import mongoose from "mongoose";
import { getRouteSummary } from "./location.service.js";
import { User, Tasker, Customer, Address, Order } from "../models/index.js";
import { changeOrderStatus } from "./order.service.js";

const DEFAULT_TASKER_BATCH_SIZE = 10;

// save the route for later use
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

// return 
const buildTaskerRanking = async (customerId) => {
  const addressModel = Address;
  const taskerModel = Tasker;
  const customerModel = Customer;
  const userModel = User;
  const customer = await customerModel.findOne({ user_id: customerId });
  if (!customer) throw new Error("Customer not found");

  const userId = customer.user_id;
  const userAddress = await addressModel.findOne({ user_id: userId }).lean();
  if (!userAddress) throw new Error("User address not found");

  // find available taskers
  const availableTaskers = await taskerModel.find({ working_status: "available" }).lean();
  if (!availableTaskers.length) return [];
  console.log("Available taskers:", availableTaskers);

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
    console.log("Built ranked list:", ranked);
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

  console.log("Final current batch:", cache.currentBatch);
  if (!cache.currentBatch.length) {
    throw new Error("No suitable tasker found");
  }

  const suggestion = cache.currentBatch[0];
  console.log("Suggesting tasker", suggestion);
  return suggestion;
};

// tasker confirms different stages of the order

export const acceptTaskRequest = async (taskerId, orderId) =>{
    try {
        const tasker = await Tasker.findOne({ user_id: taskerId });
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
            order.tasker_id = taskerId;
        } 
        else if (order.tasker_id.toString() !== taskerId.toString()) {
            throw new Error("You are not assigned to this order");
        }

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "accepted",
            actorType: "tasker",
            actorId: taskerId
        });

        await Tasker.updateOne({
            user_id: taskerId
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

export const denyTaskRequest = async (taskerId, orderId, reason) =>{
    try {
        const tasker = await Tasker.findOne({ user_id: taskerId })
        if (!tasker) {
            throw new Error("Tasker not found")
        }
        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error("Order not found")
        }
        if (order.tasker_id.toString() !== taskerId.toString()) {
            throw new Error("You are not assigned to this order")
        }
        if (order.status !== "assigned") {
            throw new Error("Order must be in assigned state to be denied")
        }

        await Tasker.updateOne(
            { user_id: taskerId },
            {
                $inc: { rejection_count: 1 }
            },
            { runValidators: true }
        );

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "cancelled",
            actorType: "tasker",
            actorId: taskerId,
            reason: reason || "Tasker denied the task"
        });

        const orderLogg = await changeOrderStatus({
            orderId,
            toStatus: "pending",
            actorType: "system",
            actorId: null,
        });

        const newTasker = await suggestTasker(order.customer_id, {
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

export const confirmDepartureService = async (taskerId, orderId) =>{
    try {
        console.log(taskerId, orderId);

        const tasker = await Tasker.findOne({ user_id: taskerId })
        if (!tasker) {
            throw new Error("Tasker not found")
        }

        const order = await Order.findById(orderId)
        if (!order) {
            throw new Error("Order not found")
        }
        if (order.tasker_id.toString() !== taskerId.toString()) {
            throw new Error("You are not assigned to this order")
        }
        if (order.status !== "accepted") {
            throw new Error("Order is not accepted")
        }

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "departed",
            actorType: "tasker",
            actorId: taskerId
        });

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmArrivingService = async (taskerId, orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) 
            throw new Error("Order not found");

        if (order.tasker_id.toString() !== taskerId.toString())
            throw new Error("You are not assigned to this order");

        if (order.status !== "accepted")
            throw new Error("Order must be accepted before arriving");

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "arrived",
            actorType: "tasker",
            actorId: taskerId
        });

    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmStartService = async (taskerId, orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) 
            throw new Error("Order not found");

        const tasker = await Tasker.findOne({ user_id: taskerId })
        if (!tasker) {
            throw new Error("Tasker not found")
        }

        if (order.tasker_id.toString() !== taskerId.toString())
            throw new Error("You are not assigned to this order");

        if (order.status !== "arrived")
            throw new Error("Tasker must be arrived before starting the task.");

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "in_progress",
            actorType: "tasker",
            actorId: taskerId
        });
    } catch (error) {
        throw new Error(error.message);
    }
};

export const confirmCompleteService = async (taskerId, orderId) => {
    try {
        const order = await Order.findById(orderId);
        if (!order) 
            throw new Error("Order not found");

        if (order.tasker_id.toString() !== taskerId.toString())
            throw new Error("You are not assigned to this order");

        if (order.status !== "in_progress")
            throw new Error("Order's status must be in progress to be completed.");

        const orderLog = await changeOrderStatus({
            orderId,
            toStatus: "completed",
            actorType: "tasker",
            actorId: taskerId
        });

        await Tasker.updateOne(
            { user_id: taskerId },
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
