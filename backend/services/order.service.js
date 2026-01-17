import mongoose from "mongoose";
import { Task, Order, OrderStatusLog, Address, 
  Voucher, Receipt, VoucherUsage, Customer, 
} from "../models/index.js";
import { suggestTasker, changeTaskerStatus } from "./taskers.service.js";
import { pushNotification } from "./notification.service.js";

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
      .populate('customer_id', 'full_name phone_number email')
      .populate('tasker_id', 'full_name phone_number email')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id')
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
    const order = await Order.findById(orderId)
      .populate('customer_id', 'full_name phone_number email')
      .populate('tasker_id', 'full_name phone_number email')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id')
      .select("-__v -created_at -updated_at")
      .lean();
      
    if (!order) 
      throw new Error("Order not found");

    return order;

  } catch (err) {
    throw new Error(err.message);
  }
}

// Get all orders of a customer, with pagination + filter by status or category
export async function getAllOrdersByCustomerIdService({
  customerId,
  status,
  category, // "upcoming" or "history"
  page = 1,
  limit = 50,
}) {
  try {
    const q = {};
    if (customerId) q.customer_id = customerId;
    
    // Filter by category (upcoming vs history)
    if (category === "upcoming") {
      // Upcoming: all statuses except completed and cancelled
      q.status = { $nin: ["completed", "cancelled"] };
    } else if (category === "history") {
      // History: only completed and cancelled
      q.status = { $in: ["completed", "cancelled"] };
    } else if (status) {
      // If specific status is provided, use it
      q.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(q)
      .populate("task_id", "task_name unit base_price")
      .populate("tasker_id", "full_name phone_number email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return orders;
  } catch (err) {
    throw new Error(err.message);
  }
}

// Get available orders for tasker (pending orders + orders assigned to this tasker)
export async function getAvailableOrdersForTaskerService({
  taskerUserId,
  page = 1,
  limit = 50,
}) {
  try {
    // Get orders that are either:
    // 1. Pending (not assigned to anyone yet) - available for all taskers
    // 2. Assigned to this tasker (status = "assigned" and tasker_id = taskerUserId)
    // 3. Already accepted by this tasker (status in ["accepted", "departed", "arrived", "in_progress"] and tasker_id = taskerUserId)
    const q = {
      status: { $nin: ["completed", "cancelled"] },
      $or: [
        { status: "pending", tasker_id: null },
        { status: "assigned", tasker_id: taskerUserId },
        { 
          status: { $in: ["accepted", "departed", "arrived", "in_progress"] },
          tasker_id: taskerUserId
        }
      ]
    };

    const skip = (Number(page) - 1) * Number(limit);

    const orders = await Order.find(q)
      .populate('customer_id', 'full_name phone_number email')
      .populate('tasker_id', 'full_name phone_number email')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return orders;
  } catch (err) {
    throw new Error(err.message);
  }
}

export async function createOrderService({
  customer_id, task_id, task_snapshot, voucher_id, voucher_snapshot,
  discount_id, discount_snapshot, address_id, address_snapshot, 
  task_payload, scheduled_at, type, note, quantity, base_amount, final_amount }) 
  {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // validation
      if (!task_id || !type || !task_payload || !address_id) {
        throw new Error("Yêu cầu chọn dịch vụ, loại task, số lượng và địa chỉ.");
      }

      if (!["immediate", "scheduled"].includes(type)) {
        throw new Error("Chỉ chọn giữa đặt liền hoặc đặt lịch trước.");
      }

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
        throw new Error("Đây không phải là địa chỉ của khách hàng.");
      }

      if (!voucher_id) voucher_id = null;
      if (!discount_id) discount_id = null;
      if (!voucher_snapshot) voucher_snapshot = null;
      if (!discount_snapshot) discount_snapshot = null;

      const order = await Order.create(
        [{
          customer_id,
          task_id, task_snapshot, task_payload,
          type,
          scheduled_at: scheduleDate,
          quantity, note,
          address_id, address_snapshot,
          voucher_id, voucher_snapshot,
          discount_id, discount_snapshot,
          base_amount, final_amount,
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

      if (voucher_id && voucher_snapshot) {
        // ghi usage
        await VoucherUsage.create(
          [
            {
              voucher_id,
              user_id: customer_id,
              order_id: order[0]._id
            }
          ],
          { session }
        );
    
        // update voucher
        const voucher = await Voucher.findById(voucher_id).session(session);
        voucher.used_quantity += 1;
    
        await voucher.save({ session });
      }

      // if (type === "immediate") {
      //   const { suggestTaskers, suggestion } = await suggestTasker(order[0]._id, {});

      //   console.log("SUGGESTION TASKER (createOrderService): ", suggestion);
      //   console.log("SUGGESTING TASKERS (createOrderService): ", suggestTaskers);

      //   if (!suggestion || !suggestTaskers) {
      //     throw new Error("Hiện tại chưa tìm thấy tasker phù hợp.");
      //   }

      //   order[0].tasker_id = suggestion.taskerId;
      //   await order[0].save({ session });

      //   await changeOrderStatus({
      //     orderId: order[0]._id,
      //     toStatus: "assigned",
      //     actorType: "system",
      //     actorId: null,
      //     session
      //   });

      //   await session.commitTransaction();
      //   return { order: order[0], assignedTasker: suggestion }      
      // }

      // nếu đặt lịch trước thì chưa gán tasker liền
      await session.commitTransaction();
      return { order: order[0] };

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(err.message);
    }
}

export async function assignTaskerService(order) {
  console.log("ORDER (assignTaskerService): ", order);

  const { suggestTaskers, suggestion } = await suggestTasker(order._id);

  console.log("SUGGESTION TASKER (assignTaskerService): ", suggestion);
  console.log("SUGGESTING TASKERS (assignTaskerService): ", suggestTaskers);

  if (!suggestion || !suggestTaskers) {
    throw new Error("Không tìm thấy tasker phù hợp.");
  }

  order.tasker_id = suggestion.user_id;
  await order.save();

  await changeOrderStatus({
    orderId: order._id,
    toStatus: "assigned",
    actorType: "system",
    actorId: null,
  });

  await changeTaskerStatus({
    taskerId: suggestion.tasker_id,
    toStatus: "busy",
    actorType: "system",
    actorId: null,
  });

  // thông báo cho khách
  await pushNotification(
    order.customer_id,
    "Tạo đơn hàng thành công",
    "Bạn có một đơn hàng mới đang được hệ thống tìm tasker phù hợp. Vui lòng chờ đợi giây lát.",
    "order",                              // type
    "Order",                              // kind
    order._id,                         // refId
    "unread"                              // status
  );

  // thông báo cho tasker được gán
  await pushNotification(
    suggestion.user_id,                 // userId (tasker user)
    "Có đơn hàng mới",
    `Bạn có một đơn hàng có ID: ${order._id} phù hợp, vui lòng phản hồi sớm trong vòng 2 phút.`,
    "order",                              // type
    "Order",                              // kind
    order._id,                         // refId
    "unread"                              // status
  );

  return { suggestion, suggestTaskers };
}

// Check if order can be cancelled by customer
export async function canCancelOrderByCustomer({ orderId, customerId }) {
  try {
    const order = await Order.findById(orderId);
    if (!order) {
      return { canCancel: false, reason: "Không tìm thấy đơn hàng." };
    }

    if (customerId && String(order.customer_id) !== String(customerId)) {
      return { canCancel: false, reason: "Người dùng không có quyền hủy đơn này." };
    }

    const validStatus = ["pending", "assigned", "accepted"];
    if (!validStatus.includes(order.status)) {
      return { 
        canCancel: false, 
        reason: "Đơn hàng chỉ có thể hủy khi ở trạng thái: chờ xác nhận, đã gán tasker, hoặc tasker đã nhận." 
      };
    }

    const now = new Date();

    // For scheduled orders
    if (order.type === "scheduled") {
      const scheduledAt = new Date(order.scheduled_at);
      const diffHours = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Can't cancel if less than 1 hour before scheduled time
      if (diffHours <= 1) {
        return { 
          canCancel: false, 
          reason: "Không được phép hủy 1 tiếng trước giờ hẹn lịch làm." 
        };
      }

      // Penalty if less than 5 hours
      const penaltyAmount = diffHours < 5 ? order.final_amount * 0.3 : 0;
      return { canCancel: true, penaltyAmount };
    }

    // For immediate orders - check if tasker has accepted
    if (order.status === "accepted") {
      const acceptedLog = await OrderStatusLog.findOne({
        order_id: orderId,
        to_status: "accepted"
      }).sort({ created_at: -1 });

      if (acceptedLog) {
        const diffMinutes = (now.getTime() - acceptedLog.created_at.getTime()) / (1000 * 60);
        // Can't cancel if more than 15 minutes after tasker accepted
        if (diffMinutes > 15) {
          return { 
            canCancel: false, 
            reason: "Không cho phép hủy khi quá 15 phút kể từ lúc tasker nhận đơn." 
          };
        }
      }
    }

    // Check daily cancellation limit
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const cancelCountToday = await OrderStatusLog.countDocuments({
      actor_type: "customer",
      actor_id: customerId,
      to_status: "cancelled",
      created_at: { $gte: startOfDay }
    });

    if (cancelCountToday >= 5) {
      return { 
        canCancel: false, 
        reason: "Đã hết số lần được phép hủy trong ngày (5 lần)." 
      };
    }

    return { canCancel: true, penaltyAmount: 0 };
  } catch (err) {
    return { canCancel: false, reason: err.message };
  }
}

// customer cancels order
export async function cancelOrderByCustomerService({ orderId, customerId, reason }) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const order = await Order.findById(orderId).session(session);
    if (!order) {
      throw new Error("Không tìm thấy đơn hàng.");
    }

    if (customerId && String(order.customer_id) !== String(customerId)) {
      throw new Error("Người dùng không có quyền hủy đơn này.");
    }

    const validStatus = ["pending", "assigned", "accepted"];
    if (!validStatus.includes(order.status)) {
      throw new Error("Đơn hàng chỉ có thể hủy khi ở trạng thái: chờ xác nhận, đã gán tasker, hoặc tasker đã nhận.");
    }

    const now = new Date();
    let penaltyAmount = 0;

    // For scheduled orders
    if (order.type === "scheduled") {
      const scheduledAt = new Date(order.scheduled_at);
      const diffHours = (scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60);

      // 1 tiếng trước giờ G: không cho huỷ nữa
      if (diffHours <= 1) {
        throw new Error("Không được phép hủy 1 tiếng trước giờ hẹn lịch làm.");
      }

      // dưới 5 tiếng thì phạt 30% tổng bill
      if (diffHours < 5) {
        penaltyAmount = order.final_amount * 0.3;
      }
    }

    // For immediate orders - check if tasker has accepted
    if (order.status === "accepted") {
      const acceptedLog = await OrderStatusLog.findOne({
        order_id: orderId,
        to_status: "accepted"
      })
        .sort({ created_at: -1 })
        .session(session);

      if (acceptedLog) {
        const diffMinutes = (now.getTime() - acceptedLog.created_at.getTime()) / (1000 * 60);
        // quá 15 phút từ lúc tasker nhận đơn thì không cho huỷ nữa
        if (diffMinutes > 15) {
          throw new Error("Không cho phép hủy khi quá 15 phút kể từ lúc tasker nhận đơn.");
        }
      }
    }

    // kiểm tra số lần huỷ trong ngày
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const cancelCountToday = await OrderStatusLog.countDocuments({
      actor_type: "customer",
      actor_id: customerId,
      to_status: "cancelled",
      created_at: { $gte: startOfDay }
    }).session(session);

    if (cancelCountToday >= 5) {
      throw new Error("Đã hết số lần được phép hủy trong ngày (5 lần).");
    }

    // đổi trạng thái và log
    await changeOrderStatus({
      orderId,
      toStatus: "cancelled",
      actorType: "customer",
      actorId: customerId,
      reason,
      session
    });

    // update số lần hủy của khách hàng
    await Customer.findOneAndUpdate(
      { user_id: customerId },
      { $inc: { cancellation_count: 1 } }
    );

    // cập nhật sử dụng voucher
    await VoucherUsage.deleteOne({
      voucher_id: order.voucher_id,
      order_id: order._id
    });

    await Voucher.findByIdAndUpdate(order.voucher_id, {
      $inc: { used_quantity: -1 }
    });

    order.voucher_id = null;
    order.discount_amount = 0;
    order.final_amount = order.total_amount;
    await order.save();

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

export async function verifyCustomerOrderStats(customerUserId) {

  const customer = await Customer.findOne({ user_id: customerUserId });
  if (!customer) {
    throw new Error("Không tìm thấy khách hàng.");
  }

  const [completedCount, cancelledCount] = await Promise.all([
    Order.countDocuments({
      customer_id: customerUserId,
      status: "completed",
    }),
    Order.countDocuments({
      customer_id: customerUserId,
      status: "cancelled",
    }),
  ]);

  const completedMismatch =
    completedCount !== customer.total_completed_orders;

  const cancelledMismatch =
    cancelledCount !== customer.cancellation_count;

  if (completedMismatch || cancelledMismatch) {
    throw new Error(
      JSON.stringify(
        {
          message: "Số liệu về đơn hàng đã hoàn thành và bị hủy của khách hàng đang mâu thuẫn.",
          expected: {
            completed: completedCount,
            cancelled: cancelledCount,
          },
          stored: {
            completed: customer.total_completed_orders,
            cancelled: customer.cancellation_count,
          },
        },
        null,
        2
      )
    );
  }

  return {
    completed_orders: completedCount,
    cancelled_orders: cancelledCount,
    verified: true,
  };
}

// Get order trends for the last 7 days (for admin)
export async function getOrderTrendsService() {
  try {
    const trends = [];
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Loop through last 7 days
    for (let i = 6; i >= 0; i--) {
      const endDate = new Date(today);
      endDate.setDate(today.getDate() - i);
      endDate.setHours(23, 59, 59, 999);

      const startDate = new Date(endDate);
      startDate.setHours(0, 0, 0, 0);

      // Count orders by status for this day
      const [totalCount, completedCount, inProgressCount, cancelledCount] = await Promise.all([
        Order.countDocuments({
          created_at: { $gte: startDate, $lte: endDate }
        }),
        Order.countDocuments({
          created_at: { $gte: startDate, $lte: endDate },
          status: "completed"
        }),
        Order.countDocuments({
          created_at: { $gte: startDate, $lte: endDate },
          status: { $in: ["pending", "assigned", "accepted", "departed", "arrived", "in_progress"] }
        }),
        Order.countDocuments({
          created_at: { $gte: startDate, $lte: endDate },
          status: "cancelled"
        })
      ]);

      trends.push({
        date: startDate.toISOString().split('T')[0],
        dayOfWeek: startDate.toLocaleDateString('en-US', { weekday: 'short' }),
        total: totalCount,
        completed: completedCount,
        in_progress: inProgressCount,
        cancelled: cancelledCount,
        completed_percentage: totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0,
        in_progress_percentage: totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0,
        cancelled_percentage: totalCount > 0 ? Math.round((cancelledCount / totalCount) * 100) : 0,
      });
    }

    return trends;
  } catch (err) {
    throw new Error(err.message);
  }
}