import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin, isCustomer } from "../middleware/verifyRole.js";
import { getOrderById, getAllOrdersByCustomerId, getAllOrders, deleteOrderById,
    createOrder, cancelOrderByCustomer,
    createReceipt, getCustomerOrderStats,
 } from "../controllers/order.controller.js";

import { addReview, editReview, getMyReviews, getReviewByOrder } from "../controllers/review.controller.js";

const router = express.Router();

// lấy số đơn đã hoàn thành và hủy của khách hàng
router.get("/statistics/completed-cancelled", verifyToken, getCustomerOrderStats);

router.post("/create", verifyToken, isCustomer, createOrder);
router.get("/:customerId", verifyToken, getAllOrdersByCustomerId);
router.put("/cancel/:orderId", verifyToken, isCustomer, cancelOrderByCustomer);

router.get("/all", verifyToken, isAdmin, getAllOrders);
router.get("/:id",verifyToken, getOrderById);
router.delete("/delete/:orderId", verifyToken, isAdmin, deleteOrderById);

// receipt - hóa đơn
router.post("/receipt/add", verifyToken, createReceipt);

// review - đánh giá
router.post("/reviews/add", verifyToken, addReview);
router.get("/reviews/my-reviews", verifyToken, getMyReviews);
router.get("/reviews/:order_id", verifyToken, getReviewByOrder);
router.put("/reviews/:order_id/edit", verifyToken, editReview);

export default router;
