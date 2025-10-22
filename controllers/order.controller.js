import Order from "../models/orders.js";
import { createOrderByCustomer, cancelOrderByCustomer } from "../services/order.service.js";

// List all orders with optional filters (customer_id, tasker_id, status) and pagination
// only for ADMIN
export const getAllOrders = async (req, res) => {
  try {
    const { customer_id, tasker_id, status, page = 1, limit = 50 } = req.query;
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
    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

// Delete a specific order, only for ADMIN
export const deleteOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res
      .status(200)
      .json({ success: true, message: "Delete order successfully." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

// Get order by id
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

// get all orders of a specific customer, for customer and admin
export const getAllOrdersByCustomerId = async (req, res) => {
  try {
    const { customerId, limit = 50, page = 1, status } = req.query;
    const q = {};
    if (customerId) q.customer = customerId;
    if (status) q.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(q)
      .populate("service provider")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

// customer creates order
export const createOrder = async (req, res) => {
  try {
    const userId = req.userId; // customer ID
    const orderData = req.body; // contains task_id, location, scheduled_at, etc.

    const order = await createOrderByCustomer(userId, orderData);

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

// customer delete order
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params; // order ID
    const customerId = req.userId;
    const { reason } = req.body;

    const order = await cancelOrderByCustomer(id, customerId, reason);
    res.status(200).json({ success: true, order });

  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: err.message });
  }
};

