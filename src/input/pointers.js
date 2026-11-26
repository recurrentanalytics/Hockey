// Mouse / touch / pen pointers in UI-layer coordinates.
export class Pointers {
  constructor(canvas, display) {
    this.display = display;
    this.active = new Map();
    this.downs = [];
    this.taps = [];
    // Phones/tablets: show touch controls from the start.
    this.touchSeen = navigator.maxTouchPoints > 0 && !!window.matchMedia?.('(pointer: coarse)').matches;
    this.onDown = null; // (rec) => true to swallow the press (runs inside the event)
    this.lastType = null;

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      canvas.setPointerCapture?.(e.pointerId);
      const p = display.toUI(e.clientX, e.clientY);
      const rec = { id: e.pointerId, x: p.x, y: p.y, sx: p.x, sy: p.y, type: e.pointerType, claimed: false, moved: false };
      if (e.pointerType === 'touch') this.touchSeen = true;
      if (this.onDown?.(rec)) return;
      this.active.set(e.pointerId, rec);
      this.downs.push(rec);
      this.lastType = e.pointerType;
      if (e.pointerType === 'touch') this.touchSeen = true;
    });
    canvas.addEventListener('pointermove', (e) => {
      const rec = this.active.get(e.pointerId);
      if (!rec) return;
      const p = display.toUI(e.clientX, e.clientY);
      rec.x = p.x; rec.y = p.y;
      if (Math.hypot(rec.x - rec.sx, rec.y - rec.sy) > 6) rec.moved = true;
    });
    const end = (e) => {
      const rec = this.active.get(e.pointerId);
      if (!rec) return;
      this.active.delete(e.pointerId);
      if (e.type === 'pointerup' && !rec.claimed && !rec.moved) this.taps.push({ x: rec.x, y: rec.y, type: rec.type });
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  endStep() {
    this.downs = [];
    this.taps = [];
  }
}
