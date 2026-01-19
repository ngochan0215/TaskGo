import mongoose from "mongoose";
import { getRouteSummary } from "./location.service.js";
import { User, Tasker, Customer, PayoutTasker, Order, Task, 
    Service, TaskerStatusLog, Transaction, OrderStatusLog, TaskerEarning
} from "../models/index.js";
import { changeOrderStatus } from "./order.service.js";
import { getSocketInstance } from "../sockets/instance.js";
import { getOnlineTaskerUserIds } from "../sockets/presence.js";
import { payOut, payoutDetail } from "./payos.service.js";

const DEFAULT_TASKER_BATCH_SIZE = 10;

const routeCache = new Map();
const rankingCache = new Map();

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // bán kính Trái Đất (km)

    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export async function findEligibleTaskers(order) {
    const io = getSocketInstance();
    if (!io) return [];

    const onlineUserIds = getOnlineTaskerUserIds(io);
    console.log("ONLINE TASKERS (findEligibleTaskers): ", onlineUserIds);
    if (!onlineUserIds.length) return [];

    const { task_id, address_snapshot: { latitude, longitude } } = order;

    // tìm tasker available và online
    const taskers = await Tasker.find({
        user_id: { $in: onlineUserIds },
        working_status: "available",
        status: { $ne: "resign" },
        skills: task_id
    }).lean();

    console.log("ONLINE TASKERS: ", taskers);

    if (!taskers.length) return [];
    // Lọc theo khoảng cách 
    const matchedTaskers = taskers
        .map(tasker => {
            if (
                !tasker.working_area?.latitude ||
                !tasker.working_area?.longitude
            ) {
                console.log("surprises");
                return null;
            }

            // console.log("ORDER:", latitude, longitude);
            // console.log("TASKER:", tasker.working_area.latitude, tasker.working_area.longitude);

            const distance = getDistanceKm(
                tasker.working_area.latitude,
                tasker.working_area.longitude,
                latitude,
                longitude
            );

            // console.log("DISTANCE (findEligibleTaskers): ", distance);
            // console.log("TASKER WORKING RADIUS: ", tasker.working_radius);

            if (distance > tasker.working_radius) return null;

            return {
                ...tasker,
                distance_km: Number(distance.toFixed(2))
            };
        })
        .filter(Boolean);

    // Sort theo khoảng cách gần nhất
    matchedTaskers.sort((a, b) => a.distance_km - b.distance_km);

    console.log("ELIGIBLE TASKERS (findEligibleTaskers): ", matchedTaskers);
    // Giới hạn số lượng tasker gửi job
    return matchedTaskers.slice(0, 10);
}

// create the unique key for each route
function makeCacheKey(origin, destination) {
    return `${origin}->${destination}`;
}

// summary contains moving time and distance
async function getCachedRouteSummary(origin, destination) {
    const key = makeCacheKey(origin, destination);

    // if route is stored already, just get it
    if (routeCache.has(key)) {
        return routeCache.get(key);
    }

    // if not, create one
    const summary = await getRouteSummary(origin, destination);
    routeCache.set(key, summary);
    return summary;
}

function getNextBatch(allRanked, offset) {
    return allRanked.slice(offset, offset + DEFAULT_TASKER_BATCH_SIZE);
}

