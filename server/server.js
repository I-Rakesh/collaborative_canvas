// server/server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { Rooms } from "./rooms.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "../client")));

const rooms = new Rooms();

io.on("connection", (socket) => {
  let currentRoomId = null;
  let user = null;

  // When a user joins a room
  socket.on("join", ({ roomId, username }) => {
    // 🚫 Prevent joining without room ID
    if (!roomId || roomId.trim() === "") {
      socket.emit("error", { message: "Room ID is required to join." });
      return;
    }

    currentRoomId = roomId.trim();
    user = rooms.addUser(currentRoomId, socket.id, username);
    socket.join(currentRoomId);

    // Send snapshot to the new user
    const snapshot = rooms.getState(currentRoomId).getSnapshot();
    socket.emit("joined", {
      roomId: currentRoomId,
      user,
      users: rooms.getUsers(currentRoomId),
      ops: snapshot.ops,
      canvasSize: snapshot.canvasSize,
    });

    // ✅ Notify all users in the room (including the new one)
    io.to(currentRoomId).emit("users:update", rooms.getUsers(currentRoomId));

    // ✅ Re-sync full canvas state to everyone in the room
    const state = rooms.getState(currentRoomId);
    const snap = state.getSnapshot();
    io.to(currentRoomId).emit("ops:snapshot", snap.ops);
  });

  // Handle cursor updates
  socket.on("cursor", (data) => {
    if (!currentRoomId || !user) return;
    socket.to(currentRoomId).emit("cursor", {
      userId: user.id,
      x: data.x,
      y: data.y,
    });
  });

  // Handle live stroke drawing events
  socket.on("stroke:start", ({ strokeId, color, width, mode }) => {
    if (!currentRoomId || !user) return;
    socket.to(currentRoomId).emit("stroke:start", {
      userId: user.id,
      strokeId,
      color,
      width,
      mode,
    });
  });

  socket.on("stroke:point", ({ strokeId, x, y }) => {
    if (!currentRoomId || !user) return;
    socket.to(currentRoomId).emit("stroke:point", {
      userId: user.id,
      strokeId,
      x,
      y,
    });
  });

  socket.on("stroke:end", ({ strokeId }) => {
    if (!currentRoomId || !user) return;
    socket.to(currentRoomId).emit("stroke:end", { userId: user.id, strokeId });
  });

  // Handle committed operations
  socket.on("op:commit", (op) => {
    if (!currentRoomId || !user) return;
    const state = rooms.getState(currentRoomId);
    const committed = state.commitOperation({
      ...op,
      userId: user.id,
      timestamp: Date.now(),
    });
    if (!committed) return;

    // ✅ Broadcast new operation to all users (not just others)
    io.to(currentRoomId).emit("op:commit", committed);
  });

  // ✅ Global undo (broadcast to all)
  socket.on("op:undo", () => {
    if (!currentRoomId) return;
    const state = rooms.getState(currentRoomId);
    state.undo();
    const snapshot = state.getSnapshot();
    io.to(currentRoomId).emit("ops:snapshot", snapshot.ops);
  });

  // ✅ Global redo (broadcast to all)
  socket.on("op:redo", () => {
    if (!currentRoomId) return;
    const state = rooms.getState(currentRoomId);
    state.redo();
    const snapshot = state.getSnapshot();
    io.to(currentRoomId).emit("ops:snapshot", snapshot.ops);
  });

  // ✅ Clear canvas (broadcast to all)
  socket.on("canvas:clear", () => {
    if (!currentRoomId) return;
    const state = rooms.getState(currentRoomId);
    state.clear();
    io.to(currentRoomId).emit("ops:snapshot", state.getSnapshot().ops);
  });

  // Handle disconnects
  socket.on("disconnect", () => {
    if (currentRoomId) {
      const userList = rooms.getUsers(currentRoomId);
      const leftUser = userList.find((u) => u.id === socket.id);

      rooms.removeUser(currentRoomId, socket.id);
      io.to(currentRoomId).emit("users:update", rooms.getUsers(currentRoomId));

      // ✅ notify others to remove this user's cursor
      io.to(currentRoomId).emit("user:left", { userId: socket.id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
