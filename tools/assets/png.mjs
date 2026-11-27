// Minimal PNG reader/writer (8-bit, non-interlaced) so asset checks need no packages.
import zlib from 'node:zlib';

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** Decode a PNG file buffer into { width, height, data } with RGBA bytes. */
export function decodePng(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error('not a PNG file');
  let pos = 8, head = null, palette = null, trns = null;
  const idat = [];
  while (pos + 8 <= buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('latin1', pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') head = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], color: body[9], interlace: body[12] };
    else if (type === 'PLTE') palette = body;
    else if (type === 'tRNS') trns = body;
    else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (!head) throw new Error('PNG has no header');
  if (head.depth !== 8) throw new Error(`unsupported bit depth ${head.depth} (need 8)`);
  if (head.interlace) throw new Error('interlaced PNGs are not supported');
  const ch = CHANNELS[head.color];
  if (!ch) throw new Error(`unsupported colour type ${head.color}`);
  const { width: w, height: h } = head, stride = w * ch;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  if (raw.length < (stride + 1) * h) throw new Error('PNG image data is truncated');
  const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[dst + x - ch] : 0, b = y ? px[dst + x - stride] : 0, c = x >= ch && y ? px[dst + x - stride - ch] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + x] = (raw[src + x] + pred) & 255;
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, s = i * ch;
    if (head.color === 6) data.set(px.subarray(s, s + 4), o);
    else if (head.color === 2) {
      data.set(px.subarray(s, s + 3), o);
      data[o + 3] = trns && trns.length >= 6 && px[s] === trns[1] && px[s + 1] === trns[3] && px[s + 2] === trns[5] ? 0 : 255;
    } else if (head.color === 3) {
      const k = px[s];
      data[o] = palette[k * 3]; data[o + 1] = palette[k * 3 + 1]; data[o + 2] = palette[k * 3 + 2];
      data[o + 3] = trns && k < trns.length ? trns[k] : 255;
    } else {
      data[o] = data[o + 1] = data[o + 2] = px[s];
      data[o + 3] = head.color === 4 ? px[s + 1] : 255;
    }
  }
  return { width: w, height: h, data };
}

/** Encode RGBA bytes as a PNG file buffer. */
export function encodePng(width, height, rgba) {
  const chunk = (type, body) => {
    const out = Buffer.alloc(12 + body.length);
    out.writeUInt32BE(body.length, 0);
    out.write(type, 4, 'latin1');
    body.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(width, 0); head.writeUInt32BE(height, 4);
  head[8] = 8; head[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  return Buffer.concat([SIG, chunk('IHDR', head), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
