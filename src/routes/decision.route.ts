import { Router } from "express";

import {
  create,
  getById,
  history,
  update,
  updateStatus,
} from "../controllers/decision.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/projects/:projectId/decisions", authenticate, create);

router.get("/decisions/:decisionId", authenticate, getById);

router.get("/decisions/:decisionId/history", authenticate, history);

router.patch("/decisions/:decisionId", authenticate, update);

router.patch("/decisions/:decisionId/status", authenticate, updateStatus);

export default router;
