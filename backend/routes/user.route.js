import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getUserProfile, updateUserProfile, changePassword, sendEmail, verifyEmail, updateAvatar, addFavoriteTasker, removeFavoriteTasker, getMyFavoriteTaskers, addAddress, getMyAddresses, deleteAddress, setDefaultAddress } from "../controllers/user.controller.js";
import uploadAvatar from "../middleware/uploadAvatar.js";
import { isCustomer } from "../middleware/verifyRole.js";
import { set } from "mongoose";

const router = express.Router();

router.get("/profile", verifyToken, getUserProfile);
router.put("/profile/update", verifyToken, updateUserProfile);
router.put("/profile/change-password", verifyToken, changePassword);
router.post("/profile/change-email/send-otp", verifyToken, sendEmail);
router.post("/profile/change-email/verify-otp", verifyToken, verifyEmail);
router.put("/profile/update-avatar", verifyToken, uploadAvatar.single("avatar"), updateAvatar);

router.post("/favorites/taskers/", verifyToken, isCustomer, addFavoriteTasker);
router.delete("/favorites/taskers/:tasker_id", verifyToken, isCustomer, removeFavoriteTasker);
router.get("/favorites/taskers/", verifyToken, isCustomer, getMyFavoriteTaskers);

router.post("/addresses/", verifyToken, isCustomer, addAddress);
router.get("/addresses/all", verifyToken, isCustomer, getMyAddresses);
router.delete("/addresses/:address_id", verifyToken, isCustomer, deleteAddress);
router.patch("/addresses/:address_id/set-default", verifyToken, isCustomer, setDefaultAddress);

export default router;
