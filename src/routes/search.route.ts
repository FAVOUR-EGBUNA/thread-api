import { Router } from "express";

import { search } from "../controllers/search.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/search", authenticate, search);

export default router;
