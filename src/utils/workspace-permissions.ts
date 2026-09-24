export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

const roleLevel: Record<WorkspaceRole, number> = {
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export const hasMinimumWorkspaceRole = (
  currentRole: WorkspaceRole,
  requiredRole: WorkspaceRole,
) => {
  return roleLevel[currentRole] >= roleLevel[requiredRole];
};