export const buildTaskerRanking = async (orderId) => {
    const serviceModel = Service;
    const taskModel = Task;
    const orderModel = Order;
    const customerModel = Customer;
    const userModel = User;

    // validate
    const order = await orderModel.findById(orderId);
    if (!order)
        throw new Error("Order not found");

    const task = await taskModel.findById(order.task_id);
    if (!task)
        throw new Error("Task not found");

    const service = await serviceModel.findById(task.service_id).lean();
    if (!service) throw new Error("Service not found");

    const customer = await customerModel.findOne({
        user_id: order.customer_id,
    });
    if (!customer) throw new Error("Customer not found");

    // lấy địa chỉ đơn hàng
    const orderAddress = {
        longitude: order.address_snapshot.longitude,
        latitude: order.address_snapshot.latitude
    };
    //console.log("ORDER ADDRESS (buldTaskerRanking): ", orderAddress);

    if (!orderAddress)
        throw new Error("Địa chỉ đơn hàng không hợp lệ.");

    // lấy danh sách tasker đã lọc
    const eligibleTaskers = await findEligibleTaskers(order);
    console.log("ELIGIBLE TASKERS (buildTaskerRanking): ", eligibleTaskers);
    if (!eligibleTaskers.length) return [];

    const origin = `${orderAddress.latitude},${orderAddress.longitude}`;

    // lấy reputation score của tasker
    const userIds = eligibleTaskers.map(t => t.user_id);

    const reputations = await User.find({ _id: { $in: userIds } })
        .select("_id reputation_score")
        .lean();

    const reputationMap = new Map(
        reputations.map(u => [String(u._id), u.reputation_score ?? 0])
    );

    // tính khoảng cách và thời gian
    const ranked = (
        await Promise.all(
            eligibleTaskers.map(async (tasker) => {
                const { latitude, longitude } = tasker.working_area || {};
                if (!latitude || !longitude) return null;

                const destination = `${latitude},${longitude}`;
                //console.log("TASKER WORKING AREA (buildTaskerRanking): ", destination);

                const { distance, duration } = await getCachedRouteSummary(
                    origin,
                    destination
                );

                if (!Number.isFinite(distance) || !Number.isFinite(duration)) return null;

                return {
                    tasker_id: tasker._id,
                    user_id: tasker.user_id,
                    distance,           // mét
                    duration,           // giây
                    reputation: reputationMap.get(String(tasker.user_id)) ?? 0,
                };
            })
        )
    ).filter(Boolean);

    ranked.sort(
        (a, b) =>
            a.distance - b.distance ||
            a.duration - b.duration ||
            b.reputation - a.reputation
    );

    console.log("RANKED TASKERS (buildTaskerRanking):", ranked);
    return ranked;
};

// get the best suitable tasker list for this one customer
export const suggestTasker = async (orderId, { excludedTaskerIds = [] } = {}) => {
    const key = String(orderId);
    if (!rankingCache.has(key)) {
        console.log("NO CACHE for user, Creating new list", key);

        const ranked = await buildTaskerRanking(orderId);

        rankingCache.set(key, {
            allRanked: ranked,
            currentBatch: ranked.slice(0, DEFAULT_TASKER_BATCH_SIZE),
            offset: DEFAULT_TASKER_BATCH_SIZE,
        });
    }

    const cache = rankingCache.get(key);
    const skip = new Set(excludedTaskerIds.map(String));

    cache.currentBatch = cache.currentBatch.filter(
        (t) => !skip.has(String(t.taskerId))
    );
    console.log("Filtered current batch:", cache.currentBatch);

    if (
        cache.currentBatch.length === 0 &&
        cache.offset < cache.allRanked.length
    ) {
        const nextBatch = getNextBatch(cache.allRanked, cache.offset);
        cache.currentBatch = nextBatch;
        cache.offset += DEFAULT_TASKER_BATCH_SIZE;
    }

    console.log("Final current batch:", cache.currentBatch);
    if (!cache.currentBatch.length) {
        throw new Error("Hệ thống chưa tìm thấy tasker nào phù hợp.");
    }

    const suggestTaskers = cache.currentBatch;
    const suggestion = cache.currentBatch[0];
    //console.log("Final suggesting tasker (suggestTasker): ", suggestion);

    return { suggestTaskers, suggestion };
};

// tasker confirms different stages of the order
export const acceptTaskRequest = async (taskerUserId, orderId) => {
    try {
        const tasker = await Tasker.findOne({ user_id: taskerUserId });
        if (!tasker) {
            throw new Error("Tasker not found")
        }
        const taskerId = tasker._id;

        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error("Order not found")
        }
        if (order.status !== "assigned") {
            throw new Error("Order is not assigned yet!");
        }

        if (!order.tasker_id) {
            order.tasker_id = taskerUserId;
        }
        else if (order.tasker_id.toString() !== taskerUserId.toString()) {
            throw new Error("You are not assigned to this order");
        }

        // update order status
        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "accepted",
            actorType: "tasker",
            actorId: taskerUserId
        });

        //console.log("ORDER STATUS LOG (acceptTask): ", orderLog);

        // update tasker status
        const taskerLog = await changeTaskerStatus({
            taskerId,
            toStatus: "busy",
            actorType: "tasker",
            actorId: orderId,
            note: "Tasker chấp nhận đơn hàng, actor_id chính là ID của đơn hàng"
        });

        //console.log("TASKER STATUS LOG (acceptTask): ", taskerLog);

        rankingCache.delete(String(order.user_id));
    } catch (error) {
        throw new Error(error.message);
    }
};

