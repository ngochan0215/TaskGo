import mongoose from "mongoose";
import { Receipt, Order } from "../models";

export const createReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { order_id, payment_method } = req.body;

    if (!order_id) {
      return res.status(400).json({
        message: "order_id là bắt buộc."
      });
    }

    if (!["cash", "credit_card", "bank_transfer", "ewallet"].includes(payment_method)) {
      return res.status(400).json({
        message: "Phương thức thanh toán không hợp lệ."
      });
    }

    const order = await Order.findById(order_id).session(session);
    if (!order) {
      return res.status(404).json({
        message: "Không tìm thấy đơn hàng."
      });
    }

    const allowedStatuses = ["pending", "awaiting_payment"];
    if (!allowedStatuses.includes(order.status)) {
      return res.status(400).json({
        message: `Không thể tạo hóa đơn khi đơn hàng đang ở trạng thái: ${order.status}`
      });
    }

    if (order.type === "scheduled" && payment_method !== "bank") {
      return res.status(400).json({
        message: "Đơn đặt lịch chỉ được thanh toán bằng chuyển khoản"
      });
    }

    let deposit_paid_amount = 0;
    if (order.type === "scheduled") {
      deposit_paid_amount = Math.round(order.base_amount * 0.3);
    }

    const existingReceipt = await Receipt
      .findOne({ order_id: order._id })
      .session(session);

    if (existingReceipt) {
      await session.commitTransaction();
      return res.status(200).json({
        message: "Hóa đơn đã tồn tại",
        data: {
          receipt: existingReceipt,
          order
        }
      });
    }

    const receipt = await Receipt.create(
      [
        {
          order_id: order._id,
          total_amount: order.base_amount,
          deposit_paid_amount,
          payment_method,
          status: "pending"
        }
      ],
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      message: "Tạo hóa đơn thành công",
      data: {
        receipt: receipt[0],
        order
      }
    });

  } catch (err) {
    await session.abortTransaction();
    return res.status(500).json({
      message: err.message || "Lỗi tạo hóa đơn"
    });
  } finally {
    session.endSession();
  }
};

export const getAllReceipts = async (req, res) => {
  try {
    const { status, payment_method, order_id,
        from_date, to_date } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (payment_method) filter.payment_method = payment_method;

    if (order_id && mongoose.Types.ObjectId.isValid(order_id)) {
      filter.order_id = order_id;
    }

    if (from_date || to_date) {
      filter.created_at = {};
      if (from_date) filter.created_at.$gte = new Date(from_date);
      if (to_date) filter.created_at.$lte = new Date(to_date);
    }

    const receipts = await Receipt.find(filter)
      .populate("order_id")
      .sort({ created_at: -1 });

    return res.status(200).json({
      message: "Lấy danh sách hóa đơn thành công",
      data: receipts
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Lỗi lấy danh sách hóa đơn"
    });
  }
};

export const getReceiptById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID hóa đơn không hợp lệ"
      });
    }

    const receipt = await Receipt.findById(id).populate("order_id");

    if (!receipt) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn"
      });
    }

    return res.status(200).json({
      message: "Lấy hóa đơn thành công",
      data: receipt
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Lỗi lấy hóa đơn"
    });
  }
};

export const updateReceiptStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID hóa đơn không hợp lệ"
      });
    }

    if (!["success", "pending", "failed", "refunded"].includes(status)) {
      return res.status(400).json({
        message: "Trạng thái hóa đơn không hợp lệ"
      });
    }

    const updateData = { status };

    if (status === "success") {
      updateData.paid_at = new Date();
    }

    const receipt = await Receipt.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate("order_id");

    if (!receipt) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn"
      });
    }

    return res.status(200).json({
      message: "Cập nhật trạng thái hóa đơn thành công",
      data: receipt
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Lỗi cập nhật hóa đơn"
    });
  }
};

// dùng cho thanh toán tiền mặt
export const markReceiptPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction_id } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "ID hóa đơn không hợp lệ"
      });
    }

    const receipt = await Receipt.findById(id);

    if (!receipt) {
      return res.status(404).json({
        message: "Không tìm thấy hóa đơn"
      });
    }

    if (receipt.status === "success") {
      return res.status(400).json({
        message: "Hóa đơn đã được thanh toán trước đó"
      });
    }

    receipt.status = "success";
    receipt.paid_at = new Date();
    receipt.transaction_id = transaction_id || null;

    await receipt.save();

    return res.status(200).json({
      message: "Xác nhận thanh toán thành công",
      data: receipt
    });
  } catch (err) {
    return res.status(500).json({
      message: err.message || "Lỗi xác nhận thanh toán"
    });
  }
};