import Chat from "../models/chats.js";
import Message from "../models/messages.js";
import Order from "../models/orders.js";
import mongoose from "mongoose";
import { createNewChatForOrder, fetchChat } from "../services/chat.service.js";

const max_message_length = 2000;

export default function registerChatHandlers(io) {
  // this run whenever client connects
  io.on("connection", (socket) => {
    const userId = String(socket.user.userId);
    //console.log("socket connected:", socket.id, "- user:", userId);

    socket.join(`user:${userId}`);

    // join to chat room of a specific order
    socket.on("join-room", async (payload = {}, ack) => {
      try {
        const { order_id } = payload || {}; // prevent null destructuring
        if (!order_id)
          return ack && ack({ ok: false, error: "invalid_order_id" });

        let order = await Order.findById(order_id);
        if (!order) return ack && ack({ ok: false, error: "order_not_found" });

        let targetChat = await Chat.findOne({order_id: order_id});
        // Create new chat if there's none yet for order with valid status
        if (
          !targetChat &&
          (order.status === "accepted" || order.status === "assigned" || order.status === "departed" || order.status === "arrived" || order.status === "in_progress")
        ) {
          targetChat = await createNewChatForOrder(order._id);
        }

        // If it still doesn't exist (e.g. order completed, but no chat history), deny access
        if (!targetChat) {
            return ack && ack({ ok: false, error: "chat_not_found_or_unavailable" });
        }

        // permission check
        const participant = targetChat.participants.find(
          (p) => String(p.user_id) === userId
        );
        if (!participant)
          return ack && ack({ ok: false, error: "no_permission" });

        socket.join(`chat:${String(targetChat._id)}`);
        return ack && ack({ ok: true, chatId: String(targetChat._id) });
      } catch (err) {
        console.error("join-room error", err);
        return ack && ack({ ok: false, error: err.message || "server_error" });
      }
    });

    // send message
    socket.on("send-message", async (payload = {}, ack) => {
      try {
        const { target_order_id, content } = payload || {};
        // Basic validation
        if (!content) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "empty_message" });
          return;
        }

        if (typeof content === "string" && content.trim().length === 0) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "empty_message" });
          return;
        }

        if (content.length > max_message_length) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "message_too_long" });
          return;
        }

        const targetChat = await fetchChat(target_order_id, userId, true);

        if (!targetChat) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "chat_not_found" });
          return;
        } else if (targetChat.status === "completed") {
          if (typeof ack === "function")
            return ack({
              ok: false,
              error: "Đơn hàng đã hoàn thành, không thể tiếp tục trò chuyện!",
            });
          return;
        }

        // Persist message
        const messageDoc = new Message({
          chat_id: targetChat._id,
          sender_id: new mongoose.Types.ObjectId(userId),
          content: content,
          message_type: "text",
          attachment_url: "",
          status: "sent",
        });
        await messageDoc.save();

        // Update chat.last_message reference
        await Chat.updateOne(
          { _id: targetChat._id },
          { $set: { last_message: messageDoc._id } }
        ).exec();

        // ACK sender
        if (typeof ack === "function")
          ack({
            ok: true,
            id: messageDoc._id,
            createdAt: messageDoc.createdAt,
          });

        // Build payload to emit to chat room
        const payloadToEmit = {
          id: String(messageDoc._id),
          chat_id: String(targetChat._id),
          sender_id: String(messageDoc.sender_id),
          content: messageDoc.content,
          message_type: messageDoc.message_type,
          updatedAt: messageDoc.updated_at,
          status: messageDoc.status,
        };

        // Emit to everyone in chat room
        // io.to(`chat:${targetChat._id}`).emit("receive-message", payloadToEmit);
        
        // Send to every participant's personal "User Room"
        // This ensures they get the message even if they are looking at a different order
        if (targetChat.participants && targetChat.participants.length > 0) {
            targetChat.participants.forEach((p) => {
                io.to(`user:${p.user_id}`).emit("receive-message", payloadToEmit);
            });
        }

      } catch (err) {
        console.error("send-message error", err);
        if (typeof ack === "function")
          ack({ ok: false, error: err.message || "server error" });
      }
    });

    socket.on("edit-message", async (payload = {}, ack) => {
      try {
        const { message_id, new_content } = payload || {};

        if (!message_id)
           return ack && ack({ ok: false, error: "missing_message_id" });

        if (!new_content || new_content.trim().length === 0)
           return ack && ack({ ok: false, error: "empty_content" });

        if (new_content.length > max_message_length)
           return ack && ack({ ok: false, error: "message_too_long" });

        const message = await Message.findById(message_id);

        if (!message) 
          return ack && ack({ ok: false, error: "message_not_found" });

        // Only sender can edit
        if (String(message.sender_id) !== userId) 
          return ack && ack({ ok: false, error: "no_permission" });

        if (message.status === 'deleted')
          return ack && ack({ ok: false, error: "cannot_edit_deleted_message" });

        message.content = new_content;
        message.status = "edited"; 
        await message.save();

        io.to(`chat:${String(message.chat_id)}`).emit("message-updated", {
          id: String(message._id),
          chat_id: String(message.chat_id),
          content: message.content,
          status: "edited",
          updatedAt: message.updatedAt
        });

        return ack && ack({ ok: true });

      } catch (err) {
        console.error("edit-message error", err);
        return ack && ack({ ok: false, error: err.message || "server_error" });
      }
    });

    socket.on("delete-message", async (payload = {}, ack) => {
      try {
        const { message_id } = payload || {};

        if (!message_id) 
          return ack && ack({ ok: false, error: "missing_message_id" });

        const message = await Message.findById(message_id);

        if (!message) 
          return ack && ack({ ok: false, error: "message_not_found" });

        if (String(message.sender_id) !== userId) 
          return ack && ack({ ok: false, error: "no_permission" });

        message.status = 'deleted';
        await message.save();

        // Broadcast deletion event
        io.to(`chat:${String(message.chat_id)}`).emit("message-deleted", {
          id: String(message._id),
          chat_id: String(message.chat_id),
          status: 'deleted'
        });

        return ack && ack({ ok: true });

      } catch (err) {
        console.error("delete-message error", err);
        return ack && ack({ ok: false, error: err.message || "server_error" });
      }
    });

    // Typing indicator
    socket.on("start-typing", async (payload = {}, ack) => {
      try {
        const { target_order_id } = payload || {};

        const targetChat = await fetchChat(target_order_id, userId);

        socket.to(`chat:${targetChat._id}`).emit("start-typing");
      } catch (err) {
        console.error(`start-typing error`, err);
        if (typeof ack === "function")
          return ack({ ok: false, error: err.message || "server_error" });
      }
    });

    // Stop typing indicator
    socket.on("stop-typing", async (payload = {}, ack) => {
      try {
        const { target_order_id } = payload || {};

        const targetChat = await fetchChat(target_order_id, userId);

        socket.to(`chat:${targetChat._id}`).emit("stop-typing");
      } catch (err) {
        console.error(`start-typing error`, err);
        if (typeof ack === "function")
          return ack({ ok: false, error: err.message || "server_error" });
      }
    });

    socket.on("mark-read", async (payload = {}, ack) => {
      try {
        const { target_order_id } = payload || {};

        const targetChat = await fetchChat(target_order_id, userId);
        const chatId = targetChat._id;

        // Find the LATEST message sent by the OTHER party.
        const latestMessage = await Message.findOne({
          chat_id: chatId,
          sender_id: { $ne: userId }, // Message from the other person
        })
          .select("_id sent_at")
          .sort({ sent_at: -1 }) // Get the newest one
          .lean();

        if (!latestMessage) {
          // Nothing to mark as read
          return ack && ack({ ok: true });
        }

        // Update the latest read message of the other participant
        const currentTime = new Date();

        const updateResult = await Chat.updateOne(
  {
    _id: chatId,
    participants: {
      $elemMatch: {
        user_id: userId,
        last_seen_message_id: { $ne: latestMessage._id }
      }
    }
  },
  {
    $set: {
      "participants.$.last_seen_message_id": latestMessage._id,
      "participants.$.last_seen_at": currentTime,
    },
  }
);

        // Notify the other participant that their message was read
        if (updateResult.modifiedCount > 0) {
          socket.to(`chat:${String(chatId)}`).emit("messages-seen", {
            chat_id: String(chatId),
            seen_by: userId,
            last_seen_message_id: String(latestMessage._id),
            seen_at: currentTime,
          });
        }

        // ACK to the calling socket
        if (typeof ack === "function")
          ack({ ok: true, last_seen_message_id: String(latestMessage._id) });
      } catch (err) {
        console.error("mark-read error", err);
        if (typeof ack === "function")
          ack({ ok: false, error: err.message || "server_error" });
      }
    });

    // Handle socket disconnection
    socket.on("disconnect", (reason) => {
      console.log("socket disconnected", socket.id, "reason:", reason);
    });
  });
}