export const denyTaskRequest = async (taskerUserId, orderId, reason) => {
    try {
        const tasker = await Tasker.findOne({ user_id: taskerUserId })
        if (!tasker) {
            throw new Error("Tasker not found")
        }
        const taskerId = tasker._id;

        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error("Order not found")
        }
        if (order.tasker_id.toString() !== taskerUserId.toString()) {
            throw new Error("You are not assigned to this order")
        }
        if (order.status !== "assigned") {
            throw new Error("Order must be in assigned state to be denied")
        }

        // update tasker rejection count
        await Tasker.updateOne(
            { user_id: taskerUserId },
            {
                $inc: { rejection_count: 1 }
            },
            { runValidators: true }
        );

        // log order status 
        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "cancelled",
            actorType: "tasker",
            actorId: taskerUserId,
            reason: reason || "Tasker từ chối task"
        });

        // log tasker status
        const taskerLog = await changeTaskerStatus({
            taskerId,
            toStatus: "available",
            actorType: "tasker",
            actorId: null,
            reason: reason || "Tasker từ chối task"
        });

        const orderLogg = await changeOrderStatus({
            orderId,
            toStatus: "pending",
            actorType: "system",
            actorId: null,
        });

        // tìm tasker khác
        const { suggestTaskers, suggestion } = await suggestTasker(orderId, {
            excludedTaskerIds: [tasker._id]
        });

        console.log("Final suggesting tasker (denyTaskRequest): ", suggestion);
        console.log("Suggesting tasker list (denyTaskRequest): ", suggestTaskers);

        if (suggestion) {
            const orderLog = await changeOrderStatus({
                orderId,
                toStatus: "assigned",
                actorType: "tasker",
                actorId: suggestion.user_id,
            });

            const newTaskerId = suggestion.tasker_id;
            const taskerLog = await changeTaskerStatus({
                newTaskerId,
                toStatus: "busy",
                actorType: "system",
                actorId: orderId,
                note: "actor_id chính là ID của đơn hàng được gán"
            });
        }

        if (order.customer_id)
            rankingCache.delete(String(order.customer_id));

        return suggestion;

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmDepartureService = async (taskerUserId, orderId) => {
    try {
        console.log(taskerUserId, orderId);

        const tasker = await Tasker.findOne({ user_id: taskerUserId })
        if (!tasker) {
            throw new Error("Tasker not found")
        }

        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error("Order not found")
        }
        if (order.tasker_id.toString() !== taskerUserId.toString()) {
            throw new Error("You are not assigned to this order")
        }
        if (order.status !== "accepted") {
            throw new Error("Order is not accepted")
        }

        // Check if departure is allowed for scheduled tasks (must be within 2 hours before scheduled time)
        if (order.type === "scheduled" && order.scheduled_at) {
            const scheduledTime = new Date(order.scheduled_at);
            const now = new Date();
            const hoursUntilScheduled = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            if (hoursUntilScheduled > 2) {
                throw new Error("Bạn chỉ có thể xác nhận khởi hành khi còn 2 giờ trước thời gian đã lên lịch.");
            }
        }

        // update order status
        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "departed",
            actorType: "tasker",
            actorId: taskerUserId
        });

        // tasker vẫn giữ nguyên trạng thái busy

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmArrivingService = async (taskerUserId, orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order)
            throw new Error("Order not found");

        if (order.tasker_id.toString() !== taskerUserId.toString())
            throw new Error("You are not assigned to this order");

        if (order.status !== "departed")
            throw new Error("Order must be departed before arriving");

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "arrived",
            actorType: "tasker",
            actorId: taskerUserId
        });

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmStartService = async (taskerUserId, orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order)
            throw new Error("Order not found");

        const tasker = await Tasker.findOne({ user_id: taskerUserId })
        if (!tasker) {
            throw new Error("Tasker not found")
        }

        if (order.tasker_id.toString() !== taskerUserId.toString())
            throw new Error("You are not assigned to this order");

        if (order.status !== "arrived")
            throw new Error("Tasker must be arrived before starting the task.");

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "in_progress",
            actorType: "tasker",
            actorId: taskerUserId
        });

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmCompleteService = async (
  taskerUserId,
  orderId,
  session
) => {
  try {
    const order = await Order.findById(orderId).session(session);
    if (!order)
      throw new Error("Order not found");

    if (order.tasker_id.toString() !== taskerUserId.toString())
      throw new Error("You are not assigned to this order");

    const tasker = await Tasker.findOne({ user_id: taskerUserId })
      .session(session);
    if (!tasker)
      throw new Error("Tasker not found");

    const taskerId = tasker._id;

    if (order.status !== "in_progress")
      throw new Error("Order's status must be in progress to be completed.");

    // đổi trạng thái order + log
    await changeOrderStatus({
      orderId,
      toStatus: "completed",
      actorType: "tasker",
      actorId: taskerUserId,
      session
    });

    // đổi trạng thái tasker + log
    await changeTaskerStatus({
      taskerId,
      toStatus: "available",
      actorType: "tasker",
      actorId: null,
      note: "Tasker đánh dấu hoàn thành đơn hàng",
      session
    });

    // update tasker stats
    await Tasker.updateOne(
      { user_id: taskerUserId },
      {
        $inc: { total_completed_tasks: 1 },
        $set: { working_status: "available" }
      },
      {
        runValidators: true,
        session
      }
    );

    if (order.customer_id)
      rankingCache.delete(String(order.customer_id));

    // tiền thực tasker nhận được là 70% tổng tiền hàng (chưa áp khuyến mãi) + tiền tip
    // tiền tasker nhận
    const commissionRate = 0.7;
    const grossAmount = order.base_amount;
    const earningAmount = grossAmount * commissionRate + (order.tip_amount || 0);
    const platformFee = grossAmount - grossAmount * commissionRate;

    await TaskerEarning.create([{
        tasker_id: taskerId,
        order_id: order._id,

        gross_amount: grossAmount,
        commission_rate: commissionRate,
        earning_amount: earningAmount,
        platform_fee: platformFee,

        status: "available",
        completed_at: new Date()
    }], { session });

    // await PayoutTasker.create({
    //     order_id: order._id,
    //     tasker_id: taskerId,
    //     amount: order.base_amount * 0.7 + order.tip_amount,
    //     status: "pending"
    // });

  } catch (error) {
    throw new Error(error.message);
  }
};

