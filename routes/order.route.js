import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/verifyRole.js";
import { getOrderById, getAllOrdersByCustomerId, getAllOrders, deleteOrderById } from "../controllers/order.controller.js";
import { createOrder, cancelOrder } from "../controllers/order.controller.js";

const router = express.Router();

router.get("/:id",verifyToken, getOrderById);

// // GET /api/orders?customer=...? // Truyền query customer, limit, page, status
router.get("/", verifyToken, getAllOrdersByCustomerId);

router.post("/customer/create-order",verifyToken, createOrder);
router.put("/customer/cancel-order/:id",verifyToken, cancelOrder);

// ADMIN manage orders
router.get("/order", verifyToken, isAdmin, getAllOrders);
router.delete("/order/delete/:orderId", verifyToken, isAdmin, deleteOrderById);

export default router;
