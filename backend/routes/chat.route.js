import express from "express";
import { getMessagesByOrder } from "../controllers/chat.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Route: /api/chats/orders/:orderId/messages
router.get(
  "/orders/:orderId/messages", 
  verifyToken, 
  getMessagesByOrder
);

export default router;