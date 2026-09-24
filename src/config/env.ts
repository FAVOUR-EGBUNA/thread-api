import { z } from "zod";

const baseEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1).optional(),

  TEST_DATABASE_URL: z.string().min(1).optional(),

  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  JWT_EXPIRES_IN: z.string().min(1).default("7d"),

  CLIENT_URL: z.string().url().optional().or(z.literal("")),
});

const envSchema = baseEnvSchema.superRefine((data, ctx) => {
  if (data.NODE_ENV === "test" && !data.TEST_DATABASE_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["TEST_DATABASE_URL"],
      message: "TEST_DATABASE_URL is required when NODE_ENV=test",
    });
  }

  if (data.NODE_ENV !== "test" && !data.DATABASE_URL) {
    ctx.addIssue({
      code: "custom",
      path: ["DATABASE_URL"],
      message: "DATABASE_URL is required outside the test environment",
    });
  }
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment configuration:");

  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }

  process.exit(1);
}

export const env = result.data;
