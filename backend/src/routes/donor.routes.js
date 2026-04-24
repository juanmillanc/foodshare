import express from "express";
import { authenticateToken, requireActiveUser, requireRole } from "../middleware/auth.js";
import { uploadDonationImages } from "../middleware/upload.js";
import { publishDonation } from "../controllers/donor.controller.js";

const router = express.Router();

router.use(authenticateToken, requireActiveUser, requireRole("DONANTE"));

router.post("/donations", uploadDonationImages.array("photos", 12), publishDonation);

export default router;
