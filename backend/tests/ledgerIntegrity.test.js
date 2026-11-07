
const request = require("supertest");
const app = require("../server");
const { pool } = require("../config/db");

describe("Ledger Integrity and Tampering Protection", () => {
  let token;
  let accountId;
  let transactionId;
  let uniqueId;

  beforeAll(async () => {
    uniqueId = Date.now().toString();
    const email = `ledger.${uniqueId}@example.com`;

    await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Ledger Integrity User",
        email,
        password: "TestPassword123"
      })
      .expect(201);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "TestPassword123" })
      .expect(200);

    token = login.body.token;

    const account = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ accountType: "savings" })
      .expect(201);

    accountId = account.body.account.id;

    const deposit = await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId,
        amount: "25.00",
        idempotencyKey: `ledger-deposit-${uniqueId}`
      })
      .expect(201);

    transactionId = deposit.body.transaction.id;
  });

  test("every completed transaction must have two equal ledger entries", async () => {
    const result = await pool.query(
      `SELECT entry_type, amount
       FROM ledger_entries
       WHERE transaction_id = $1`,
      [transactionId]
    );

    expect(result.rows).toHaveLength(2);

    const debit = result.rows.find(row => row.entry_type === "debit");
    const credit = result.rows.find(row => row.entry_type === "credit");

    expect(debit).toBeDefined();
    expect(credit).toBeDefined();
    expect(Number(debit.amount)).toBe(Number(credit.amount));
    expect(Number(debit.amount)).toBe(25);
  });

  test("ledger entries must reject modification", async () => {
    await expect(
      pool.query(
        `UPDATE ledger_entries
         SET amount = amount + 1
         WHERE transaction_id = $1`,
        [transactionId]
      )
    ).rejects.toThrow();

    const result = await pool.query(
      `SELECT amount FROM ledger_entries
       WHERE transaction_id = $1`,
      [transactionId]
    );

    expect(result.rows).toHaveLength(2);
    expect(result.rows.every(row => Number(row.amount) === 25)).toBe(true);
  });

  test("completed transactions must reject deletion", async () => {
    await expect(
      pool.query(
        "DELETE FROM transactions WHERE id = $1",
        [transactionId]
      )
    ).rejects.toThrow();

    const result = await pool.query(
      "SELECT id FROM transactions WHERE id = $1",
      [transactionId]
    );

    expect(result.rows).toHaveLength(1);
  });
});

afterAll(async () => {
  await pool.end();
});
