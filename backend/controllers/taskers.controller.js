import {
    acceptTaskRequest, confirmDepartureService, denyTaskRequest,
    confirmArrivingService, confirmStartService, confirmCompleteService,
    cashOutForTasker, getCashoutInfo, availableCashout,
    getTaskerAcceptanceRate
} from "../services/taskers.service.js";
import mongoose from "mongoose";
import { getSocketInstance } from "../sockets/instance.js";
import { User, Order, Notification, Customer, Tasker, Receipt, OrderStatusLog, Account, Review } from "../models/index.js";
import { pushNotification } from "../services/notification.service.js";
import { changeOrderStatus, getOrderByIdService, getAvailableOrdersForTaskerService, getAllOrdersByTaskerIdService } from "../services/order.service.js";
import { markReceiptPaidService } from "./receipt.controller.js";

// tasker nhận task
export const acceptTask = async (req, res) => {
    const { orderId } = req.params;
    try {
        await acceptTaskRequest(req.userId, orderId);

        const order = await Order.findById(orderId);
        if (!order) {
          return res.status(404).json({ message: "Không tìm thấy đơn hàng."});
        }

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId).select("full_name");
        const tasker_name = tasker.full_name.toString();
        console.log("tasker", tasker);

        // gửi thông báo xác nhận cho tasker
        await pushNotification(
          req.userId,
          "Bạn đã nhận đơn hàng!",
          `Bạn đã nhận đơn hàng có ID: ${orderId}`,
          "order",
          "Order",
          orderId,
          "unread"
        );

        // gửi thông báo cho khách hàng
        await pushNotification(
          customerUserId,
          "Đơn hàng đã được chấp nhận!",
          `Tasker ${tasker_name} đã nhận đơn hàng của bạn!`,
          "order",
          "Order",
          orderId,
          "unread"
        );

        res.status(200).json({ 
          success: true,
          message: "Order accepted successfully" 
        });
    }
    catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message || "Failed to accept order"
        });
    }
}

// tasker xác nhận khởi hành đến địa điểm của khách hàng
export const confirmDeparture = async (req, res) => {
    const { orderId } = req.params;
    try {
        await confirmDepartureService(req.userId, orderId);

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
        }

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId).select("full_name");
        const tasker_name = tasker.full_name || "Nhân viên";

        const now = new Date();

        // gửi thông báo xác nhận cho tasker
        await pushNotification(
            req.userId,
            "Bạn đã xác nhận bắt đầu khởi hành đến điểm đến!",
            `Bạn đã xác nhận khởi hành cho đơn hàng có ID: ${orderId}.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        // gửi thông báo cho khách
        await pushNotification(
            customerUserId,
            "Tasker đang trên đường đến!",
            `Tasker ${tasker_name} đã xác nhận khởi hành đến địa điểm của bạn. 
                Hãy để ý điện thoại trong thời gian này nhé.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ 
            success: true,
            message: "Tasker confirm departure successfully" 
        });
    }
    catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message || "Failed to confirm departure"
        });
    }
}

// tasker từ chối task
export const denyTask = async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error("Order not found.");
        }

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId);
        const tasker_name = tasker.full_name.toString();

        // thông báo xác nhận cho tasker
        await pushNotification(
            req.userId,
            "Bạn đã từ chối đơn hàng!",
            `Bạn đã từ chối đơn hàng có ID: ${orderId}. Hãy chú ý đến điểm uy tín của mình nhé.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        // thông báo cho khách
        // await pushNotification(
        //     customerUserId,
        //     "Đơn hàng đã bị tasker từ chối",
        //     `Tasker ${tasker_name} đã từ chối đơn hàng của bạn. Hệ thống đang tìm tasker khác cho bạn.`,
        //     "order",
        //     "Order",
        //     orderId,
        //     "unread"
        // );

        const newTasker = await denyTaskRequest(req.userId, orderId, reason);

        await pushNotification(
            newTasker.user_id,
            "Bạn có đơn hàng mới.",
            `Bạn vừa được chỉ định thực hiện đơn hàng mới (ID: ${orderId}). 
                Vui lòng xác nhận sớm trong vòng 2 phút kể từ lúc nhận thông báo.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ 
            success: true,
            message: "Order denied and assign task to another tasker successfully" 
        });
    }
    catch (error) {
        res.status(400).json({ 
            success: false,
            message: error.message || "Failed to deny order"
        });
    }
};