export async function changeTaskerStatus({
  taskerId,
  toStatus,
  actorType,
  actorId,
  reason = null,
  note = null,
  session
}) {
  try {
    let taskerQuery = Tasker.findById(taskerId);
    if (session) taskerQuery = taskerQuery.session(session);

    const tasker = await taskerQuery;
    if (!tasker) throw new Error("Không tìm thấy tasker.");

    const now = new Date();
    const fromStatus = tasker.working_status;

    if (fromStatus !== toStatus) {
      let logQuery = TaskerStatusLog.findOne({
        tasker_id: taskerId,
        end_time: null
      }).sort({ start_time: -1 });

      if (session) logQuery = logQuery.session(session);

      const activeLog = await logQuery;

      if (activeLog) {
        activeLog.end_time = now;
        await activeLog.save(session ? { session } : {});
      }

      await TaskerStatusLog.create([{
        tasker_id: taskerId,
        from_status: fromStatus,
        to_status: toStatus,
        actor_type: actorType,
        actor_id: actorId,
        reason: reason || "",
        note: note || "",
        start_time: now,
        end_time: null
      }], session ? { session } : {});

      tasker.working_status = toStatus;
      await tasker.save(session ? { session } : {});
    }

    return tasker;
  } catch (error) {
    throw error;
  }
}

