import mongoose from "mongoose";
import Order from "../models/orders.js";
import Account from "../models/accounts.js";
import Chat from "../models/chats.js";

export async function createNewChatForOrder(order_id) {
  if (!mongoose.Types.ObjectId.isValid(order_id))
    throw new Error("invalid_order_id");
  const order = await Order.findById(order_id).exec();
  if (!order) throw new Error("order_not_found");
  if (order.status !== "accepted" && order.status !== "in_progress")
    throw new Error("invalid_order_state");

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
  const chat = await Chat.findOne({ order_id: orderId });
  if (!chat) {
    throw new Error("chat_not_found");
  }

  // Check Status (optional)
  if (checkActive && chat.status === "inactive") {
    throw new Error("chat_closed_after_order_completion");
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
