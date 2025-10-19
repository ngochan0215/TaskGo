import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isTasker } from "../middleware/verifyRole.js"
import { acceptTask, confirmDeparture, denyTask} from "../controllers/taskers.controller.js";

const router = express.Router();
router.use(verifyToken, isTasker);

router.put("/:orderId/accept",acceptTask);
router.put("/:orderId/deny",denyTask);
router.put("/:orderId/confirm-departure",confirmDeparture);

export default router;