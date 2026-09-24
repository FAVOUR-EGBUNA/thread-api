import type { Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

import {
  createProjectSchema,
  updateProjectSchema,
} from "../schemas/project.schema.js";

import {
  createProject,
  deleteProject,
  getProjectById,
  getProjectDecisions,
  getProjectGraph,
  getWorkspaceProjects,
  updateProject,
} from "../services/project.service.js";

export const create = async (
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

    const workspaceId = Number(
      req.params.workspaceId,
    );

    if (
      !Number.isInteger(workspaceId) ||
      workspaceId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const result =
      createProjectSchema.safeParse(
        req.body,
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors:
          result.error.flatten().fieldErrors,
      });
    }

    const project = await createProject(
      req.user.userId,
      workspaceId,
      result.data,
    );

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        project,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "WORKSPACE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "WORKSPACE_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this workspace",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to create projects in this workspace",
      });
    }

    console.error(
      "Create project error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const list = async (
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

    const workspaceId = Number(
      req.params.workspaceId,
    );

    if (
      !Number.isInteger(workspaceId) ||
      workspaceId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const data =
      await getWorkspaceProjects(
        req.user.userId,
        workspaceId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Workspace projects retrieved successfully",
      data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "WORKSPACE_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "WORKSPACE_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this workspace",
      });
    }

    console.error(
      "Get workspace projects error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const getById = async (
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

    const projectId = Number(
      req.params.projectId,
    );

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project =
      await getProjectById(
        req.user.userId,
        projectId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Project retrieved successfully",
      data: {
        project,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROJECT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this project",
      });
    }

    console.error(
      "Get project error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const update = async (
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

    const projectId = Number(
      req.params.projectId,
    );

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const result =
      updateProjectSchema.safeParse(
        req.body,
      );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors:
          result.error.flatten(),
      });
    }

    const project = await updateProject(
      req.user.userId,
      projectId,
      result.data,
    );

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: {
        project,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROJECT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this project",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update projects in this workspace",
      });
    }

    console.error(
      "Update project error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const remove = async (
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

    const projectId = Number(
      req.params.projectId,
    );

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const project = await deleteProject(
      req.user.userId,
      projectId,
    );

    return res.status(200).json({
      success: true,
      message: "Project deleted successfully",
      data: {
        project,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROJECT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this project",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to delete projects in this workspace",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_HAS_DECISIONS"
    ) {
      return res.status(409).json({
        success: false,
        message:
          "This project contains decisions and cannot be deleted",
      });
    }

    console.error(
      "Delete project error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const listDecisions = async (
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

    const projectId = Number(
      req.params.projectId,
    );

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const data =
      await getProjectDecisions(
        req.user.userId,
        projectId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Project decisions retrieved successfully",
      data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROJECT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this project",
      });
    }

    console.error(
      "Get project decisions error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const graph = async (
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

    const projectId = Number(
      req.params.projectId,
    );

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const graphData =
      await getProjectGraph(
        req.user.userId,
        projectId,
      );

    return res.status(200).json({
      success: true,
      message:
        "Project graph retrieved successfully",
      data: graphData,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "PROJECT_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    if (
      error instanceof Error &&
      error.message ===
        "PROJECT_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this project",
      });
    }

    console.error(
      "Get project graph error:",
      error,
    );

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};