import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("Unhandled application error:", error);

  if (error instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      message: "Invalid JSON payload",
    });

    return;
  }

  if (
    error instanceof Error &&
    error.message === "Origin not allowed by CORS"
  ) {
    res.status(403).json({
      success: false,
      message: "Origin not allowed",
    });

    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
};
