
const { pool } = require("../config/db");

// Administrator system overview
const getAdminOverview = async (req, res) => {
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
    console.error("Admin overview error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch system overview"
    });
  }
};

// View all registered users
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, full_name, email, role, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    return res.status(200).json({
      success: true,
      users: result.rows
    });
  } catch (error) {
    console.error("Admin users error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch users"
    });
  }
};

// View all accounts and their owners
const getAllAccounts = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.*,
        u.full_name AS owner_name,
        u.email AS owner_email
      FROM accounts a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC
    `);

    return res.status(200).json({
      success: true,
      accounts: result.rows
    });
  } catch (error) {
    console.error("Admin accounts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch accounts"
    });
  }
};

module.exports = {
  getAdminOverview,
  getAllUsers,
  getAllAccounts
};
