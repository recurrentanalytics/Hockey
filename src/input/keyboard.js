// Raw keyboard state. `hits` remembers keys pressed since the last step so
// very short taps still register.
const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace']);

export class Keyboard {
  constructor() {
    this.down = new Set();
    this.hits = new Set();
    this.onKey = null; // optional listener for remapping
    window.addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.hits.add(e.code);
      this.onKey?.(e.code);
      this.onKeyDown?.(e.code);
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => this.down.clear());
  }

  isDown(code) { return this.down.has(code) || this.hits.has(code); }
  hit(code) { return this.hits.has(code); }
  get anyHit() { return this.hits.size > 0; }
  endStep() { this.hits.clear(); }
}
