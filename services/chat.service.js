import mongoose from "mongoose";
import Order from "../models/orders.js";
import Account from "../models/accounts.js";
import Chat from "../models/chats.js";

export async function createNewChatForOrder(order_id) {
  if (!mongoose.Types.ObjectId.isValid(order_id)) throw new Error("Invalid order id");
  const order = await Order.findById(order_id).exec();
  if (!order) throw new Error("Order not found");
  if (order.status !== "accepted" && order.status !== "in_progress")
    throw new Error("Can't create new chat for pending or completed orders");

  const customer = await Account.findOne({ user_id: order.customer_id }).exec();
  const tasker = await Account.findOne({ user_id: order.tasker_id }).exec();

  if (!customer || !tasker) throw new Error("Participant account not found");
  if (customer.role !== "customer" || tasker.role !== "tasker") throw new Error("Only allow chat between customer and tasker");

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
