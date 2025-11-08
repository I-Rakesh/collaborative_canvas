export class WSClient {
  constructor() {
    this.socket = io();
  }

  join(roomId, username) {
    this.socket.emit("join", { roomId, username });
  }

  on(event, handler) {
    this.socket.on(event, handler);
  }

  sendCursor(x, y) {
    this.socket.emit("cursor", { x, y });
  }

  startStroke(payload) {
    this.socket.emit("stroke:start", payload);
  }
  sendPoint(payload) {
    this.socket.emit("stroke:point", payload);
  }
  endStroke(payload) {
    this.socket.emit("stroke:end", payload);
  }

  commitOp(op) {
    this.socket.emit("op:commit", op);
  }

  undo() {
    this.socket.emit("op:undo");
  }
  redo() {
    this.socket.emit("op:redo");
  }
  clear() {
    this.socket.emit("canvas:clear");
  }
}
