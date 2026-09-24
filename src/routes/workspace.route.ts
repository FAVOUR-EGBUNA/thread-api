import { Router } from "express";

import {
  addMember,
  create,
  getById,
  getMembers,
  list,
  removeMember,
  update,
  updateMemberRole,
} from "../controllers/workspace.controller.js";

import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", authenticate, create);

router.get("/", authenticate, list);

router.get("/:workspaceId", authenticate, getById);

router.patch("/:workspaceId", authenticate, update);

router.get("/:workspaceId/members", authenticate, getMembers);

router.post("/:workspaceId/members", authenticate, addMember);

router.patch(
  "/:workspaceId/members/:memberId/role",
  authenticate,
  updateMemberRole,
);

router.delete("/:workspaceId/members/:memberId", authenticate, removeMember);

export default router;
