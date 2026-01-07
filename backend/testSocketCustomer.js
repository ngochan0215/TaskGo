import { io } from "socket.io-client";

const socket = io("http://localhost:4000", {
  transports: ["websocket", "polling"],
  auth: {
    token:
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OTJiZmM0MDE1OWJhYTY4MDVkNGI4MzkiLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NjY4MDI3NzIsImV4cCI6MTc2NzQwNzU3Mn0.K5-aORws7AVgu2WS6Alf5elRIwxOuxX0d9r9bQnX0EA",
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

socket.emit(
  "join-order-room",
  { order_id: "694f48e3192b366dfa6f1a2a" },
  (res) => {
    console.log("Join order room response:", res);
  }
);

socket.on("order-created", (data) => {
  console.log("Order created:", data);
});
socket.on("suggest-tasker", (data) => {
  console.log("Suggest tasker:", data);
});
