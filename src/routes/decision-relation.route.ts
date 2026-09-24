import { Router } from "express";

import {
  create,
  impact,
  remove,
} from "../controllers/decision-relation.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/decisions/:decisionId/relations", authenticate, create);

router.delete("/decision-relations/:relationId", authenticate, remove);

router.get("/decisions/:decisionId/impact", authenticate, impact);

export default router;
