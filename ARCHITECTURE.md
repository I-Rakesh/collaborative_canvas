```markdown
# 🧱 ARCHITECTURE.md

## 🎯 Overview

The **Real-Time Collaborative Canvas** enables multiple users to draw on the same shared canvas simultaneously using **Socket.io** over WebSockets.
Each client maintains a live rendering of the global drawing state, synchronized in real-time through server-managed operations.

---

## 🗺️ Data Flow Diagram

Below is the conceptual flow of data between users, the client, and the server:
```

```
    ┌──────────────────┐
    │      User A      │
    │ (Browser Client) │
    └───────┬──────────┘
            │
            │ 1️⃣ Draws on canvas → emits stroke events
            ▼
    ┌──────────────────┐
    │  Socket.io Server│
    │ (Node + Express) │
    └───────┬──────────┘
            │
            │ 2️⃣ Broadcast stroke updates to all in room
            ▼
    ┌──────────────────┐
    │   Room Manager   │
    │ (rooms.js)       │
    ├──────────────────┤
    │Assigns color     │
    │Tracks users      │
    │Holds DrawingState│
    └───────┬──────────┘
            │
            │ 3️⃣ Updates global DrawingState
            ▼
    ┌──────────────────┐
    │  DrawingState    │
    │(drawing_state.js)│
    ├──────────────────┤
    │ ops[] = history  │
    │ redoStack[]      │
    │ undo/redo/clear  │
    └───────┬──────────┘
            │
            │ 4️⃣ Emits snapshot to all clients
            ▼
    ┌──────────────────┐
    │   User B, User C │
    │ (Other Clients)  │
    └──────────────────┘
```

````

---

## 🔌 WebSocket Protocol

The app communicates entirely through **Socket.io** events.

| Event | Direction | Description |
|--------|------------|-------------|
| `join` | Client → Server | Join a room with `{roomId, username}` |
| `joined` | Server → Client | Confirmation + user list + current ops |
| `users:update` | Server → All | Notify everyone when user list changes |
| `cursor` | Bidirectional | Send real-time cursor coordinates |
| `stroke:start` | Client → Others | User starts drawing a stroke |
| `stroke:point` | Client → Others | User moves pointer while drawing |
| `stroke:end` | Client → Others | User finishes the stroke |
| `op:commit` | Client → All | Commit final stroke to history |
| `op:undo` | Client → All | Trigger global undo |
| `op:redo` | Client → All | Trigger global redo |
| `canvas:clear` | Client → All | Clear the canvas for everyone |
| `ops:snapshot` | Server → All | Send full state snapshot (used after undo/redo/clear) |
| `user:left` | Server → All | Remove disconnected user’s cursor |

**All real-time synchronization** is achieved via these message types.
Every drawing action is represented as an **operation object**:

```js
{
  type: "stroke",
  opId: "op_12345",
  mode: "draw" | "erase",
  color: "#000000",
  width: 5,
  points: [{x, y}, {x, y}, ...],
  userId: "socketId"
}
````

---

## ♻️ Undo / Redo Strategy

Undo and redo are **global** operations, managed on the server through the `DrawingState` class:

```js
// drawing_state.js
ops[]        // all committed operations
redoStack[]  // undone operations
```

- **Undo** → `ops.pop()` → move to `redoStack`
- **Redo** → `redoStack.pop()` → push back to `ops`
- Server rebroadcasts `ops:snapshot` after every undo/redo to ensure all clients rebuild canvases consistently.

This ensures **authoritative synchronization** — no client maintains independent history.

---

## ⚙️ Performance Decisions

1. **Optimized Rendering**
   - Each stroke is drawn **incrementally** using only the latest segment instead of redrawing the entire path on every move.
     (`CanvasRenderer._drawSegment` handles minimal line updates)

2. **Client-side Preview**
   - Local brush strokes render **instantly** without waiting for the server, minimizing perceived latency.

3. **Server Batching Avoidance**
   - Events are small and streamed in real-time instead of batched, reducing delay during rapid drawing.

4. **Offscreen Canvas Layers**
   - A **base canvas** stores finalized strokes.
   - An **overlay canvas** handles live cursors and temporary strokes for a smooth, flicker-free experience.

5. **Event Debouncing Avoidance**
   - Rather than debouncing events (which can make strokes feel laggy), lightweight event payloads allow continuous updates without stuttering.

---

## ⚖️ Conflict Resolution

When multiple users draw simultaneously:

- Each stroke carries a **unique `strokeId` and `opId`**.
- The server **serializes commit order** (FIFO via Socket.io) and broadcasts the authoritative order.
- The client never tries to resolve conflicts locally — the **last write wins**.
- Cursor rendering is isolated per-user (via `renderer.cursors`), ensuring clean parallel updates.
- Since every op is replayable from `ops[]`, any temporary mismatch auto-corrects upon `ops:snapshot`.

> **Example:**
> If two users erase and draw the same area simultaneously, the one whose `op:commit` arrives last overwrites the area — ensuring consistency across all clients.

---

## 🧠 Architectural Summary

| Layer                                 | Responsibility                                       |
| ------------------------------------- | ---------------------------------------------------- |
| **Client (`canvas.js`, `main.js`)**   | Capture input, render strokes, send WebSocket events |
| **WebSocket Layer (`websocket.js`)**  | Abstracts Socket.io communication                    |
| **Server (`server.js`)**              | Routes WebSocket events, manages rooms               |
| **Rooms (`rooms.js`)**                | Tracks users, colors, and room isolation             |
| **DrawingState (`drawing_state.js`)** | Manages undo/redo stacks and authoritative ops       |
| **Canvas**                            | Rebuilds full frame using `ops:snapshot` after sync  |

---

## 🧩 Example Lifecycle of a Stroke

1️⃣ User starts drawing → `stroke:start`
2️⃣ Sends real-time points → `stroke:point`
3️⃣ Ends stroke → `stroke:end`
4️⃣ Commits final path → `op:commit`
5️⃣ Server stores op → broadcasts → all clients redraw
6️⃣ If undo triggered → server pops op → emits new snapshot → clients rebuild

---

## 🚀 Future Optimization Ideas

- Store `ops` in Redis or database for persistence
- Delta-compression for stroke data
- Lazy replay (draw only visible strokes)
- Conflict-free replicated data type (CRDT) integration
- FPS & latency visualization layer

---

## 🏁 Conclusion

This architecture balances **real-time responsiveness**, **data consistency**, and **simplicity**.
By combining **Socket.io**, a **centralized state engine**, and **client-side smooth rendering**,
it achieves a seamless multi-user drawing experience across desktop and mobile.