// tỉ lệ nhận đơn của tasker
export async function getTaskerAcceptanceRate(taskerId) {
  const stats = await OrderStatusLog.aggregate([
    {
      $match: {
        actor_type: "tasker",
        actor_id: new mongoose.Types.ObjectId(taskerId),
        from_status: "assigned"
      }
    },
    {
      $group: {
        _id: null,
        accepted: {
          $sum: { $cond: [{ $eq: ["$to_status", "accepted"] }, 1, 0] }
        },
        rejected: {
          $sum: { $cond: [{ $eq: ["$to_status", "rejected"] }, 1, 0] }
        }
      }
    },
    {
      $project: {
        _id: 0,
        accepted: 1,
        rejected: 1,
        totalAssigned: { $add: ["$accepted", "$rejected"] },
        acceptanceRate: {
          $cond: [
            { $eq: [{ $add: ["$accepted", "$rejected"] }, 0] },
            0,
            {
              $divide: [
                "$accepted",
                { $add: ["$accepted", "$rejected"] }
              ]
            }
          ]
        }
      }
    }
  ]);

  return stats[0] || {
    accepted: 0,
    rejected: 0,
    totalAssigned: 0,
    acceptanceRate: 0
  };
}

// Tạo PayoutTasker batch từ các TaskerEarning có status 'available'
export async function createPayoutBatchForTasker(userId) {
    try {
        const tasker = await Tasker.findOne({ user_id: userId });
        if (!tasker) {
            throw new Error("Tasker not found");
        }
        const taskerId = tasker._id;

        // Tìm tất cả earnings có status 'available' và chưa được gán vào payout nào
        const availableEarnings = await TaskerEarning.find({
            tasker_id: taskerId,
            status: 'available',
            payout_id: { $exists: false }
        }).sort({ completed_at: 1 }); // Sắp xếp theo thời gian hoàn thành

        if (!availableEarnings.length) {
            return null; // Không có earnings nào để tạo batch
        }

        // Tính tổng số tiền
        const totalAmount = availableEarnings.reduce((sum, earning) => sum + earning.earning_amount, 0);

        // Tìm khoảng thời gian (period_start và period_end)
        const completedDates = availableEarnings.map(e => new Date(e.completed_at));
        const periodStart = new Date(Math.min(...completedDates));
        const periodEnd = new Date(Math.max(...completedDates));

        // Tạo PayoutTasker batch
        const payoutBatch = await PayoutTasker.create({
            tasker_id: taskerId,
            earning_ids: availableEarnings.map(e => e._id),
            total_amount: totalAmount,
            period_start: periodStart,
            period_end: periodEnd,
            status: 'pending'
        });

        // Cập nhật TaskerEarning records để link với payout_id
        await TaskerEarning.updateMany(
            { _id: { $in: availableEarnings.map(e => e._id) } },
            { payout_id: payoutBatch._id }
        );

        return payoutBatch;
    } catch (error) {
        throw new Error(error.message);
    }
}

