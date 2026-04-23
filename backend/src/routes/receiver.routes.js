import express from "express";
import { authenticateToken, requireActiveUser, requireRole } from "../middleware/auth.js";
import { listActiveDonationCategories, searchDonations } from "../controllers/receiver.controller.js";

const router = express.Router();

router.use(authenticateToken, requireActiveUser, requireRole("RECEPTOR"));

router.get("/donations/categories", listActiveDonationCategories);
router.get("/donations/search", searchDonations);

export default router;

