import Chat from "../models/chats.js";
import Message from "../models/messages.js";
import Order from "../models/orders.js";
import Account from "../models/accounts.js";
import mongoose from "mongoose";
import * as chatService from "../services/chat.service.js";

const max_message_length = 2000;
const num_of_msg_per_load = 10;

export default function registerHandlers(io) {
  io.on("connection", (socket) => {
    const userId = String(socket.user.userId);
    console.log("socket connected:", socket.id, "- user:", userId);

    socket.join(`user:${userId}`);

    socket.on("join-room", async (payload = {}, ack) => {
      try {
        const { order_id } = payload || {};
        if (!order_id)
          return ack && ack({ ok: false, error: "order_id_required" });

        let order = await Order.findById(order_id); 
        if (!order) return ack && ack({ ok: false, error: "order_not_found" });

        let targetChat = await Chat.findOne({ order_id: order._id }).exec();
        if (
          !targetChat &&
          (order.status === "accepted" || order.status === "in_progress")
        ) {
          targetChat = await chatService.createNewChatForOrder(order._id);
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
        return ack && ack({ ok: false, error: "server_error" });
      }
    });

    socket.on("send-message", async (payload = {}, ack) => {
      try {
        const { to_order_id, content } = payload || {};
        // Basic validation
        if (!to_order_id || !content) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "invalid_payload" });
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

        // Verify recipient room exists
        const targetChat = await Chat.findOne({
          order_id: new mongoose.Types.ObjectId(to_order_id),
        });

        if (!targetChat) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "chat_not_found" });
          return;
        } else if (targetChat.status === "inactive") {
          if (typeof ack === "function")
            return ack({
              ok: false,
              error: "chat_closed_after_order_completion",
            });
          return;
        }
        // Verify sender's permission
        const participantObj = targetChat.participants.find(
          (p) => String(p.user_id) === userId
        );

        if (!participantObj) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "no_permission" });
          return;
        }

        const chatId = targetChat._id;

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
          createdAt: messageDoc.createdAt,
          status: messageDoc.status,
        };

        // Emit to everyone in chat room
        io.to(`chat:${chatId}`).emit("receive-message", payloadToEmit);

        // // Mark delivered if recipient online
        // const targetRecipient = userId === customer_id ? tasker_id : customer_id;
        // if (targetRecipient) {
        //   const recipientSockets = await io
        //     .in(`user:${targetRecipient}`)
        //     .allSockets();
        //   if (recipientSockets && recipientSockets.size > 0) {
        //     // mark delivered
        //     await Message.updateOne(
        //       { _id: messageDoc._id },
        //       { $set: { status: "delivered" } }
        //     ).exec();
        //     // inform sender's devices about delivery
        //     io.to(`user:${userId}`).emit("message_delivered", {
        //       messageId: String(messageDoc._id),
        //       to: targetRecipient,
        //     });
        //     // inform recipient devices about delivered/new message (optional)
        //     io.to(`user:${targetRecipient}`).emit("new_message_notification", {
        //       message: payloadToEmit,
        //     });
        //   } else {
        //     // recipient offline — keep 'sent' status
        //   }
        // }
      } catch (err) {
        console.error("send-message error", err);
        if (typeof ack === "function")
          ack({ ok: false, error: "server_error" });
      }
    });
    socket.on("get-messages", async (payload = {}, ack) => {
      try {
        const { target_order_id, before } = payload || {};
        if (!target_order_id) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "target_required" });
          return;
        }
        if (!mongoose.Types.ObjectId.isValid(target_order_id)) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "invalid_order_id" });
          return;
        }

        // Verify requesting chat exists
        const targetChat = await Chat.findOne({ order_id: target_order_id });

        if (!targetChat) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "chat_not_found" });
          return;
        }
        // Verify requester's permission
        const participant = targetChat.participants.find(
          (p) => String(p.user_id) === userId
        );
        if (!participant) {
          if (typeof ack === "function")
            return ack({ ok: false, error: "no_permission" });
          return;
        }

        const query = { chat_id: targetChat._id };
        if (before && mongoose.Types.ObjectId.isValid(before)) {
          // fetch messages with _id < before
          query._id = { $lt: new mongoose.Types.ObjectId(before) };
        }

        // Sort descendingly based on id then reverse
        // More efficient than sorting ascendingly with no reverse
        let messages = await Message.find(query)
          .sort({ _id: -1 }) // -1 means descending
          .limit(num_of_msg_per_load)
          .lean();

        const ordered = messages.reverse().map((m) => ({
          id: String(m._id),
          chat_id: String(m.chat_id),
          sender_id: String(m.sender_id),
          content: m.content,
          message_type: m.message_type,
          createdAt: m.createdAt,
          status: m.status,
          attachment_url: m.attachment_url,
        }));

        if (typeof ack === "function") ack({ ok: true, messages: ordered });
      } catch (err) {
        console.error("get-messages error", err);
        if (typeof ack === "function")
          ack({ ok: false, error: "server_error" });
      }
    });
    socket.on("disconnect", (reason) => {
      console.log("socket disconnected", socket.id, "reason:", reason);
    });
  });
}
