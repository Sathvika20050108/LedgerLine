
const request = require("supertest");
const app = require("../server");

describe("LedgerLine API Health Check", () => {
  test("should return API running status", async () => {
    const response = await request(app).get("/");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("LedgerLine API is running!");
  });

  test("should return healthy status", async () => {
    const response = await request(app).get("/api/health");

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("healthy");
  });
});
