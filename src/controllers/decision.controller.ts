import type { Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

import {
  createDecisionSchema,
  updateDecisionSchema,
  updateDecisionStatusSchema,
} from "../schemas/decision.schema.js";

import {
  createDecision,
  getDecisionById,
  getDecisionHistory,
  updateDecision,
  updateDecisionStatus,
} from "../services/decision.service.js";

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

    const projectId = Number(req.params.projectId);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    const result = createDecisionSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }

    const decision = await createDecision(
      req.user.userId,
      projectId,
      result.data,
    );

    return res.status(201).json({
      success: true,
      message: "Decision created successfully",
      data: {
        decision,
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
      error.message === "PROJECT_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this project",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to create decisions in this workspace",
      });
    }

    console.error("Create decision error:", error);

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

    const decisionId = Number(req.params.decisionId);

    if (!Number.isInteger(decisionId) || decisionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision ID",
      });
    }

    const data = await getDecisionById(
      req.user.userId,
      decisionId,
    );

    return res.status(200).json({
      success: true,
      message: "Decision retrieved successfully",
      data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "DECISION_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this decision",
      });
    }

    console.error("Get decision error:", error);

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

    const decisionId = Number(req.params.decisionId);

    if (!Number.isInteger(decisionId) || decisionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision ID",
      });
    }

    const result = updateDecisionSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }

    const decision = await updateDecision(
      req.user.userId,
      decisionId,
      result.data,
    );

    return res.status(200).json({
      success: true,
      message: "Decision updated successfully",
      data: {
        decision,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "DECISION_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this decision",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to update decisions in this workspace",
      });
    }

    console.error("Update decision error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const updateStatus = async (
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

    const decisionId = Number(req.params.decisionId);

    if (!Number.isInteger(decisionId) || decisionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision ID",
      });
    }

    const result =
      updateDecisionStatusSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }

    const data = await updateDecisionStatus(
      req.user.userId,
      decisionId,
      result.data,
    );

    return res.status(200).json({
      success: true,
      message: "Decision status updated successfully",
      data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "DECISION_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this decision",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to change decision status in this workspace",
      });
    }

    if (
      error instanceof Error &&
      error.message === "STATUS_UNCHANGED"
    ) {
      return res.status(409).json({
        success: false,
        message: "Decision already has this status",
      });
    }

    console.error("Update decision status error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const history = async (
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

    const decisionId = Number(req.params.decisionId);

    if (!Number.isInteger(decisionId) || decisionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision ID",
      });
    }

    const data = await getDecisionHistory(
      req.user.userId,
      decisionId,
    );

    return res.status(200).json({
      success: true,
      message: "Decision history retrieved successfully",
      data,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "DECISION_ACCESS_DENIED"
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this decision",
      });
    }

    console.error("Get decision history error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};