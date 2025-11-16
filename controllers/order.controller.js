import { Order, Task } from "../models/index.js";
import { createOrderByCustomer, cancelOrderByCustomer,
  getAllOrdersService, deleteOrderByIdService, getOrderByIdService, getAllOrdersByCustomerIdService,
 } from "../services/order.service.js";

export const getAllOrders = async (req, res) => {
  try {
    const orders = await getAllOrdersService(req.query);
    res.status(200).json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export const deleteOrderById = async (req, res) => {
  try {
    const deleted = await deleteOrderByIdService(req.params.orderId);
    res.status(200).json({ success: true, deleted });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await getOrderByIdService(req.params.id);
    res.status(200).json({ success: true, order });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const getAllOrdersByCustomerId = async (req, res) => {
  try {
    const { customerId } = req.params;
    const orders = await getAllOrdersByCustomerIdService({
      customerId, 
      ...req.query
    });
    res.status(200).json({ success: true, orders });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// create order by customer
export const createOrder = async (req, res) => {
  try {
    const result = await createOrderService({
      customerId: req.userId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully.",
      order: result.order,
      assignedTasker: result.assignedTasker,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

// customer delete order
export const cancelOrderByCustomer = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await cancelOrderByCustomerService({
      orderId,
      customerId: req.userId,  
      reason: req.body.reason
    });

    return res.status(200).json({ success: true, order });

  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
