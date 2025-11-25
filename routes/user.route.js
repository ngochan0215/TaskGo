import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getUserProfile, updateUserProfile, changePassword, sendEmail, verifyEmail, updateAvatar } from "../controllers/user.controller.js";
import uploadAvatar from "../middleware/uploadAvatar.js";

const router = express.Router();

router.get("/profile", verifyToken, getUserProfile);
router.put("/profile/update", verifyToken, updateUserProfile);
router.put("/profile/change-password", verifyToken, changePassword);
router.post("/profile/change-email/send-otp", verifyToken, sendEmail);
router.post("/profile/change-email/verify-otp", verifyToken, verifyEmail);
router.put("/profile/update-avatar", verifyToken, uploadAvatar.single("avatar"), updateAvatar);

export default router;
