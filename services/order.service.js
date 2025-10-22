import Task from "../models/tasks.js";
import Voucher from "../models/vouchers.js";
import Discount from "../models/discounts.js";
import User from "../models/users.js";
import Order from  "../models/orders.js";
import { suggestTasker } from "../services/taskers.service.js";

// customer posts order
export const createOrderByCustomer = async (customer_id, data) => {
  try {
    const {
      task_id,
      scheduled_at,
      location,
      note,
      voucher_id,
      discount_id,
      quantity,
      base_fee,
      discount_amount = 0,
      tip_amount = 0,
      total_amount
    } = data;

    if (!customer_id || !task_id || !scheduled_at || !base_fee || !quantity)
      return res.status(400).json({ message: "Inputs are required." });

    const customer = await User.findById(customer_id);
    if (!customer)
      return res.status(404).json({ message: "Customer not found." });

    const task = await Task.findById(task_id);
    if (!task)
      return res.status(404).json({ message: "Task not found." });

    // only find if voucher/discount id is valid
    const voucher = voucher_id ? await Voucher.findById(voucher_id) : null;
    const discount = discount_id ? await Discount.findById(discount_id) : null;

    // Build order object
    const orderData = {
      customer_id: customer._id,
      service_id: task.service_id || null,
      tasker_id: null,
      task_id: task._id,
      scheduled_at,
      completed_at: null,
      location: location || null,
      note: note || "",
      voucher_id: voucher ? voucher._id : null,
      discount_id: discount ? discount._id : null,
      quantity,
      base_fee,
      discount_amount,
      tip_amount,
      total_amount,
      status: "pending",
    };

    // Check if it's immediate (within ~15 mins)
    const isImmediate = new Date(scheduled_at).getTime() <= Date.now() + 15 * 60 * 1000;

    // If immediate, then assign a tasker
    if (isImmediate) {
      const suggestion = await suggestTasker(customer_id);
      if (!suggestion) throw new Error("No available tasker at the moment");

      orderData.tasker_id = suggestion.taskerId;
      // Keep status 'pending' until tasker accepts
    }

    const order = await Order.create(orderData);
    return res.status(201).json({ success: true, order });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};


// customer cancels order
export const cancelOrderByCustomer = async (orderId, customerId, reason) => {
  try {
    const order = await Order.findById(orderId);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });

    // ensure customer identification
    if (customerId && String(order.customer_id) !== String(customerId)) {
      return res
        .status(403)
        .json({ success: false, message: "User doesn't have the right to do this." });
    }

    if (order.status === "cancelled" || order.status === "completed") {
        throw new Error("Order cannot be cancelled.");
    }

    // update order status
    order.status = "cancelled";
    order.cancelReason = reason || null;
    order.cancelledAt = new Date();

    await order.save();
    return res.status(200).json({ success: true, order });
    
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};