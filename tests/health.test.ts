import request from "supertest";
import { describe, expect, it } from "vitest";

import app from "../src/app.js";

describe("Health endpoint", () => {
  it("returns 200 when the API is healthy", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: "THREAD API is running",
    });
  });
});
