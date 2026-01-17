let socket = null;

export function initSocket() {
  if (socket) return socket;

  socket = io("http://localhost:3000", {
    auth: {
      token: localStorage.getItem("token")
    }
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("connect_error", (err) => {
    console.error("Socket error:", err.message);
  });

  return socket;
}

export function getSocket() {
  if (!socket) {
    throw new Error("Socket chưa được init");
  }
  return socket;
}
