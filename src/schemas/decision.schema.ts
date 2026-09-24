import { z } from "zod";

export const decisionStatusSchema = z.enum([
  "PROPOSED",
  "ACCEPTED",
  "REJECTED",
  "SUPERSEDED",
]);

export const createDecisionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Decision title must be at least 3 characters")
    .max(150, "Decision title must not exceed 150 characters"),

  context: z.string().trim().min(10, "Context must be at least 10 characters"),

  decision: z.string().trim().min(5, "Decision must be at least 5 characters"),

  reasoning: z.string().trim().optional(),

  status: decisionStatusSchema.default("PROPOSED"),
});

export const updateDecisionSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, "Decision title must be at least 3 characters")
      .max(150, "Decision title must not exceed 150 characters")
      .optional(),

    context: z
      .string()
      .trim()
      .min(10, "Context must be at least 10 characters")
      .optional(),

    decision: z
      .string()
      .trim()
      .min(5, "Decision must be at least 5 characters")
      .optional(),

    reasoning: z.string().trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const updateDecisionStatusSchema = z.object({
  status: decisionStatusSchema,
});

export type CreateDecisionInput = z.infer<typeof createDecisionSchema>;

export type UpdateDecisionInput = z.infer<typeof updateDecisionSchema>;

export type UpdateDecisionStatusInput = z.infer<
  typeof updateDecisionStatusSchema
>;
