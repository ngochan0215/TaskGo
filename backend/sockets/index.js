import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketAuth.js";
import { setSocketInstance } from "./instance.js";
import registerChatHandlers from "./chat.handler.js";
import registerNotificationHandlers from "./notification.handler.js";

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // Global socket middleware for JWT auth
  io.use(socketAuth);

  registerChatHandlers(io);
  registerNotificationHandlers(io);

  setSocketInstance(io);

  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO engine connection_error:", err.message || err);
  });

  return io;
}
