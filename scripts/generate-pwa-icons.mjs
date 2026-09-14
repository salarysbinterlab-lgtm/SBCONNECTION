import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffers) {
  let c = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const len = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32([typeBuffer, data]));
  return Buffer.concat([len, typeBuffer, data, crc]);
}

function writePng(filename, size, maskable = false) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const pad = Math.floor(size * (maskable ? 0.24 : 0.16));
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size - pad * 2) / 2;
  const ring = Math.max(3, Math.floor(size * 0.025));

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const t = (x + y) / (size * 2);
      let r = Math.round(7 + (153 - 7) * t);
      let g = Math.round(95 + (246 - 95) * t);
      let b = Math.round(86 + (228 - 86) * t);
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < radius) {
        r = 248; g = 255; b = 253;
      }
      if (dist > radius - ring && dist < radius + ring) {
        r = 245; g = 158; b = 11;
      }
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = 255;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND')
  ]);

  writeFileSync(join(outDir, filename), png);
}

writePng('icon-192.png', 192);
writePng('icon-512.png', 512);
writePng('maskable-512.png', 512, true);
writePng('apple-touch-icon.png', 180);
