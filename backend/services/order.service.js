
import { Task, Voucher, Discount, User, Order } from "../models/index.js";
import { suggestTasker } from "../services/taskers.service.js";

// Get all orders with optional filters + pagination
export async function getAllOrdersService({ customer_id, tasker_id, status, page = 1, limit = 50 }) {
  try {
    const q = {};
    if (customer_id) q.customer_id = customer_id;
    if (tasker_id) q.tasker_id = tasker_id;
    if (status) q.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return orders;

  } catch (err) {
    throw new Error(err.message);
  }
};

// Delete a specific order, only for ADMIN
export async function deleteOrderByIdService(orderId) {
  try {

    const deleted = await Order.findByIdAndDelete(orderId);
    if (!deleted) throw new Error("Order not found");
    return deleted;
  } catch (err) {
    throw new Error(err.message);
  }
};

// Get order by id
export async function getOrderByIdService(orderId) {
  try {
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error("Order not found");
    return order;
  } catch (err) {
    throw new Error(err.message);
  }
}

// Get all orders of a customer, with pagination + filter by status
export async function getAllOrdersByCustomerIdService({ customerId, status, page = 1, limit = 50 }) {
  try {

    const q = {};
    if (customerId) q.customer = customerId;
    if (status) q.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(q)
      .populate("task_id")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return orders;

  } catch (err) {
    throw new Error(err.message);
  }
};

export async function createOrderService({
  customerId,
  task_id,
  voucher_id,
  discount_id,
  scheduled_at,
  type,
  location,
  note,
  quantity,
  total_amount
}) {
  try {
    if (!task_id || !type || !quantity || !location) {
      throw new Error("Please fill all the required information.");
    }
    
    const scheduleDate = new Date(scheduled_at);
    if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date()) {
      throw new Error("Invalid or past scheduled date.");
    }

    const task = await Task.findById(task_id);
    if (!task) {
      throw new Error("Task not found.");
    }

    let base_fee = task.pricing.amount * quantity;

    let discount_percent = 0;
    if (discount_id) {
      const discount = await Discount.findById(discount_id);
      discount_percent += discount?.percent || 0;
    }

    let voucher_percent = 0;
    if (voucher_id) {
      const voucher = await Voucher.findById(voucher_id);
      voucher_percent += voucher?.percent || 0;
    }

    const discount_amount = (base_fee * discount_percent) / 100;
    const voucher_amount = (base_fee * voucher_percent) / 100;

    const expected_total = Math.max(base_fee - discount_amount - voucher_amount, 0);

    if (Number(total_amount) !== expected_total) {
      throw new Error("Invalid total bill. Please refresh and confirm again.");
    }

    const newOrder = await Order.create({
      customer_id: customerId,
      task_id,
      type,
      scheduled_at: scheduleDate,
      location,
      note,
      voucher_id,
      discount_id,
      quantity,
      base_fee,
      discount_amount,
      voucher_amount,
      total_amount,
      status: "pending",
    });

    // Check if it's immediate (within ~15 mins)
    const isImmediate = new Date(scheduleDate).getTime() <= Date.now() + 15 * 60 * 1000;
    // If immediate, then assign a tasker
    if (isImmediate) {
      const suggestion = await suggestTasker(newOrder._id, {});
      if (!suggestion) throw new Error("No available tasker at the moment");

      await Order.updateOne(
        { _id: newOrder._id },
        {
          tasker_id: suggestion.taskerId,
          status: "assigned",
        }
      );

      const updated = await Order.findById(newOrder._id);
      return { order: updated, assignedTasker: suggestion }      
    }

    // if scheduled order, not assign yet
    return { order: newOrder, assignedTasker: null };

  } catch (err) {
    throw new Error(err.message);
  }
}

// customer cancels order
export async function cancelOrderByCustomerService({ orderId, customerId, reason }) {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error("Order not found.");
    }

    if (customerId && String(order.customer_id) !== String(customerId)) {
      throw new Error("User doesn't have the right to cancel this order.");
    }

    if (order.status === "cancelled" || order.status === "completed") {
      throw new Error("Order cannot be cancelled.");
    }

    // update order status
    order.status = "cancelled";
    order.cancelReason = reason || null;
    order.cancelledAt = new Date();

    await order.save();
    return order;

  } catch (error) {
    throw new Error(error.message);
  }
}