// nhân viên nhận lương
export async function cashOutForTasker(userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    let payoutIds = []; // Declare outside try block for error handling

    try {
        const tasker = await Tasker.findOne({ user_id: userId }).session(session);
        if (!tasker) {
            throw new Error("Tasker not found");
        }
        const user = await User.findById(userId).session(session);
        if (!user) {
            throw new Error("User not found");
        }
        const taskerId = tasker._id;

        // Tự động tạo payout batch từ available earnings nếu chưa có pending payout
        let payoutBill = await PayoutTasker.find({
            status: "pending",
            tasker_id: taskerId
        }).session(session);

        // Nếu không có pending payout, tạo batch mới từ available earnings
        if (!payoutBill.length) {
            const availableEarnings = await TaskerEarning.find({
                tasker_id: taskerId,
                status: 'available',
                payout_id: { $exists: false }
            }).session(session).sort({ completed_at: 1 });

            if (!availableEarnings.length) {
                await session.abortTransaction();
                throw new Error("Không có tiền lương để rút");
            }

            const totalAmount = availableEarnings.reduce((sum, earning) => sum + earning.earning_amount, 0);
            const completedDates = availableEarnings.map(e => new Date(e.completed_at));
            const periodStart = new Date(Math.min(...completedDates));
            const periodEnd = new Date(Math.max(...completedDates));

            const newPayoutBatch = await PayoutTasker.create([{
                tasker_id: taskerId,
                earning_ids: availableEarnings.map(e => e._id),
                total_amount: totalAmount,
                period_start: periodStart,
                period_end: periodEnd,
                status: 'pending'
            }], { session });

            await TaskerEarning.updateMany(
                { _id: { $in: availableEarnings.map(e => e._id) } },
                { payout_id: newPayoutBatch[0]._id }
            ).session(session);

            payoutBill = newPayoutBatch;
        }

        const amount = payoutBill.reduce((sum, bill) => sum + bill.total_amount, 0);
        if (amount <= 0) {
            await session.abortTransaction();
            throw new Error("Số tiền payout không hợp lệ");
        }

        console.log("Thực hiện thanh toán cho tasker:", user.full_name, "số tiền:", amount);
        const payoutPayload = {
            amount: amount,
            description: `TaskGo thanh toán lương`,
            toBin: tasker.BIN,
            toAccountNumber: tasker.account_number
        };

        // Update payout status to processing before making payment
        payoutIds = payoutBill.map(bill => bill._id);
        await PayoutTasker.updateMany(
            { _id: { $in: payoutIds } },
            { status: 'processing' }
        ).session(session);

        await session.commitTransaction();
        session.endSession();

        let orderCode;
        let orderCodeFromResult;
        try {
            orderCode = await payOut(payoutPayload, userId);
            orderCodeFromResult = orderCode.split('_')[1];
        } catch (payOutError) {
            // Revert payout status back to pending if payOut fails
            await PayoutTasker.updateMany(
                { _id: { $in: payoutIds } },
                { status: 'pending' }
            );
            console.error("PayOut error details:", {
                message: payOutError.message,
                status: payOutError.status,
                code: payOutError.code,
                response: payOutError.response?.data,
                stack: payOutError.stack
            });
            throw new Error(`Lỗi khi tạo yêu cầu thanh toán trong tasker.service: ${payOutError.message}`);
        }

        const start = Date.now();
        let state = 'PROCESSING';

        let lastError = null;
        while (Date.now() - start < 30000 && state === 'PROCESSING') {
            let result;

            try {
                result = await payoutDetail(orderCode);
                console.log('Payout detail:', result);
            } catch (err) {
                lastError = err;
                await sleep(5000);
                continue;
            }

            const payoutState = result?._data?.[0]?.transactions?.[0]?.state;
            console.log('Payout state:', payoutState);
            if (!payoutState) {
                lastError = new Error('Không lấy được trạng thái payout');
                await sleep(5000);
                continue;
            }

            if (payoutState === 'SUCCEEDED' || payoutState === 'COMPLETED') {
                await Transaction.updateOne(
                    { order_code: orderCodeFromResult, user_id: userId },
                    { status: 'completed' }
                );

                // Update PayoutTasker status to completed
                await PayoutTasker.updateMany(
                    { _id: { $in: payoutIds } },
                    { status: 'completed', processed_at: new Date() }
                );

                // Update all related TaskerEarning records to 'paid' status
                const completedPayouts = await PayoutTasker.find({
                    _id: { $in: payoutIds },
                    status: 'completed'
                }).select('earning_ids');

                const allEarningIds = completedPayouts.flatMap(payout => payout.earning_ids);
                if (allEarningIds.length > 0) {
                    await TaskerEarning.updateMany(
                        { _id: { $in: allEarningIds } },
                        { status: 'paid' }
                    );
                }

                state = 'SUCCEEDED';
                return true; 
            }

            if (payoutState === 'FAILED') {
                await Transaction.updateOne(
                    { order_code: orderCodeFromResult, user_id: userId },
                    { status: 'failed' }
                );

                // Revert payout status back to pending on failure
                await PayoutTasker.updateMany(
                    { _id: { $in: payoutIds } },
                    { status: 'pending' }
                );

                state = 'FAILED';
                throw new Error('Payout failed');
            }

            await sleep(5000);
        }

        if (state === 'PROCESSING') {
            await Transaction.updateOne({
                order_code: orderCodeFromResult,
                user_id: userId
            }, {
                status: 'failed'
            });

            // Revert payout status back to pending on timeout
            await PayoutTasker.updateMany(
                { _id: { $in: payoutIds } },
                { status: 'pending' }
            );

            throw new Error('Payout processing timeout');
        }
        if (lastError) {
            // Revert payout status back to pending if there's an error
            if (payoutIds && payoutIds.length > 0) {
                await PayoutTasker.updateMany(
                    { _id: { $in: payoutIds } },
                    { status: 'pending' }
                );
            }
            throw lastError;
        }
    } catch (error) {
        // Revert payout status back to pending if error occurs after transaction commit
        if (payoutIds && payoutIds.length > 0) {
            try {
                const currentPayouts = await PayoutTasker.find({
                    _id: { $in: payoutIds },
                    status: 'processing'
                });
                if (currentPayouts.length > 0) {
                    await PayoutTasker.updateMany(
                        { _id: { $in: payoutIds }, status: 'processing' },
                        { status: 'pending' }
                    );
                }
            } catch (revertError) {
                console.error('Error reverting payout status:', revertError);
            }
        }

        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        throw new Error(error.message);
    }
}

