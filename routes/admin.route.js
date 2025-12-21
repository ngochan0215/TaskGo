import express from "express";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { getAllCustomers, updateTaskerProfile } from "../controllers/admin.controller.js";

const router = express.Router();

// manage employess and customers
router.patch("/tasker/update/:taskerId", verifyToken, isAdmin, updateTaskerProfile);
router.get("/customer", verifyToken, isAdmin, getAllCustomers);

export default router;