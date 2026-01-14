import Message from "../models/messages.js";
import mongoose from "mongoose";
import { fetchChat } from "../services/chat.service.js";

const num_of_msg_per_load = 10;

// Expecting URL: /api/chats/orders/:orderId/messages?before=xxx
export const getMessagesByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { before } = req.query;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const targetChat = await fetchChat(orderId, userId);

    // Identify the other participant
    const otherParticipant = targetChat.participants.find(
      (p) => String(p.user_id) !== userId
    );

    // Build Query
    const query = { chat_id: targetChat._id };

    if (before && mongoose.Types.ObjectId.isValid(before)) {
      query._id = { $lt: new mongoose.Types.ObjectId(before) };
    }

    // Execute query
    let messages = await Message.find(query)
      .sort({ _id: -1 }) // Sort descendingly
      .limit(num_of_msg_per_load)
      .lean();

    // Format Data
    const ordered = messages.reverse().map((m) => {
      const isDeleted = m.status === "deleted";

      return {
        id: String(m._id),
        chat_id: String(m.chat_id),
        sender_id: String(m.sender_id),
        content: isDeleted ? "Tin nhắn đã bị xóa" : m.content,
        message_type: isDeleted ? "text" : m.message_type,
        createdAt: m.createdAt,
        status: m.status,
        attachment_url: isDeleted ? "" : m.attachment_url,
      };
    });

    return res.status(200).json({
      ok: true,
      data: ordered,
      // ID of the oldest message in this batch to help the FE in later API calls
      nextCursor: ordered.length > 0 ? ordered[0].id : null,
      lastSeenMessageId: otherParticipant
        ? String(otherParticipant.last_seen_message_id)
        : null,
      lastSeenAt: otherParticipant ? otherParticipant.last_seen_at : null,
    });
  } catch (err) {
    console.error("API getMessagesByOrder error:", err);

    if (err.message === "no_permission") {
      return res
        .status(403)
        .json({ ok: false, error: "Forbidden: No access to this chat" });
    }
    if (err.message === "chat_not_found" || err.message === "order_not_found") {
      return res
        .status(404)
        .json({ ok: false, error: "Chat resource not found" });
    }
    if (err.message === "invalid_order_id") {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid Order ID format" });
    }

    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
};
