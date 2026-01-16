import Message from "../models/messages.js";
import Chat from "../models/chats.js";
import User from "../models/users.js";
import Order from "../models/orders.js";
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

    // Fetch partner's details
    const partner = await User.findById(otherParticipant.user_id)
        .select("full_name avatar_url reputation_score")
        .lean();

    const order = await Order.findById(orderId)
        .select("task_snapshot _id") // Get the task name and ID
        .lean();

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
        updatedAt: m.updated_at,
        status: m.status,
        attachment_url: isDeleted ? "" : m.attachment_url,
      };
    });

    return res.status(200).json({
      ok: true,
      conversation: {
          id: targetChat._id,
          partner: {
              id: partner._id,
              full_name: partner.full_name,
              avatar_url: partner.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Julia", 
              reputation_score: partner.reputation_score,
          }
      },
      order: {
              id: order._id,
              task_name: order.task_snapshot ? order.task_snapshot.name : "Dịch vụ",
      },
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

// Route: GET /api/chats
export const getAllChats = async (req, res) => {
  try {
    const userId = req.userId; // From verifyToken middleware

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // 1. Find chats where user is a participant
    const chats = await Chat.find({
      "participants.user_id": userId,
      status: { $ne: "deleted" } // Optional: Hide deleted chats
    })
    .populate({
      path: "participants.user_id",
      select: "full_name avatar_url", // Only get fields needed for display
      model: "User"
    })
    .populate({
      path: "last_message",
      select: "content message_type createdAt sender_id", // Get message preview
      model: "Message"
    })
    .populate({
        path: "order_id",
        select: "status", // Helpful to gray out completed orders
        model: "Order"
    })
    .sort({ updated_at: -1 }) // Newest active chats first
    .lean();

    // 2. Transform data for Frontend
    // The frontend shouldn't have to figure out who "participant[0]" is. 
    // We categorize into "me" and "partner".
    const formattedChats = chats.map(chat => {
      
      const me = chat.participants.find(p => String(p.user_id._id) === userId);
      const partner = chat.participants.find(p => String(p.user_id._id) !== userId);

      // Handle edge case where partner user might be deleted
      const partnerInfo = partner ? partner.user_id : { full_name: "Người dùng ẩn", avatar_url: null };

      // Check if the last message was seen by me
      let isSeen = true;
      if (chat.last_message) {
        // If I am not the sender AND the last message ID is not what I last saw
        const isMyMessage = String(chat.last_message.sender_id) === userId;
        const lastSeenId = me.last_seen_message_id ? String(me.last_seen_message_id) : null;
        
        if (!isMyMessage && String(chat.last_message._id) !== lastSeenId) {
            isSeen = false;
        }
      }

      return {
        chat_id: chat._id,
        order_id: chat.order_id._id,
        order_status: chat.order_id.status,
        
        partner: {
          id: partnerInfo._id,
          full_name: partnerInfo.full_name,
          avatar_url: partnerInfo.avatar_url,
          role: partner ? partner.role : 'unknown'
        },

        last_message: chat.last_message ? {
          content: chat.last_message.message_type === 'text' 
            ? chat.last_message.content 
            : `[${chat.last_message.message_type}]`, // e.g. "[image]"
          created_at: chat.last_message.createdAt,
          is_sender: String(chat.last_message.sender_id) === userId
        } : null,

        is_seen: isSeen,
        updated_at: chat.updated_at
      };
    });

    return res.status(200).json({
      ok: true,
      data: formattedChats
    });

  } catch (err) {
    console.error("getAllChats error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
};