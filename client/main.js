// client/main.js
import { CanvasRenderer } from "./canvas.js";
import { WSClient } from "./websocket.js";

const el = (id) => document.getElementById(id);

// UI elements
const canvas = el("canvas");
const overlay = el("overlay");
const joinOverlay = el("joinOverlay"); // 🔒 added overlay element
const userList = el("userList");
const colorPicker = el("colorPicker");
const brushSize = el("brushSize");
const brushTool = el("brushTool");
const eraserTool = el("eraserTool");
const undoBtn = el("undoBtn");
const redoBtn = el("redoBtn");
const clearBtn = el("clearBtn");
const usernameEl = el("username");
const roomIdEl = el("roomId");
const joinBtn = el("joinBtn");

// Core instances
const renderer = new CanvasRenderer(canvas, overlay);
const ws = new WSClient();

let me = null;
let users = [];
let isJoined = false; // 🔒 lock flag

// Initially lock drawing
canvas.style.pointerEvents = "none";
overlay.style.pointerEvents = "none";

// ==== UI Logic ====
colorPicker.addEventListener("input", () =>
  renderer.setColor(colorPicker.value),
);
brushSize.addEventListener("input", () => renderer.setSize(brushSize.value));

brushTool.addEventListener("click", () => {
  brushTool.classList.add("active");
  eraserTool.classList.remove("active");
  renderer.setTool("brush");
});

eraserTool.addEventListener("click", () => {
  eraserTool.classList.add("active");
  brushTool.classList.remove("active");
  renderer.setTool("eraser");
});

undoBtn.addEventListener("click", () => {
  if (!isJoined) return alert("Join a room first!");
  ws.undo();
});
redoBtn.addEventListener("click", () => {
  if (!isJoined) return alert("Join a room first!");
  ws.redo();
});
clearBtn.addEventListener("click", () => {
  if (!isJoined) return alert("Join a room first!");
  ws.clear();
});

// === Join button ===
joinBtn.addEventListener("click", () => {
  const username = usernameEl.value.trim() || "Anonymous";
  const roomId = roomIdEl.value.trim();

  if (!roomId) {
    alert("⚠️ Please enter a Room ID before joining!");
    return;
  }

  ws.join(roomId, username);
});

// ==== Renderer → WebSocket ====
renderer.onCursor = ({ x, y }) => {
  if (isJoined) ws.sendCursor(x, y);
};
renderer.onStart = (payload) => {
  if (isJoined) ws.startStroke(payload);
};
renderer.onPoint = (payload) => {
  if (isJoined) ws.sendPoint(payload);
};
renderer.onEnd = (payload) => {
  if (isJoined) ws.endStroke(payload);
};
renderer.onCommit = (op) => {
  if (isJoined) ws.commitOp(op);
};

// ==== WebSocket → Renderer ====
ws.on("joined", ({ user, users: initialUsers, ops }) => {
  me = user;
  users = initialUsers;
  isJoined = true;

  // 🔓 Unlock drawing
  canvas.style.pointerEvents = "auto";
  overlay.style.pointerEvents = "none";
  joinOverlay.classList.add("hidden");

  // ✅ clear all old cursors when joining new room
  renderer.cursors.clear();

  // ✅ create placeholder cursors for all other users
  for (const u of users) {
    if (u.id !== me.id) {
      renderer.cursors.set(u.id, {
        x: -10,
        y: -10,
        color: u.color,
        name: u.name,
      });
    }
  }

  refreshUserList();
  renderer.setColor(me.color);
  colorPicker.value = me.color;
  renderer.rebuildFromOps(ops);
});

// ✅ when user list updates (join/leave)
ws.on("users:update", (list) => {
  const previous = new Set(users.map((u) => u.id));
  const next = new Set(list.map((u) => u.id));

  // remove stale cursors
  for (const oldId of previous) {
    if (!next.has(oldId)) {
      renderer.cursors.delete(oldId);
    }
  }

  users = list;
  refreshUserList();
});

// ✅ handle user leaving explicitly (remove their cursor)
ws.on("user:left", ({ userId }) => {
  renderer.cursors.delete(userId);
});

// ✅ handle cursor updates safely (prevents ghost cursors)
ws.on("cursor", ({ userId, x, y }) => {
  const u = users.find((u) => u.id === userId);
  if (!u) return; // ignore if the user left before the update arrived
  renderer.updateCursor({ userId, x, y, color: u.color, name: u.name });
});

ws.on("stroke:start", (payload) => renderer.remoteStart(payload));
ws.on("stroke:point", (payload) => renderer.remotePoint(payload));
ws.on("stroke:end", (payload) => renderer.remoteEnd(payload));

ws.on("op:commit", (op) => {
  const ctx = renderer.baseCtx;
  ctx.save();
  const erase = op.mode === "erase";
  ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";
  ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : op.color;
  ctx.lineWidth = op.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const pts = op.points;
  if (pts.length > 1) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
  ctx.restore();
  renderer._blitBase();
});

ws.on("ops:snapshot", (ops) => renderer.rebuildFromOps(ops));

// ✅ Handle join errors from server
ws.on("error", (data) => {
  alert(data.message || "Failed to join room");
});

// ==== Helper ====
function refreshUserList() {
  userList.innerHTML = users
    .map(
      (u) =>
        `<li><span class="swatch" style="background:${u.color}"></span>${u.name}</li>`,
    )
    .join("");
}

// Auto join
window.addEventListener("load", () => {
  joinOverlay.classList.remove("hidden");
});
