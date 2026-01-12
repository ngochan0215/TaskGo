import mongoose from "mongoose";
import { Voucher, VoucherUsage, Order, Customer, User } from "../models/index.js";
import {
  cancelOrderByCustomerService,
  getAllOrdersService,
  deleteOrderByIdService,
  getOrderByIdService,
  getAllOrdersByCustomerIdService,
  createOrderService,
  createReceiptService,
  verifyCustomerOrderStats
} from "../services/order.service.js";

import { getSocketInstance } from "../sockets/instance.js";
import { buildTaskerRanking } from "../services/taskers.service.js";

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

export const createOrder = async (req, res) => {
  console.log("req.body", req.body);
  try {
    console.log("Creating order for user:", req.userId);

    const result = await createOrderService({
      customer_id: req.userId,
      ...req.body,
    });

    console.log("ORDER: ", result);
    const io = getSocketInstance();

    io.to(`user:${req.userId}`).emit("order-created", {
      order_id: result._id,
      order: result,
    });

    console.log("Emitted order-created to user:", req.userId);

    // Gợi ý tasker dựa trên thuật toán xếp hạng
    const taskers = await buildTaskerRanking(result.order._id);
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

export const cancelOrderByCustomer = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await cancelOrderByCustomerService({
      orderId,
      customerId: req.userId,
      reason: req.body.reason,
    });

    const io = getSocketInstance();

    // notify all sockets in order room
    io.to(`order:${orderId}`).emit("order-cancelled", {
      order_id: orderId,
      reason: req.body.reason,
    });

    return res.status(200).json({ success: true, order });
    
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

// trả về số đơn đã hoàn thành và hủy
export const getCustomerOrderStats = async (req, res) => {
  try {
    const customerUserId = req.userId;

    const stats = await verifyCustomerOrderStats(customerUserId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// check lại voucher, thêm record voucher usage
export const applyVoucherToBooking = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user._id;
    const { order_id, voucher_code } = req.body;

    const order = await Order.findById(order_id).session(session);
    if (!order) {
      return res.status(400).json({ message: "Không tìm thấy đơn hàng." });
    }

    if (order.customer_id.toString() !== userId.toString()) {
      return res.status(400).json({ message: "Không có quyền áp voucher cho booking này." });
    }

    if (order.voucher_id) {
      return res.status(400).json({ message: "Đơn hàng đã áp dụng voucher." });
    }

    const voucher = await Voucher.findOne({
      code: voucher_code.toUpperCase(),
      is_active: true
    }).session(session);

    if (!voucher) {
      return res.status(400).json({ message: "Voucher không tồn tại hoặc đã bị vô hiệu hóa." });
    }

    const now = new Date();
    if (now < voucher.begin_date || now > voucher.end_date) {
      return res.status(400).json({ message: "Voucher không nằm trong thời gian hiệu lực." });
    }

    // check tổng lượt
    if (voucher.used_quantity >= voucher.total_quantity) {
      return res.status(400).json({ message: "Voucher đã hết lượt sử dụng." });
    }

    // check per user limit
    const usedByUser = await VoucherUsage.countDocuments({
      voucher_id: voucher._id,
      user_id: userId
    }).session(session);

    if (usedByUser >= voucher.per_user_limit) {
      return res.status(400).json({ message: "Bạn đã dùng hết lượt voucher này." });
    }

    // FIRST_ORDER
    if (voucher.conditions?.rule_type === "FIRST_ORDER") {
      const totalUsed = await VoucherUsage.countDocuments({
        user_id: userId
      }).session(session);

      if (totalUsed > 0) {
        return res.status(400).json({ message: "Voucher chỉ áp dụng cho đơn đầu tiên." });
      }
    }

    // min order value
    if (
      voucher.conditions?.min_order_value &&
      booking.total_amount < voucher.conditions.min_order_value
    ) {
      return res.status(400).json({ message: "Giá trị đơn hàng chưa đạt điều kiện áp voucher." });
    }

    // tính discount
    let discountAmount = 0;

    if (voucher.discount.type === "PERCENT") {
      discountAmount =
        booking.total_amount * (voucher.discount.value / 100);

      if (
        voucher.discount.max_discount &&
        discountAmount > voucher.discount.max_discount
      ) {
        discountAmount = voucher.discount.max_discount;
      }
    }

    if (voucher.discount.type === "FIXED") {
      discountAmount = voucher.discount.value;
    }

    discountAmount = Math.min(discountAmount, booking.total_amount);

    // update booking
    booking.voucher_id = voucher._id;
    booking.discount_amount = discountAmount;
    booking.final_amount = booking.total_amount - discountAmount;

    // ghi usage
    await VoucherUsage.create(
      [
        {
          voucher_id: voucher._id,
          user_id: userId,
          order_id: order._id
        }
      ],
      { session }
    );

    // update voucher
    voucher.used_quantity += 1;

    await order.save({ session });
    await voucher.save({ session });

    await session.commitTransaction();

    return res.json({
      success: true,
      message: "Áp dụng voucher thành công.",
      discount_amount: discountAmount,
      final_amount: booking.final_amount
    });

  } catch (err) {
    await session.abortTransaction();
    return res.status(400).json({
      success: false,
      message: err.message
    });
  } finally {
    session.endSession();
  }
};

export const createReceipt = async (req, res) => {
  try {
    const { order_id, payment_method } = req.body;

    if (!order_id || !payment_method) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu điền đầy đủ thông tin.",
      });
    }

    const receipt = await createReceiptService({ order_id, payment_method });

    return res.status(201).json({
      success: true,
      data: receipt,
    });

  } catch (error) {
    console.error("createReceipt error:", error.message);

    const errorMap = {
      ORDER_NOT_FOUND: "Order not found",
      CUSTOMER_NOT_FOUND: "Customer not found",
      PAID_AMOUNT_NOT_ENOUGH: "Paid amount is not enough",
    };

    return res.status(400).json({
      success: false,
      message: errorMap[error.message] || "Create receipt failed",
    });
  }
};