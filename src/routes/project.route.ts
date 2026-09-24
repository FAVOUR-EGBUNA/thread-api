import { Router } from "express";

import {
  create,
  getById,
  graph,
  list,
  listDecisions,
  remove,
  update,
} from "../controllers/project.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/workspaces/:workspaceId/projects", authenticate, create);

router.get("/workspaces/:workspaceId/projects", authenticate, list);

router.get("/projects/:projectId", authenticate, getById);

router.patch("/projects/:projectId", authenticate, update);

router.delete("/projects/:projectId", authenticate, remove);

router.get("/projects/:projectId/decisions", authenticate, listDecisions);

router.get("/projects/:projectId/graph", authenticate, graph);

export default router;
