import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

import { db } from "../prisma/db.js";
import type { RegisterInput, LoginInput } from "../schemas/auth.schema.js";

const getJwtConfig = () => {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "7d";

  if (!secret) {
    throw new Error("JWT_SECRET_NOT_CONFIGURED");
  }

  return {
    secret,
    expiresIn: expiresIn as SignOptions["expiresIn"],
  };
};

export const registerUser = async (input: RegisterInput) => {
  const { name, email, password } = input;

  const existingUser = await db.orm.public.User.where({
    email,
  }).first();

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.orm.public.User.create({
    name,
    email,
    passwordHash,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
};

export const loginUser = async (input: LoginInput) => {
  const { email, password } = input;

  const user = await db.orm.public.User.where({
    email,
  }).first();

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const { secret, expiresIn } = getJwtConfig();

  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
    },
    secret,
    {
      expiresIn,
      algorithm: "HS256",
    },
  );

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    },
  };
};

export const getCurrentUser = async (userId: number) => {
  const user = await db.orm.public.User.where({
    id: userId,
  }).first();

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};
