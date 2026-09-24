import { Router } from "express";

import { getWorkspaceActivity } from "../controllers/activity.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.get(
  "/workspaces/:workspaceId/activity",
  authenticate,
  getWorkspaceActivity,
);

export default router;
