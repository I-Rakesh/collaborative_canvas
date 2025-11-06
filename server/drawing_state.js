// server/drawing-state.js
// Maintains authoritative history of operations for a room.
// Operation types: 'stroke' with { points: [{x,y}], color, width, mode: 'draw'|'erase', userId, opId }

let NEXT_ID = 1;

export class DrawingState {
  constructor() {
    this.ops = []; // committed operations (for replay)
    this.redoStack = []; // for redo
    this.canvasSize = { width: 800, height: 500 };
  }

  getSnapshot() {
    return { ops: this.ops, canvasSize: this.canvasSize };
  }

  commitOperation(op) {
    if (!op || !op.points || op.points.length < 2) return null;
    const committed = {
      type: "stroke",
      mode: op.mode === "erase" ? "erase" : "draw",
      color: op.color,
      width: op.width,
      points: op.points,
      userId: op.userId,
      timestamp: op.timestamp || Date.now(),
      opId: op.opId || `op_${NEXT_ID++}`,
    };
    this.ops.push(committed);
    this.redoStack = [];
    return committed;
  }

  undo() {
    if (this.ops.length === 0) return null;
    const removed = this.ops.pop();
    this.redoStack.push(removed);
    return removed;
  }

  redo() {
    if (this.redoStack.length === 0) return null;
    const op = this.redoStack.pop();
    this.ops.push(op);
    return op;
  }

  clear() {
    this.ops = [];
    this.redoStack = [];
  }
}
