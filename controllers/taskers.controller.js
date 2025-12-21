import { acceptTaskRequest, confirmDepartureService, denyTaskRequest,
    confirmArrivingService, confirmStartService, confirmCompleteService
 } from "../services/taskers.service.js";
import { getSocketInstance } from "../sockets/instance.js";
import { User, Order, Notification, Customer, Tasker } from "../models/index.js";
import { pushNotification } from "../services/notification.service.js";

export const acceptTask = async (req, res) =>{
    const { orderId } = req.params;
    try {
        await acceptTaskRequest(req.userId, orderId);

        //TODO: send notification to customer
        const order = await Order.findById(orderId).select("customer_id");
        if (!order) throw new Error("Order not found");

        const user_id = order.customer_id.toString();
        console.log("user_id of customer", user_id);

        const tasker = await User.findById(req.userId).select("full_name");
        const tasker_name = tasker.full_name.toString();
        console.log("tasker", tasker);

        const notification = await Notification.create({
            user_id: user_id,
            title: "Đơn hàng đã được chấp nhận",
            message: `Tasker ${tasker_name} đã nhận đơn hàng của bạn!`,
            type: "order",
            reference: { kind: "Order", refId: orderId },
            status: "unread",
        });

        const io = getSocketInstance();
        io.to(`user:${user_id}`).emit("notification", {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            createdAt: notification.createdAt,
            reference: notification.reference,
        });

        res.status(200).json({ message: "Order accepted successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to accept order", error: error.message });
    }
}

export const confirmDeparture = async (req, res) =>{
    const {  orderId } = req.params;
    try {
        await confirmDepartureService(req.userId, orderId);
        //TODO: send notification to customer

        const order = await Order.findById(orderId).select("customer_id");
        if (!order) throw new Error("Order not found");

        const user_id = order.customer_id.toString();
        console.log("user_id of customer", user_id);

        const tasker = await User.findById(req.userId).select("full_name");
        const tasker_name = tasker.full_name || "Tasker";

        const notification = await Notification.create({
            user_id: user_id,
            title: "Tasker đang trên đường đến!",
            message: `Tasker ${tasker_name} đã xác nhận khởi hành đến địa điểm của bạn.`,
            type: "order",
            reference: { kind: "Order", refId: orderId },
            status: "unread",
        });

        // Gửi qua Socket.IO
        const io = getSocketInstance();
        io.to(`user:${user_id}`).emit("notification", {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            createdAt: notification.createdAt,
            reference: notification.reference,
        });
        res.status(200).json({ message: "Tasker confirm departure successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to confirm departure", error: error.message });
    }
}
export const denyTask = async (req, res) =>{
    const {  orderId } = req.params;
    try {
        const newTasker = await denyTaskRequest(req.userId, orderId);

        //TODO: send notification to customer and newTasker
        const order = await Order.findById(orderId).select("customer_id");
        if (!order) throw new Error("Order not found");
        const customerId = order.customer_id.toString();

        const customer = await Customer.findById(customerId);
        if (!customer) throw new Error("Customer not found");
        const user_id = customer.user_id.toString();

        const tasker = await User.findById(req.userId);
        const tasker_name = tasker.full_name.toString();

        const notification = await Notification.create({
            user_id: user_id,
            title: "Đơn hàng đã bị từ chối",
            message: `Tasker ${tasker_name} đã từ chối đơn hàng của bạn. Hệ thống đang tìm
            tasker khác cho bạn.`,
            type: "order",
            reference: { kind: "Order", refId: orderId },
            status: "unread",
        });

        const io = getSocketInstance();
        io.to(`user:${user_id}`).emit("notification", {
            id: notification._id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            createdAt: notification.createdAt,
            reference: notification.reference,
        });

        const newTaskerNoti = await Notification.create({
            user_id: newTasker.taskerId,
            title: "Bạn có đơn hàng mới.",
            message: `Bạn vừa được chỉ định thực hiện đơn hàng mới (ID: ${orderId}).`,
            type: "order",
            reference: { kind: "Order", refId: orderId },
            status: "unread",
        });

         io.to(`user:${newTasker.taskerId}`).emit("notification", {
            id: newTaskerNoti._id,
            title: newTaskerNoti.title,
            message: newTaskerNoti.message,
            type: newTaskerNoti.type,
            createdAt: newTaskerNoti.createdAt,
            reference: newTaskerNoti.reference,
        });

        res.status(200).json({ message: "Order denied and assign task to another tasker successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to deny order", error: error.message });
    }
};

export const confirmArriving = async (req, res) => {
    const { orderId } = req.params;
    try {
        await confirmArrivingService(req.userId, orderId);

        const order = await Order.findById(orderId);
        const customerId = order.customer_id.toString();

        const tasker = await User.findById(req.userId);
        const taskerName = tasker.full_name ?? "Tasker";

        await pushNotification(
            customerId,
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

export const confirmStart = async (req, res) => {
    const { orderId } = req.params;
    try {
        await confirmStartService(req.userId, orderId);

        const order = await Order.findById(orderId).select("customer_id");
        if (!order) throw new Error("Order not found");
        const customerId = order.customer_id.toString();

        const tasker = await User.findById(req.userId).select("full_name");
        const taskerName = tasker?.full_name || "Tasker";

        await pushNotification(
            customerId,
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

export const confirmComplete = async (req, res) => {
    const { orderId } = req.params;
    try {
        await confirmCompleteService(req.userId, orderId);

        const order = await Order.findById(orderId).select("customer_id");
        if (!order) throw new Error("Order not found");
        const customerId = order.customer_id.toString();

        const tasker = await User.findById(req.userId).select("full_name");
        const taskerName = tasker?.full_name || "Tasker";

        await pushNotification(
            customerId,
            "Dịch vụ đã hoàn thành",
            `Tasker ${taskerName} đã hoàn tất đơn hàng của bạn.`,
            "order",
            "Order",
            orderId,
            "unread"
        );

        res.status(200).json({ message: "Task completed successfully" });
    }
    catch (err) {
        res.status(400).json({ message: "Failed to complete task", error: err.message });
    }
};

// Show all taskers in the system along with their information
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
