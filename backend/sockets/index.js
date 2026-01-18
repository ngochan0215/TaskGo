import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketAuth.js";
import { setSocketInstance } from "./instance.js";
import registerChatHandlers from "./chat.handler.js";
import registerCallHandlers from "./call.handler.js";
import registerNotificationHandlers from "./notification.handler.js";
import registerOrderHandlers from "./order.handler.js";
import { userSocketsMap } from "./presence.js";
import { activeCalls } from './call.handler.js';

export function initSocket(httpServer) {
  console.log("IM CALLED");
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

    // Check if this user has a pending incoming call
    for (const [chatId, call] of activeCalls.entries()) {
        if (call.calleeId === userId && call.status === 'ringing') {
            // Resend the event to the user who just reconnected
            socket.emit("call:incoming", {
                chat_id: chatId,
                order_id: call.orderId,
                caller_name: call.callerName, 
                caller_avatar: call.callerAvatar,
                caller_id: call.callerId 
            });
        }
    }

    socket.on("disconnect", () => {
      const set = userSocketsMap.get(userId);
      if (!set) return;

      set.delete(socket.id);
      if (set.size === 0) {
        userSocketsMap.delete(userId);
      }

      // Clean up the calls
      if (set.size === 0) {
        // Give the user 2 seconds to reconnect (refresh page)
        setTimeout(() => {
            // Check again if they are still offline
            if (!userSocketsMap.has(userId)) {
                userSocketsMap.delete(userId); 

                // End the calls
                for (const [chatId, call] of activeCalls.entries()) {
                    if (call.callerId === userId || call.calleeId === userId) {
                        const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
                        activeCalls.delete(chatId);
                        io.to(`user:${otherUserId}`).emit("call:ended", {
                            chat_id: chatId,
                            ended_by: userId,
                            reason: "disconnected",
                        });
                    }
                }
            }
        }, 2000); 
      }
    });
  });

  registerChatHandlers(io);
  registerCallHandlers(io);
  registerNotificationHandlers(io);
  registerOrderHandlers(io);

  setSocketInstance(io);

  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO engine connection_error:", err.message || err);
  });

  return io;
}
