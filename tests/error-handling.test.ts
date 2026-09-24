import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";

describe("Global API error handling", () => {
  it("returns a consistent 404 response for an unknown API route", async () => {
    const response = await request(app).get(
      "/api/v1/this-route-does-not-exist",
    );

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
    });
  });

  it("returns a consistent 404 response for an unknown non-API route", async () => {
    const response = await request(app).get("/this-route-does-not-exist");

    expect(response.status).toBe(404);

    expect(response.body).toEqual({
      success: false,
      message: "Route not found",
    });
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email":"test@example.com","password":');

    expect(response.status).toBe(400);

    expect(response.body).toEqual({
      success: false,
      message: "Invalid JSON payload",
    });
  });

  it("returns 403 for a disallowed CORS origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://not-allowed.example.com");

    expect(response.status).toBe(403);

    expect(response.body).toEqual({
      success: false,
      message: "Origin not allowed",
    });
  });

  it("allows the local frontend CORS origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);

    expect(response.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );

    expect(response.body).toEqual({
      success: true,
      message: "THREAD API is running",
    });
  });
});
