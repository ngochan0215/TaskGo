import mongoose from "mongoose";
import { Task, Order, OrderStatusLog, Address, 
  Voucher, Receipt, VoucherUsage, Customer, Tasker,
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
      .populate('customer_id', 'full_name phone_number avatar_url')
      .populate('tasker_id', 'full_name phone_number avatar_url')
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
      .populate('customer_id', 'full_name phone_number avatar_url')
      .populate('tasker_id', 'full_name phone_number avatar_url')
      .populate('task_id', 'task_name unit base_price')
      .populate('address_id')
      .select("-__v")
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
  category, // "current_working", "scheduled", or "history"
  page = 1,
  limit = 50,
}) {
  try {
    const q = {};
    if (customerId) q.customer_id = customerId;
    
    // Filter by category
    if (category === "current_working") {
      // Current working: orders in progress
      q.status = { $in: ["pending", "accepted", "departed", "arrived", "in_progress"] };
    } else if (category === "scheduled") {
      // Scheduled: pending or assigned orders that are scheduled (type === "scheduled")
      q.status = { $in: ["pending", "assigned"] };
      q.type = "scheduled";
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

// Get all orders of a tasker, with pagination + filter by category
export async function getAllOrdersByTaskerIdService({
  taskerUserId,
  status,
  category, // "current_working", "scheduled", or "history"
  page = 1,
  limit = 50,
}) {
  try {
    const q = { tasker_id: taskerUserId };
    
    // Filter by category
    if (category === "current_working") {
      // Current working: orders in progress assigned to this tasker
      q.status = { $in: ["accepted", "departed", "arrived", "in_progress"] };
    } else if (category === "scheduled") {
      // Scheduled: pending or assigned orders that are scheduled (type === "scheduled") and assigned to this tasker
      q.status = { $in: ["pending", "assigned"] };
      q.type = "scheduled";
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
      .populate("customer_id", "full_name phone_number email avatar_url")
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
      if (!voucher_snapshot) voucher_snapshot = null;

      // Tự động tính và áp dụng discount nếu chưa có discount_id
      let appliedDiscountId = discount_id;
      let appliedDiscountSnapshot = discount_snapshot;
      let calculatedFinalAmount = final_amount;

      if (!appliedDiscountId) {
        try {
          const { calculateDiscountForService } = await import("./discount.service.js");
          const discountResult = await calculateDiscountForService({
            userId: customer_id,
            taskId: task_id.toString(),
            basePrice: base_amount,
            checkTime: scheduleDate // Dùng scheduled_at cho scheduled orders, hiện tại cho immediate
          });

          if (discountResult.discount && discountResult.discountAmount > 0) {
            appliedDiscountId = discountResult.discount._id;
            appliedDiscountSnapshot = {
              name: discountResult.discount.name,
              description: discountResult.discount.description,
              percentage: discountResult.discount.discount.type === "PERCENT" 
                ? discountResult.discount.discount.value 
                : null,
              discount_amount: discountResult.discountAmount,
              appliedAt: new Date()
            };
            // Áp dụng discount vào final_amount (trước khi áp voucher)
            calculatedFinalAmount = discountResult.finalPrice;
          }
        } catch (discountError) {
          console.error("Error calculating discount for order:", discountError);
          // Tiếp tục với giá gốc nếu có lỗi
        }
      }

      if (!appliedDiscountId) appliedDiscountId = null;
      if (!appliedDiscountSnapshot) appliedDiscountSnapshot = null;

      const order = await Order.create(
        [{
          customer_id,
          task_id, task_snapshot, task_payload,
          type,
          scheduled_at: scheduleDate,
          quantity, note,
          address_id, address_snapshot,
          voucher_id, voucher_snapshot,
          discount_id: appliedDiscountId,
          discount_snapshot: appliedDiscountSnapshot,
          base_amount, 
          final_amount: calculatedFinalAmount, // Sử dụng giá đã áp discount
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

      await session.commitTransaction();
      return { order: order[0] };

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      throw new Error(err.message);
    }
  }

// assign taskers for an order
export async function assignTaskerService(order) {
  //console.log("ORDER (assignTaskerService): ", order);

  const { suggestTaskers, suggestion } = await suggestTasker(order._id);

  // console.log("SUGGESTION TASKER (assignTaskerService): ", suggestion);
  // console.log("SUGGESTING TASKERS (assignTaskerService): ", suggestTaskers);

  if (!suggestion || !suggestTaskers) {
    throw new Error("Không tìm thấy tasker phù hợp.");
  }

  order.tasker_id = suggestion.user_id;
  await order.save();

  // gán cho tasker nên để actor là tasker
  await changeOrderStatus({
    orderId: order._id,
    toStatus: "assigned",
    actorType: "tasker",
    actorId: order.tasker_id,
  });

  //console.log("WHAT???");
  await changeTaskerStatus({
    taskerId: suggestion.tasker_id,
    toStatus: "busy",
    actorType: "system",
    actorId: order._id,
    note: "actorId là ID của đơn hàng được gán"
  });

  //console.log("HERE???");
  // thông báo cho khách
  await pushNotification(
    order.customer_id,
    "Tạo đơn hàng thành công",
    "Bạn có một đơn hàng mới đang được hệ thống tìm tasker phù hợp. Vui lòng chờ đợi giây lát.",
    "order",                              
    "Order",                              
    order._id,                         
    "unread"                              
  );

  // thông báo cho tasker được gán
  await pushNotification(
    suggestion.user_id,
    "Có đơn hàng mới",
    `Bạn có một đơn hàng có ID: ${order._id} phù hợp, vui lòng phản hồi sớm trong vòng 2 phút.`,
    "order",
    "Order",
    order._id,                      
    "unread"                            
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
      actor_id: customerId,   // customerId ở đây là user_id của customer
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
      reason: reason,
      session
    });

    // log trạng thái mới của tasker được gán nếu có
    if (order.tasker_id) {
      const tasker = await Tasker.findOne({ user_id: order.tasker_id }).session(session);
      const taskerId = tasker._id;
  
      await changeTaskerStatus({
        taskerId,
        toStatus: "available",
        actorType: "customer",
        actorId: customerId,
        reason: reason,
        note: "actor_id là user_id của khách hàng hủy đơn",
        session
      });

    }

    // update số lần hủy của khách hàng
    await Customer.findOneAndUpdate(
      { user_id: customerId },
      { $inc: { cancellation_count: 1 } },
      { session }
    );

    if (order.voucher_id) {
      // cập nhật sử dụng voucher (quay lại ban đầu)
      await VoucherUsage.deleteOne({
        voucher_id: order.voucher_id,
        order_id: order._id
      }, { session });

      await Voucher.findByIdAndUpdate(order.voucher_id, {
        $inc: { used_quantity: -1 }
      }, { session });

      // console.log("order: ", order.final_amount);
      // order.final_amount += order.voucher_snapshot.discount_amount;
      // order.voucher_id = null;
      // order.voucher_snapshot = null;
    }

    await order.save({ session });

    // update trạng thái hóa đơn
    const receipt = await Receipt.findOne({ order_id: order._id }).session(session);
    if (receipt) {
      receipt.status = "cancelled";
      receipt.cancelled_at = new Date();
      await receipt.save({ session });
    }

    // TODO: Xử lý phí phạt
    if (penaltyAmount > 0) {
      console.log(`Apply penalty of amount: ${penaltyAmount}`);
      // Logic xử lý phí phạt (trừ vào ví, thanh toán, v.v.) sẽ được triển khai ở đây.
    }

    // TODO: đối với những đơn đặt trước và trả full tiền thì cần phải hoàn tiền lại cho khách

    await session.commitTransaction();

    return { order, penaltyAmount };

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

// Get work schedule for a tasker for a specific week
export async function getWorkScheduleService({
  taskerUserId,
  startDate,
  endDate,
}) {
  try {    
    // Validate dates and normalize to start/end of day in UTC
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Set start to beginning of day (00:00:00) and end to end of day (23:59:59.999)
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new Error("Invalid date range");
    }

    // Get all orders for this tasker within the date range
    // Include orders that have scheduled_at within the range, or orders that are in progress/completed
    const query = {
      tasker_id: taskerUserId,
      $or: [
        // Scheduled orders with scheduled_at in range
        {
          scheduled_at: {
            $gte: start,
            $lte: end
          }
        },
        // Or orders that are active (not completed) and started before end date
        {
          status: { $in: ["accepted", "departed", "arrived", "in_progress"] },
          scheduled_at: { $lte: end }
        },
        // Completed orders must be within the date range
        {
          status: { $in: ["completed", "awaiting_payment"] },
          scheduled_at: {
            $gte: start,
            $lte: end
          }
        }
      ]
    };
    
    const orders = await Order.find(query)
      .populate("customer_id", "full_name phone_number email")
      .populate("task_id", "task_name unit base_price")
      .populate("address_id")
      .sort({ scheduled_at: 1 })
      .lean();

    // Get status logs to calculate actual duration for completed orders
    const orderIds = orders.map(o => o._id);
    const statusLogs = await OrderStatusLog.find({
      order_id: { $in: orderIds }
    })
      .sort({ created_at: 1 })
      .lean();

    // Group logs by order_id
    const logsByOrder = {};
    statusLogs.forEach(log => {
      if (!logsByOrder[log.order_id]) {
        logsByOrder[log.order_id] = [];
      }
      logsByOrder[log.order_id].push(log);
    });

    // Format orders for schedule display
    const scheduleData = orders.map(order => {
      const scheduledAt = new Date(order.scheduled_at);
      
      // Determine schedule status
      let scheduleStatus = "upcoming";
      if (["in_progress", "arrived", "departed"].includes(order.status)) {
        // These statuses are always ongoing regardless of order type
        scheduleStatus = "ongoing";
      } else if (order.status === "accepted") {
        if (order.type === "scheduled") {
          scheduleStatus = "upcoming";
        } else {
          scheduleStatus = "ongoing";
        }
      } else if (["completed", "awaiting_payment"].includes(order.status)) {
        scheduleStatus = "completed";
      } else if (order.status === "cancelled") {
        scheduleStatus = "cancelled";
      } else if (order.status === "assigned") {
        scheduleStatus = "upcoming";
      }

      // Calculate duration
      // Default duration: 2 hours for scheduled orders, 1.5 hours for immediate
      console.log("order before setting duration hours: ", order);
      let durationHours = order.task_payload.total_time / 60;
      //let durationHours = order.type === "scheduled" ? 2 : 1.5;
      
      // Try to calculate actual duration from status logs
      const logs = logsByOrder[order._id] || [];
      const startLog = logs.find(log => log.to_status === "in_progress");
      const endLog = logs.find(log => log.to_status === "completed");
      
      if (startLog && endLog) {
        const startTime = new Date(startLog.created_at);
        const endTime = new Date(endLog.created_at);
        durationHours = (endTime - startTime) / (1000 * 60 * 60); // Convert to hours
        console.log(`duration hours of order ${startLog.order_id}: `, durationHours);
        // Ensure minimum 0.5 hours and maximum 8 hours
        durationHours = Math.max(0.5, Math.min(8, durationHours));
      }

      // Calculate position on schedule grid
      // Each hour column is 80px wide
      const hour = scheduledAt.getHours();
      const minutes = scheduledAt.getMinutes();
      const leftPosition = (hour * 80) + (minutes / 60 * 80);
      const width = durationHours * 80;

      // Format time range
      const startTime = scheduledAt.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
      });
      const endTime = new Date(scheduledAt.getTime() + durationHours * 60 * 60 * 1000);
      console.log("END TIME: ", endTime);
      const endTimeStr = endTime.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit"
      });
      console.log("END TIME STRING: ", endTimeStr);
      // Get day of week (0 = Sunday, 1 = Monday, etc.)
      const dayOfWeek = scheduledAt.getDay();
      
      // Calculate date in local timezone (not UTC) to avoid timezone issues
      // For Vietnam (UTC+7), an order at 00:15 on 18/01 should be on 18/01, not 17/01
      const year = scheduledAt.getFullYear();
      const month = String(scheduledAt.getMonth() + 1).padStart(2, '0');
      const day = String(scheduledAt.getDate()).padStart(2, '0');
      const localDate = `${year}-${month}-${day}`;
      
      const result = {
        _id: order._id,
        orderId: order._id,
        service: order.task_snapshot?.name || order.task_id?.task_name || "Dịch vụ",
        scheduledAt: order.scheduled_at,
        startTime: startTime,
        endTime: endTimeStr,
        timeRange: `${startTime} - ${endTimeStr}`,
        address: order.address_snapshot?.full_address || order.address_id?.full_address || "—",
        customer: order.customer_id?.full_name || "—",
        status: order.status,
        scheduleStatus: scheduleStatus, // ongoing, upcoming, completed, cancelled
        dayOfWeek: dayOfWeek, // 0 = Sunday, 1 = Monday, etc.
        date: localDate, // Use local date instead of UTC date
        hour: hour,
        minutes: minutes,
        leftPosition: leftPosition,
        width: width,
        durationHours: durationHours,
        type: order.type
      };
      
      return result;
    });

    return scheduleData;
  } catch (err) {
    throw new Error(err.message);
  }
}