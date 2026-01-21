import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { getUserProfile, changePassword, sendEmail, 
    verifyEmail, updateAvatar, addFavoriteTasker, removeFavoriteTasker, 
    getMyFavoriteTaskers, addAddress, getMyAddresses, deleteAddress, setDefaultAddress,
    getUserPoints, getAUserProfile,
    updateTaskerProfile, updateCustomerProfile, 
    addFavoriteTask, removeFavoriteTask, getMyFavoriteTasks,
} from "../controllers/user.controller.js";
import uploadAvatar from "../middleware/uploadAvatar.js";
import { isCustomer } from "../middleware/verifyRole.js";

const router = express.Router();

// lấy điểm uy tín
router.get("/reputation-score", verifyToken, getUserPoints);

router.get("/profile", verifyToken, getUserProfile);
router.post("/show-public/profile", verifyToken, getAUserProfile);

router.put("/profile/update", verifyToken, updateCustomerProfile);
router.put("/profile/update/tasker", verifyToken, updateTaskerProfile);

router.put("/profile/change-password", verifyToken, changePassword);
router.post("/profile/change-email/send-otp", verifyToken, sendEmail);
router.post("/profile/change-email/verify-otp", verifyToken, verifyEmail);
router.put("/profile/update-avatar", verifyToken, uploadAvatar.single("avatar"), updateAvatar);

// tasker yêu thích
router.post("/favorites/taskers/", verifyToken, isCustomer, addFavoriteTasker);
router.delete("/favorites/taskers/:tasker_id", verifyToken, isCustomer, removeFavoriteTasker);
router.get("/favorites/taskers", verifyToken, isCustomer, getMyFavoriteTaskers);

// task yêu thích
router.post("/favorites/tasks/", verifyToken, isCustomer, addFavoriteTask);
router.delete("/favorites/tasks/:task_id", verifyToken, isCustomer, removeFavoriteTask);
router.get("/favorites/tasks", verifyToken, isCustomer, getMyFavoriteTasks);

router.post("/addresses/", verifyToken, addAddress);
router.post("/tasker-signup/first-address", addAddress);

router.get("/addresses/my", verifyToken, isCustomer, getMyAddresses);
router.delete("/addresses/:address_id", verifyToken, isCustomer, deleteAddress);
router.patch("/addresses/:address_id/set-default", verifyToken, isCustomer, setDefaultAddress);

export default router;
