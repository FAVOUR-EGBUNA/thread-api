import type { Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { getWorkspaceActivities } from "../services/activity.service.js";

export const getWorkspaceActivity = async (
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

    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const page = req.query.page ? Number(req.query.page) : 1;

    const limit = req.query.limit ? Number(req.query.limit) : 20;

    if (!Number.isInteger(page) || page <= 0) {
      return res.status(400).json({
        success: false,
        message: "Page must be a positive integer",
      });
    }

    if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: "Limit must be a positive integer between 1 and 100",
      });
    }

    const data = await getWorkspaceActivities(req.user.userId, workspaceId, {
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace activity retrieved successfully",
      data,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_ACCESS_DENIED") {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this workspace",
      });
    }

    console.error("Get workspace activity error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
