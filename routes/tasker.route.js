import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isTasker } from "../middleware/verifyRole.js"
import { acceptTask, confirmDeparture, denyTask} from "../controllers/taskers.controller.js";

const router = express.Router();
router.use(verifyToken, isTasker);

router.put("/accept/:orderId",acceptTask);
router.put("/deny/:orderId",denyTask);
router.put("/confirm-departure/:orderId",confirmDeparture);

export default router;