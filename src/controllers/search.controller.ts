import type { Response } from "express";

import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { searchDecisions } from "../services/search.service.js";

export const search = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    if (query.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
    }

    if (query.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Search query must not exceed 100 characters",
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

    const data = await searchDecisions(req.user.userId, query, {
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: "Search completed successfully",
      data,
    });
  } catch (error) {
    console.error("Search error:", error);

    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};
