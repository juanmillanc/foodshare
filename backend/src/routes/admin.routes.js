import express from "express";
import { authenticateToken, requireAdmin } from "../middleware/auth.js";
import {
  blockUserPermanently,
  listPendingValidations,
  validateUserRequest
} from "../controllers/admin.controller.js";

const router = express.Router();

router.use(authenticateToken, requireAdmin);

router.get("/pending-validations", listPendingValidations);
router.patch("/validate-user/:id", validateUserRequest);
router.patch("/block-user/:id", blockUserPermanently);

export default router;
