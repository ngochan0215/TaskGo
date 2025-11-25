// import { io } from "socket.io-client";

// // Token JWT của customer
// const token = "";

// const socket = io("http://localhost:3000", {
//   auth: { token },  // gửi token để middleware socketAuth xác thực
// });

// socket.on("connect", () => {
//   console.log("Connected to socket server:", socket.id);
// });

// // Lắng nghe thông báo từ server
// socket.on("notification", (data) => {
//   console.log("Received notification:", data);
// });

// socket.on("disconnect", () => {
//   console.log("Disconnected");
// });

// socket.on("connect_error", (err) => {
//   console.error("Connection error:", err.message);
// });
