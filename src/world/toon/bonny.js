// Bonny, the little wild boar from the Eilenriede, drawn in the comic style.
// Side view is rigged (hips, knees, ankles, shoulders, elbows, hands) so every game
// pose can be drawn; front and back views are for the model sheet and menus.
// Figure units: ~70 tall, anchor (0,0) on the ground between the skates, y up = negative.
import { shape, tube, draw, render, P, lerp, ellipse, poly, blob, ik, letter, INK } from './ink.js';
import { STYLE } from '../../art/bible.js';

const PAL = STYLE.palette;
export const COLORS = {
  fur: PAL.fur, furShade: PAL.furDark, furLight: PAL.fur,
  muzzle: PAL.muzzle, muzzleShade: PAL.muzzleDark,
  snout: PAL.snout, snoutShade: PAL.snoutDark, pink: PAL.pink,
  tusk: PAL.tusk, eyeWhite: PAL.eyeWhite, pupil: PAL.pupil,
  jersey: PAL.jersey, jerseyShade: PAL.jerseyFar, jerseyLight: PAL.jersey,
  cream: PAL.cream, orange: PAL.orange, orangeShade: PAL.orangeFar,
  pants: PAL.pants, pantsShade: PAL.pants,
  helmet: PAL.helmet, helmetShade: PAL.helmetDark, helmetLight: PAL.helmet,
  glove: PAL.glove, gloveShade: PAL.jerseyFar,
  boot: PAL.boot, bootShade: PAL.bootFar, frame: PAL.frame, wheel: PAL.wheel, wheelShade: PAL.wheelFar,
  wood: PAL.wood, woodShade: PAL.wood, tape: PAL.tape,
};
const C = COLORS;

const THIGH = 10.5, SHIN = 10, UPPER = 8.5, FORE = 8, TORSO = 17, ANKLE = 5.5, HEAD = 12;

// ------------------------------------------------------------------ side-view pieces

function skateSide(parts, ank, far) {
  const g = { x: ank.x, y: ank.y + ANKLE };
  const dk = far ? 0.75 : 1;
  const wheels = [];
  for (let i = 0; i < 4; i++) wheels.push({ x: g.x - 4.6 + i * 3.4, y: g.y - 1.6 });
  parts.push(shape((p) => { for (const w of wheels) { p.moveTo(w.x + 1.7, w.y); p.arc(w.x, w.y, 1.7, 0, Math.PI * 2); } }, far ? C.wheelShade : C.wheel, { lw: 0.45 }));
  parts.push(shape((p) => poly(p, [P(g.x - 6.4, g.y - 4.2), P(g.x + 7.4, g.y - 4.2), P(g.x + 7.4, g.y - 3), P(g.x - 6.4, g.y - 3)]), C.frame, { lw: 0.4 }));
  parts.push(shape((p) => blob(p, [P(ank.x - 3.6, ank.y - 4), P(ank.x + 2.4, ank.y - 4.6), P(ank.x + 3.6, ank.y - 0.6), P(ank.x + 8.4, ank.y + 0.6), P(ank.x + 8, ank.y + 1.8), P(ank.x - 4.8, ank.y + 1.8)]),
    far ? C.bootShade : C.boot, { shade: far ? null : C.bootShade, shadeOffset: 1,
      details: (ctx) => { ctx.strokeStyle = far ? PAL.trimFar : C.cream; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(ank.x - 4.5, ank.y + 0.9); ctx.lineTo(ank.x + 7.8, ank.y + 0.9); ctx.stroke(); } }));
  void dk;
}

