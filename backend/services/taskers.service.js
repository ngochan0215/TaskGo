import mongoose from "mongoose";
import { getRouteSummary } from "./location.service.js";
import { User, Tasker, Customer, Receipt, Order, Task, Service, TaskerStatusLog } from "../models/index.js";
import { changeOrderStatus } from "./order.service.js";
import { getSocketInstance } from "../sockets/instance.js";
import { getOnlineTaskerUserIds } from "../sockets/presence.js";

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

    //console.log("ELIGIBLE TASKERS (findEligibleTaskers): ", matchedTaskers);
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
export const acceptTaskRequest = async (taskerUserId, orderId) =>{
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

        console.log("ORDER STATUS LOG (acceptTask): ", orderLog);

        // update tasker status
        const taskerLog = await changeTaskerStatus({
            taskerId,
            toStatus: "busy",
            actorType: "tasker",
            actorId: null
        });

        console.log("TASKER STATUS LOG (acceptTask): ", taskerLog);

        // // update tasker working status
        // await Tasker.updateOne({
        //     user_id: taskerUserId
        // },{
        //     working_status: "busy" 
        // },{
        //     runValidators: true
        // })

        rankingCache.delete(String(order.user_id));
    } catch (error) {
        throw new Error(error.message);
    }
};

export const denyTaskRequest = async (taskerUserId, orderId, reason) =>{
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
            reason: reason || "Tasker denied the task"
        });

        // log tasker status
        const taskerLog = await changeTaskerStatus({
            taskerId,
            toStatus: "available",
            actorType: "tasker",
            actorId: null,
            reason: reason || "Tasker denied the task"
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
                actorType: "system",
                actorId: null,
            });

            const newTaskerId = suggestion.tasker_id;
            const taskerLog = await changeTaskerStatus({
                newTaskerId,
                toStatus: "busy",
                actorType: "system",
                actorId: null
            });
        }
        
        if (order.customer_id) 
            rankingCache.delete(String(order.customer_id));
        
        return suggestion;

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmDepartureService = async (taskerUserId, orderId) =>{
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

// export const confirmCompleteService = async (taskerUserId, orderId) => {
//     try {
//         const order = await Order.findById(orderId);
//         if (!order) 
//             throw new Error("Order not found");

//         if (order.tasker_id.toString() !== taskerUserId.toString())
//             throw new Error("You are not assigned to this order");

//         const tasker = await Tasker.findOne({ user_id: taskerUserId })
//         if (!tasker) {
//             throw new Error("Tasker not found")
//         }
//         const taskerId = tasker._id;

//         if (order.status !== "in_progress")
//             throw new Error("Order's status must be in progress to be completed.");

//         const orderLog = await changeOrderStatus({
//             orderId,
//             toStatus: "completed",
//             actorType: "tasker",
//             actorId: taskerUserId
//         });

//         // log trạng thái tasker
//         const taskerLog = await changeTaskerStatus({
//             taskerId,
//             toStatus: "available",
//             actorType: "tasker",
//             actorId: null
//         });

//         // update tasker completed orders count
//         await Tasker.updateOne(
//             { user_id: taskerUserId },
//             {
//                 $inc: { total_completed_tasks: 1 },
//                 $set: { working_status: "available" }
//             },
//             { runValidators: true }
//         );

//         if (order.customer_id) 
//             rankingCache.delete(String(order.customer_id));

//     } catch (error) {
//         throw new Error(error.message);
//     }
// };

// change order status and log it
// export async function changeTaskerStatus({ taskerId, toStatus, actorType, actorId , reason = null, session }) {
//   try {
//     const tasker = await Tasker.findById(taskerId).session(session);
//     if (!tasker) {
//       throw new Error("Không tìm thấy tasker.");
//     } 

//     const now = new Date();
//     const fromStatus = tasker.working_status;

//     // Nếu đang chuyển sang trạng thái mới (không phải trạng thái hiện tại)
//     if (fromStatus !== toStatus) {
//       // Tìm log entry cuối cùng của tasker này chưa có end_time (đang active)
//       const activeLog = await TaskerStatusLog.findOne({
//         tasker_id: taskerId,
//         end_time: null
//       }).sort({ start_time: -1 }).session(session);

//       // Nếu có log entry đang active, set end_time cho nó
//       if (activeLog) {
//         activeLog.end_time = now;
//         await activeLog.save({ session });
//       }

//       // Tạo log entry mới với start_time
//       await TaskerStatusLog.create({
//         tasker_id: taskerId,
//         from_status: fromStatus,
//         to_status: toStatus,
//         actor_type: actorType,
//         actor_id: actorId,
//         reason: reason || "",
//         start_time: now,
//         end_time: null
//       }, { session });

//       // update tasker
//       tasker.working_status = toStatus;
//       await tasker.save({ session });

//       return tasker;
//     } else {
//       // Nếu trạng thái không thay đổi, chỉ trả về tasker
//       return tasker;
//     }
//   } catch (error) {
//     throw new Error(error.message);
//   }   
// };

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
