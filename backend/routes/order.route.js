import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin, isCustomer } from "../middleware/verifyRole.js";

import { getOrderById, getAllOrdersByCustomerId, getAllOrders, deleteOrderById,
    createOrder, cancelOrderByCustomer, getCustomerOrderStats, getOrderTrends,
 } from "../controllers/order.controller.js";

import { getReceiptById, createReceipt, getAllReceipts, 
    updateReceiptStatus, markReceiptPaid
} from "../controllers/receipt.controller.js";

import { addReview, editReview, getMyReviews, getReviewByOrder } from "../controllers/review.controller.js";

const router = express.Router();

router.get("/statistics/completed-cancelled", verifyToken, getCustomerOrderStats);
router.get("/statistics/trends", verifyToken, isAdmin, getOrderTrends);

// ADMIN routes - specific paths first
router.get("/all", verifyToken, isAdmin, getAllOrders);
router.delete("/delete/:orderId", verifyToken, isAdmin, deleteOrderById);

// Order detail route - use specific path to avoid conflict
router.get("/detail/:id", verifyToken, getOrderById);

// CUSTOMER routes
router.post("/create", verifyToken, isCustomer, createOrder);
router.put("/cancel/:orderId", verifyToken, isCustomer, cancelOrderByCustomer);

// Customer orders - must be after specific routes
router.get("/customer/:customerId", verifyToken, getAllOrdersByCustomerId);

// reviews
router.post("/reviews/add", verifyToken, addReview);
router.get("/reviews/my-reviews", verifyToken, getMyReviews);
router.get("/reviews/:order_id", verifyToken, getReviewByOrder);
router.put("/reviews/:order_id/edit", verifyToken, editReview);

// receipt
router.post("/receipt/add", verifyToken, createReceipt);
router.get("/receipt/:id", verifyToken, getReceiptById);
router.get("/receipt/all", verifyToken, getAllReceipts);
router.patch("/receipt/:id/status", verifyToken, isAdmin, updateReceiptStatus);
router.post("/receipt/:id/paid", verifyToken, isAdmin, markReceiptPaid);

export default router;