function legSide(parts, hip, foot, far) {
  const ank = { x: foot.x, y: foot.y - ANKLE };
  const { j: knee, end } = ik(hip, ank, THIGH, SHIN, 1);
  const sock = far ? C.jerseyShade : C.jersey;
  parts.push(tube([lerp(hip, knee, 0.4), knee, end], 5.2, sock, { shade: far ? null : C.jerseyShade,
    details: (ctx) => {
      // sock rings: cream, orange, cream
      const band = (t0, t1, col) => { const a = lerp(knee, end, t0), b = lerp(knee, end, t1); ctx.strokeStyle = col; ctx.lineWidth = 5.2; ctx.lineCap = 'butt'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
      band(0.28, 0.36, far ? PAL.creamFar : C.cream); band(0.36, 0.46, far ? C.orangeShade : C.orange); band(0.46, 0.54, far ? PAL.creamFar : C.cream);
    } }));
  skateSide(parts, end, far);
  return { knee, ankle: end };
}

function armSide(parts, sh, hand, far, stripe = true) {
  const { j: elbow, end } = ik(sh, hand, UPPER, FORE, 1);
  parts.push(tube([sh, elbow, lerp(elbow, end, 0.8)], 5, far ? C.jerseyShade : C.jersey, { shade: far ? null : C.jerseyShade,
    details: (ctx) => {
      if (!stripe) return;
      const a = lerp(elbow, end, 0.45), b = lerp(elbow, end, 0.7);
      ctx.lineCap = 'butt'; ctx.lineWidth = 5;
      ctx.strokeStyle = far ? PAL.creamFar : C.cream; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      const m1 = lerp(elbow, end, 0.52), m2 = lerp(elbow, end, 0.63);
      ctx.strokeStyle = far ? C.orangeShade : C.orange; ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke();
    } }));
  // glove: orange cuff and a big padded mitt
  const cuff = lerp(elbow, end, 0.86);
  parts.push(shape((p) => ellipse(p, cuff.x, cuff.y, 3, 3), far ? C.orangeShade : C.orange, { lw: 0.5 }));
  parts.push(shape((p) => ellipse(p, end.x, end.y, 3.4, 3.1), far ? C.gloveShade : C.glove, { shade: far ? null : C.gloveShade, shadeOffset: 0.9 }));
  return { elbow, hand: end };
}

function torsoSide(parts, hip, neck) {
  const ang = Math.atan2(neck.y - hip.y, neck.x - hip.x);
  const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;   // v = toward the chest (forward)
  const at = (u, v) => P(hip.x + ux * u + vx * v, hip.y + uy * u + vy * v);
  const outline = [at(-2, -7.4), at(-2.5, 7.2), at(6, 9.2), at(13, 8.6), at(17, 6), at(18.5, 0), at(17, -6.6), at(10, -9.2), at(3, -8.8)];
  parts.push(shape((p) => blob(p, outline), C.jersey, { shade: C.jerseyShade, shadeOffset: 2.2,
    details: (ctx) => {
      // hem stripes cream–orange–cream, then the crest on the chest
      const band = (u0, u1, col) => { ctx.fillStyle = col; const q = new Path2D(); poly(q, [at(u0, -12), at(u1, -12), at(u1, 12), at(u0, 12)]); ctx.fill(q); };
      band(-3, 0.6, C.cream); band(0.6, 2.6, C.orange); band(2.6, 4.2, C.cream);
      const cr = at(11.5, 5.6);
      ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(cr.x, cr.y, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.fur; ctx.beginPath(); ctx.arc(cr.x, cr.y, 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.snout; ctx.beginPath(); ctx.ellipse(cr.x + 0.9, cr.y + 0.7, 1, 0.7, 0, 0, Math.PI * 2); ctx.fill();
      // collar
      const c1 = at(16.4, -5), c2 = at(17.6, 4);
      ctx.strokeStyle = C.cream; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(c1.x, c1.y); ctx.lineTo(c2.x, c2.y); ctx.stroke();
    } }));
  return { at };
}

/** Bonny's head in profile, facing right. mood: normal, happy, effort, dizzy, sad, blink */
function headSide(parts, hc, mood, tilt = 0) {
  const r = HEAD;
  const rot = (x, y) => { const c = Math.cos(tilt), s = Math.sin(tilt); return P(hc.x + x * c - y * s, hc.y + x * s + y * c); };
  // ear behind (far ear peeks over the helmet)
  parts.push(shape((p) => poly(p, [rot(-4, -9), rot(-11, -20), rot(-0.5, -11)]), C.furShade, { lw: 0.5 }));
  // nape bristles
  parts.push(shape((p) => poly(p, [rot(-9, 2), rot(-15, 3), rot(-11, 5.5), rot(-15.5, 8), rot(-10.5, 9), rot(-13, 12), rot(-6, 10)]), C.furShade, { lw: 0.5 }));
  // skull and cheek
  parts.push(shape((p) => blob(p, [rot(-11, -3), rot(-6, -11), rot(4, -11.5), rot(11, -6), rot(13, 2), rot(9, 10), rot(-1, 12), rot(-9, 8)]), C.fur, { shade: C.furShade, shadeOffset: 2 }));
  // muzzle reaching forward to the snout
  parts.push(shape((p) => blob(p, [rot(5, -3.5), rot(13, -1.5), rot(18, 2), rot(18, 8.6), rot(12, 11), rot(5, 10.5), rot(3, 4)]), C.muzzle, { shade: C.muzzleShade, shadeOffset: 1.2 }));
  // snout disc seen from the side
  parts.push(shape((p) => ellipse(p, ...Object.values(rot(18.4, 5)), 2.8, 4.8, tilt), C.snout, { shade: C.snoutShade, shadeOffset: 0.8,
    details: (ctx) => { const n = rot(19.4, 5.2); ctx.fillStyle = PAL.nostril; ctx.beginPath(); ctx.ellipse(n.x, n.y, 0.8, 1.6, tilt, 0, Math.PI * 2); ctx.fill(); } }));
  // tusk
  parts.push(shape((p) => poly(p, [rot(12.6, 10.6), rot(15.2, 10.4), rot(15.6, 5.6)]), C.tusk, { lw: 0.45 }));
  // helmet: dome over the top and back, rim above the eye
  parts.push(shape((p) => {
    const pts = [rot(-14.2, 4), rot(-14, -6), rot(-7.5, -13.6), rot(2, -14.6), rot(9.6, -10.6), rot(12.6, -5.2), rot(11.8, -4), rot(3.4, -4.6), rot(-1.6, 0.2), rot(-6.4, 4.6)];
    blob(p, pts);
  }, C.helmet, { shade: C.helmetShade, shadeOffset: 2,
    details: (ctx) => {
      ctx.fillStyle = C.helmetShade;
      for (const [x, y] of [[-8, -7], [-4.6, -10.2]]) { const v = rot(x, y); ctx.beginPath(); ctx.ellipse(v.x, v.y, 1.4, 0.6, tilt - 0.7, 0, Math.PI * 2); ctx.fill(); }
      const e = rot(-6.4, -0.6); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(e.x, e.y, 1.3, 0, Math.PI * 2); ctx.fill();
    } }));
  // near ear through the helmet slot, and the tuft poking out on top
  parts.push(shape((p) => poly(p, [rot(-5.5, -10.5), rot(-10, -22), rot(0.5, -12.4)]), C.fur, { lw: 0.55,
    details: (ctx) => { const q = new Path2D(); poly(q, [rot(-5, -12), rot(-8.4, -19.4), rot(-1.4, -12.8)]); ctx.fillStyle = C.pink; ctx.fill(q); } }));
  parts.push(shape((p) => poly(p, [rot(-1, -13.6), rot(-2.6, -19.6), rot(0.6, -15.2), rot(1.4, -21), rot(2.6, -15), rot(5.4, -19.2), rot(4.6, -13.4)]), C.furShade, { lw: 0.5 }));
  // face: eye, brow, cheek, mouth, chin strap
  parts.push(draw((ctx) => {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const e = rot(7.6, -0.6);
    const lid = mood === 'blink' || mood === 'happy' || mood === 'effort';
    if (lid) {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath();
      if (mood === 'happy') { ctx.arc(e.x, e.y + 1.4, 2.6, Math.PI * 1.1, Math.PI * 1.9); }
      else if (mood === 'effort') { ctx.moveTo(e.x - 2.4, e.y - 1.6); ctx.lineTo(e.x + 1.8, e.y); ctx.lineTo(e.x - 2.2, e.y + 1.6); }
      else { ctx.moveTo(e.x - 2.6, e.y + 0.6); ctx.quadraticCurveTo(e.x, e.y + 2, e.x + 2.6, e.y + 0.4); }
      ctx.stroke();
    } else if (mood === 'dizzy') {
      ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let a = 0; a < Math.PI * 4; a += 0.3) { const rr = 0.4 + a * 0.22; const x = e.x + Math.cos(a) * rr, y = e.y + Math.sin(a) * rr; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    } else {
      ctx.fillStyle = C.eyeWhite; ctx.strokeStyle = INK; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(e.x, e.y, 3.2, 4.2, tilt, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const look = mood === 'sad' ? 1.4 : 0;
      ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.ellipse(e.x + 1.2, e.y + 0.6 + look, 2, 2.7, tilt, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(e.x + 0.6, e.y - 0.6 + look, 0.85, 0, Math.PI * 2); ctx.fill();
    }
    // brow
    const b0 = rot(4.6, mood === 'sad' ? -4.4 : mood === 'effort' ? -4.2 : -6.2), b1 = rot(10, mood === 'sad' ? -6.2 : mood === 'effort' ? -3.4 : -5.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    // cheek
    const ck = rot(7.4, 5); ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.ellipse(ck.x, ck.y, 2.2, 1.3, tilt, 0, Math.PI * 2); ctx.fill();
    // mouth
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath();
    const m0 = rot(9, 9), m1 = rot(15.4, 9.4);
    if (mood === 'happy') { ctx.moveTo(m0.x, m0.y - 0.6); ctx.quadraticCurveTo((m0.x + m1.x) / 2, m0.y + 3.6, m1.x, m1.y - 0.8); ctx.closePath(); ctx.fillStyle = PAL.mouth; ctx.fill(); }
    else if (mood === 'sad') { ctx.moveTo(m0.x, m0.y + 1); ctx.quadraticCurveTo((m0.x + m1.x) / 2, m0.y - 1, m1.x, m1.y + 0.6); }
    else if (mood === 'effort') { ctx.rect(m0.x + 0.4, m0.y - 1, 5, 2); ctx.fillStyle = '#ffffff'; ctx.fill(); }
    else { ctx.moveTo(m0.x, m0.y); ctx.quadraticCurveTo((m0.x + m1.x) / 2, m0.y + 1.6, m1.x, m1.y - 0.6); }
    ctx.stroke();
    // chin strap
    const s0 = rot(-5.2, 1), s1 = rot(2.6, 11.4);
    ctx.strokeStyle = C.helmetShade; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
  }));
}

function stickSide(parts, top, bottom, blade) {
  parts.push(draw((ctx) => {
    ctx.lineCap = 'round';
    const dx = bottom.x - top.x, dy = bottom.y - top.y, d = Math.hypot(dx, dy) || 1;
    const butt = { x: top.x - (dx / d) * 2.5, y: top.y - (dy / d) * 2.5 };
    ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.lineTo(blade.x, blade.y); ctx.stroke();
    ctx.strokeStyle = C.wood; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(butt.x, butt.y); ctx.lineTo(blade.x, blade.y); ctx.stroke();
    // blade with black tape
    const dir = blade.x >= bottom.x ? 1 : -1;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(dir > 0 ? blade.x - 1.2 : blade.x - 8.8, blade.y - 1.6, 10, 3.2, 1.4); ctx.fill();
    ctx.fillStyle = C.tape; ctx.beginPath(); ctx.roundRect(dir > 0 ? blade.x - 0.6 : blade.x - 8.2, blade.y - 1, 8.8, 2, 0.9); ctx.fill();
    ctx.strokeStyle = PAL.tapeLine; ctx.lineWidth = 0.4;
    for (let i = 1; i < 5; i++) { const x = (dir > 0 ? blade.x - 0.6 : blade.x - 8.2) + i * 1.8; ctx.beginPath(); ctx.moveTo(x, blade.y - 1); ctx.lineTo(x - 0.6, blade.y + 1); ctx.stroke(); }
  }));
}

function tail(parts, at) {
  parts.push(draw((ctx) => {
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.bezierCurveTo(at.x - 4, at.y - 1, at.x - 3, at.y - 5, at.x - 6, at.y - 6); ctx.stroke();
    ctx.strokeStyle = C.fur; ctx.lineWidth = 0.9; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(at.x - 6.6, at.y - 6.8, 2, 1.4, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.furShade; ctx.beginPath(); ctx.ellipse(at.x - 6.6, at.y - 6.8, 1.3, 0.8, -0.6, 0, Math.PI * 2); ctx.fill();
  }));
}

// ------------------------------------------------------------------ poses (side view)

const deg = (d) => (d * Math.PI) / 180;

/** Pose: hip, lean (forward), feet {x, lift}, hands (far = free/top, near = stick), blade, head tilt, mood. */
export const POSES = {
  idle:   { hip: P(0, -26), lean: deg(14), far: P(-5, 0), near: P(5, 0), farHand: P(7, -36), nearHand: P(12, -24), blade: P(20, -0.5), mood: 'normal' },
  skate:  { oneHand: true, hip: P(-2, -24), lean: deg(32), far: P(-14, -3), near: P(7, 0), farHand: P(-16, -38), nearHand: P(16, -22), blade: P(25, -0.5), mood: 'normal' },
  sprint: { oneHand: true, hip: P(-3, -23), lean: deg(46), far: P(-19, -6), near: P(10, 0), farHand: P(-18, -44), nearHand: P(21, -28), blade: P(30, -0.5), tilt: deg(-8), mood: 'effort' },
  windup: { hip: P(-1, -24), lean: deg(18), far: P(-8, 0), near: P(9, 0), farHand: P(-6, -50), nearHand: P(-2, -46), blade: P(-22, -62), tilt: deg(-6), mood: 'effort' },
  shot:   { hip: P(3, -24), lean: deg(40), far: P(-13, -5), near: P(12, 0), farHand: P(22, -46), nearHand: P(18, -42), blade: P(34, -66), tilt: deg(-4), mood: 'effort' },
  cheer:  { hip: P(0, -28), lean: deg(-6), far: P(-5, 0), near: P(6, -9), farHand: P(-10, -66), nearHand: P(12, -68), blade: P(18, -96), tilt: deg(-12), mood: 'happy' },
  fall:   { oneHand: true, hip: P(-6, -9), lean: deg(84), far: P(-24, -16), near: P(-20, -8), farHand: P(14, -6), nearHand: P(22, -15), blade: P(34, -2), tilt: deg(26), mood: 'dizzy', fall: true },
};

/** All parts of Bonny in side view (facing right) for a pose. */
export function sideParts(pose) {
  const parts = [];
  const hip = pose.hip, lean = pose.lean;
  const neck = P(hip.x + Math.sin(lean) * TORSO, hip.y - Math.cos(lean) * TORSO);
  const ux = Math.sin(lean), uy = -Math.cos(lean);
  const sh = (u, v) => P(hip.x + ux * u - uy * v, hip.y + uy * u + ux * v);
  const shFar = sh(14, -3.6), shNear = sh(14.4, 2.4);
  const foot = (f) => P(f.x, f.y);
  // far side
  const farArm = armSide(parts, shFar, pose.farHand, true);
  legSide(parts, P(hip.x - 1.4, hip.y - 0.6), foot(pose.far), true);
  tail(parts, sh(1, -8.6));
  // body
  torsoSide(parts, hip, neck);
  // pants: short and bulky over the hips
  parts.push(shape((p) => blob(p, [sh(-6.4, -7.4), sh(1.4, -8.6), sh(2.6, 0), sh(1.2, 8.2), sh(-5.4, 8.4), sh(-7.6, 0)]), C.pants, { shade: C.pantsShade, shadeOffset: 1.4 }));
  legSide(parts, P(hip.x + 1.4, hip.y + 0.6), foot(pose.near), false);
  // stick behind the near arm
  // one hand on the stick while skating: the shaft starts just above the bottom hand
  const top = pose.oneHand ? lerp(pose.blade, pose.nearHand, 1.25) : farArm.hand;
  stickSide(parts, top, pose.nearHand, pose.blade);
  // head on top of the neck, leaning less than the body
  const hl = lean * 0.4;
  const hc = P(neck.x + Math.sin(hl) * HEAD * 0.82 + 1.5, neck.y - Math.cos(hl) * HEAD * 0.82);
  headSide(parts, hc, pose.mood, pose.tilt ?? 0);
  const nearArm = armSide(parts, shNear, pose.nearHand, false);
  // sleeve number on the near shoulder
  parts.push(draw((ctx) => {
    const m = lerp(shNear, nearArm.elbow, 0.45);
    // keep the number upright: along the sleeve, but never upside down
    let a = Math.atan2(nearArm.elbow.y - shNear.y, nearArm.elbow.x - shNear.x) - Math.PI / 2;
    a = Math.atan2(Math.sin(a), Math.cos(a));
    if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
    letter(ctx, '61', m.x, m.y, 4.2, { fill: C.cream, outline: 0.45, rot: a });
  }));
  if (pose.fall) {
    // little stars circling over the head
    parts.push(draw((ctx) => {
      for (let i = 0; i < 4; i++) {
        const a = i * (Math.PI / 2) + 0.4, x = hc.x - 4 + Math.cos(a) * 11, y = hc.y - 15 + Math.sin(a) * 3.5;
        star(ctx, x, y, 2.2, i % 2 ? PAL.star : '#ffffff');
      }
    }));
  }
  return parts;
}

export function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath();
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 0.9; ctx.stroke();
  ctx.fillStyle = fill; ctx.fill();
}

// ------------------------------------------------------------------ front and back views

/** Front view, standing, stick held across. */
export function frontParts(mood = 'happy') {
  const parts = [];
  const hip = P(0, -26), neck = P(0, -43), hc = P(0, -56);
  // legs and skates (seen from the front)
  for (const s of [-1, 1]) {
    const knee = P(s * 4.2, -14.5), ank = P(s * 4.6, -ANKLE);
    parts.push(tube([P(s * 3.6, -22), knee, ank], 5.4, C.jersey, { shade: C.jerseyShade, details: (ctx) => {
      ctx.lineWidth = 5.4; ctx.lineCap = 'butt';
      for (const [t0, t1, col] of [[0.55, 0.62, C.cream], [0.62, 0.7, C.orange], [0.7, 0.76, C.cream]]) {
        const a = lerp(knee, ank, t0 - 0.2), b = lerp(knee, ank, t1 - 0.2); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } }));
    parts.push(shape((p) => { p.roundRect(s * 4.6 - 1.4, -2.4, 2.8, 2.6, 1.2); }, C.wheel, { lw: 0.45 }));
    parts.push(shape((p) => blob(p, [P(s * 4.6 - 3.4, -7.4), P(s * 4.6 + 3.4, -7.4), P(s * 4.6 + 3.6, -2.2), P(s * 4.6 - 3.6, -2.2)]), C.boot, { shade: C.bootShade, shadeOffset: 0.8 }));
  }
  // pants
  parts.push(shape((p) => blob(p, [P(-9, -30), P(9, -30), P(10, -21), P(1, -19.6), P(0, -22), P(-1, -19.6), P(-10, -21)]), C.pants, { shade: C.pantsShade, shadeOffset: 1.4 }));
  // arms: both hands on the stick, held low across the body
  const sl = P(-9, -40), sr = P(9, -40), hl = P(-6, -27), hr = P(8, -24);
  for (const [s, h] of [[sl, hl], [sr, hr]]) {
    const { j } = ik(s, h, UPPER, FORE, s.x < 0 ? 1 : -1);
    parts.push(tube([s, j, lerp(j, h, 0.8)], 5, C.jersey, { shade: C.jerseyShade }));
  }
  // jersey
  parts.push(shape((p) => blob(p, [P(-10.5, -42), P(0, -44.4), P(10.5, -42), P(11.4, -32), P(10, -23.6), P(0, -22.4), P(-10, -23.6), P(-11.4, -32)]), C.jersey, { shade: C.jerseyShade, shadeOffset: 2,
    details: (ctx) => {
      ctx.fillStyle = C.cream; ctx.fillRect(-14, -27.8, 28, 1.8);
      ctx.fillStyle = C.orange; ctx.fillRect(-14, -26, 28, 1.8);
      ctx.fillStyle = C.cream; ctx.fillRect(-14, -24.2, 28, 1.6);
      // crest: Bonny's head in a cream roundel
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -34.5, 4.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.cream; ctx.beginPath(); ctx.arc(0, -34.5, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.fur; ctx.beginPath(); ctx.arc(0, -34.5, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.snout; ctx.beginPath(); ctx.ellipse(0, -33.6, 1.3, 0.9, 0, 0, Math.PI * 2); ctx.fill();
      // laced collar
      ctx.strokeStyle = C.cream; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-4, -43.4); ctx.lineTo(0, -40); ctx.lineTo(4, -43.4); ctx.stroke();
      ctx.strokeStyle = C.orange; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-1.4, -41.6); ctx.lineTo(1.4, -41.6); ctx.stroke();
    } }));
  // stick across the front
  parts.push(draw((ctx) => {
    ctx.lineCap = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-9, -29); ctx.lineTo(15, -1); ctx.stroke();
    ctx.strokeStyle = C.wood; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(13, -2.4, 10, 3.4, 1.4); ctx.fill();
    ctx.fillStyle = C.tape; ctx.beginPath(); ctx.roundRect(13.6, -1.8, 8.8, 2.2, 1); ctx.fill();
  }));
  for (const h of [hl, hr]) {
    parts.push(shape((p) => ellipse(p, h.x, h.y, 3.4, 3.2), C.glove, { shade: C.gloveShade, shadeOffset: 0.9 }));
  }
  // head front
  for (const s of [-1, 1]) {
    parts.push(shape((p) => poly(p, [P(s * 6, -64), P(s * 13, -76), P(s * 10.6, -61)]), C.fur, { lw: 0.55,
      details: (ctx) => { const q = new Path2D(); poly(q, [P(s * 7, -64.4), P(s * 11.6, -73), P(s * 10, -62.4)]); ctx.fillStyle = C.pink; ctx.fill(q); } }));
  }
  parts.push(shape((p) => blob(p, [P(-12, -58), P(-8, -66.6), P(0, -68.4), P(8, -66.6), P(12, -58), P(10.6, -49), P(0, -44.2), P(-10.6, -49)]), C.fur, { shade: C.furShade, shadeOffset: 1.6 }));
  // helmet
  parts.push(shape((p) => blob(p, [P(-13, -56), P(-11.6, -65), P(-4, -70.2), P(4, -70.2), P(11.6, -65), P(13, -56), P(8, -60.6), P(0, -61.6), P(-8, -60.6)]), C.helmet, { shade: C.helmetShade, shadeOffset: 1.6,
    details: (ctx) => {
      ctx.fillStyle = C.helmetShade; for (const x of [-4, 0, 4]) { ctx.beginPath(); ctx.ellipse(x, -64.6, 1, 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
    } }));
  // tuft on top
  parts.push(shape((p) => poly(p, [P(-3, -69.6), P(-4.6, -75), P(-1.2, -71.4), P(0, -77), P(1.4, -71.4), P(4.6, -75), P(3, -69.6)]), C.furShade, { lw: 0.5 }));
  // muzzle and snout
  parts.push(shape((p) => ellipse(p, 0, -50.6, 7.4, 5.6), C.muzzle, { shade: C.muzzleShade, shadeOffset: 1 }));
  parts.push(shape((p) => ellipse(p, 0, -52, 5, 3.7), C.snout, { shade: C.snoutShade, shadeOffset: 0.7,
    details: (ctx) => { ctx.fillStyle = PAL.nostril; for (const x of [-1.9, 1.9]) { ctx.beginPath(); ctx.ellipse(x, -52, 1, 1.5, 0, 0, Math.PI * 2); ctx.fill(); } } }));
  for (const s of [-1, 1]) parts.push(shape((p) => poly(p, [P(s * 4.6, -46.4), P(s * 7.2, -46.6), P(s * 6.8, -50.6)]), C.tusk, { lw: 0.45 }));
  parts.push(draw((ctx) => {
    for (const s of [-1, 1]) {
      const ex = s * 5, ey = -58.4;
      if (mood === 'happy') { ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(ex, ey + 1.4, 2.4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      else {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.ellipse(ex, ey, 2.8, 3.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.pupil; ctx.beginPath(); ctx.ellipse(ex + s * 0.3, ey + 0.6, 1.8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 0.5, ey - 0.6, 0.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex - s * 2.4, ey - 5.2); ctx.lineTo(ex + s * 2.6, ey - 6); ctx.stroke();
      ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.ellipse(s * 8.2, -52.6, 2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    }
    // mouth: a big grin under the snout
    ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-3.4, -47.4); ctx.quadraticCurveTo(0, -44, 3.4, -47.4); ctx.closePath();
    ctx.fillStyle = PAL.mouth; if (mood === 'happy') ctx.fill(); ctx.stroke();
    // chin straps
    ctx.strokeStyle = C.helmetShade; ctx.lineWidth = 0.9;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 11.6, -57); ctx.quadraticCurveTo(s * 9, -47, s * 3, -44.6); ctx.stroke(); }
  }));
  void hip; void neck; void hc;
  return parts;
}

/** Back view: BONI and the big 61, tail, nape bristles. */
export function backParts() {
  const parts = [];
  for (const s of [-1, 1]) {
    const knee = P(s * 4.2, -14.5), ank = P(s * 4.6, -ANKLE);
    parts.push(tube([P(s * 3.6, -22), knee, ank], 5.4, C.jersey, { shade: C.jerseyShade, details: (ctx) => {
      ctx.lineWidth = 5.4; ctx.lineCap = 'butt';
      for (const [t0, t1, col] of [[0.35, 0.42, C.cream], [0.42, 0.5, C.orange], [0.5, 0.56, C.cream]]) {
        const a = lerp(knee, ank, t0), b = lerp(knee, ank, t1); ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    } }));
    parts.push(shape((p) => blob(p, [P(s * 4.6 - 3.4, -7.4), P(s * 4.6 + 3.4, -7.4), P(s * 4.6 + 3.6, -2.2), P(s * 4.6 - 3.6, -2.2)]), C.boot, { shade: C.bootShade, shadeOffset: 0.8 }));
    parts.push(shape((p) => { p.roundRect(s * 4.6 - 1.4, -2.4, 2.8, 2.6, 1.2); }, C.wheel, { lw: 0.45 }));
  }
  parts.push(shape((p) => blob(p, [P(-9, -30), P(9, -30), P(10, -21), P(1, -19.6), P(0, -22), P(-1, -19.6), P(-10, -21)]), C.pants, { shade: C.pantsShade, shadeOffset: 1.4 }));
  tail(parts, P(1.5, -23));
  for (const s of [-1, 1]) {
    const a = P(s * 9, -40), h = P(s * 12.6, -27);
    const { j } = ik(a, h, UPPER, FORE, s > 0 ? 1 : -1);
    parts.push(tube([a, j, lerp(j, h, 0.8)], 5, C.jersey, { shade: C.jerseyShade, details: (ctx) => {
      const m = lerp(a, j, 0.5); letter(ctx, '61', m.x, m.y, 3.6, { fill: C.cream, outline: 0.4, rot: s * 0.2 });
    } }));
    parts.push(shape((p) => ellipse(p, h.x, h.y, 3.4, 3.2), C.glove, { shade: C.gloveShade, shadeOffset: 0.9 }));
  }
  parts.push(shape((p) => blob(p, [P(-10.5, -42), P(0, -44.4), P(10.5, -42), P(11.4, -32), P(10, -23.6), P(0, -22.4), P(-10, -23.6), P(-11.4, -32)]), C.jersey, { shade: C.jerseyShade, shadeOffset: 2,
    details: (ctx) => {
      ctx.fillStyle = C.cream; ctx.fillRect(-14, -27.8, 28, 1.8);
      ctx.fillStyle = C.orange; ctx.fillRect(-14, -26, 28, 1.8);
      ctx.fillStyle = C.cream; ctx.fillRect(-14, -24.2, 28, 1.6);
      letter(ctx, 'BONI', 0, -39.4, 3.6, { fill: C.cream, outline: 0.4 });
      letter(ctx, '61', 0, -33, 8.6, { fill: C.cream, ink: PAL.furDark, outline: 0.7 });
    } }));
  for (const s of [-1, 1]) parts.push(shape((p) => poly(p, [P(s * 6, -64), P(s * 13, -76), P(s * 10.6, -61)]), C.fur, { lw: 0.55 }));
  parts.push(shape((p) => blob(p, [P(-12, -58), P(-8, -66.6), P(0, -68.4), P(8, -66.6), P(12, -58), P(10.6, -49), P(0, -45.2), P(-10.6, -49)]), C.fur, { shade: C.furShade, shadeOffset: 1.6 }));
  // helmet covers the back of the head
  parts.push(shape((p) => blob(p, [P(-13, -54), P(-11.6, -65), P(-4, -70.2), P(4, -70.2), P(11.6, -65), P(13, -54), P(6, -52.4), P(0, -52), P(-6, -52.4)]), C.helmet, { shade: C.helmetShade, shadeOffset: 1.6,
    details: (ctx) => {
      ctx.fillStyle = C.helmetShade; for (const x of [-5, 0, 5]) { ctx.beginPath(); ctx.ellipse(x, -60, 1.1, 0.5, 0, 0, Math.PI * 2); ctx.fill(); }
    } }));
  // nape bristles below the helmet, tuft on top
  parts.push(shape((p) => poly(p, [P(-6, -52), P(-7, -46), P(-4, -49), P(-2.6, -44.6), P(0, -48.4), P(2.6, -44.6), P(4, -49), P(7, -46), P(6, -52)]), C.furShade, { lw: 0.5 }));
  parts.push(shape((p) => poly(p, [P(-3, -69.6), P(-4.6, -75), P(-1.2, -71.4), P(0, -77), P(1.4, -71.4), P(4.6, -75), P(3, -69.6)]), C.furShade, { lw: 0.5 }));
  return parts;
}

/** Draw a part list scaled at (x, y) — anchor on the ground. flip: face left. */
export function drawFigure(ctx, parts, x, y, scale, { flip = false, outer = 1.25, ligne = true } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip ? -scale : scale, scale);
  render(ctx, parts, ligne ? { uniform: STYLE.line.width, flat: true } : { outer });
  ctx.restore();
}

// ------------------------------------------------------------------ animation and props

/** One frame of the skating stride (n frames per cycle): legs push and recover, arm swings. */
export function stridePose(i, n = 8) {
  const ph = i / n;
  const leg = (p, base, side) => {
    p = ((p % 1) + 1) % 1;
    if (p < 0.5) { const u = p / 0.5; return P(base - 15 * u, -Math.sin(Math.PI * u) * 1.2 * side); }
    const u = (p - 0.5) / 0.5; return P(base - 15 * (1 - u), -Math.sin(Math.PI * u) * 5.5);
  };
  const bob = (1 + Math.cos(4 * Math.PI * ph)) / 2;
  const sw = Math.cos(2 * Math.PI * ph);
  return {
    oneHand: true,
    hip: P(-1.5, -24 + bob * 1.2), lean: deg(32),
    far: leg(ph, 4, 1), near: leg(ph + 0.5, 7, -1),
    farHand: P(-6 + sw * 10, -36 - Math.abs(sw) * 2),
    nearHand: P(16, -22 + bob), blade: P(26, -0.5),
    mood: 'normal',
  };
}

/** The inline hockey stick on its own (prop asset): shaft, grip tape, curved blade with tape. */
export function stickParts(len = 64) {
  const parts = [];
  const top = P(-len * 0.55, -len * 0.62), heel = P(len * 0.28, -2.2);
  parts.push(tube([top, heel], 2.4, C.wood, { details: (ctx) => {
    // black grip tape at the top end
    const g = lerp(top, heel, 0.14);
    ctx.lineCap = 'butt'; ctx.strokeStyle = C.tape; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(g.x, g.y); ctx.stroke();
  } }));
  parts.push(shape((p) => blob(p, [P(heel.x - 2, heel.y - 1.6), P(heel.x + 6, heel.y + 0.2), P(heel.x + 15, heel.y + 0.6), P(heel.x + 16.4, heel.y + 2.4), P(heel.x + 6, heel.y + 2.8), P(heel.x - 2.4, heel.y + 1.6)]), C.tape, {
    details: (ctx) => { ctx.strokeStyle = PAL.tapeLine; ctx.lineWidth = 0.45; for (let i = 0; i < 6; i++) { const x = heel.x + 1 + i * 2.4; ctx.beginPath(); ctx.moveTo(x, heel.y - 1); ctx.lineTo(x - 0.8, heel.y + 3); ctx.stroke(); } } }));
  return parts;
}
