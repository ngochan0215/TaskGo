import mongoose from "mongoose";
import { Task, User, Order, OrderStatusLog, Address, Voucher, Discount } from "../models/index.js";
import { validateAndGetDiscountSnapshot } from "./discount.js";
import { checkAndGetVoucherSnapshot } from "./voucher.js";

// Get all orders with optional filters + pagination
export async function getAllOrdersService({
  customer_id,
  tasker_id,
  status,
  page = 1,
  limit = 50,
}) {
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
}

// Delete a specific order, only for ADMIN
export async function deleteOrderByIdService(orderId) {
  try {
    const deleted = await Order.findByIdAndDelete(orderId);
    if (!deleted) 
      throw new Error("Order not found");

    return deleted;

  } catch (err) {
    throw new Error(err.message);
  }
}

// Get order by id
export async function getOrderByIdService(orderId) {
  try {
    const order = await Order.findById(orderId).select("-__v -created_at -updated_at").lean();
    if (!order) 
      throw new Error("Order not found");

    return order;

  } catch (err) {
    throw new Error(err.message);
  }
}

// Get all orders of a customer, with pagination + filter by status
export async function getAllOrdersByCustomerIdService({
  customerId,
  status,
  page = 1,
  limit = 50,
}) {
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
}

export async function createOrderService({
  customer_id, task_id, voucher_id, discount_id, address_id,
  scheduled_at, type, note, quantity, total_amount }) 
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {

      // validation
      if (!task_id || !type || !quantity || !address_id) {
        throw new Error("Yêu cầu chọn dịch vụ, loại task, số lượng và địa chỉ.");
      }

      if (!["immediate", "scheduled"].includes(type)) {
        throw new Error("Chỉ chọn giữa đặt liền hoặc đặt lịch trước.");
      }

      if (quantity <= 0) 
        throw new Error("Số giờ đặt phải lớn hơn 0.");

      let scheduleDate;
      if (type === "scheduled") {
        scheduleDate = new Date(scheduled_at);
        if (isNaN(scheduleDate.getTime()) || scheduleDate < new Date())
          throw new Error("Ngày hẹn lịch không hợp lệ.");
      } else {
        scheduleDate = new Date();
      }

      const task = await Task.findById(task_id).session(session);
      if (!task) {
        throw new Error("Không tìm thấy dịch vụ.");
      }

      const address = await Address.findById(address_id).session(session);
      if (!address) 
        throw new Error("Không tìm thấy địa chỉ khách hàng.");

      if (address.user_id.toString() !== customer_id.toString()) {
        throw new Error("Address does not belong to customer");
      }

      // TODO: logic tính tiền  nên thực hiện trước khi tạo order
      let base_fee = task.pricing * quantity;

    // const discount_snapshot =
    //   discount_id && (await validateAndGetDiscountSnapshot(discount_id));

    // const discount_percent = discount_snapshot?.percentage || 0;

    // const voucher_snapshot =
    //   voucher_id &&
    //   (await checkAndGetVoucherSnapshot(
    //     voucher_id,
    //     customerId,
    //     (
    //       await User.findById(customerId)
    //     ).type
    //   ));
    // const voucher_percent = voucher_snapshot?.percentage || 0;

    // if (voucher_id) {
    //   await Voucher.findByIdAndUpdate(voucher_id, {
    //     $inc: { total_quantity: -1 },
    //   });

    //   // Lưu vào VoucherUsage để track
    //   await VoucherUsage.create({
    //     voucher_id,
    //     user_id: customerId,
    //     order_id: newOrder._id,
    //     used_at: new Date(),
    //   });
    // }

    //   const discount_amount = (base_fee * discount_percent) / 100;
    //   const voucher_amount = (base_fee * voucher_percent) / 100;

    // const expected_total = Math.max(
    //   base_fee - discount_amount - voucher_amount,
    //   0
    // );

    //   if (Number(total_amount) !== expected_total) {
    //     throw new Error("Invalid total bill. Please refresh and confirm again.");
    //   }

      const order = await Order.create(
        [{
          customer_id,
          task_id,
          type,
          scheduled_at: scheduleDate,
          quantity, note,
          address_id,
          address_snapshot: {
            full_address: address.full_address,
            latitude: address.latitude,
            longtitude: address.longtitude
          },
          voucher_id,
          discount_id,
          base_fee,
          discount_amount,
          voucher_amount,
          total_amount,
          status: "pending",
        }],
        { session }
      );

      await changeOrderStatus({
        orderId: order[0]._id,
        toStatus: "pending",
        actorType: "system",
        actorId: null,
        session
      });

      // TODO: thêm logic đặt liền
      if (type === "immediate") {
      //   const suggestion = await suggestTasker(order[0]._id, {});
      //   if (!suggestion) 
      //     throw new Error("No available tasker at the moment");
      // order[0].tasker_id = suggestion.taskerId;
      // await order[0].save({ session });

        await changeOrderStatus({
          orderId: order[0]._id,
          toStatus: "assigned",
          actorType: "system",
          actorId: null,
          session
        });

        await session.commitTransaction();
        return { order: order[0], assignedTasker: suggestion }      
      }

      // nếu đặt lịch trước thì chưa gán tasker liền
      await session.commitTransaction();
      return { order: order[0], assignedTasker: null };

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(err.message);
    }
}

