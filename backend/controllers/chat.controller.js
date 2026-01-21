import Message from "../models/messages.js";
import Chat from "../models/chats.js";
import User from "../models/users.js";
import Order from "../models/orders.js";
import Review from "../models/reviews.js";
import Account from "../models/accounts.js";
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
        .select("full_name avatar_url")
        .lean();

    // Get partner's account to determine role
    const partnerAccount = await Account.findOne({ user_id: partner._id })
        .select("role")
        .lean();

    // Get partner's average_rating from reviews
    const partnerRole = partnerAccount?.role || "customer";
    // For reviews: if partner is tasker, reviewee_role is "tasker" (customer reviews tasker)
    // If partner is customer, reviewee_role is "customer" (tasker reviews customer)
    const revieweeRole = partnerRole === "tasker" ? "tasker" : "customer";

    const reviewStats = await Review.aggregate([
        {
            $match: {
                reviewee_id: partner._id,
                reviewee_role: revieweeRole,
                status: "visible"
            }
        },
        {
            $group: {
                _id: "$reviewee_id",
                average_rating: { $avg: "$rating" }
            }
        }
    ]);

    const averageRating = reviewStats.length > 0 && reviewStats[0].average_rating
        ? Number(reviewStats[0].average_rating.toFixed(1))
        : 0.0;

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
      .sort({ _id: -1 }) 
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
              average_rating: averageRating,
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
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // Find chats where user is a participant
    const chats = await Chat.find({
      "participants.user_id": userId,
      status: { $ne: "deleted" } 
    })
    .populate({
      path: "participants.user_id",
      select: "full_name avatar_url", 
      model: "User"
    })
    .populate({
      path: "last_message",
      select: "content message_type sent_at sender_id", // Get message preview
      model: "Message"
    })
    .populate({
        path: "order_id",
        select: "status task_snapshot", // For greying out completed order
        model: "Order"
    })
    .sort({ updated_at: -1 }) // Newest active chats first (descendingly)
    .lean();

    // Transform data for Frontend
    const formattedChats = chats.map(chat => {
      const me = chat.participants.find(p => String(p.user_id._id) === userId);
      const partner = chat.participants.find(p => String(p.user_id._id) !== userId);

      // Handle edge case where partner user might be deleted
      const partnerInfo = partner ? partner.user_id : { full_name: "Người dùng ẩn", avatar_url: null };

      // Check if the last message was seen by the caller
      let isSeen = true;
      if (chat.last_message) {
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
        order_name: chat.order_id.task_snapshot.name,
        
        partner: {
          id: partnerInfo._id,
          full_name: partnerInfo.full_name,
          avatar_url: partnerInfo.avatar_url,
          role: partner ? partner.role : 'unknown'
        },

        last_message: chat.last_message ? {
          content: chat.last_message.message_type === 'text' 
            ? chat.last_message.content 
            : `[${chat.last_message.message_type}]`, 
          sent_at: chat.last_message.sent_at,
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

// Route: GET /api/chats/orders/:orderId/search?keyword=xxx&page=1&limit=20
export const searchMessagesInOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { keyword, page = 1, limit = 20 } = req.query; 
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    if (!keyword || keyword.trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Empty keyword" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(50, parseInt(limit))); // Cap limit at 50
    const skip = (pageNum - 1) * limitNum;

    const targetChat = await fetchChat(orderId, userId);

    const searchCriteria = {
      chat_id: targetChat._id,
      content: { $regex: keyword, $options: "i" }, // Case-insensitive
      status: { $ne: "deleted" }, 
      message_type: "text"
    };

    // Run Queries (Count + Fetch) parallel for performance
    const [totalMatches, searchResults] = await Promise.all([
      Message.countDocuments(searchCriteria),
      Message.find(searchCriteria)
        .sort({ createdAt: -1 }) // Newest matches 
        .skip(skip)
        .limit(limitNum)
        .populate("sender_id", "full_name avatar_url")
        .lean()
    ]);

    const formattedResults = searchResults.map((m) => ({
      id: String(m._id),
      chat_id: String(m.chat_id),
      sender_id: String(m.sender_id._id),
      sender: {
          full_name: m.sender_id.full_name || "Unknown",
          avatar_url: m.sender_id.avatar_url || null,
      },
      content: m.content,
      message_type: m.message_type,
      updatedAt: m.updated_at,
      status: m.status,
    }));

    return res.status(200).json({
      ok: true,
      data: formattedResults,
      pagination: {
        total: totalMatches,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalMatches / limitNum),
        hasMore: pageNum * limitNum < totalMatches
      }
    });

  } catch (err) {
    console.error("API searchMessagesInOrder error:", err);
    return handleChatErrors(res, err);
  }
};