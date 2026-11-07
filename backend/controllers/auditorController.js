const { pool } = require("../config/db");

// Auditor overview: read-only summary of the system
const getOverview = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM accounts) AS total_accounts,
        (SELECT COUNT(*) FROM transactions) AS total_transactions,
        (SELECT COUNT(*) FROM ledger_entries) AS total_ledger_entries,
        (SELECT COUNT(*) FROM audit_logs) AS total_audit_logs
    `);

    return res.status(200).json({
      success: true,
      overview: result.rows[0]
    });
  } catch (error) {
    console.error("Auditor overview error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch auditor overview"
    });
  }
};

// View all transactions
const getAllTransactions = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM transactions
      ORDER BY created_at DESC
      LIMIT 200
    `);

    return res.status(200).json({
      success: true,
      transactions: result.rows
    });
  } catch (error) {
    console.error("Auditor transactions error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch transactions"
    });
  }
};

// View all ledger entries
const getAllLedgerEntries = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM ledger_entries
      ORDER BY created_at DESC
      LIMIT 500
    `);

    return res.status(200).json({
      success: true,
      ledgerEntries: result.rows
    });
  } catch (error) {
    console.error("Auditor ledger error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch ledger entries"
    });
  }
};

// View audit logs
const getAllAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 500
    `);

    return res.status(200).json({
      success: true,
      auditLogs: result.rows
    });
  } catch (error) {
    console.error("Auditor audit logs error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Unable to fetch audit logs"
    });
  }
};

module.exports = {
  getOverview,
  getAllTransactions,
  getAllLedgerEntries,
  getAllAuditLogs
};