// tasker xác nhận đã đến nơi
export const confirmArriving = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error("Order not found.");
        }

        await confirmArrivingService(req.userId, orderId);

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId);
        const taskerName = tasker.full_name ?? "Nhân viên";

        // xác nhận với tasker
        await pushNotification(
            req.userId,
            "Bạn đã xác nhận đến điểm đến!",
            `Bạn đã xác nhận đến điểm đến. Hãy nhanh chóng liên lạc với khách hàng nhé.`,
            "order",
            "Order",
            orderId,
            "unread"
        );
        // thông báo cho khách
        await pushNotification(
            customerUserId,
            "Tasker đã đến nơi!",
            `Tasker ${taskerName} đã đến địa điểm của bạn. Vui lòng chú ý điện thoại.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ 
            success: true,
            message: "Tasker confirmed arriving" 
        });
    }
    catch (err) {
        res.status(400).json({ 
            success: false,
            message: err.message 
        });
    }
};

// tasker xác nhận bắt đầu công việc
export const confirmStart = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error("Order not found.");
        }

        await confirmStartService(req.userId, orderId);

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId).select("full_name");
        const taskerName = tasker?.full_name || "Nhân viên";

        // xác nhận với tasker
        await pushNotification(
            req.userId,
            "Bạn đã xác nhận bắt đầu đơn hàng!",
            `Bạn đã xác nhận bắt đầu thực hiện đơn hàng có ID: ${orderId}. 
                Hãy cố gắng hoàn thành tốt và đúng giờ nhé.`,
            "order",
            "Order",
            orderId,
            "unread"
        );
        // gửi cho khách
        await pushNotification(
            customerUserId,
            "Công việc đã được bắt đầu",
            `Tasker ${taskerName} đã bắt đầu thực hiện dịch vụ. 
                Nếu có thắc mắc hoặc cần hỗ trợ, hãy liên lạc với tasker nhé.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ 
            success: true,
            message: "Tasker started task successfully" 
        });
    } 
    catch (err) {
        res.status(400).json({ 
            success: false,
            message: err.message || "Failed to start task"
        });
    }
};

