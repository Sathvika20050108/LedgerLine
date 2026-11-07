
const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const { pool } = require("../config/db");

let tokens = {};

beforeAll(async () => {
  const result = await pool.query(
    "SELECT id, role FROM users WHERE role IN ('account_holder', 'administrator', 'auditor')"
  );

  for (const user of result.rows) {
    tokens[user.role] = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
  }

  expect(tokens.account_holder).toBeDefined();
  expect(tokens.administrator).toBeDefined();
  expect(tokens.auditor).toBeDefined();
});

describe("Role-based authorization", () => {
  test("account holder cannot access administrator overview", async () => {
    const response = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${tokens.account_holder}`);

    expect(response.statusCode).toBe(403);
  });

  test("auditor cannot perform a deposit", async () => {
    const response = await request(app)
      .post("/api/transactions/deposit")
      .set("Authorization", `Bearer ${tokens.auditor}`)
      .send({});

    expect(response.statusCode).toBe(403);
  });

  test("administrator cannot access account-holder account routes", async () => {
    const response = await request(app)
      .get("/api/accounts")
      .set("Authorization", `Bearer ${tokens.administrator}`);

    expect(response.statusCode).toBe(403);
  });
});
afterAll(async () => {
  await pool.end();
});