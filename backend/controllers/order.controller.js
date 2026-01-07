import {
  cancelOrderByCustomerService,
  getAllOrdersService,
  deleteOrderByIdService,
  getOrderByIdService,
  getAllOrdersByCustomerIdService,
  createOrderService,
} from "../services/order.service.js";

import { getSocketInstance } from "../sockets/instance.js";
import { buildTaskerRanking } from "../services/taskers.service.js";

/**
 * GET ALL ORDERS
 */
export const getAllOrders = async (req, res) => {
  try {
    const orders = await getAllOrdersService(req.query);

    res.status(200).json({ success: true, orders });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * DELETE ORDER
 */
export const deleteOrderById = async (req, res) => {
  try {
    const deleted = await deleteOrderByIdService(req.params.orderId);

    res.status(200).json({ success: true, deleted });

  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * GET ORDER BY ID
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await getOrderByIdService(req.params.id);

    res.status(200).json({ success: true, order });

  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

/**
 * GET ORDERS BY CUSTOMER
 */
export const getAllOrdersByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params || req.userId;

    const orders = await getAllOrdersByCustomerIdService({
      customerId,
      ...req.query,
    });
    
    res.status(200).json({ success: true, orders });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * CREATE ORDER (CUSTOMER)
 */
export const createOrder = async (req, res) => {
  console.log("req.body", req.body);
  try {
    console.log("Creating order for user:", req.userId);
    const result = await createOrderService({
      customer_id: req.userId,
      ...req.body,
    });

    const io = getSocketInstance();

    io.to(`user:${req.userId}`).emit("order-created", {
      order_id: result._id,
      order: result,
    });

    console.log("Emitted order-created to user:", req.userId);

    // Gợi ý tasker dựa trên thuật toán xếp hạng
    const taskers = await buildTaskerRanking(result._id);

    console.log("Tasker ", taskers);
    if (Array.isArray(taskers)) {
      console.log("Taskers to notify:", taskers);
      for (const tasker of taskers) {
        if (tasker._id) {
          console.log("Notifying tasker:", tasker._id);
          io.to(`user:${tasker._id}`).emit("suggest-tasker", {
            order_id: result._id,
            customer_id: req.userId,
            suggestion: tasker,
          });
          console.log("Emitted suggest-tasker to tasker:", tasker._id);
        }
      }
    }

    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order: result,
      assignedTasker: result.assignedTasker,
    });
  } catch (err) {
    console.log("err", err);  
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * CANCEL ORDER (CUSTOMER)
 */
export const cancelOrderByCustomer = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await cancelOrderByCustomerService({
      orderId,
      customerId: req.userId,
      reason: req.body.reason,
    });

    const io = getSocketInstance();

    // 🔔 Notify all sockets in order room
    io.to(`order:${orderId}`).emit("order-cancelled", {
      order_id: orderId,
      reason: req.body.reason,
    });

    return res.status(200).json({ success: true, order });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
