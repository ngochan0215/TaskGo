import express from "express";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { getAllTaskers, getAllCustomers, updateTaskerProfile, getAllOrders , deleteOrderById} from "../controllers/admin.controller.js";

const router = express.Router();
router.get("/tasker", verifyToken, isAdmin, getAllTaskers);
router.get("/customer", verifyToken, isAdmin, getAllCustomers);
router.get("/order", verifyToken, isAdmin, getAllOrders) /*(query: ?customerId=...&status=...&page=...&limit=...)*/
router.delete("/order/:id", verifyToken, isAdmin, deleteOrderById)
router.patch("/tasker/update/:taskerId", verifyToken, isAdmin, updateTaskerProfile);

export default router;