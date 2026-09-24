import { z } from "zod";

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must not exceed 100 characters"),
});

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Workspace name must be at least 2 characters")
    .max(100, "Workspace name must not exceed 100 characters"),
});

export const addWorkspaceMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),

  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});

export const updateWorkspaceMemberRoleSchema = z.object({
  role: z.enum(["ADMIN", "MEMBER"]),
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;

export type UpdateWorkspaceMemberRoleInput = z.infer<
  typeof updateWorkspaceMemberRoleSchema
>;
