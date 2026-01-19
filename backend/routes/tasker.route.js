import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin, isTasker } from "../middleware/verifyRole.js"
import { acceptTask, confirmDeparture, denyTask, confirmArriving, 
    confirmComplete, confirmStart, getAllTaskers, updateWorkingStatus, 
    cashOut, amountCashout, availableCashoutAmount, getOrderDetailsForTasker, 
    getAvailableOrdersForTasker, getTaskerAcceptanceStats, getTaskerOrders,
    getWorkSchedule,
} from "../controllers/taskers.controller.js";

const router = express.Router();

// Get available orders for tasker (for home page)
router.get("/orders/available", verifyToken, isTasker, getAvailableOrdersForTasker);

// Get all orders for tasker (for activity page)
router.get("/orders", verifyToken, isTasker, getTaskerOrders);

// Get work schedule for tasker
router.get("/work-schedule", verifyToken, isTasker, getWorkSchedule);

// Get order details for tasker
router.get("/order/:orderId", verifyToken, isTasker, getOrderDetailsForTasker);

// Tasker actions
router.put("/accept/:orderId", verifyToken, isTasker, acceptTask);
router.put("/deny/:orderId", verifyToken, isTasker, denyTask);
router.put("/confirm/depart/:orderId", verifyToken, isTasker, confirmDeparture);
router.put("/confirm/arrive/:orderId", verifyToken, isTasker, confirmArriving);
router.put("/confirm/start/:orderId", verifyToken, isTasker, confirmStart);
router.put("/confirm/complete/:orderId", verifyToken, isTasker, confirmComplete);
router.patch("/update/working-status", verifyToken, isTasker, updateWorkingStatus);

router.get("/all", verifyToken, isAdmin, getAllTaskers);

router.get("/stats/acceptance-rate", verifyToken, getTaskerAcceptanceStats);

router.put("/cashOut", verifyToken, isTasker, cashOut);
router.get("/cashOut", verifyToken, isTasker, amountCashout);
router.get("/cashOut/available", verifyToken, isTasker, availableCashoutAmount);

export default router;