const sleep = ms => new Promise(res => setTimeout(res, ms));

export const getCashoutInfo = async (userId, timespan = 'day') => {
    try {
        const tasker = await Tasker.findOne({ user_id: userId });
        if (!tasker) {
            throw new Error('Tasker not found');
        }
        const taskerId = tasker._id;

        let startDate;
        const now = new Date();
        if (timespan === 'day') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        }
        else if (timespan === 'week') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        }
        else if (timespan === 'month') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        }
        else if (timespan === 'all') {
            const bills = await PayoutTasker.find({
                tasker_id: taskerId
            });
            return bills.reduce((sum, bill) => sum + bill.total_amount, 0);
        }
        else {
            throw new Error('Invalid timespan');
        }
        const bills = await PayoutTasker.find({
            tasker_id: taskerId,
            created_at: { $gte: startDate }
        });
        return bills.reduce((sum, bill) => sum + bill.total_amount, 0);
    }
    catch (error) {
        throw new Error(error.message);
    }
};

export const availableCashout = async (userId) => {
  try {
        const tasker = await Tasker.findOne({ user_id: userId });
        if (!tasker) {
            throw new Error('Tasker not found');
        }
        const taskerId = tasker._id;

        // Get available earnings that haven't been included in any payout yet
        const availableEarnings = await TaskerEarning.find({
            tasker_id: taskerId,
            status: 'available',
            payout_id: { $exists: false }
        });

        // Only include pending payouts (exclude processing ones as they are in progress)
        const pendingPayouts = await PayoutTasker.find({
            tasker_id: taskerId,
            status: 'pending'
        });

        const availableAmount = availableEarnings.reduce((sum, earning) => sum + earning.earning_amount, 0);
        const pendingAmount = pendingPayouts.reduce((sum, bill) => sum + bill.total_amount, 0);

        return availableAmount + pendingAmount;
    }
    catch (error) {
        throw new Error(error.message);
    }
};