// customer cancels order
export async function cancelOrderByCustomerService({ orderId, customerId, reason }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found.");
    }

    if (customerId && String(order.customer_id) !== String(customerId)) {
      throw new Error("User doesn't have the right to cancel this order.");
    }

    if (order.status !== "accepted")
      throw new Error("Order can only be cancelled after tasker has accepted it and before starting moving to destination.");

    // nếu là đơn đặt trước
    let penaltyAmount = 0;

    if (order.type === "scheduled") {
      const scheduledAt = new Date(order.scheduled_at);
      const diffHours =
        (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // 3 tiếng trước giờ G: không cho huỷ
      if (diffHours <= 3) {
        throw new Error("Cannot cancel order within 3 hours before scheduled time");
      }

      // dưới 12 tiếng thì phạt 30% tổng bill
      if (diffHours < 12) {
        penaltyAmount = order.total_amount * 0.3;
      }
    }

    // nếu là đơn đặt liền
    // lấy thời điểm tasker accept
    const acceptedLog = await OrderStatusLog.findOne({
      order_id: orderId,
      to_status: "accepted"
    })
      .sort({ created_at: -1 })
      .session(session);

    if (!acceptedLog)
      throw new Error("Accepted timestamp not found");

    const now = new Date();
    const diffMinutes =
      (now.getTime() - acceptedLog.created_at.getTime()) / (1000 * 60);

    // quá 15 phút từ lúc tasker nhận đơn thì không cho huỷ nữa
    if (diffMinutes > 15)
      throw new Error("Cancellation time window (15 minutes) has expired");

    // kiểm tra số lần huỷ trong ngày
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const cancelCountToday = await OrderStatusLog.countDocuments({
      actor_type: "customer",
      actor_id: customerId,
      to_status: "cancelled",
      created_at: { $gte: startOfDay }
    }).session(session);

    if (cancelCountToday >= 5)
      throw new Error("Daily cancellation limit exceeded (5 times)");

    // đổi trạng thái và log
    await changeOrderStatus({
      orderId,
      toStatus: "cancelled",
      actorType: "customer",
      actorId: customerId,
      reason,
      session
    });

    // TODO: Xử lý phí phạt
    if (penaltyAmount > 0) {
      console.log(`Apply penalty of amount: ${penaltyAmount}`);
      // Logic xử lý phí phạt (trừ vào ví, thanh toán, v.v.) sẽ được triển khai ở đây.
    }

    await session.commitTransaction();

  } catch (error) {
    await session.abortTransaction();
    throw new Error(error.message);
  } finally {
    session.endSession();
  }
}

// change order status and log it
export async function changeOrderStatus({ orderId, toStatus, actorType, actorId , reason = null, session }) {
  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Order not found.");
    } 

    // log trạng thái
    await OrderStatusLog.create({
      order_id: orderId,
      from_status: order.status,
      to_status: toStatus,
      actor_type: actorType,
      actor_id: actorId,
      reason
    });

    // update order
    order.status = toStatus;
    if (toStatus === "pending") {
      order.tasker_id = null;
    }
    await order.save();

    return order;
  } catch (error) {
    throw new Error(error.message);
  }   
};