import { Order, OrderStatusLog, Tasker, TaskerStatusLog } from "../models/index.js";

export const changeOrderStatus = async ({
  orderId,
  toStatus,
  actorType,
  actorId,
  reason = null
}) => {
  const order = await Order.findById(orderId);
  if (!order) 
    throw new Error("Order not found");

  const fromStatus = order.status;

  // update order
  order.status = toStatus;
  await order.save();

  // log trạng thái
  await OrderStatusLog.create({
    order_id: orderId,
    from_status: fromStatus,
    to_status: toStatus,
    actor_type: actorType,
    actor_id: actorId,
    reason
  });

  return order;
};

// export const changeTaskerStatus = async ({
//   orderId,
//   toStatus,
//   actorType,
//   actorId,
//   reason = null
// }) => {
//   const order = await Order.findById(orderId);
//   if (!order) 
//     throw new Error("Order not found");

//   const fromStatus = order.status;

//   // update order
//   order.status = toStatus;
//   await order.save();

//   // log trạng thái
//   await OrderStatusLog.create({
//     order_id: orderId,
//     from_status: fromStatus,
//     to_status: toStatus,
//     actor_type: actorType,
//     actor_id: actorId,
//     reason
//   });

//   return order;
// };