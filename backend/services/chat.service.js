import mongoose from "mongoose";
import Order from "../models/orders.js";
import Account from "../models/accounts.js";
import Chat from "../models/chats.js";

export async function createNewChatForOrder(order_id) {
  if (!mongoose.Types.ObjectId.isValid(order_id))
    throw new Error("invalid_order_id");
  const order = await Order.findById(order_id).exec();
  if (!order) throw new Error("order_not_found");
  if (order.status === "pending" || order.status === "assigned" || order.status === "completed" || order.status === "cancelled")
    throw new Error("invalid_order_status");

  const customer = await Account.findOne({ user_id: order.customer_id }).exec();
  const tasker = await Account.findOne({ user_id: order.tasker_id }).exec();

  if (!customer || !tasker) throw new Error("participant_not_found");
  if (customer.role !== "customer" || tasker.role !== "tasker")
    throw new Error("invalid_participant_roles");

  const chat = await Chat.findOneAndUpdate(
    { order_id: order._id },
    {
      $setOnInsert: {
        order_id: order._id,
        participants: [
          { user_id: order.customer_id, role: "customer" },
          { user_id: order.tasker_id, role: "tasker" },
        ],
        status: "active",
        last_message: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  return chat;
}

export async function fetchChat(orderId, userId, checkActive = false) {
  // Validate ID format
  if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
    throw new Error("invalid_order_id");
  }

  // Find Chat
  let chat = await Chat.findOne({ order_id: orderId });

  if (!chat) {
    try {
      chat = await createNewChatForOrder(orderId);
    } catch (err) {
      // If creation fails (e.g. Order is 'pending', 'cancelled' or hasn't been 'accepted' by any tasker), 
      // we map it back to "chat_not_found" so the Controller returns 404 
      // instead of a 500 Server Error.
      console.log(err.message);
      if (err.message === "invalid_order_status" || err.message === "order_not_found") {
         throw new Error("chat_not_found");
      }
      throw err; 
    }
  }

  // Check Status 
  if (checkActive && chat.status === "completed") {
    throw new Error("Đơn hàng đã hoàn thành, không thể tiếp tục trò chuyện");
  }

  // Check Permission
  const isParticipant = chat.participants.some(
    (p) => String(p.user_id) === userId
  );

  if (!isParticipant) {
    throw new Error("no_permission");
  }

  return chat;
}
