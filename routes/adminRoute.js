import express from "express";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyingToken } from "../middleware/verifyToken.js";
import { getAllTaskers, getAllCustomers, updateTaskerProfile } from "../controllers/adminController.js";

const router = express.Router();
router.get("/tasker", verifyingToken, isAdmin, getAllTaskers);
router.get("/customer", verifyingToken, isAdmin, getAllCustomers);
router.patch("/tasker/:taskerId", verifyingToken, isAdmin, updateTaskerProfile);
router.get("/services", verifyingToken, isAdmin, getAllServices);

export default router;