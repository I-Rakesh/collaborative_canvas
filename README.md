# 🎨 Real-Time Collaborative Canvas

A **real-time multi-user drawing application** built using **Vanilla JavaScript**, **HTML5 Canvas**, and **Node.js + Socket.io**.
Users can draw together on the same canvas with smooth synchronization, undo/redo, cursor sharing, and room-based collaboration.

---

## 🚀 Features

### 🖌️ Drawing Tools

- Brush and Eraser modes
- Adjustable stroke size
- Color picker for custom brush colors
- Smooth drawing with optimized canvas path rendering

### 🔄 Real-Time Synchronization

- Live stroke streaming between users
- Real-time cursor updates (see others draw in real-time)
- Efficient event broadcasting with Socket.io

### 👥 User System

- Room-based isolation (create or join a room by ID)
- Unique color assigned to each user automatically
- Live online user list

### 🧠 State Management

- Centralized canvas state stored per room
- Global Undo / Redo (affects all users)
- Clear canvas for everyone

### 📱 Responsive UI

- Modern, minimal pastel-themed interface
- Works on both desktop and mobile (touch drawing supported)

---

## 🧩 Tech Stack

| Layer           | Technology                      |
| --------------- | ------------------------------- |
| Frontend        | HTML5, CSS3, Vanilla JavaScript |
| Backend         | Node.js, Express.js             |
| Realtime Engine | Socket.io                       |
| Drawing Engine  | HTML5 Canvas API                |

---

## ⚙️ Installation and Setup

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/<your-username>/collaborative_canvas.git
cd collaborative_canvas
```

### 2️⃣ Install Dependencies

Make sure you have **Node.js (>=18)** installed. Then run:

```bash
npm install
```

This installs all required dependencies:

- `express` — for serving static files
- `socket.io` — for real-time WebSocket communication

### 3️⃣ Start the Server

```bash
npm start
```

By default, it runs on **[http://localhost:3000](http://localhost:3000)**

You can also run in development mode with automatic restarts:

```bash
npm run dev
```

---

## 🧪 Usage Instructions

### 💻 On Desktop

1. Open **[http://localhost:3000](http://localhost:3000)** in your browser.
2. Enter your **name** and a **room ID** (e.g., `test-room`) then click **Join**.
3. Once joined:
   - Select brush or eraser tool.
   - Adjust color and size using controls.
   - Start drawing — other users in the same room will see your strokes instantly!

4. Use **Undo**, **Redo**, or **Clear** buttons for collaborative editing.

### 📱 On Mobile

- Fully supports **touch drawing**.
- UI automatically adapts to small screens.

---

## 🧠 How to Test Multi-User Collaboration

To test in real time:

1. Open two browser tabs (or devices).
2. In both, open [http://localhost:3000](http://localhost:3000).
3. Enter the same **Room ID** (e.g., `demo123`) and different usernames.
4. Draw on one tab — you’ll see it appear instantly on the other.

---

## 📁 Project Structure

```
collaborative_canvas/
├── client/
│   ├── index.html          # Frontend UI
│   ├── style.css           # Pastel-themed responsive styles
│   ├── main.js             # Entry point (initialization)
│   ├── canvas.js           # Canvas drawing + rendering logic
│   ├── websocket.js        # WebSocket communication
├── server/
│   ├── server.js           # Express + Socket.io backend
│   ├── rooms.js            # Room and user management
│   ├── drawing_state.js    # Undo/redo + stroke history
├── package.json
├── package-lock.json
├── README.md
└── ARCHITECTURE.md
```

---

## 💬 WebSocket Events Overview

| Event                 | Direction       | Description                            |
| --------------------- | --------------- | -------------------------------------- |
| `join`                | Client → Server | Join a room                            |
| `joined`              | Server → Client | Receive room data and existing strokes |
| `users:update`        | Server → All    | Broadcast user list                    |
| `cursor`              | Bidirectional   | Update cursor positions                |
| `stroke:start`        | Client → Others | Begin drawing                          |
| `stroke:point`        | Client → Others | Send live stroke coordinates           |
| `stroke:end`          | Client → Others | End stroke                             |
| `op:commit`           | Client → All    | Finalize and store stroke              |
| `op:undo` / `op:redo` | Client → All    | Global undo/redo                       |
| `canvas:clear`        | Client → All    | Clear entire canvas                    |
| `user:left`           | Server → All    | Remove user cursor on disconnect       |

---

## 🧱 Architecture Summary

Each user connects to the backend via **Socket.io**.
The backend maintains:

- A `Rooms` map for multi-room isolation.
- A `DrawingState` instance for each room to manage undo/redo stacks.

All drawing actions are emitted as WebSocket events:

1. Client starts stroke (`stroke:start`)
2. Streams points (`stroke:point`)
3. Ends stroke (`stroke:end`)
4. Commits final stroke (`op:commit`) → stored server-side and broadcast to all clients

Each client rebuilds its canvas using the global list of operations (`ops`).

---

## 🪄 Global Undo / Redo Implementation

Implemented using the **`DrawingState`** class:

- `ops[]` holds all committed operations.
- `redoStack[]` stores undone ops.
- When Undo is triggered, the last op is popped → redoStack.
- When Redo is triggered, redoStack.pop() → ops.
- The server broadcasts updated snapshots (`ops:snapshot`) to all clients to ensure consistency.

---

## 🧰 Commands Summary

| Command       | Description                                 |
| ------------- | ------------------------------------------- |
| `npm install` | Install all dependencies                    |
| `npm start`   | Start the production server                 |
| `npm run dev` | Run the server with auto-restart (dev mode) |

---

## 🧠 Known Limitations

- Undo/Redo applies globally (not per-user)
- Canvas is not persistent (resets when server restarts)
- No authentication layer
- Limited conflict resolution (last-write wins)

---

## 🚧 Future Enhancements

- Session persistence (store ops in database)
- Per-user undo/redo
- Shape tools (rectangle, line, circle)
- FPS/latency monitor
- Room passwords or authentication

---

## 🧑‍💻 Development Notes

| Task                          | Time Spent  |
| ----------------------------- | ----------- |
| Canvas & Brush Implementation | 5 hrs       |
| WebSocket Communication       | 4 hrs       |
| Undo/Redo + State Sync        | 3 hrs       |
| UI/UX & Responsiveness        | 3 hrs       |
| Docs, Testing, Polish         | 1 hr        |
| **Total**                     | **~16 hrs** |
