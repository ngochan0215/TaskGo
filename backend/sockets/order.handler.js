import {
  suggestTasker,
  acceptTaskRequest,
} from "../services/taskers.service.js";
import Order from "../models/orders.js";

export default function registerOrderHandlers(io) {
  io.on("connection", (socket) => {
    const userId = String(socket.user.userId);

    socket.on("join-order-room", async ({ order_id }, ack) => {
      try {
        if (!order_id) return ack?.({ ok: false, error: "order_id_required" });

        const order = await Order.findById(order_id);
        if (!order) return ack?.({ ok: false, error: "order_not_found" });

        const isCustomer = String(order.customer_id) === userId;
        const isTasker = order.tasker_id && String(order.tasker_id) === userId;

        console.log("isCustomer:", isCustomer);
        console.log("isTasker:", isTasker);
        if (!isCustomer && !isTasker)
          return ack?.({ ok: false, error: "no_permission" });

        // 🔥 JOIN ORDER ROOM
        socket.join(`order:${order_id}`);

        // Customer vừa tạo order → suggest tasker
        if (isCustomer && order.status === "assigned") {
          let suggestion;
          try {
            suggestion = await suggestTasker(order_id);
          } catch {
            return ack?.({ ok: false, error: "no_tasker_found" });
          }

          // Emit cho tasker (user room)
          io.to(`user:${suggestion.taskerId}`).emit("suggest-tasker", {
            order_id,
            customer_id: order.customer_id,
            suggestion,
          });

          return ack?.({
            ok: true,
            room: `order:${order_id}`,
            suggestion,
          });
        }

        return ack?.({ ok: true, room: `order:${order_id}` });
      } catch (err) {
        console.error(err);
        return ack?.({ ok: false, error: "server_error" });
      }
    });

    /**
     * TASKER ACCEPT ORDER
     */
    socket.on("tasker-accept", async ({ order_id }, ack) => {
      try {
        if (!order_id) {
          return ack?.({ ok: false, error: "order_id_required" });
        }

        // 1. Atomic update để tránh race condition
        const updatedOrder = await Order.findOneAndUpdate(
          {
            _id: order_id,
            status: "pending", // ← Chỉ accept order pending
            tasker_id: null, // ← Chưa có tasker nào
          },
          {
            $set: {
              tasker_id: userId,
              status: "assigned", // hoặc "accepted"
            },
          },
          { new: true }
        );

        // 2. Nếu update thất bại → order đã được accept
        if (!updatedOrder) {
          socket.emit("order-already-accepted", { order_id });
          return ack?.({ ok: false, error: "order_already_accepted" });
        }

        // 3. Tasker join order room
        socket.join(`order:${order_id}`);

        // 4. Notify tất cả trong order room (bao gồm customer)
        io.to(`order:${order_id}`).emit("order-accepted", {
          order_id,
          tasker_id: userId,
          tasker: {
            name: socket.user.name,
            phone: socket.user.phone,
            avatar: socket.user.avatar,
          },
        });

        // 5. Emit riêng cho customer (user room)
        io.to(`user:${updatedOrder.customer_id}`).emit("tasker-assigned", {
          order_id,
          tasker_id: userId,
        });

        // 6. (Optional) Lưu notification vào DB
        // await createNotification({
        //   user_id: updatedOrder.customer_id,
        //   type: "order_accepted",
        //   order_id,
        //   tasker_id: userId
        // });

        return ack?.({ ok: true, order: updatedOrder });
      } catch (err) {
        console.error("tasker-accept error:", err);
        return ack?.({
          ok: false,
          error: err.message || "server_error",
        });
      }
    });

    /**
     * TASKER DECLINE
     */
    socket.on("tasker-decline", async (_, ack) => {
      return ack?.({ ok: true });
    });
  });
}
