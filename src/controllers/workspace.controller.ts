import type { Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

import {
  addWorkspaceMemberSchema,
  createWorkspaceSchema,
  updateWorkspaceMemberRoleSchema,
  updateWorkspaceSchema,
} from "../schemas/workspace.schema.js";

import {
  addWorkspaceMember,
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById,
  getWorkspaceMembers,
  removeWorkspaceMember,
  updateWorkspace,
  updateWorkspaceMemberRole,
} from "../services/workspace.service.js";

export const create = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const result = createWorkspaceSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const workspace = await createWorkspace(req.user.userId, result.data);

    return res.status(201).json({
      success: true,
      message: "Workspace created successfully",
      data: {
        workspace,
      },
    });
  } catch (error) {
    console.error("Create workspace error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const list = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const data = await getUserWorkspaces(req.user.userId);

    return res.status(200).json({
      success: true,
      message: "Workspaces retrieved successfully",
      data,
    });
  } catch (error) {
    console.error("Get user workspaces error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const getById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const workspace = await getWorkspaceById(req.user.userId, workspaceId);

    return res.status(200).json({
      success: true,
      message: "Workspace retrieved successfully",
      data: {
        workspace,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    console.error("Get workspace error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const update = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const result = updateWorkspaceSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const workspace = await updateWorkspace(
      req.user.userId,
      workspaceId,
      result.data,
    );

    return res.status(200).json({
      success: true,
      message: "Workspace updated successfully",
      data: {
        workspace,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    if (error instanceof Error && error.message === "OWNER_ROLE_REQUIRED") {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner can update the workspace",
      });
    }

    if (
      error instanceof Error &&
      error.message === "WORKSPACE_NAME_UNCHANGED"
    ) {
      return res.status(409).json({
        success: false,
        message: "The workspace already has this name",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_UPDATE_FAILED") {
      return res.status(500).json({
        success: false,
        message: "Workspace could not be updated",
      });
    }

    console.error("Update workspace error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const getMembers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const data = await getWorkspaceMembers(req.user.userId, workspaceId);

    return res.status(200).json({
      success: true,
      message: "Workspace members retrieved successfully",
      data,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    console.error("Get workspace members error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const addMember = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const result = addWorkspaceMemberSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const member = await addWorkspaceMember(
      req.user.userId,
      workspaceId,
      result.data,
    );

    return res.status(201).json({
      success: true,
      message: "Workspace member added successfully",
      data: {
        member,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to add workspace members",
      });
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "No THREAD user exists with that email address",
      });
    }

    if (
      error instanceof Error &&
      error.message === "WORKSPACE_MEMBER_ALREADY_EXISTS"
    ) {
      return res.status(409).json({
        success: false,
        message: "This user is already a member of the workspace",
      });
    }

    console.error("Add workspace member error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const updateMemberRole = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const workspaceId = Number(req.params.workspaceId);
    const memberId = Number(req.params.memberId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const result = updateWorkspaceMemberRoleSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const member = await updateWorkspaceMemberRole(
      req.user.userId,
      workspaceId,
      memberId,
      result.data,
    );

    return res.status(200).json({
      success: true,
      message: "Workspace member role updated successfully",
      data: {
        member,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    if (error instanceof Error && error.message === "OWNER_ROLE_REQUIRED") {
      return res.status(403).json({
        success: false,
        message: "Only the workspace owner can change member roles",
      });
    }

    if (
      error instanceof Error &&
      error.message === "WORKSPACE_MEMBER_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Workspace member not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "OWNER_ROLE_CHANGE_NOT_ALLOWED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "The workspace owner's role cannot be changed through this endpoint",
      });
    }

    if (error instanceof Error && error.message === "MEMBER_ROLE_UNCHANGED") {
      return res.status(409).json({
        success: false,
        message: "The member already has this role",
      });
    }

    console.error("Update workspace member role error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const removeMember = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const workspaceId = Number(req.params.workspaceId);
    const memberId = Number(req.params.memberId);

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid member ID",
      });
    }

    const member = await removeWorkspaceMember(
      req.user.userId,
      workspaceId,
      memberId,
    );

    return res.status(200).json({
      success: true,
      message: "Workspace member removed successfully",
      data: {
        member,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to remove workspace members",
      });
    }

    if (
      error instanceof Error &&
      error.message === "WORKSPACE_MEMBER_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Workspace member not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "SELF_REMOVAL_NOT_ALLOWED"
    ) {
      return res.status(403).json({
        success: false,
        message: "You cannot remove yourself through this endpoint",
      });
    }

    if (
      error instanceof Error &&
      error.message === "OWNER_REMOVAL_NOT_ALLOWED"
    ) {
      return res.status(403).json({
        success: false,
        message: "The workspace owner cannot be removed",
      });
    }

    if (
      error instanceof Error &&
      error.message === "ADMIN_CANNOT_REMOVE_ADMIN"
    ) {
      return res.status(403).json({
        success: false,
        message: "An admin cannot remove another admin",
      });
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.error("Remove workspace member error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
