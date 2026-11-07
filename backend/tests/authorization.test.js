
const request = require("supertest");
const app = require("../server");

describe("LedgerLine Authorization", () => {
  test("should reject requests without an authentication token", async () => {
    const response = await request(app).get("/api/admin/overview");

    expect(response.statusCode).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
