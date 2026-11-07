
const request = require("supertest");
const app = require("../server");
const { pool } = require("../config/db");

describe("Unauthorized Transfer Protection", () => {
  let ownerToken;
  let attackerToken;
  let ownerAccountId;
  let attackerAccountId;
  let uniqueId;

  beforeAll(async () => {
    uniqueId = Date.now().toString();

    const ownerEmail = `transfer.owner.${uniqueId}@example.com`;
    const attackerEmail = `transfer.attacker.${uniqueId}@example.com`;

    // Register account owner
    await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Transfer Account Owner",
        email: ownerEmail,
        password: "TestPassword123"
      })
      .expect(201);

    // Register attacker
    await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Unauthorized Transfer User",
        email: attackerEmail,
        password: "TestPassword123"
      })
      .expect(201);

    // Login owner
    const ownerLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: ownerEmail,
        password: "TestPassword123"
      })
      .expect(200);

    ownerToken = ownerLogin.body.token;

    // Login attacker
    const attackerLogin = await request(app)
      .post("/api/auth/login")
      .send({
        email: attackerEmail,
        password: "TestPassword123"
      })
      .expect(200);

    attackerToken = attackerLogin.body.token;

    // Create owner's account
    const ownerAccount = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({ accountType: "savings" })
      .expect(201);

    ownerAccountId = ownerAccount.body.account.id;

    // Create attacker's account
    const attackerAccount = await request(app)
      .post("/api/accounts")
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({ accountType: "savings" })
      .expect(201);

    attackerAccountId = attackerAccount.body.account.id;

    // Deposit ₹50 into owner's account
    await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send({
        accountId: ownerAccountId,
        amount: "50.00",
        idempotencyKey: `owner-deposit-${uniqueId}`
      })
      .expect(201);

  }, 30000);

  test("a user must not transfer money from another user's account", async () => {
    const response = await request(app)
      .post("/api/transactions/transfer")
      .set("Authorization", `Bearer ${attackerToken}`)
      .send({
        fromAccountId: ownerAccountId,
        toAccountId: attackerAccountId,
        amount: "30.00",
        idempotencyKey: `unauthorized-transfer-${uniqueId}`
      });

    // Unauthorized source account access must be rejected
    expect(response.statusCode).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe(
      "Source account not found or access denied"
    );

    // Owner's balance must remain unchanged
    const ownerBalance = await pool.query(
      "SELECT balance FROM accounts WHERE id = $1",
      [ownerAccountId]
    );

    expect(Number(ownerBalance.rows[0].balance)).toBe(50);

    // Attacker must not receive any money
    const attackerBalance = await pool.query(
      "SELECT balance FROM accounts WHERE id = $1",
      [attackerAccountId]
    );

    expect(Number(attackerBalance.rows[0].balance)).toBe(0);
  });
});

afterAll(async () => {
  await pool.end();
});
