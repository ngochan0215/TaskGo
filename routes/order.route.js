import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin, isCustomer } from "../middleware/verifyRole.js";
import { getOrderById, getAllOrdersByCustomerId, getAllOrders, deleteOrderById,
    createOrder, cancelOrderByCustomer
 } from "../controllers/order.controller.js";

const router = express.Router();

router.post("/create", verifyToken, isCustomer, createOrder);
router.get("/:customerId", verifyToken, getAllOrdersByCustomerId);
router.put("/cancel/:orderId", verifyToken, isCustomer, cancelOrderByCustomer);

router.get("/all", verifyToken, isAdmin, getAllOrders);
router.get("/:id",verifyToken, getOrderById);
router.delete("/delete/:orderId", verifyToken, isAdmin, deleteOrderById);

export default router;
