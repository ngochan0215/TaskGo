import express from "express";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { getAllTaskers, getAllCustomers, updateTaskerProfile } from "../controllers/admin.controller.js";

const router = express.Router();
router.get("/tasker", verifyToken, isAdmin, getAllTaskers);
router.get("/customer", verifyToken, isAdmin, getAllCustomers);
router.patch("/tasker/update/:taskerId", verifyToken, isAdmin, updateTaskerProfile);

export default router;