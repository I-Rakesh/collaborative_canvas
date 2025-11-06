// client/canvas.js

export class CanvasRenderer {
  // ==== event hooks (defined for TS/JS intellisense) ====
  onCursor = null;
  onStart = null;
  onPoint = null;
  onEnd = null;
  onCommit = null;

  constructor(canvasEl, overlayEl) {
    this.canvas = canvasEl;
    this.overlay = overlayEl;
    this.ctx = this.canvas.getContext("2d");

    this.currentTool = "brush";
    this.color = "#000000";
    this.size = 5;

    // Base canvas stores all confirmed operations
    this.base = document.createElement("canvas");
    this.base.width = this.canvas.width;
    this.base.height = this.canvas.height;
    this.baseCtx = this.base.getContext("2d");

    // Cursor overlay (shows other users’ cursors)
    this.cursorLayer = document.createElement("canvas");
    this.cursorLayer.width = this.canvas.width;
    this.cursorLayer.height = this.canvas.height;
    this.cursorCtx = this.cursorLayer.getContext("2d");
    this.overlay.appendChild(this.cursorLayer);

    // State for local + remote strokes
    this.localPoints = [];
    this.localStrokeId = null;
    this.liveStrokes = new Map(); // strokeId -> {lastX, lastY, color, width, mode}
    this.cursors = new Map(); // userId -> {x,y,color,name}

    this._bindPointer();
    this._renderLoop();
  }

  // ==== basic settings ====
  setTool(tool) {
    this.currentTool = tool;
  }
  setColor(c) {
    this.color = c;
  }
  setSize(px) {
    this.size = +px;
  }

  // ==== handle mouse input ====
  _bindPointer() {
    const getXY = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) * this.canvas.width) / rect.width;
      const y = ((e.clientY - rect.top) * this.canvas.height) / rect.height;
      return { x, y };
    };

    const onMove = (e) => {
      const { x, y } = getXY(e);
      if (this.onCursor) this.onCursor({ x, y });
      if (!this.drawing) return;

      this.localPoints.push({ x, y });
      // Local preview (brush/eraser)
      this._drawSegment(this.ctx, this.localPoints, this.currentTool);

      if (this.onPoint) this.onPoint({ strokeId: this.localStrokeId, x, y });
    };

    this.canvas.addEventListener("mousedown", (e) => {
      this.drawing = true;
      const { x, y } = getXY(e);
      this.localStrokeId = `s_${Math.random().toString(36).slice(2)}`;
      this.localPoints = [{ x, y }];

      if (this.onStart)
        this.onStart({
          strokeId: this.localStrokeId,
          color: this.color,
          width: this.size,
          mode: this.currentTool === "eraser" ? "erase" : "draw",
          x,
          y, // important for remote users
        });

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp, { once: true });
    });

    const onUp = () => {
      this.drawing = false;
      window.removeEventListener("mousemove", onMove);

      if (this.onEnd) this.onEnd({ strokeId: this.localStrokeId });

      // Commit final stroke
      if (this.localPoints.length > 1 && this.onCommit) {
        this.onCommit({
          type: "stroke",
          opId: `op_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          mode: this.currentTool === "eraser" ? "erase" : "draw",
          color: this.color,
          width: this.size,
          points: this.localPoints,
        });
      }

      // Draw stroke permanently into base layer
      this._drawSegment(this.baseCtx, this.localPoints, this.currentTool);
      this._blitBase();

      this.localPoints = [];
      this.localStrokeId = null;
    };
  }

  // ==== core drawing logic ====
  _drawSegment(ctx, points, toolMode) {
    if (points.length < 2) return;
    const erase = toolMode === "eraser";

    ctx.save();
    ctx.lineWidth = this.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : this.color;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";

    // draw only the newest line segment
    const a = points[points.length - 2];
    const b = points[points.length - 1];
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    ctx.restore();
  }

  // ==== rebuild full canvas from server ops (undo/redo/new join) ====
  rebuildFromOps(ops) {
    this.baseCtx.clearRect(0, 0, this.base.width, this.base.height);
    for (const op of ops) {
      if (op.type !== "stroke" || op.points.length < 2) continue;
      const erase = op.mode === "erase";

      this.baseCtx.save();
      this.baseCtx.lineWidth = op.width;
      this.baseCtx.lineCap = "round";
      this.baseCtx.lineJoin = "round";
      this.baseCtx.strokeStyle = erase ? "rgba(0,0,0,1)" : op.color;
      this.baseCtx.globalCompositeOperation = erase
        ? "destination-out"
        : "source-over";

      const pts = op.points;
      this.baseCtx.beginPath();
      this.baseCtx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++)
        this.baseCtx.lineTo(pts[i].x, pts[i].y);
      this.baseCtx.stroke();

      this.baseCtx.restore();
    }
    this._blitBase();
  }

  // ==== sync visible canvas with base ====
  _blitBase() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.base, 0, 0);
  }

  // ==== remote live stroke preview (other users) ====
  remoteStart({ strokeId, color, width, mode, x, y }) {
    this.liveStrokes.set(strokeId, { lastX: x, lastY: y, color, width, mode });
  }

  remotePoint({ strokeId, x, y }) {
    const s = this.liveStrokes.get(strokeId);
    if (!s) return;

    const erase = s.mode === "erase";
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = erase ? "rgba(0,0,0,1)" : s.color;
    ctx.globalCompositeOperation = erase ? "destination-out" : "source-over";

    ctx.beginPath();
    ctx.moveTo(s.lastX, s.lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    s.lastX = x;
    s.lastY = y;
  }

  remoteEnd({ strokeId }) {
    this.liveStrokes.delete(strokeId);
  }

  // ==== cursor overlay (other users’ pointers) ====
  updateCursor(user) {
    this.cursors.set(user.userId, user);
  }

  // ==== continuous rendering loop for cursors ====
  _renderLoop() {
    const drawCursors = () => {
      this.cursorCtx.clearRect(
        0,
        0,
        this.cursorLayer.width,
        this.cursorLayer.height,
      );
      for (const [, c] of this.cursors) {
        this.cursorCtx.save();
        this.cursorCtx.beginPath();
        this.cursorCtx.arc(c.x, c.y, 4, 0, Math.PI * 2);
        this.cursorCtx.fillStyle = c.color || "#000";
        this.cursorCtx.fill();
        this.cursorCtx.font = "12px sans-serif";
        this.cursorCtx.fillText(c.name || "", c.x + 6, c.y - 6);
        this.cursorCtx.restore();
      }
      requestAnimationFrame(drawCursors);
    };
    requestAnimationFrame(drawCursors);
  }
}
