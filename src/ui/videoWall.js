// The arena video wall: pops up during stoppages with a kiss cam, Bonny cam,
// dance cam or a goal replay card.
import { PAL } from '../engine/palette.js';
import { drawText, drawTextOutlined } from '../engine/font.js';
import { panel, fillCircle } from '../engine/draw.js';
import { TEAMS } from '../config.js';
import { skaterFigures as skaterSprites, HAIR } from '../world/sprites.js';

const W = 100, H = 60;
const SHIRTS = [PAL.red, PAL.blue, PAL.yellow, PAL.green, PAL.purple, PAL.orange, PAL.pink, PAL.sky];

function heart(ctx, x, y, color) {
  ctx.fillStyle = color;
  for (const [dx, dy, w] of [[0, 0, 2], [3, 0, 2], [-1, 1, 7], [-1, 2, 7], [0, 3, 5], [1, 4, 3], [2, 5, 1]]) ctx.fillRect(x + dx, y + dy, w, 1);
}

/** A chibi fan, 2x size: round head with hair, face, shirt. */
function fan(ctx, x, y, hair, shirt, { lean = 0, eyesClosed = false } = {}) {
  ctx.fillStyle = shirt;
  fillCircle(ctx, x, y + 15, 7);
  ctx.fillStyle = PAL.ink;
  fillCircle(ctx, x + lean, y, 9);
  ctx.fillStyle = PAL.skin;
  fillCircle(ctx, x + lean, y, 8);
  ctx.fillStyle = hair;
  ctx.fillRect(x + lean - 8, y - 8, 17, 5);
  ctx.fillRect(x + lean - 8, y - 4, 3, 5);
  ctx.fillStyle = PAL.ink;
  if (eyesClosed) { ctx.fillRect(x + lean - 4, y + 1, 3, 1); ctx.fillRect(x + lean + 2, y + 1, 3, 1); }
  else { ctx.fillRect(x + lean - 4, y, 2, 3); ctx.fillRect(x + lean + 3, y, 2, 3); }
  ctx.fillStyle = PAL.pink;
  ctx.fillRect(x + lean - 6, y + 4, 2, 1); ctx.fillRect(x + lean + 5, y + 4, 2, 1);
}

export class VideoWall {
  constructor() {
    this.show = null;
  }

  /** kind: 'kiss' | 'bonny' | 'dance' | 'goal' */
  start(kind, data = {}, seconds = 3.2, delay = 0) {
    const r = Math.random;
    this.show = {
      kind, data, t: -delay, life: seconds,
      fans: [0, 1].map(() => ({ hair: HAIR[Math.floor(r() * HAIR.length)], shirt: SHIRTS[Math.floor(r() * SHIRTS.length)] })),
    };
  }

  get active() {
    return !!this.show;
  }

  update(dt) {
    if (!this.show) return;
    this.show.t += dt;
    if (this.show.t > this.show.life) this.show = null;
  }

  draw(ctx, sw) {
    const s = this.show;
    if (!s || s.t < 0) return;
    const x = sw - W - 6, y = 28;
    // Slide in from the right
    const slide = Math.max(0, 1 - s.t * 4) * (W + 10);
    const ox = Math.round(x + slide);
    panel(ctx, ox - 3, y - 3, W + 6, H + 14, { fill: PAL.ink, border: PAL.mist, alpha: 0.95 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, y, W, H);
    ctx.clip();
    // Screen background
    ctx.fillStyle = s.kind === 'kiss' ? '#ffd6e6' : s.kind === 'goal' ? '#fff1c2' : '#d7ecff';
    ctx.fillRect(ox, y, W, H);
    // Scanlines for that big-screen look
    ctx.fillStyle = 'rgba(42,31,61,0.08)';
    for (let i = 0; i < H; i += 2) ctx.fillRect(ox, y + i, W, 1);
    const t = s.t, cx = ox + W / 2;
    if (s.kind === 'kiss') {
      const lean = Math.min(4, Math.max(0, (t - 1) * 5));
      fan(ctx, cx - 16, y + 26, s.fans[0].hair, s.fans[0].shirt, { lean, eyesClosed: t > 1.6 });
      fan(ctx, cx + 16, y + 26, s.fans[1].hair, s.fans[1].shirt, { lean: -lean, eyesClosed: t > 1.6 });
      for (let i = 0; i < 4; i++) {
        const hy = y + H - ((t * 18 + i * 15) % (H + 6));
        heart(ctx, ox + 8 + i * 24, Math.round(hy), i % 2 ? PAL.red : PAL.pink);
      }
      if (t > 1.6) heart(ctx, cx - 3, y + 4 - Math.round(Math.sin(t * 8)), PAL.red);
    } else if (s.kind === 'bonny' || s.kind === 'dance') {
      const sp = s.kind === 'bonny'
        ? skaterSprites(TEAMS.borstentiere, { kind: 'boar' })
        : skaterSprites(TEAMS[s.data.team ?? 'blazers'], { hair: s.fans[0].hair });
      const frame = Math.floor(t * 6) % 2;
      const img = frame ? sp.happyRight : sp.happyLeft;
      const hop = Math.round(Math.abs(Math.sin(t * 7)) * 6);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 16, 72, 62, cx - 36, y - 2 - hop, 72, 62);
      // little musical notes
      ctx.fillStyle = PAL.purple;
      for (let i = 0; i < 3; i++) {
        const nx = ox + 10 + i * 36, ny = y + 8 + Math.round(Math.sin(t * 4 + i) * 3);
        ctx.fillRect(nx, ny, 1, 5); ctx.fillRect(nx - 2, ny + 4, 3, 2); ctx.fillRect(nx, ny, 3, 1);
      }
    } else if (s.kind === 'goal') {
      const team = TEAMS[s.data.team];
      const sp = skaterSprites(team, s.data.look ?? {});
      ctx.imageSmoothingEnabled = false;
      const hop = Math.round(Math.abs(Math.sin(t * 8)) * 5);
      ctx.drawImage(sp.happyRight, 0, 16, 72, 62, cx - 36, y - hop, 72, 62);
      // starburst
      ctx.fillStyle = PAL.yellow;
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4 + t;
        ctx.fillRect(Math.round(cx + Math.cos(a) * 34), Math.round(y + 28 + Math.sin(a) * 20), 2, 2);
      }
    }
    ctx.restore();
    const label = { kiss: 'KISS CAM', bonny: 'BONNY CAM', dance: 'DANCE CAM', goal: s.data.text ?? 'TOR!' }[s.kind];
    drawTextOutlined(ctx, label, ox + W / 2, y + H + 3, { color: s.kind === 'kiss' ? PAL.pink : PAL.yellow, align: 'center' });
  }
}
