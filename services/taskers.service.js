import mongoose from "mongoose";
import { getRouteSummary } from "./location.service.js";
import Address from "../models/addresses.js";
import User from "../models/users.js";
import Tasker from "../models/taskers.js";
import Order from "../models/orders.js";
import Customer from "../models/customers.js";
const DEFAULT_TASKER_BATCH_SIZE = 10;

// save the route for later use
const routeCache = new Map();

// create the unique key for each route
function makeCacheKey(origin, destination) {
  return `${origin}->${destination}`;
}

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
// summary contains moving time and distance

// return 
const buildTaskerRanking = async (customerId) => {
  const addressModel = Address;
  const taskerModel = Tasker;
  const customerModel = Customer;
  const userModel = User;
  const customer = await customerModel.findById(customerId);
  if (!customer) throw new Error("Customer not found");

  const userId = customer.user_id;
  const userAddress = await addressModel.findOne({ user_id: userId }).lean();
  if (!userAddress) throw new Error("User address not found");

  // find available taskers
  const availableTaskers = await taskerModel.find({ working_status: "available" }).lean();
  if (!availableTaskers.length) return [];

  const taskerIds = availableTaskers.map(({ user_id }) => user_id);

  // get each tasker's distance and reputation score, then store 
  const [taskerAddresses, userReputations] = await Promise.all([
    addressModel.find({ user_id: { $in: taskerIds } }).lean(),
    userModel.find({ _id: { $in: taskerIds } }).select("reputation_score").lean(),
  ]);

  const addressByUserId = new Map(taskerAddresses.map((a) => [String(a.user_id), a]));
  const reputationByUserId = new Map(userReputations.map((u) => [String(u.user_id), u.reputation_score ?? 0]));
  
  // calculate the distance between customer and tasker
  const origin = `${userAddress.latitude},${userAddress.longtitude}`;

  const ranked = (
    await Promise.all(
      availableTaskers.map(async (tasker) => {
        const taskerAddress = addressByUserId.get(String(tasker.user_id));
        if (!taskerAddress) return null;

        const destination = `${taskerAddress.latitude},${taskerAddress.longtitude}`;
        const { distance, duration } = await getCachedRouteSummary(origin, destination);
        console.log("Route summary", { origin, destination, distance, duration });
        if (!Number.isFinite(distance) || !Number.isFinite(duration)) return null;

        return {
          taskerId: tasker._id,
          distance,
          duration,
          reputation: reputationByUserId.get(String(tasker.user_id)) ?? 0,
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

const rankingCache = new Map(); 


function getNextBatch(allRanked, offset) {
  return allRanked.slice(offset, offset + DEFAULT_TASKER_BATCH_SIZE);
}

// get the best suitable tasker list for this one customer
export const suggestTasker = async (userId, { excludedTaskerIds = [] } = {}) => {
    const key = String(userId);
    if (!rankingCache.has(key)) {
    console.log("NO CACHE for user, Creating new list", key);
    const ranked = await buildTaskerRanking(userId);
    rankingCache.set(key, {
      allRanked: ranked,
      currentBatch: ranked.slice(0, DEFAULT_TASKER_BATCH_SIZE),
      offset: DEFAULT_TASKER_BATCH_SIZE,
    });
  }
  
  const cache = rankingCache.get(key);
  const skip = new Set(excludedTaskerIds.map(String));

  cache.currentBatch = cache.currentBatch.filter((t) => !skip.has(String(t.taskerId)));
  console.log("Filtered current batch:", cache.currentBatch);
  if (cache.currentBatch.length === 0 && cache.offset < cache.allRanked.length) {
    const nextBatch = getNextBatch(cache.allRanked, cache.offset);
    cache.currentBatch = nextBatch;
    cache.offset += DEFAULT_TASKER_BATCH_SIZE;
  }

  if (!cache.currentBatch.length) {
    throw new Error("No suitable tasker found");
  }

  const suggestion = cache.currentBatch[0];
  console.log("Suggesting tasker", suggestion);
  return suggestion;
};

export const acceptTaskRequest = async (taskerId, orderId) =>{
    const taskerModel = Tasker;
    const orderModel = Order;
    const tasker = await taskerModel.findOne({ user_id: taskerId });
    if (!tasker) {
        throw new Error("Tasker not found")
    }
    const order = await orderModel.findById(orderId)
    if (!order) {
        throw new Error("Order not found")
    }
    if (order.status !== "assigned") {
        throw new Error("Order is not assigned yet!");
    }

    if (!order.tasker_id) {
        order.tasker_id = taskerId;
    } 
    else if (order.tasker_id.toString() !== taskerId.toString()) {
        throw new Error("You are not assigned to this order");
    }

    await orderModel.updateOne({
        _id: orderId
    },{
        tasker_id: taskerId,
        status: "accepted",
    },{
        runValidators: true
    })
    await taskerModel.updateOne({
        user_id: taskerId
    },{
        working_status: "busy" 
    },{
        runValidators: true
    })
    rankingCache.delete(String(order.user_id));
};

export const denyTaskRequest = async (taskerId, orderId) =>{
    const taskerModel = Tasker;
    const orderModel = Order;

    const tasker = await taskerModel.findOne({ user_id: taskerId })
    if (!tasker) {
        throw new Error("Tasker not found")
    }
    const order = await orderModel.findById(orderId)
    if (!order) {
        throw new Error("Order not found")
    }
    if (order.tasker_id.toString() !== taskerId.toString()) {
        throw new Error("You are not assigned to this order")
    }
    if (order.status !== "assigned") {
        throw new Error("Order must be in assigned state to be denied")
    }

     await Order.updateOne(
        { _id: orderId },
        {
            status: "pending",
            tasker_id: null
        },
        { runValidators: true }
    );

    const newTasker = await suggestTasker(order.customer_id, {
        excludedTaskerIds: [tasker._id]
    })

    if (newTasker) {
        await orderModel.updateOne({
            _id: orderId
        },{
            tasker_id: newTasker.taskerId,
            status: "assigned"
        },{
            runValidators: true
        })
    }
    
    if (order.customer_id) rankingCache.delete(String(order.customer_id));
    return newTasker;
};

export const confirmDepartureTask = async (taskerId, orderId) =>{
    const taskerModel = Tasker;
    const orderModel = Order;
    console.log(taskerId, orderId);
    const tasker = await taskerModel.findOne({ user_id: taskerId })

    if (!tasker) {
        throw new Error("Tasker not found")
    }
    const order = await orderModel.findById(orderId)
    if (!order) {
        throw new Error("Order not found")
    }
    if (order.tasker_id.toString() !== taskerId.toString()) {
        throw new Error("You are not assigned to this order")
    }
    if (order.status !== "accepted") {
        throw new Error("Order is not accepted")
    }
    await orderModel.updateOne({
        _id: orderId
    },{
        departed_at: new Date(),
        status: "departed",
    },{
        runValidators: true
    })
    await taskerModel.updateOne({
        user_id: taskerId
    },{
        working_status: "busy" 
    },{
        runValidators: true
    })
};

export const confirmArriving = async (taskerId, orderId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.tasker_id.toString() !== taskerId.toString())
    throw new Error("You are not assigned to this order");

    if (order.status !== "accepted")
    throw new Error("Order must be accepted before arriving");

    await Order.updateOne(
    { _id: orderId },
    {
        arrived_at: new Date(),
        status: "arrived",
    },
    { runValidators: true }
    );

    return { success: true };
};

export const confirmStart = async (taskerId, orderId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.tasker_id.toString() !== taskerId.toString())
    throw new Error("You are not assigned to this order");

    if (order.status !== "arrived")
    throw new Error("Tasker must be arrived before starting the task.");

    await Order.updateOne(
    { _id: orderId },
    {
        started_at: new Date(),
        status: "in_progress",
    }
    );

    return { success: true };
};

export const confirmComplete = async (taskerId, orderId) => {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.tasker_id.toString() !== taskerId.toString())
    throw new Error("You are not assigned to this order");

    if (order.status !== "in_progress")
    throw new Error("Order's status must be in progress to be completed.");

    await Order.updateOne(
        { _id: orderId },
        {
            completed_at: new Date(),
            status: "completed"
        }
    );

    if (order.customer_id) rankingCache.delete(String(order.customer_id));
    return { success: true };
};
