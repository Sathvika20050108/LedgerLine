
const { pool } = require("../config/db");

// Get statement for one account
const getAccountStatement = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Verify account ownership
    const accountResult = await pool.query(
      `SELECT id, account_number, account_type, balance, status
       FROM accounts
       WHERE id = $1
         AND user_id = $2
         AND account_kind = 'customer'`,
      [accountId, req.user.id]
    );

    if (accountResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found or access denied"
      });
    }

    const account = accountResult.rows[0];

    // Fetch completed ledger entries
    const ledgerResult = await pool.query(
      `SELECT
          le.id,
          le.entry_type,
          le.amount,
          le.created_at,
          t.id AS transaction_id,
          t.transaction_type,
          t.description,
          t.initiated_by,
          u.full_name AS initiated_by_name,
          u.email AS initiated_by_email
       FROM ledger_entries le
       JOIN transactions t ON t.id = le.transaction_id
       JOIN users u ON u.id = t.initiated_by
       WHERE le.account_id = $1
         AND t.status = 'completed'
       ORDER BY le.created_at ASC, le.id ASC`,
      [accountId]
    );

    // Fetch refused and failed attempts, including attempted amount
    const auditResult = await pool.query(
      `SELECT
          a.id,
          a.action,
          a.status,
          a.details,
          a.amount,
          a.created_at,
          a.user_id,
          u.full_name AS initiated_by_name,
          u.email AS initiated_by_email
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       WHERE a.resource_type = 'transaction'
         AND a.resource_id = $1
         AND a.status IN ('refused', 'failed')
       ORDER BY a.created_at ASC, a.id ASC`,
      [accountId]
    );

    // Combine successful and refused records
    const records = [
      ...ledgerResult.rows.map((entry) => ({
        id: entry.id,
        transactionId: entry.transaction_id,
        type: entry.transaction_type,
        entryType: entry.entry_type,
        amount: Number(entry.amount),
        status: "completed",
        initiatedBy: entry.initiated_by_name,
        initiatedByEmail: entry.initiated_by_email,
        date: entry.created_at,
        description: entry.description
      })),

      ...auditResult.rows.map((entry) => ({
        id: entry.id,
        transactionId: null,
        type: entry.action,
        entryType: null,
        amount:
          entry.amount === null
            ? null
            : Number(entry.amount),
        status: entry.status,
        initiatedBy: entry.initiated_by_name || "Unknown user",
        initiatedByEmail: entry.initiated_by_email || null,
        date: entry.created_at,
        description: entry.details
      }))
    ];

    // Sort all records chronologically
    records.sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );

    // Calculate running balance using completed entries only
    let runningBalance = 0;

    const statement = records.map((entry) => {
      if (entry.status === "completed") {
        if (entry.entryType === "credit") {
          runningBalance += entry.amount;
        } else if (entry.entryType === "debit") {
          runningBalance -= entry.amount;
        }
      }

      return {
        ...entry,
        amount:
          entry.amount === null
            ? null
            : entry.amount.toFixed(2),
        runningBalance: runningBalance.toFixed(2)
      };
    });

    return res.status(200).json({
      success: true,
      account: {
        accountNumber: account.account_number,
        accountType: account.account_type,
        currentBalance: Number(account.balance).toFixed(2),
        status: account.status
      },
      statement
    });

  } catch (error) {
    console.error("Statement error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch account statement"
    });
  }
};

module.exports = {
  getAccountStatement
};
