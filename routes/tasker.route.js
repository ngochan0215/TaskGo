import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isTasker } from "../middleware/verifyRole.js"
import { acceptTask, confirmDeparture, denyTask, confirmArrive, confirmStartTask, confirmCompleteTask} from "../controllers/taskers.controller.js";

const router = express.Router();

router.put("/accept/:orderId", verifyToken, isTasker, acceptTask);
router.put("/deny/:orderId", verifyToken, isTasker, denyTask);
router.put("/confirm/depart/:orderId", verifyToken, isTasker, confirmDeparture);
router.put("/confirm/arrive/:orderId", verifyToken, isTasker, confirmArrive);
router.put("/confirm/start/:orderId", verifyToken, isTasker, confirmStartTask);
router.put("/confirm/complete/:orderId", verifyToken, isTasker, confirmCompleteTask);
export default router;