export const confirmComplete = async (req, res) => {
  const { orderId } = req.params;
  const session = await mongoose.startSession();

  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) throw new Error("Order not found.");

    if (order.status === "completed") {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Đơn hàng đã được hoàn thành trước đó."
      });
    }

    await confirmCompleteService(req.userId, orderId, session);

    const customerUserId = order.customer_id.toString();

    const tasker = await User.findById(req.userId).select("full_name").session(session);
    const taskerName = tasker?.full_name || "Anonymous";

    const receipt = await Receipt.findOne({ order_id: order._id }).session(session);
    if (!receipt) throw new Error("Không tìm thấy hóa đơn.");

    if (receipt.payment_method === "cash") {
      // tiền mặt thì phải update thời điểm thanh toán thủ công
      console.log("before marking paid receipt!!!");
      console.log("receipt_id: ", receipt._id);
      console.log("transaction_id in receipt: ", receipt.transaction_id);
      
      await markReceiptPaidService({
        receiptId: receipt._id,
        transactionId: receipt.transaction_id,
        session
      });
    }

    // update số đơn hoàn thành của khách hàng
    await Customer.updateOne(
      { user_id: customerUserId },
      { $inc: { total_completed_orders: 1 } },
      { session }
    );

    let reputationDelta = Math.floor(receipt.total_amount * 0.1);
    if (reputationDelta === 0) reputationDelta = 10;
    console.log("reputation delta: ", reputationDelta);
    
    // update điểm danh tiếng của khách
    await User.updateOne(
      { _id: customerUserId },
      { $inc: { reputation_score: reputationDelta } },
      { session }
    );
    console.log("DONE UPDATING REPUTATION SCORE FOR CUSTOMER");

    // update điểm danh tiếng của tasker
    await User.updateOne(
      { _id: req.userId },
      { $inc: { reputation_score: reputationDelta } },
      { session }
    );
    
    console.log("DONE UPDATING REPUTATION SCORE FOR TASKER");
    await session.commitTransaction();

    await pushNotification(
      req.userId,
      "Bạn đã xác nhận hoàn thành đơn hàng!",
      `Bạn đã xác nhận hoàn thành đơn hàng ${orderId}.`,
      "order",
      "Order",
      orderId,
      "unread"
    );

    await pushNotification(
      customerUserId,
      "Dịch vụ đã hoàn thành",
      `Tasker ${taskerName} đã xác nhận hoàn tất đơn hàng của bạn.`,
      "order",
      "Order",
      orderId,
      "unread"
    );

    const admins = await Account.find({ role: "admin" }).select("user_id");
    await Promise.all(
      admins.map(ad =>
        pushNotification(
          ad.user_id,
          "Đơn hàng đã hoàn thành!",
          `Đơn hàng ${orderId} đã được xác nhận hoàn thành.`,
          "order",
          "Order",
          orderId,
          "unread"
        )
      )
    );

    res.status(200).json({
      success: true,
      message: "Đơn hàng hoàn thành."
    });

  } catch (err) {
    await session.abortTransaction();
    res.status(400).json({
      success: false,
      message: err.message || "Failed to complete task"
    });
  } finally {
    session.endSession();
  }
};

