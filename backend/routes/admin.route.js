import express from "express";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { approveTasker, getAllCustomers, getAllTaskers, rejectTasker, updateTaskerProfile } from "../controllers/admin.controller.js";

const router = express.Router();

// Manage Customers
router.get("/customers/all", verifyToken, isAdmin, getAllCustomers);

// Manage Taskers
router.get("/taskers/all", verifyToken, isAdmin, getAllTaskers);
router.patch("/taskers/update/:taskerId", verifyToken, isAdmin, updateTaskerProfile);
router.patch("/taskers/approve/:taskerId", verifyToken, isAdmin, approveTasker);
router.patch("/taskers/reject/:taskerId", verifyToken, isAdmin, rejectTasker);

export default router;
