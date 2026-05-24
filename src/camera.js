import { WORLD_HEIGHT, WORLD_WIDTH, clamp } from "./ecosystem.js";

export class Camera {
  constructor(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.minZoom = 1;
    this.maxZoom = 2.8;
    this.isDragging = false;
    this.lastPointer = null;
  }

  attach(canvas) {
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const pointer = {
        x: ((event.clientX - rect.left) / rect.width) * this.width,
        y: ((event.clientY - rect.top) / rect.height) * this.height
      };
      const before = this.screenToWorld(pointer.x, pointer.y);
      const direction = event.deltaY < 0 ? 1 : -1;
      this.zoom = clamp(this.zoom + direction * 0.18, this.minZoom, this.maxZoom);
      const after = this.screenToWorld(pointer.x, pointer.y);
      this.x += before.x - after.x;
      this.y += before.y - after.y;
      this.constrain();
    }, { passive: false });

    canvas.addEventListener("pointerdown", (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.isDragging = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
    });

    canvas.addEventListener("pointermove", (event) => {
      if (!this.isDragging || !this.lastPointer) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      this.x -= (event.clientX - this.lastPointer.x) * scaleX / this.zoom;
      this.y -= (event.clientY - this.lastPointer.y) * scaleY / this.zoom;
      this.lastPointer = { x: event.clientX, y: event.clientY };
      this.constrain();
    });

    canvas.addEventListener("pointerup", (event) => {
      this.isDragging = false;
      this.lastPointer = null;
      canvas.releasePointerCapture(event.pointerId);
    });

    canvas.addEventListener("pointercancel", () => {
      this.isDragging = false;
      this.lastPointer = null;
    });
  }

  apply(ctx) {
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.x), -Math.round(this.y));
  }

  screenToWorld(x, y) {
    return {
      x: x / this.zoom + this.x,
      y: y / this.zoom + this.y
    };
  }

  constrain() {
    const maxX = this.width - this.width / this.zoom;
    const maxY = this.height - this.height / this.zoom;
    this.x = clamp(this.x, 0, Math.max(0, maxX));
    this.y = clamp(this.y, 0, Math.max(0, maxY));
  }
}
