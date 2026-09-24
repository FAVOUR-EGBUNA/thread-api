import "dotenv/config";
import postgres from "@prisma/orm-postgres/runtime";

import type { Contract } from "./contract.d.js";
import contractJson from "./contract.json" with { type: "json" };

const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === "test") {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;

    if (!testDatabaseUrl) {
      throw new Error("TEST_DATABASE_URL is required when NODE_ENV=test.");
    }

    return testDatabaseUrl;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return databaseUrl;
};

export const db = postgres<Contract>({
  contractJson,
  url: getDatabaseUrl(),
});

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
