import express from "express";
import { getMessagesByOrder, getAllChats, searchMessagesInOrder } from "../controllers/chat.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Route: /api/chats/orders/:orderId/messages
router.get("/orders/:orderId/messages", verifyToken, getMessagesByOrder);

// Route: GET /api/chats/orders/:orderId/search
router.get("/orders/:orderId/search", verifyToken, searchMessagesInOrder)

// Get all conversations for the current user
router.get("/", verifyToken, getAllChats);

export default router;