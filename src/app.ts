import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";

import { env } from "./config/env.js";

import authRouter from "./routes/auth.route.js";
import workspaceRouter from "./routes/workspace.route.js";
import projectRouter from "./routes/project.route.js";
import decisionRouter from "./routes/decision.route.js";
import decisionRelationRouter from "./routes/decision-relation.route.js";
import searchRouter from "./routes/search.route.js";
import activityRouter from "./routes/activity.route.js";

import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";

const app = express();

const allowedOrigins = ["http://localhost:5173"];

if (env.CLIENT_URL) {
  allowedOrigins.push(env.CLIENT_URL);
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts. Please try again later.",
  },
});

app.use(helmet());

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(
  express.json({
    limit: "100kb",
  }),
);

app.use("/api/v1", apiLimiter);

app.get("/api/v1/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "THREAD API is running",
  });
});

app.use("/api/v1/auth", authLimiter, authRouter);

app.use("/api/v1/workspaces", workspaceRouter);

app.use("/api/v1", projectRouter);
app.use("/api/v1", decisionRouter);
app.use("/api/v1", decisionRelationRouter);
app.use("/api/v1", searchRouter);
app.use("/api/v1", activityRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
