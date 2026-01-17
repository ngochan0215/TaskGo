export const userSocketsMap = new Map();
// userId -> Set<socketId>

export function getOnlineTaskerUserIds(io) {
  const room = io.sockets.adapter.rooms.get("taskers:online");
  if (!room) return [];

  console.log("ROOM: ", room);
  const ids = [];
  for (const socketId of room) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket?.user?.userId) {
      ids.push(String(socket.user.userId));
    }
  }
  return [...new Set(ids)];
}
