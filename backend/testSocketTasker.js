import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  transports: ["websocket", "polling"],
  auth: {
    token:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTQ4MjIwYjJhMWZmODA1NTgxODFiZTEiLCJyb2xlIjoidGFza2VyIiwiaWF0IjoxNzY2ODAyNjk1LCJleHAiOjE3Njc0MDc0OTV9.kVzaDP6hyMXu57nc180VxjO0Dvm4FbJm6sZldmxrJtI",
  },
});

socket.on("connect", () => {
  console.log("Connected to server! Socket ID:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});

socket.on("connect", () => {
  console.log("Connected");
});

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});

// socket.emit(
//   "join-order-room",
//   { order_id: "69483ba9fac083487a14f445" },
//   (res) => {
//     console.log("Join order room response:", res);
//   }
// );

socket.emit('tasker-accept', { order_id: '694f48e3192b366dfa6f1a2a' }, (res) => {
  console.log('Tasker accept response:', res);
});


