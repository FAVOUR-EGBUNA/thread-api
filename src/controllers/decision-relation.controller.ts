import type { Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";

import { createDecisionRelationSchema } from "../schemas/decision-relation.schema.js";

import {
  createDecisionRelation,
  deleteDecisionRelation,
  getDirectImpact,
} from "../services/decision-relation.service.js";

export const create = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const sourceDecisionId = Number(req.params.decisionId);

    if (!Number.isInteger(sourceDecisionId) || sourceDecisionId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision ID",
      });
    }

    const result = createDecisionRelationSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      });
    }

    const relation = await createDecisionRelation(
      req.user.userId,
      sourceDecisionId,
      result.data,
    );

    return res.status(201).json({
      success: true,
      message: "Decision relationship created successfully",
      data: {
        relation,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "SOURCE_DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Source decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "TARGET_DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Target decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "SELF_RELATION_NOT_ALLOWED"
    ) {
      return res.status(400).json({
        success: false,
        message: "A decision cannot relate to itself",
      });
    }

    if (
      error instanceof Error &&
      error.message === "CROSS_PROJECT_RELATION_NOT_ALLOWED"
    ) {
      return res.status(400).json({
        success: false,
        message: "Decisions must belong to the same project",
      });
    }

    if (error instanceof Error && error.message === "RELATION_ALREADY_EXISTS") {
      return res.status(409).json({
        success: false,
        message: "This decision relationship already exists",
      });
    }

    if (error instanceof Error && error.message === "DECISION_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to these decisions",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to create decision relationships in this workspace",
      });
    }

    console.error("Create decision relationship error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const remove = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const relationId = Number(req.params.relationId);

    if (!Number.isInteger(relationId) || relationId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid decision relationship ID",
      });
    }

    const relation = await deleteDecisionRelation(req.user.userId, relationId);

    return res.status(200).json({
      success: true,
      message: "Decision relationship deleted successfully",
      data: {
        relation,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RELATION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Decision relationship not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "SOURCE_DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Source decision not found",
      });
    }

    if (
      error instanceof Error &&
      error.message === "TARGET_DECISION_NOT_FOUND"
    ) {
      return res.status(404).json({
        success: false,
        message: "Target decision not found",
      });
    }

    if (error instanceof Error && error.message === "DECISION_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this decision relationship",
      });
    }

    if (
      error instanceof Error &&
      error.message === "INSUFFICIENT_WORKSPACE_ROLE"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to delete decision relationships in this workspace",
      });
    }

    console.error("Delete decision relationship error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

export const impact = async (req: AuthenticatedRequest, res: Response) => {
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

    const impactData = await getDirectImpact(req.user.userId, decisionId);

    return res.status(200).json({
      success: true,
      message: "Decision impact retrieved successfully",
      data: impactData,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DECISION_NOT_FOUND") {
      return res.status(404).json({
        success: false,
        message: "Decision not found",
      });
    }

    if (error instanceof Error && error.message === "DECISION_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this decision",
      });
    }

    console.error("Decision impact error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
