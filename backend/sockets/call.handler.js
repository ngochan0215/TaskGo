import User from "../models/users.js";
import { fetchChat } from "../services/chat.service.js";

// In-memory store for active calls
export const activeCalls = new Map(); 

export default function registerCallHandlers(io) {
  io.on("connection", (socket) => {
    const userId = String(socket.user.userId);

    // Initiate a call to the other participant in a chat
    socket.on("call:initiate", async (payload = {}, ack) => {
      try {
        const { order_id } = payload || {};
        
        if (!order_id) {
          return ack && ack({ ok: false, error: "missing_order_id" });
        }

        const targetChat = await fetchChat(order_id, userId, true);
        const chatId = String(targetChat._id);

        // Check if there's already an active call
        if (activeCalls.has(chatId)) {
          return ack && ack({ ok: false, error: "call_already_in_progress" });
        }

        // Find the other participant
        const otherParticipant = targetChat.participants.find(
          (p) => String(p.user_id) !== userId
        );

        if (!otherParticipant) {
          return ack && ack({ ok: false, error: "no_participant_found" });
        }

        const calleeId = String(otherParticipant.user_id);
        const callerInfo = await User.findById(userId).select("full_name avatar_url");

        // Store call state
        activeCalls.set(chatId, {
          callerId: userId,
          calleeId: calleeId,
          callerName: callerInfo ? callerInfo.full_name : "Unknown",
          callerAvatar: callerInfo ? callerInfo.avatar_url : null,
          orderId: order_id,
          status: "ringing",
          startedAt: new Date(),
        });

        // Notify the callee about incoming call
        io.to(`user:${calleeId}`).emit("call:incoming", {
          chat_id: chatId,
          order_id: order_id,
          caller_id: userId,
          caller_name: callerInfo ? callerInfo.full_name : "Unknown",
          caller_avatar: callerInfo ? callerInfo.avatar_url : null,
        });

        // ACK the caller
        if (typeof ack === "function") {
          ack({ ok: true, chat_id: chatId, callee_id: calleeId });
        }

        // Auto-cancel if not answered in 30 seconds
        setTimeout(() => {
          const call = activeCalls.get(chatId);
          if (call && call.status === "ringing") {
            activeCalls.delete(chatId);
            io.to(`user:${userId}`).emit("call:timeout", { chat_id: chatId });
            io.to(`user:${calleeId}`).emit("call:timeout", { chat_id: chatId });
          }
        }, 30000);

      } catch (err) {
        console.error("call:initiate error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // Accept an incoming call
    socket.on("call:accept", async (payload = {}, ack) => {
      try {
        const { order_id } = payload || {};

        const targetChat = await fetchChat(order_id, userId);
        const chatId = String(targetChat._id);

        const call = activeCalls.get(chatId);
        if (!call) {
          return ack && ack({ ok: false, error: "no_active_call" });
        }

        if (call.calleeId !== userId) {
          return ack && ack({ ok: false, error: "not_the_callee" });
        }

        // Update call status
        call.status = "connected";
        activeCalls.set(chatId, call);

        // Notify the caller that call was accepted
        io.to(`user:${call.callerId}`).emit("call:accepted", {
          chat_id: chatId,
          accepted_by: userId,
        });

        if (typeof ack === "function") {
          ack({ ok: true, caller_id: call.callerId });
        }
      } catch (err) {
        console.error("call:accept error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // Reject/decline an incoming call
    socket.on("call:reject", async (payload = {}, ack) => {
      try {
        const { order_id } = payload || {};

        const targetChat = await fetchChat(order_id, userId);
        const chatId = String(targetChat._id);

        const call = activeCalls.get(chatId);
        if (!call) {
          return ack && ack({ ok: false, error: "no_active_call" });
        }

        // Remove call from active calls
        activeCalls.delete(chatId);

        // Notify the caller that call was rejected
        io.to(`user:${call.callerId}`).emit("call:rejected", {
          chat_id: chatId,
          rejected_by: userId,
        });

        if (typeof ack === "function") {
          ack({ ok: true });
        }
      } catch (err) {
        console.error("call:reject error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // End an ongoing call
    socket.on("call:end", async (payload = {}, ack) => {
      try {
        const { order_id } = payload || {};

        const targetChat = await fetchChat(order_id, userId);
        const chatId = String(targetChat._id);

        const call = activeCalls.get(chatId);
        if (!call) {
          return ack && ack({ ok: false, error: "no_active_call" });
        }

        // Remove call from active calls
        activeCalls.delete(chatId);

        // Notify both participants
        const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
        io.to(`user:${otherUserId}`).emit("call:ended", {
          chat_id: chatId,
          ended_by: userId,
        });

        if (typeof ack === "function") {
          ack({ ok: true });
        }
      } catch (err) {
        console.error("call:end error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // WebRTC Signaling: Send offer
    socket.on("call:offer", async (payload = {}, ack) => {
      try {
        const { order_id, offer } = payload || {};

        const targetChat = await fetchChat(order_id, userId);
        const chatId = String(targetChat._id);

        const call = activeCalls.get(chatId);
        if (!call || call.status !== "connected") {
          return ack && ack({ ok: false, error: "call_not_connected" });
        }

        const targetUserId = call.callerId === userId ? call.calleeId : call.callerId;

        // Forward offer to the other participant
        io.to(`user:${targetUserId}`).emit("call:offer", {
          chat_id: chatId,
          offer: offer,
          from: userId,
        });

        if (typeof ack === "function") {
          ack({ ok: true });
        }
      } catch (err) {
        console.error("call:offer error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // WebRTC Signaling: Send answer
    socket.on("call:answer", async (payload = {}, ack) => {
      try {
        const { order_id, answer } = payload || {};

        const targetChat = await fetchChat(order_id, userId);
        const chatId = String(targetChat._id);

        const call = activeCalls.get(chatId);
        if (!call || call.status !== "connected") {
          return ack && ack({ ok: false, error: "call_not_connected" });
        }

        const targetUserId = call.callerId === userId ? call.calleeId : call.callerId;

        // Forward answer to the other participant
        io.to(`user:${targetUserId}`).emit("call:answer", {
          chat_id: chatId,
          answer: answer,
          from: userId,
        });

        if (typeof ack === "function") {
          ack({ ok: true });
        }
      } catch (err) {
        console.error("call:answer error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // WebRTC Signaling: ICE candidate exchange
    socket.on("call:ice-candidate", async (payload = {}, ack) => {
      try {
        const { order_id, candidate } = payload || {};

        const targetChat = await fetchChat(order_id, userId);
        const chatId = String(targetChat._id);

        const call = activeCalls.get(chatId);
        if (!call) {
          return ack && ack({ ok: false, error: "no_active_call" });
        }

        const targetUserId = call.callerId === userId ? call.calleeId : call.callerId;

        // Forward ICE candidate to the other participant
        io.to(`user:${targetUserId}`).emit("call:ice-candidate", {
          chat_id: chatId,
          candidate: candidate,
          from: userId,
        });

        if (typeof ack === "function") {
          ack({ ok: true });
        }
      } catch (err) {
        console.error("call:ice-candidate error", err);
        if (typeof ack === "function") {
          ack({ ok: false, error: err.message || "server_error" });
        }
      }
    });

    // Handle disconnect - clean up any active calls
    // socket.on("disconnect", () => {
    //   // Find and end any calls this user was part of
    //   for (const [chatId, call] of activeCalls.entries()) {
    //     if (call.callerId === userId || call.calleeId === userId) {
    //       const otherUserId = call.callerId === userId ? call.calleeId : call.callerId;
    //       activeCalls.delete(chatId);
    //       io.to(`user:${otherUserId}`).emit("call:ended", {
    //         chat_id: chatId,
    //         ended_by: userId,
    //         reason: "disconnected",
    //       });
    //     }
    //   }
    // });
  });
}
