
const request = require("supertest");
const app = require("../server");
const { pool } = require("../config/db");

describe("Concurrent Withdrawal Safety", () => {
  let token;
  let accountId;
  let uniqueId;

  beforeAll(async () => {
    uniqueId = Date.now().toString();

    const email = `concurrency.${uniqueId}@example.com`;

    // Register a separate test user
    await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Concurrency Test User",
        email,
        password: "TestPassword123"
      })
      .expect(201);

    // Login
    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({
        email,
        password: "TestPassword123"
      })
      .expect(200);

    token = loginResponse.body.token;

    // Create a fresh test account
    const accountResponse = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${token}`)
      .send({ accountType: "savings" })
      .expect(201);

    accountId = accountResponse.body.account.id;

    // Deposit ₹100 as the starting balance
    await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId,
        amount: "100.00",
        idempotencyKey: `concurrency-deposit-${uniqueId}`
      })
      .expect(201);

  }, 30000);

  test("two simultaneous withdrawals must not create a negative balance", async () => {
    const withdrawal1 = request(app)
      .post("/api/transactions/withdraw")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId,
        amount: "80.00",
        idempotencyKey: `withdraw-a-${uniqueId}`
      });

    const withdrawal2 = request(app)
      .post("/api/transactions/withdraw")
      .set("Authorization", `Bearer ${token}`)
      .send({
        accountId,
        amount: "80.00",
        idempotencyKey: `withdraw-b-${uniqueId}`
      });

    // Send both requests simultaneously
    const responses = await Promise.all([
      withdrawal1,
      withdrawal2
    ]);

    const statuses = responses
      .map(response => response.statusCode)
      .sort();

    // Exactly one succeeds and one is refused
    expect(statuses).toEqual([201, 400]);

    // Verify final account balance
    const balanceResult = await pool.query(
      "SELECT balance FROM accounts WHERE id = $1",
      [accountId]
    );

    expect(Number(balanceResult.rows[0].balance)).toBe(20);
    expect(Number(balanceResult.rows[0].balance))
      .toBeGreaterThanOrEqual(0);
  });
});

afterAll(async () => {
  await pool.end();
});
