import express from "express";
import { getMessagesByOrder, getAllChats } from "../controllers/chat.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Route: /api/chats/orders/:orderId/messages
router.get(
  "/orders/:orderId/messages", 
  verifyToken, 
  getMessagesByOrder
);

// Get all conversations for the current user
router.get("/", verifyToken, getAllChats);

export default router;