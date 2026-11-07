
const request = require("supertest");
const app = require("../server");
const { pool } = require("../config/db");

describe("Transaction Idempotency", () => {
  let token;
  let accountId;
  let idempotencyKey;

  beforeAll(async () => {
    const uniqueId = `${Date.now()}`;

    idempotencyKey = `test-deposit-${uniqueId}`;

    // Register a dedicated test user
    await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "LedgerLine Test User",
        email: `ledgerline.test.${uniqueId}@example.com`,
        password: "TestPassword123"
      })
      .expect(201);

    // Log in
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email: `ledgerline.test.${uniqueId}@example.com`,
        password: "TestPassword123"
      })
      .expect(200);

    token = loginResponse.body.token;

    // Create a dedicated test account
    const accountResponse = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ accountType: "savings" })
      .expect(201);

    accountId = accountResponse.body.account.id;
  });

  test("replaying the same deposit must not create a second transaction", async () => {
    const depositRequest = {
      accountId,
      amount: "10.00",
      idempotencyKey
    };

    // First request
    const firstResponse = await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send(depositRequest);

    expect(firstResponse.statusCode).toBe(201);
    expect(firstResponse.body.success).toBe(true);

    // Replay the exact same request
    const secondResponse = await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send(depositRequest);

    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.body.success).toBe(true);
    expect(secondResponse.body.message).toBe("Request already processed");

    // Both responses must refer to the same transaction
    expect(secondResponse.body.transaction.id).toBe(
      firstResponse.body.transaction.id
    );

    // Verify database contains only one transaction for this key
    const transactionResult = await pool.query(
      `SELECT COUNT(*) AS count
       FROM transactions
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    expect(Number(transactionResult.rows[0].count)).toBe(1);

    // Verify account balance was credited only once
    const balanceResult = await pool.query(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId]
    );

    expect(Number(balanceResult.rows[0].balance)).toBe(10);
  });

  afterAll(async () => {
    await pool.end();
  });
});
