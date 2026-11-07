
const { pool } = require("../config/db");
const crypto = require("crypto");

// Generate a unique 12-digit account number
const generateAccountNumber = () => {
  return crypto.randomInt(100000000000, 999999999999).toString();
};

// Create a customer account
const createAccount = async (req, res) => {
  try {
    if (req.user.role !== "account_holder") {
      return res.status(403).json({
        success: false,
        message: "Only account holders can create customer accounts"
      });
    }

    const { accountType = "savings" } = req.body;

    if (!["savings", "current"].includes(accountType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account type"
      });
    }

    let result;

    // Retry if a randomly generated account number already exists
    for (let attempt = 0; attempt < 3; attempt++) {
      const accountNumber = generateAccountNumber();

      try {
        result = await pool.query(
          `INSERT INTO accounts
           (user_id, account_number, account_type, account_kind)
           VALUES ($1, $2, $3, 'customer')
           RETURNING id, account_number, account_type,
                     account_kind, balance, status, created_at`,
          [req.user.id, accountNumber, accountType]
        );

        break;

      } catch (error) {
        if (error.code !== "23505" || attempt === 2) {
          throw error;
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      account: result.rows[0]
    });

  } catch (error) {
    console.error("Account creation error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to create account"
    });
  }
};

// Get accounts belonging to the logged-in account holder
const getMyAccounts = async (req, res) => {
  try {
    if (req.user.role !== "account_holder") {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    const result = await pool.query(
      `SELECT id, account_number, account_type,
              account_kind, balance, status, created_at
       FROM accounts
       WHERE user_id = $1
         AND account_kind = 'customer'
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      accounts: result.rows
    });

  } catch (error) {
    console.error("Fetch accounts error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to fetch accounts"
    });
  }
};

module.exports = {
  createAccount,
  getMyAccounts
};
