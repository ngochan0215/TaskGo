let socket = null;

export function initSocket() {
  if (socket) return socket;

  const base = (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL : "http://localhost:3000";
  socket = io(base, {
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
