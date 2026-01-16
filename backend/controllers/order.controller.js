import mongoose from "mongoose";
import { Voucher, VoucherUsage, Order, Customer, User, Receipt, Review } from "../models/index.js";
import {
  cancelOrderByCustomerService,
  getAllOrdersService,
  deleteOrderByIdService,
  getOrderByIdService,
  getAllOrdersByCustomerIdService,
  createOrderService,
  verifyCustomerOrderStats,
  getOrderTrendsService,
  assignTaskerService,
  canCancelOrderByCustomer
} from "../services/order.service.js";

import { getSocketInstance } from "../sockets/instance.js";

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

// Get order details with reviews and receipt for customer activity page
export const getOrderDetailsForCustomer = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.userId;

    // Get order with all populated fields
    const order = await Order.findById(orderId)
      .populate('customer_id', 'full_name phone_number email')
      .populate('tasker_id', 'full_name phone_number email avatar_url')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng."
      });
    }

    // Verify ownership
    if (String(order.customer_id._id || order.customer_id) !== String(customerId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền xem đơn hàng này."
      });
    }

    // Get receipt
    const receipt = await Receipt.findOne({ order_id: orderId }).lean();

    // Get reviews (customer reviewing tasker)
    const review = await Review.findOne({
      order_id: orderId,
      reviewer_id: customerId,
      reviewee_role: "tasker",
      status: "visible"
    })
      .populate('reviewer_id', 'full_name avatar_url')
      .populate('reviewee_id', 'full_name avatar_url')
      .lean();

    // Check if can cancel
    const cancelCheck = await canCancelOrderByCustomer({
      orderId: order._id,
      customerId: customerId
    });

    res.status(200).json({
      success: true,
      order,
      receipt: receipt || null,
      review: review || null,
      canCancel: cancelCheck.canCancel,
      cancelReason: cancelCheck.reason || null,
      penaltyAmount: cancelCheck.penaltyAmount || 0
    });

  } catch (err) {
    console.error("Error in getOrderDetailsForCustomer:", err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

export const getAllOrdersByCustomerId = async (req, res) => {
  try {
    // Use customerId from params if provided and not "me", otherwise use authenticated user's ID
    const customerId = req.params.customerId 
      ? req.params.customerId : req.userId;
    
    console.log("customerId: ", customerId);
    // Extract query parameters
    const { status, category, page = 1, limit = 50 } = req.query;

    const orders = await getAllOrdersByCustomerIdService({
      customerId,
      status,
      category, // "upcoming" or "history"
      page: Number(page),
      limit: Number(limit),
    });
    
    // Populate receipt for payment method (if exists)
    const ordersWithReceipts = await Promise.all(
      orders.map(async (order) => {
        const receipt = await Receipt.findOne({ order_id: order._id }).lean();
        return {
          ...order,
          receipt: receipt || null,
        };
      })
    );
    
    res.status(200).json({ 
      success: true, 
      orders: ordersWithReceipts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: ordersWithReceipts.length
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const createOrder = async (req, res) => {
  console.log("req.body in createOrder", req.body);
  try {
    console.log("Creating order for user:", req.userId);

    const result = await createOrderService({
      customer_id: req.userId,
      ...req.body,
    });

    const order = result.order;
    console.log("RESULT ORDER: ", order);

    return res.status(201).json({
      success: true,
      message: "Tạo đơn hàng thành công.",
      order: order,
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

// Get order trends for last 7 days (admin only)
export const getOrderTrends = async (req, res) => {
  try {
    const trends = await getOrderTrendsService();

    res.status(200).json({
      success: true,
      trends
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// Find and assign tasker for an order
export const findTaskerForOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.userId;

    // Get order as Mongoose document (not lean) because assignTaskerService needs to call save()
    const order = await Order.findById(orderId)
      .populate('customer_id', 'full_name phone_number email')
      .populate('tasker_id', 'full_name phone_number email')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng."
      });
    }

    // Check if order belongs to the customer
    const orderCustomerId = order.customer_id?._id || order.customer_id;
    if (String(orderCustomerId) !== String(customerId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không có quyền truy cập đơn hàng này."
      });
    }

    // Check if order already has a tasker assigned and is not in pending status
    if (order.tasker_id && order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Đơn hàng đã được gán tasker và không thể tìm lại.",
        order: order.toObject()
      });
    }

    // If order is not pending, don't allow finding tasker
    if (order.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: `Không thể tìm tasker cho đơn hàng ở trạng thái "${order.status}".`
      });
    }

    // Only find tasker for immediate orders
    if (order.type !== "immediate") {
      return res.status(400).json({
        success: false,
        message: "Chỉ có thể tìm tasker cho đơn hàng đặt liền."
      });
    }

    // Find and assign tasker
    const { suggestion, suggestTaskers } = await assignTaskerService(order);

    // Refresh order to get updated data
    await order.populate('tasker_id', 'full_name phone_number email');
    const updatedOrder = await getOrderByIdService(orderId);

    return res.status(200).json({
      success: true,
      message: "Đã tìm thấy tasker phù hợp.",
      order: updatedOrder,
      assignedTasker: suggestion,
      suggestedTaskers: suggestTaskers
    });

  } catch (err) {
    console.log("Error in findTaskerForOrder:", err);
    return res.status(400).json({
      success: false,
      message: err.message
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