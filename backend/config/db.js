const { Pool } = require("pg");
require("dotenv").config();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Reusable database transaction helper
const withTransaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await callback(client);

    await client.query("COMMIT");

    return result;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
};

pool.on("connect", () => {
  console.log("Database connection established");
});

pool.on("error", (error) => {
  console.error("Unexpected database error:", error.message);
});

module.exports = {
  pool,
  withTransaction
};