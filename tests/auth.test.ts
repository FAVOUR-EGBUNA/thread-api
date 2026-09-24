import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import app from "../src/app.js";
import { db } from "../src/prisma/db.js";

const testUser = {
  name: "Automated Auth Test",
  email: "automated-auth-test@thread.dev",
  password: "Test1234!",
};

const deleteTestUser = async () => {
  const existingUser = await db.orm.public.User.where({
    email: testUser.email,
  }).first();

  if (!existingUser) {
    return;
  }

  await db.orm.public.User.where({
    id: existingUser.id,
  }).delete();
};

describe("Auth API", () => {
  beforeAll(async () => {
    await deleteTestUser();
  });

  afterAll(async () => {
    await deleteTestUser();
  });

  it("registers a new user", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Account created successfully");

    expect(response.body.data.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
    });

    expect(response.body.data.user.id).toEqual(expect.any(Number));

    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate registration", async () => {
    const response = await request(app)
      .post("/api/v1/auth/register")
      .send(testUser);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      success: false,
      message: "An account with this email already exists",
    });
  });

  it("rejects invalid registration data", async () => {
    const response = await request(app).post("/api/v1/auth/register").send({
      name: "A",
      email: "not-an-email",
      password: "weak",
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Validation failed");
    expect(response.body.errors).toBeDefined();
  });

  it("logs in with valid credentials", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe("Login successful");

    expect(response.body.data.token).toEqual(expect.any(String));

    expect(response.body.data.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
    });

    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an incorrect password", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({
      email: testUser.email,
      password: "WrongPassword123!",
    });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: "Invalid email or password",
    });
  });

  it("returns the authenticated user from /me", async () => {
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(loginResponse.status).toBe(200);

    const token = loginResponse.body.data.token;

    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    expect(response.body.data.user).toMatchObject({
      name: testUser.name,
      email: testUser.email,
    });

    expect(response.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("rejects /me without a token", async () => {
    const response = await request(app).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });

  it("rejects /me with an invalid token", async () => {
    const response = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer definitely-not-a-valid-token");

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
  });
});
