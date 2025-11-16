import { io } from "socket.io-client";

// Token JWT của customer
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGYyNmVkNmFhZWM5ZWQ1M2VmZWU4MDciLCJyb2xlIjoiY3VzdG9tZXIiLCJpYXQiOjE3NjMwMDcxOTAsImV4cCI6MTc2MzYxMTk5MH0.ru0DeOH0aYFM9g0_GjuIde8NV_mBVfdeI6MYY-8ivvU";

const socket = io("http://localhost:3000", {
  auth: { token },  // gửi token để middleware socketAuth xác thực
});

socket.on("connect", () => {
  console.log("Connected to socket server:", socket.id);
});

// Lắng nghe thông báo từ server
socket.on("notification", (data) => {
  console.log("Received notification:", data);
});

socket.on("disconnect", () => {
  console.log("Disconnected");
});

socket.on("connect_error", (err) => {
  console.error("Connection error:", err.message);
});
