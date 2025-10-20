import { Server } from "socket.io";
import { socketAuth } from "../middleware/socketAuth.js";
import registerHandlers from "./handlers.js";

export function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: true, credentials: true },
  });

  // Global socket middleware for JWT auth
  io.use(socketAuth);

  // Register application event handlers
  registerHandlers(io);

  io.engine.on("connection_error", (err) => {
    console.error("Socket.IO engine connection_error:", err.message || err);
  });

  return io;
}
