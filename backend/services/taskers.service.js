import mongoose from "mongoose";
import { getRouteSummary } from "./location.service.js";
import { User, Tasker, Customer, Address, Order, Task, Service } from "../models/index.js";
import { changeOrderStatus } from "./order.service.js";
import { getSocketInstance } from "../sockets/instance.js";
import { getOnlineTaskerUserIds } from "../sockets/presence.js";

const DEFAULT_TASKER_BATCH_SIZE = 10;

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
    if (!onlineUserIds.length) return [];

    const { task_id, address_snapshot: { latitude, longitude } } = order;

    // tìm tasker available và online
    const taskers = await Tasker.find({
        user_id: { $in: onlineUserIds },
        working_status: "available",
        status: { $ne: "resign" },
        skills: task_id
    }).lean();

    if (!taskers.length) return [];

    // Lọc theo khoảng cách 
    const matchedTaskers = taskers
        .map(tasker => {
        if (
            !tasker.working_area?.latitude ||
            !tasker.working_area?.longitude
        ) {
            return null;
        }

        const distance = getDistanceKm(
            tasker.working_area.latitude,
            tasker.working_area.longitude,
            latitude,
            longitude
        );

        if (distance > tasker.working_radius) return null;

        return {
            ...tasker,
            distance_km: Number(distance.toFixed(2))
        };
        })
        .filter(Boolean);

    // Sort theo khoảng cách gần nhất
    matchedTaskers.sort((a, b) => a.distance_km - b.distance_km);

    // Giới hạn số lượng tasker gửi job
    return matchedTaskers.slice(0, 10);
}

const routeCache = new Map();

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
  
  if (!orderAddress) 
    throw new Error("Địa chỉ đơn hàng không hợp lệ.");

  // lấy danh sách tasker đã lọc
  const eligibleTaskers = await findEligibleTaskers(orderId);
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

        const { distance, duration } = await getCachedRouteSummary(
          origin,
          destination
        );

        if (!Number.isFinite(distance) || !Number.isFinite(duration)) return null;

        return {
          tasker_id: tasker._id,
          user_id: tasker.user_id,
          distance,           // km
          duration,           // phút
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
  console.log("Ranked taskers:", ranked);
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
        throw new Error("No suitable tasker found");
    }

    const suggestion = cache.currentBatch[0];
    console.log("Suggesting tasker", suggestion);
    return suggestion;
};

// tasker confirms different stages of the order
export const acceptTaskRequest = async (taskerUserId, orderId) =>{
    try {
        const tasker = await Tasker.findOne({ user_id: taskerUserId });
        if (!tasker) {
            throw new Error("Tasker not found")
        }

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

        // update tasker working status
        await Tasker.updateOne({
            user_id: taskerUserId
        },{
            working_status: "busy" 
        },{
            runValidators: true
        })

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

        const orderLogg = await changeOrderStatus({
            orderId,
            toStatus: "pending",
            actorType: "system",
            actorId: null,
        });

        // tìm tasker khác
        const newTasker = await suggestTasker(orderId, {
            excludedTaskerIds: [tasker._id]
        })

        if (newTasker) {
            const orderLog = await changeOrderStatus({
                orderId,
                toStatus: "assigned",
                actorType: "system",
                actorId: newTasker.taskerId,
            });
        }
        
        if (order.customer_id) 
            rankingCache.delete(String(order.customer_id));
        
        return newTasker;

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

        if (order.status !== "accepted")
            throw new Error("Order must be accepted before arriving");

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

export const confirmCompleteService = async (taskerUserId, orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) 
            throw new Error("Order not found");

        if (order.tasker_id.toString() !== taskerUserId.toString())
            throw new Error("You are not assigned to this order");

        if (order.status !== "in_progress")
            throw new Error("Order's status must be in progress to be completed.");

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "completed",
            actorType: "tasker",
            actorId: taskerUserId
        });

        // update tasker completed orders count
        await Tasker.updateOne(
            { user_id: taskerUserId },
            {
                $inc: { total_completed_tasks: 1 },
                $set: { working_status: "available" }
            },
            { runValidators: true }
        );

        if (order.customer_id) 
            rankingCache.delete(String(order.customer_id));

    } catch (error) {
        throw new Error(error.message);
    }
};
