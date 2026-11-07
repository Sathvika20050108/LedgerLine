
const { pool, withTransaction } = require("../config/db");

const isValidId = (id) =>
  typeof id === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);

const reverseTransaction = async (req, res) => {
  const { transactionId } = req.params;
  const { idempotencyKey } = req.body;
  const adminId = req.user.id;

  if (
    !isValidId(transactionId) ||
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim() ||
    idempotencyKey.length > 100
  ) {
    return res.status(400).json({
      success: false,
      message: "Valid transaction ID and idempotency key are required"
    });
  }

  try {
    const result = await withTransaction(async (client) => {
      // Serialize requests using the same idempotency key.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [idempotencyKey]
      );

      // Check whether this reversal request was already processed.
      const duplicateResult = await client.query(
        `SELECT id, transaction_type, original_transaction_id,
                amount, status, initiated_by, created_at
         FROM transactions
         WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (duplicateResult.rows.length > 0) {
        const existing = duplicateResult.rows[0];

        if (
          existing.transaction_type === "reversal" &&
          existing.original_transaction_id === transactionId &&
          existing.initiated_by === adminId
        ) {
          return {
            duplicate: true,
            transaction: existing
          };
        }

        throw Object.assign(
          new Error("Idempotency key already used for another request"),
          { statusCode: 409 }
        );
      }

      // Lock the original transaction.
      const originalResult = await client.query(
        `SELECT id, transaction_type, from_account_id,
                to_account_id, amount, status, initiated_by
         FROM transactions
         WHERE id = $1
         FOR UPDATE`,
        [transactionId]
      );

      if (originalResult.rows.length === 0) {
        throw Object.assign(
          new Error("Original transaction not found"),
          { statusCode: 404 }
        );
      }

      const original = originalResult.rows[0];

      if (
        original.status !== "completed" ||
        !["deposit", "withdrawal", "transfer"].includes(
          original.transaction_type
        )
      ) {
        throw Object.assign(
          new Error("Only completed original transactions can be reversed"),
          { statusCode: 400 }
        );
      }

      // Check whether another administrator already reversed it.
      const previousReversal = await client.query(
        `SELECT id
         FROM transactions
         WHERE original_transaction_id = $1`,
        [transactionId]
      );

      if (previousReversal.rows.length > 0) {
        throw Object.assign(
          new Error("This transaction has already been reversed"),
          { statusCode: 409 }
        );
      }

      // Retrieve the original double-entry ledger records.
      const entriesResult = await client.query(
        `SELECT account_id, entry_type, amount
         FROM ledger_entries
         WHERE transaction_id = $1
         ORDER BY account_id
         FOR UPDATE`,
        [transactionId]
      );

      const originalEntries = entriesResult.rows;

      if (
        originalEntries.length !== 2 ||
        originalEntries.filter(e => e.entry_type === "debit").length !== 1 ||
        originalEntries.filter(e => e.entry_type === "credit").length !== 1 ||
        originalEntries.some(
          e => Number(e.amount) !== Number(original.amount)
        )
      ) {
        throw Object.assign(
          new Error("Original ledger entries are invalid"),
          { statusCode: 409 }
        );
      }

      const debitEntry = originalEntries.find(
        e => e.entry_type === "debit"
      );

      const creditEntry = originalEntries.find(
        e => e.entry_type === "credit"
      );

      const amount = String(original.amount);

      // Reverse the direction of the original movement.
      const reversalFromAccountId = creditEntry.account_id;
      const reversalToAccountId = debitEntry.account_id;

      // Lock all affected accounts in a consistent order.
      const accountIds = originalEntries
        .map(e => e.account_id)
        .sort();

      const lockedAccounts = await client.query(
        `SELECT id, balance, account_kind, status
         FROM accounts
         WHERE id = ANY($1::uuid[])
         ORDER BY id
         FOR UPDATE`,
        [accountIds]
      );

      if (lockedAccounts.rows.length !== 2) {
        throw Object.assign(
          new Error("One or more original accounts are unavailable"),
          { statusCode: 409 }
        );
      }

      const accounts = new Map(
        lockedAccounts.rows.map(a => [a.id, a])
      );

      // Do not allow a reversal to create a negative customer balance.
      if (original.transaction_type === "deposit") {
        const platform = accounts.get(debitEntry.account_id);
        const customer = accounts.get(creditEntry.account_id);

        if (
          !platform ||
          !customer ||
          platform.account_kind !== "platform" ||
          customer.account_kind !== "customer"
        ) {
          throw Object.assign(
            new Error("Invalid original deposit accounts"),
            { statusCode: 409 }
          );
        }

        if (
          Number(platform.balance) < Number(amount) ||
          Number(customer.balance) < Number(amount)
        ) {
          throw Object.assign(
            new Error("Insufficient balance to reverse this deposit"),
            { statusCode: 400 }
          );
        }

        await client.query(
          `UPDATE accounts
           SET balance = balance - $1
           WHERE id = $2
             AND balance >= $1`,
          [amount, platform.id]
        );

        await client.query(
          `UPDATE accounts
           SET balance = balance - $1
           WHERE id = $2
             AND account_kind = 'customer'
             AND balance >= $1`,
          [amount, customer.id]
        );
      }

      if (original.transaction_type === "withdrawal") {
        const customer = accounts.get(debitEntry.account_id);
        const platform = accounts.get(creditEntry.account_id);

        if (
          !customer ||
          !platform ||
          customer.account_kind !== "customer" ||
          platform.account_kind !== "platform"
        ) {
          throw Object.assign(
            new Error("Invalid original withdrawal accounts"),
            { statusCode: 409 }
          );
        }

        await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE id = $2`,
          [amount, customer.id]
        );

        await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE id = $2`,
          [amount, platform.id]
        );
      }

      if (original.transaction_type === "transfer") {
        const source = accounts.get(original.from_account_id);
        const destination = accounts.get(original.to_account_id);

        if (
          !source ||
          !destination ||
          source.account_kind !== "customer" ||
          destination.account_kind !== "customer"
        ) {
          throw Object.assign(
            new Error("Invalid original transfer accounts"),
            { statusCode: 409 }
          );
        }

        if (Number(destination.balance) < Number(amount)) {
          throw Object.assign(
            new Error("Insufficient destination balance to reverse transfer"),
            { statusCode: 400 }
          );
        }

        await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE id = $2`,
          [amount, source.id]
        );

        const debitResult = await client.query(
          `UPDATE accounts
           SET balance = balance - $1
           WHERE id = $2
             AND account_kind = 'customer'
             AND balance >= $1`,
          [amount, destination.id]
        );

        if (debitResult.rowCount !== 1) {
          throw Object.assign(
            new Error("Unable to debit destination account"),
            { statusCode: 400 }
          );
        }
      }

      // Create a new reversal transaction.
      // The original transaction is never modified.
      const reversalResult = await client.query(
        `INSERT INTO transactions
         (
           idempotency_key,
           transaction_type,
           from_account_id,
           to_account_id,
           amount,
           status,
           initiated_by,
           description,
           original_transaction_id
         )
         VALUES ($1, 'reversal', $2, $3, $4, 'completed', $5, $6, $7)
         RETURNING id, transaction_type, from_account_id,
                   to_account_id, amount, status,
                   initiated_by, original_transaction_id, created_at`,
        [
          idempotencyKey,
          reversalFromAccountId,
          reversalToAccountId,
          amount,
          adminId,
          `Reversal of transaction ${transactionId}`,
          transactionId
        ]
      );

      const reversal = reversalResult.rows[0];

      // Add two NEW ledger entries with opposite directions.
      await client.query(
        `INSERT INTO ledger_entries
         (transaction_id, account_id, entry_type, amount)
         VALUES
         ($1, $2, 'credit', $4),
         ($1, $3, 'debit', $4)`,
        [
          reversal.id,
          debitEntry.account_id,
          creditEntry.account_id,
          amount
        ]
      );

      // Record the successful reversal.
      await client.query(
        `INSERT INTO audit_logs
         (user_id, action, resource_type, resource_id,
          status, details, amount, ip_address)
         VALUES ($1, 'reversal', 'transaction', $2,
                 'success', $3, $4, $5)`,
        [
          adminId,
          transactionId,
          `Transaction ${transactionId} reversed by ${reversal.id}`,
          amount,
          req.ip
        ]
      );

      return {
        duplicate: false,
        transaction: reversal
      };
    });

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "Reversal request already processed"
        : "Transaction reversed successfully",
      transaction: result.transaction
    });

  } catch (error) {
    const statusCode = error.statusCode || 500;

    // Record refused or failed reversal attempts.
    try {
      await pool.query(
        `INSERT INTO audit_logs
         (user_id, action, resource_type, resource_id,
          status, details, ip_address)
         VALUES ($1, 'reversal', 'transaction', $2, $3, $4, $5)`,
        [
          adminId,
          isValidId(transactionId) ? transactionId : null,
          statusCode === 500 ? "failed" : "refused",
          error.message,
          req.ip
        ]
      );
    } catch (auditError) {
      console.error("Reversal audit logging error:", auditError.message);
    }

    console.error("Reversal error:", error.message);

    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500
        ? "Unable to reverse transaction"
        : error.message
    });
  }
};

module.exports = { reverseTransaction };