// Get tasker earnings grouped by period (day/week/month)
export const getTaskerEarningsService = async ({
    taskerUserId,
    period = 'week', // 'day', 'week', or 'month'
    startDate,
    endDate,
    page = 1,
    limit = 50
}) => {
    try {
        const tasker = await Tasker.findOne({ user_id: taskerUserId });
        if (!tasker) {
            throw new Error('Tasker not found');
        }
        const taskerId = tasker._id;
        
        // Build date range query
        let dateQuery = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            start.setUTCHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            dateQuery.completed_at = { $gte: start, $lte: end };
        } else {
            // Default to last period if no dates provided
            const now = new Date();
            let start;
            if (period === 'day') {
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                start.setUTCHours(0, 0, 0, 0);
            } else if (period === 'week') {
                start = new Date(now);
                start.setDate(start.getDate() - 7);
                start.setUTCHours(0, 0, 0, 0);
            } else if (period === 'month') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                start.setUTCHours(0, 0, 0, 0);
            } else {
                throw new Error('Invalid period. Must be day, week, or month');
            }
            dateQuery.completed_at = { $gte: start };
        }

        // Get all earnings for this tasker in the date range
        const earnings = await TaskerEarning.find({
            tasker_id: taskerId,
            status: { $in: ['pending', 'available', 'paid'] }, // Exclude cancelled
            ...dateQuery
        })
            .populate('order_id', 'task_snapshot address_snapshot customer_id scheduled_at type status')
            .populate('order_id.customer_id', 'full_name')
            .sort({ completed_at: -1 })
            .lean();

        // Group earnings by period
        const groupedEarnings = {};
        const periodTotals = {};

        earnings.forEach(earning => {
            const completedDate = new Date(earning.completed_at);
            let periodKey;
            let periodLabel;

            if (period === 'day') {
                const year = completedDate.getFullYear();
                const month = String(completedDate.getMonth() + 1).padStart(2, '0');
                const day = String(completedDate.getDate()).padStart(2, '0');
                periodKey = `${year}-${month}-${day}`;
                periodLabel = completedDate.toLocaleDateString('vi-VN', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: 'numeric' 
                });
            } else if (period === 'week') {
                // Get week start (Monday)
                const weekStart = new Date(completedDate);
                const dayOfWeek = completedDate.getDay();
                const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
                weekStart.setDate(completedDate.getDate() - diff);
                weekStart.setHours(0, 0, 0, 0);
                
                const year = weekStart.getFullYear();
                const month = String(weekStart.getMonth() + 1).padStart(2, '0');
                const day = String(weekStart.getDate()).padStart(2, '0');
                periodKey = `${year}-${month}-${day}`;
                
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                periodLabel = `${weekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} - ${weekEnd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;
            } else if (period === 'month') {
                const year = completedDate.getFullYear();
                const month = String(completedDate.getMonth() + 1).padStart(2, '0');
                periodKey = `${year}-${month}`;
                periodLabel = completedDate.toLocaleDateString('vi-VN', { 
                    month: 'long', 
                    year: 'numeric' 
                });
            }

            if (!groupedEarnings[periodKey]) {
                groupedEarnings[periodKey] = {
                    period: periodKey,
                    periodLabel: periodLabel,
                    earnings: [],
                    totalEarning: 0,
                    totalGross: 0,
                    totalPlatformFee: 0,
                    orderCount: 0
                };
                periodTotals[periodKey] = {
                    totalEarning: 0,
                    totalGross: 0,
                    totalPlatformFee: 0,
                    orderCount: 0
                };
            }

            groupedEarnings[periodKey].earnings.push({
                _id: earning._id,
                orderId: earning.order_id?._id,
                order: earning.order_id,
                grossAmount: earning.gross_amount,
                earningAmount: earning.earning_amount,
                commissionRate: earning.commission_rate,
                platformFee: earning.platform_fee,
                status: earning.status,
                completedAt: earning.completed_at,
                payoutId: earning.payout_id
            });

            periodTotals[periodKey].totalEarning += earning.earning_amount;
            periodTotals[periodKey].totalGross += earning.gross_amount;
            periodTotals[periodKey].totalPlatformFee += earning.platform_fee;
            periodTotals[periodKey].orderCount += 1;
        });

        // Update totals in grouped earnings
        Object.keys(groupedEarnings).forEach(key => {
            groupedEarnings[key].totalEarning = periodTotals[key].totalEarning;
            groupedEarnings[key].totalGross = periodTotals[key].totalGross;
            groupedEarnings[key].totalPlatformFee = periodTotals[key].totalPlatformFee;
            groupedEarnings[key].orderCount = periodTotals[key].orderCount;
        });

        // Convert to array and sort by period (newest first)
        const result = Object.values(groupedEarnings).sort((a, b) => {
            return new Date(b.period) - new Date(a.period);
        });

        // Apply pagination
        const skip = (Number(page) - 1) * Number(limit);
        const paginatedResult = result.slice(skip, skip + Number(limit));

        // Calculate overall totals
        const overallTotals = {
            totalEarning: result.reduce((sum, period) => sum + period.totalEarning, 0),
            totalGross: result.reduce((sum, period) => sum + period.totalGross, 0),
            totalPlatformFee: result.reduce((sum, period) => sum + period.totalPlatformFee, 0),
            totalOrders: result.reduce((sum, period) => sum + period.orderCount, 0)
        };

        return {
            earnings: paginatedResult,
            totals: overallTotals,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total: result.length,
                totalPages: Math.ceil(result.length / Number(limit))
            }
        };
    } catch (error) {
        throw new Error(error.message);
    }
};
   
