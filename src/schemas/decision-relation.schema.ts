import { z } from "zod";

export const createDecisionRelationSchema = z.object({
  targetDecisionId: z
    .number()
    .int()
    .positive("Target decision ID must be valid"),

  type: z.enum([
    "DEPENDS_ON",
    "AFFECTS",
    "SUPPORTS",
    "CONFLICTS_WITH",
    "SUPERSEDES",
    "RELATED_TO",
  ]),
});

export type CreateDecisionRelationInput = z.infer<
  typeof createDecisionRelationSchema
>;
