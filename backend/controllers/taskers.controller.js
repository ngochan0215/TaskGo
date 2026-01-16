import { acceptTaskRequest, confirmDepartureService, denyTaskRequest,
    confirmArrivingService, confirmStartService, confirmCompleteService
 } from "../services/taskers.service.js";
import { getSocketInstance } from "../sockets/instance.js";
import { User, Order, Notification, Customer, Tasker } from "../models/index.js";
import { pushNotification } from "../services/notification.service.js";
import { changeOrderStatus } from "../services/order.service.js";

// tasker nhận task
export const acceptTask = async (req, res) =>{
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

        await pushNotification(
            customerUserId,
            "Đơn hàng đã được chấp nhận!",
            `Tasker ${tasker_name} đã nhận đơn hàng của bạn!`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ message: "Order accepted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Failed to accept order", error: error.message });
    }
}

// tasker xác nhận khởi hành đến địa điểm của khách hàng
export const confirmDeparture = async (req, res) =>{
    const {  orderId } = req.params;
    try {
        await confirmDepartureService(req.userId, orderId);

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: "Không tìm thấy đơn hàng."});
        }

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId).select("full_name");
        const tasker_name = tasker.full_name || "Nhân viên";

        await pushNotification(
            customerUserId,
            "Tasker đang trên đường đến!",
            `Tasker ${tasker_name} đã xác nhận khởi hành đến địa điểm của bạn.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ message: "Tasker confirm departure successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to confirm departure", error: error.message });
    }
}

// tasker từ chối task
export const denyTask = async (req, res) =>{
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

        await pushNotification(
            customerUserId,
            "Đơn hàng đã bị tasker từ chối",
            `Tasker ${tasker_name} đã từ chối đơn hàng của bạn. Hệ thống đang tìm tasker khác cho bạn.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        const newTasker = await denyTaskRequest(req.userId, orderId, reason);

        await pushNotification(
            newTasker.taskerId,
            "Bạn có đơn hàng mới.",
            `Bạn vừa được chỉ định thực hiện đơn hàng mới (ID: ${orderId}).`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        // const notification = await Notification.create({
        //     user_id: user_id,
        //     title: "Đơn hàng đã bị từ chối",
        //     content: `Tasker ${tasker_name} đã từ chối đơn hàng của bạn. Hệ thống đang tìm
        //     tasker khác cho bạn.`,
        //     type: "order",
        //     reference: { kind: "Order", refId: orderId },
        //     status: "unread",
        // });

        // const io = getSocketInstance();
        // io.to(`user:${user_id}`).emit("notification", {
        //     id: notification._id,
        //     title: notification.title,
        //     content: notification.message,
        //     type: notification.type,
        //     created_at: notification.created_at,
        //     reference: notification.reference,
        // });

        // const newTaskerNoti = await Notification.create({
        //     user_id: newTasker.taskerId,
        //     title: "Bạn có đơn hàng mới.",
        //     message: `Bạn vừa được chỉ định thực hiện đơn hàng mới (ID: ${orderId}).`,
        //     type: "order",
        //     reference: { kind: "Order", refId: orderId },
        //     status: "unread",
        // });

        //  io.to(`user:${newTasker.taskerId}`).emit("notification", {
        //     id: newTaskerNoti._id,
        //     title: newTaskerNoti.title,
        //     content: newTaskerNoti.content,
        //     type: newTaskerNoti.type,
        //     created_at: newTaskerNoti.created_at,
        //     reference: newTaskerNoti.reference,
        // });

        res.status(200).json({ message: "Order denied and assign task to another tasker successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to deny order", error: error.message });
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

        await pushNotification(
            customerUserId,
            "Tasker đã đến nơi!",
            `Tasker ${taskerName} đã đến địa điểm của bạn.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ message: "Tasker confirmed arriving" });
    }
    catch (err) {
        res.status(400).json({ message: err.message });
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

        await pushNotification(
            customerUserId,
            "Công việc đã được bắt đầu",
            `Tasker ${taskerName} đã bắt đầu thực hiện dịch vụ.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ message: "Tasker started task successfully" });
    } 
    catch (err) {
        res.status(400).json({ message: "Failed to start task", error: err.message });
    }
};

// tasker xác nhận hoàn thành công việc
export const confirmComplete = async (req, res) => {
    const { orderId } = req.params;
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error("Order not found.");
        }

        await confirmCompleteService(req.userId, orderId);

        const customerUserId = order.customer_id.toString();
        console.log("user_id of customer", customerUserId);

        const tasker = await User.findById(req.userId).select("full_name");
        const taskerName = tasker?.full_name || "Anoymous";

        await pushNotification(
            customerUserId,
            "Dịch vụ đã hoàn thành",
            `Tasker ${taskerName} đã hoàn tất đơn hàng của bạn.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        // await Customer.updateOne(
        //     { user_id: customerUserId },
        //     {
        //         $inc: { total_completed_orders: 1 }
        //     },
        //     { runValidators: true }
        // );

        res.status(200).json({ message: "Task completed successfully" });
    }
    catch (err) {
        res.status(400).json({ message: "Failed to complete task", error: err.message });
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

    // Không cho bật available nếu chưa được duyệt
    if (tasker.status !== "working" && working_status === "available") {
      return res.status(403).json({
        success: false,
        message: "Tasker chưa được duyệt thành công."
      });
    }

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