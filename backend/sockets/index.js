import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketAuth.js";
import { setSocketInstance } from "./instance.js";
import registerChatHandlers from "./chat.handler.js";
import registerNotificationHandlers from "./notification.handler.js";
import registerOrderHandlers from "./order.handler.js";
import { userSocketsMap } from "./presence.js";

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Global socket middleware for JWT auth
  io.use(socketAuth);

  io.on("connection", (socket) => {
    const { userId, role } = socket.user;

    console.log(`User connected: ${userId} (socket id: ${socket.id})`);

    // init set nếu chưa có
    if (!userSocketsMap.has(userId)) {
      userSocketsMap.set(userId, new Set());
    }

    userSocketsMap.get(userId).add(socket.id);

    socket.join(`user:${userId}`);

    if (role === "tasker") {
      console.log("Tasker connected, joining online room:", userId);
      socket.join("taskers:online");
    }

    socket.on("disconnect", () => {
      const set = userSocketsMap.get(userId);
      if (!set) return;

      set.delete(socket.id);
      if (set.size === 0) {
        userSocketsMap.delete(userId);
      }
    });
  });

  registerChatHandlers(io);
  registerNotificationHandlers(io);
  registerOrderHandlers(io);

  setSocketInstance(io);

  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO engine connection_error:", err.message || err);
  });

  return io;
}
