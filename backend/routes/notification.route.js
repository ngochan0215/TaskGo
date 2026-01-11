import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/verifyRole.js"
import { getMyNotifications, markAsDeleted, markAsRead, markAsReadAll } from "../controllers/notification.controller.js";

const router = express.Router();

// DISCOUNT
router.get("/all", verifyToken, getMyNotifications);
router.patch("/read-all", verifyToken, markAsReadAll);
router.patch("/:id", verifyToken, markAsRead);
router.delete("/:id", verifyToken, markAsDeleted);

export default router;