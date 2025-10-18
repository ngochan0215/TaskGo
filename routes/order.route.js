import express from "express";
import {
  createOrderByCustomer,
  cancelOrderByCustomer,
} from "../controllers/customer.controller.js";
import {
  getOrderById,
  getAllOrdersByCustomerId,
} from "../controllers/order.controller.js";

const router = express.Router();

// Nếu có middleware auth, import và dùng ở đây
// const auth = require('../middleware/auth');

// Route xử lý đơn hàng
// // GET /api/orders/:id
router.get("/:id", /* auth, */ getOrderById);

// // GET /api/orders?customer=...? // Truyền query customer, limit, page, status
router.get("/", /* auth, */ getAllOrdersByCustomerId);


// Route đặt dịch vụ với khách hàng

// POST /api/orders/schedule
router.post("/customer/createOrder", /* auth, */ createOrderByCustomer);

// PUT /api/order/customer/cancelOrder/{orderId}
router.put("/customer/cancelOrder/:id", /* auth, */ cancelOrderByCustomer);


// Router nhận dịch vụ của tasker

export default router;