// Lấy danh sách tất cả tasker với phân trang, lọc và sắp xếp
export const getAllTaskers = async (req, res) => {
    try {
        const {
            status,
            working_status,
            sort_by = "created_at",
            sort_dir = "asc",
            page = 1,
            limit = 10
        } = req.query;

        const filter = {};

        if (status) filter.status = status;
        if (working_status) filter.working_status = working_status;

        const taskers = await Tasker.find(filter)
            .populate({
                path: "user_id",
                select: "full_name phone_number identification avatar_url"
            })
            .populate({
                path: "user_id",
                populate: {
                    path: "account_id",
                    select: "email status is_verified"
                }
            })
            .sort({ [sort_by]: sort_dir === "desc" ? -1 : 1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Tasker.countDocuments(filter);

        res.status(200).json({
            success: true,
            page: Number(page),
            limit: Number(limit),
            total,
            data: taskers
        });

  } catch (error) {
    console.error("Get all taskers error:", error);
    res.status(500).json({ success: false, message: "Server error", error });
  }
};

// Get available orders for tasker (for tasker home page)
export const getAvailableOrdersForTasker = async (req, res) => {
  try {
    const taskerUserId = req.userId;
    const { page = 1, limit = 50 } = req.query;

    const orders = await getAvailableOrdersForTaskerService({
      taskerUserId,
      page: Number(page),
      limit: Number(limit),
    });

    res.status(200).json({
      success: true,
      orders,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: orders.length
      }
    });

  } catch (err) {
    console.error("Error in getAvailableOrdersForTasker:", err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// Get all orders for tasker (for activity page)
export const getTaskerOrders = async (req, res) => {
  try {
    const taskerUserId = req.userId;
    const { status, category, page = 1, limit = 50 } = req.query;

    const orders = await getAllOrdersByTaskerIdService({
      taskerUserId,
      status,
      category, // "current_working", "scheduled", or "history"
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

// Get order details for tasker
export const getOrderDetailsForTasker = async (req, res) => {
  try {
    const { orderId } = req.params;
    const taskerUserId = req.userId;

    // Get order with all populated fields
    const order = await Order.findById(orderId)
      .populate('customer_id', 'full_name phone_number email avatar_url reputation_score')
      .populate('tasker_id', 'full_name phone_number email avatar_url reputation_score')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id')
      .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy đơn hàng."
      });
    }

    // Verify tasker is assigned to this order
    if (order.tasker_id && String(order.tasker_id._id || order.tasker_id) !== String(taskerUserId)) {
      return res.status(403).json({
        success: false,
        message: "Bạn không được gán cho đơn hàng này."
      });
    }

    // Get receipt
    const receipt = await Receipt.findOne({ order_id: orderId }).lean();

    // Get order status logs for timeline
    const statusLogs = await OrderStatusLog.find({ order_id: orderId })
      .sort({ created_at: 1 })
      .lean();

    res.status(200).json({
      success: true,
      order,
      receipt: receipt || null,
      statusLogs: statusLogs || []
    });

  } catch (err) {
    console.error("Error in getOrderDetailsForTasker:", err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// tasker nhấn nút sẵn sàng làm việc/nghỉ làm việc
export const updateWorkingStatus = async (req, res) => {
    try {
        const userId = req.userId;
        const { working_status } = req.body;

        if (!["available", "offline"].includes(working_status)) {
            return res.status(400).json({
                success: false,
                message: "Trạng thái làm việc không hợp lệ, chỉ được cập nhật sang Không hoạt động hoặc Đang rảnh."
            });
        }

    const tasker = await Tasker.findOne({ user_id: userId });
    if (!tasker) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tasker"
      });
    }
    const taskerId = tasker._id;

    // Không cho bật available nếu chưa được duyệt
    if (tasker.status !== "working" && working_status === "available") {
      return res.status(403).json({
        success: false,
        message: "Tasker chưa được duyệt thành công."
      });
    }

    // log trạng thái tasker
    const taskerLog = await changeTaskerStatus({
      taskerId,
      toStatus: working_status,
      actorType: "tasker",
      actorId: null
    });

        tasker.working_status = working_status;
        await tasker.save();

        return res.json({
            success: true,
            working_status: tasker.working_status
        });

    } catch (err) {
        console.error("UPDATE WORKING STATUS ERROR:", err);
        res.status(500).json({
            success: false,
            message: "Lỗi hệ thống"
        });
    }
};

export const getTaskerAcceptanceStats = async (req, res) => {
  try {
    const tasker = await Tasker.findOne({ user_id: req.userId });
    if (!tasker) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy tasker"
      });
    }

    const acceptanceStats = await getTaskerAcceptanceRate(req.userId);

    return res.status(200).json({
      success: true,
      acceptance_rate: acceptanceStats.acceptanceRate,
      stats: acceptanceStats
    });

  } catch (error) {
    console.error("GET TASKER STATS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server"
    });
  }
};

// tasker rút lương
export const cashOut = async (req, res) => {
    try {
        const userId = req.userId;
        const result = await cashOutForTasker(userId);
        if (result === true) {
            res.status(200).json({ success: true, message: "Yêu cầu rút tiền thành công." });
        }
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Yêu cầu rút tiền thất bại.", error: error.message });
    }
};

export const amountCashout = async (req, res) => {
    try {
        const userId = req.userId;
        const timespan = req.query.timespan;
        const result = await getCashoutInfo(userId, timespan);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Lấy thông tin rút tiền thất bại.", error: error.message });
    }
}

export const availableCashoutAmount = async (req, res) => {
    try{
        const userId = req.userId;
        const result = await availableCashout(userId);
        res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        res.status(500).json({ success: false, message: "Lấy số tiền có thể rút thất bại.", error: error.message });
    }
};