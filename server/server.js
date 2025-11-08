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

  socket.on("join", ({ roomId, username }) => {
    if (!roomId || roomId.trim() === "") {
      socket.emit("error", { message: "Room ID is required to join." });
      return;
    }

    currentRoomId = roomId.trim();
    user = rooms.addUser(currentRoomId, socket.id, username);
    socket.join(currentRoomId);

    const snapshot = rooms.getState(currentRoomId).getSnapshot();
    socket.emit("joined", {
      roomId: currentRoomId,
      user,
      users: rooms.getUsers(currentRoomId),
      ops: snapshot.ops,
      canvasSize: snapshot.canvasSize,
    });

    io.to(currentRoomId).emit("users:update", rooms.getUsers(currentRoomId));

    const state = rooms.getState(currentRoomId);
    const snap = state.getSnapshot();
    io.to(currentRoomId).emit("ops:snapshot", snap.ops);
  });

  socket.on("cursor", (data) => {
    if (!currentRoomId || !user) return;
    socket.to(currentRoomId).emit("cursor", {
      userId: user.id,
      x: data.x,
      y: data.y,
    });
  });

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

  socket.on("op:commit", (op) => {
    if (!currentRoomId || !user) return;
    const state = rooms.getState(currentRoomId);
    const committed = state.commitOperation({
      ...op,
      userId: user.id,
      timestamp: Date.now(),
    });
    if (!committed) return;

    io.to(currentRoomId).emit("op:commit", committed);
  });

  socket.on("op:undo", () => {
    if (!currentRoomId) return;
    const state = rooms.getState(currentRoomId);
    state.undo();
    const snapshot = state.getSnapshot();
    io.to(currentRoomId).emit("ops:snapshot", snapshot.ops);
  });

  socket.on("op:redo", () => {
    if (!currentRoomId) return;
    const state = rooms.getState(currentRoomId);
    state.redo();
    const snapshot = state.getSnapshot();
    io.to(currentRoomId).emit("ops:snapshot", snapshot.ops);
  });

  socket.on("canvas:clear", () => {
    if (!currentRoomId) return;
    const state = rooms.getState(currentRoomId);
    state.clear();
    io.to(currentRoomId).emit("ops:snapshot", state.getSnapshot().ops);
  });

  socket.on("disconnect", () => {
    if (currentRoomId) {
      rooms.removeUser(currentRoomId, socket.id);
      io.to(currentRoomId).emit("users:update", rooms.getUsers(currentRoomId));

      io.to(currentRoomId).emit("user:left", { userId: socket.id });
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
