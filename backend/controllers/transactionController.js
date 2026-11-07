
const { pool, withTransaction } = require("../config/db");

// Validate positive amounts with up to two decimal places.
const isValidAmount = (amount) => {
  if (typeof amount !== "string" && typeof amount !== "number") {
    return false;
  }

  const value = String(amount);

  if (!/^\d+(\.\d{1,2})?$/.test(value)) {
    return false;
  }

  const [rupees] = value.split(".");

  return (
    rupees.length <= 16 &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0
  );
};

// Convert money to integer paise to avoid floating-point errors.
const toPaise = (amount) => {
  const [rupees, paise = ""] = String(amount).split(".");
  return BigInt(rupees) * 100n +
    BigInt((paise + "00").slice(0, 2));
};

const isValidId = (id) => {
  return (
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
  );
};

// Record audit events, including attempted transaction amount.
const recordAudit = async (
  userId, action, accountId, status, details, amount, ip
) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs
       (user_id, action, resource_type, resource_id,
        status, details, amount, ip_address)
       VALUES ($1, $2, 'transaction', $3, $4, $5, $6, $7)`,
      [
        userId,
        action,
        accountId || null,
        status,
        details,
        isValidAmount(amount) ? String(amount) : null,
        ip || null
      ]
    );
  } catch (error) {
    console.error("Audit logging error:", error.message);
  }
};

// Shared transaction processor.
const processMoneyMovement = async (req, res, transactionType) => {
  const { amount, idempotencyKey } = req.body;

  let fromAccountId = null;
  let toAccountId = null;

  if (transactionType === "deposit") {
    toAccountId = req.body.accountId;
  } else if (transactionType === "withdrawal") {
    fromAccountId = req.body.accountId;
  } else {
    fromAccountId = req.body.fromAccountId;
    toAccountId = req.body.toAccountId;
  }

  const auditAccountId = fromAccountId || toAccountId;

  // Validate transaction input.
  if (
    !isValidAmount(amount) ||
    typeof idempotencyKey !== "string" ||
    !idempotencyKey.trim() ||
    idempotencyKey.length > 100 ||
    (fromAccountId && !isValidId(fromAccountId)) ||
    (toAccountId && !isValidId(toAccountId))
  ) {
    await recordAudit(
      req.user.id,
      transactionType,
      auditAccountId,
      "refused",
      "Invalid transaction input",
      amount,
      req.ip
    );

    return res.status(400).json({
      success: false,
      message: "Please provide valid account IDs, amount and idempotency key"
    });
  }

  // Prevent transfers between the same account.
  if (
    transactionType === "transfer" &&
    fromAccountId === toAccountId
  ) {
    await recordAudit(
      req.user.id,
      transactionType,
      fromAccountId,
      "refused",
      "Source and destination accounts must be different",
      amount,
      req.ip
    );

    return res.status(400).json({
      success: false,
      message: "Source and destination accounts must be different"
    });
  }

  try {
    const result = await withTransaction(async (client) => {

      // Serialize requests using the same idempotency key.
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        [idempotencyKey]
      );

      // Check whether this request was already processed.
      const existingResult = await client.query(
        `SELECT id, transaction_type, from_account_id,
                to_account_id, amount, status, initiated_by, created_at
         FROM transactions
         WHERE idempotency_key = $1`,
        [idempotencyKey]
      );

      if (existingResult.rows.length > 0) {
        const old = existingResult.rows[0];

        const sameRequest =
          old.transaction_type === transactionType &&
          old.from_account_id === fromAccountId &&
          old.to_account_id === toAccountId &&
          toPaise(old.amount) === toPaise(amount) &&
          old.initiated_by === req.user.id;

        if (!sameRequest) {
          throw Object.assign(
            new Error("Idempotency key already used for another request"),
            { statusCode: 409 }
          );
        }

        return {
          duplicate: true,
          transaction: old
        };
      }

      let platformAccount = null;

      // Deposits and withdrawals use the platform reserve account.
      if (transactionType !== "transfer") {
        const platformResult = await client.query(
          `SELECT id, balance
           FROM accounts
           WHERE account_number = 'PLATFORM-CLEARING'
             AND account_kind = 'platform'
             AND status = 'active'
           FOR UPDATE`
        );

        if (platformResult.rows.length === 0) {
          throw Object.assign(
            new Error("Platform clearing account is not configured"),
            { statusCode: 500 }
          );
        }

        platformAccount = platformResult.rows[0];
      }

      // Lock all involved accounts in a consistent order.
      const accountIds = [
        fromAccountId,
        toAccountId,
        platformAccount?.id
      ].filter(Boolean);

      const accountsResult = await client.query(
        `SELECT id, user_id, account_kind, balance, status
         FROM accounts
         WHERE id = ANY($1::uuid[])
         ORDER BY id
         FOR UPDATE`,
        [accountIds]
      );

      const accounts = new Map(
        accountsResult.rows.map((account) => [account.id, account])
      );

      const source = fromAccountId
        ? accounts.get(fromAccountId)
        : null;

      const destination = toAccountId
        ? accounts.get(toAccountId)
        : null;

      const lockedPlatform = platformAccount
        ? accounts.get(platformAccount.id)
        : null;

      // Deposit validation.
      if (transactionType === "deposit") {
        if (
          !destination ||
          destination.user_id !== req.user.id ||
          destination.account_kind !== "customer" ||
          destination.status !== "active"
        ) {
          throw Object.assign(
            new Error("Destination account not found or access denied"),
            { statusCode: 404 }
          );
        }
      }

      // Withdrawal validation.
      if (transactionType === "withdrawal") {
        if (
          !source ||
          source.user_id !== req.user.id ||
          source.account_kind !== "customer" ||
          source.status !== "active"
        ) {
          throw Object.assign(
            new Error("Source account not found or access denied"),
            { statusCode: 404 }
          );
        }

        if (toPaise(source.balance) < toPaise(amount)) {
          throw Object.assign(
            new Error("Insufficient customer balance"),
            { statusCode: 400 }
          );
        }

        if (
          !lockedPlatform ||
          toPaise(lockedPlatform.balance) < toPaise(amount)
        ) {
          throw Object.assign(
            new Error("Insufficient platform reserve for withdrawal"),
            { statusCode: 400 }
          );
        }
      }

      // Transfer validation.
      if (transactionType === "transfer") {
        if (
          !source ||
          source.user_id !== req.user.id ||
          source.account_kind !== "customer" ||
          source.status !== "active"
        ) {
          throw Object.assign(
            new Error("Source account not found or access denied"),
            { statusCode: 404 }
          );
        }

        if (
          !destination ||
          destination.account_kind !== "customer" ||
          destination.status !== "active"
        ) {
          throw Object.assign(
            new Error("Destination account not found"),
            { statusCode: 404 }
          );
        }

        if (toPaise(source.balance) < toPaise(amount)) {
          throw Object.assign(
            new Error("Insufficient balance"),
            { statusCode: 400 }
          );
        }
      }

      // Create transaction record.
      const transactionResult = await client.query(
        `INSERT INTO transactions
         (idempotency_key, transaction_type, from_account_id,
          to_account_id, amount, status, initiated_by)
         VALUES ($1, $2, $3, $4, $5, 'completed', $6)
         RETURNING id, transaction_type, from_account_id,
                   to_account_id, amount, status, initiated_by, created_at`,
        [
          idempotencyKey,
          transactionType,
          fromAccountId,
          toAccountId,
          String(amount),
          req.user.id
        ]
      );

      const transaction = transactionResult.rows[0];

      // DEPOSIT:
      // Platform reserve increases; customer balance increases.
      // Ledger: debit platform, credit customer.
      if (transactionType === "deposit") {
        await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE id = $2
             AND account_kind = 'platform'`,
          [String(amount), platformAccount.id]
        );

        const creditResult = await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE id = $2
             AND account_kind = 'customer'`,
          [String(amount), toAccountId]
        );

        if (creditResult.rowCount !== 1) {
          throw new Error("Unable to credit destination account");
        }

        await client.query(
          `INSERT INTO ledger_entries
           (transaction_id, account_id, entry_type, amount)
           VALUES
           ($1, $2, 'debit', $4),
           ($1, $3, 'credit', $4)`,
          [
            transaction.id,
            platformAccount.id,
            toAccountId,
            String(amount)
          ]
        );
      }

      // WITHDRAWAL:
      // Customer balance decreases; platform reserve decreases.
      // Ledger: debit customer, credit platform.
      if (transactionType === "withdrawal") {
        const debitResult = await client.query(
          `UPDATE accounts
           SET balance = balance - $1
           WHERE id = $2
             AND account_kind = 'customer'
             AND balance >= $1`,
          [String(amount), fromAccountId]
        );

        if (debitResult.rowCount !== 1) {
          throw Object.assign(
            new Error("Insufficient customer balance"),
            { statusCode: 400 }
          );
        }

        const reserveResult = await client.query(
          `UPDATE accounts
           SET balance = balance - $1
           WHERE id = $2
             AND account_kind = 'platform'
             AND balance >= $1`,
          [String(amount), platformAccount.id]
        );

        if (reserveResult.rowCount !== 1) {
          throw Object.assign(
            new Error("Insufficient platform reserve for withdrawal"),
            { statusCode: 400 }
          );
        }

        await client.query(
          `INSERT INTO ledger_entries
           (transaction_id, account_id, entry_type, amount)
           VALUES
           ($1, $2, 'debit', $4),
           ($1, $3, 'credit', $4)`,
          [
            transaction.id,
            fromAccountId,
            platformAccount.id,
            String(amount)
          ]
        );
      }

      // TRANSFER:
      // Debit source customer, credit destination customer.
      if (transactionType === "transfer") {
        const debitResult = await client.query(
          `UPDATE accounts
           SET balance = balance - $1
           WHERE id = $2
             AND account_kind = 'customer'
             AND balance >= $1`,
          [String(amount), fromAccountId]
        );

        if (debitResult.rowCount !== 1) {
          throw Object.assign(
            new Error("Insufficient balance"),
            { statusCode: 400 }
          );
        }

        const creditResult = await client.query(
          `UPDATE accounts
           SET balance = balance + $1
           WHERE id = $2
             AND account_kind = 'customer'`,
          [String(amount), toAccountId]
        );

        if (creditResult.rowCount !== 1) {
          throw new Error("Unable to credit destination account");
        }

        await client.query(
          `INSERT INTO ledger_entries
           (transaction_id, account_id, entry_type, amount)
           VALUES
           ($1, $2, 'debit', $4),
           ($1, $3, 'credit', $4)`,
          [
            transaction.id,
            fromAccountId,
            toAccountId,
            String(amount)
          ]
        );
      }

      // Record successful transaction in audit log.
      await client.query(
        `INSERT INTO audit_logs
         (user_id, action, resource_type, resource_id,
          status, details, amount, ip_address)
         VALUES ($1, $2, 'transaction', $3, 'success', $4, $5, $6)`,
        [
          req.user.id,
          transactionType,
          auditAccountId,
          `Transaction ${transaction.id} completed`,
          String(amount),
          req.ip
        ]
      );

      return {
        duplicate: false,
        transaction
      };
    });

    return res.status(result.duplicate ? 200 : 201).json({
      success: true,
      message: result.duplicate
        ? "Request already processed"
        : `${transactionType} successful`,
      transaction: result.transaction
    });

  } catch (error) {
    const statusCode = error.statusCode || 500;

    await recordAudit(
      req.user.id,
      transactionType,
      auditAccountId,
      statusCode === 500 ? "failed" : "refused",
      error.message,
      amount,
      req.ip
    );

    console.error(`${transactionType} error:`, error.message);

    return res.status(statusCode).json({
      success: false,
      message: statusCode === 500
        ? "Transaction failed"
        : error.message
    });
  }
};

// Deposit money.
const deposit = (req, res) =>
  processMoneyMovement(req, res, "deposit");

// Withdraw money.
const withdraw = (req, res) =>
  processMoneyMovement(req, res, "withdrawal");

// Transfer money.
const transfer = (req, res) =>
  processMoneyMovement(req, res, "transfer");

// Get current user's transaction history.
const getMyTransactions = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         t.id,
         t.transaction_type,
         t.amount,
         t.status,
         t.created_at,
         t.description,
         u.full_name AS initiated_by
       FROM transactions t
       JOIN users u ON u.id = t.initiated_by
       WHERE
         t.from_account_id IN (
           SELECT id FROM accounts WHERE user_id = $1
         )
         OR
         t.to_account_id IN (
           SELECT id FROM accounts WHERE user_id = $1
         )
       ORDER BY t.created_at DESC
       LIMIT 10`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      transactions: result.rows
    });

  } catch (error) {
    console.error("Transaction history error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch transactions"
    });
  }
};

module.exports = {
  deposit,
  withdraw,
  transfer,
  getMyTransactions
};
