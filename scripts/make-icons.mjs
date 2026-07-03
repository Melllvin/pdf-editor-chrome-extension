// Génère extension/icons/icon{16,32,48,128}.png sans dépendance : encodeur PNG
// minimal (zlib natif) + dessin procédural (page blanche au coin plié + crayon).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const outDir = path.join(
  path.dirname(path.dirname(fileURLToPath(import.meta.url))),
  'extension',
  'icons',
);

// ---------- Encodeur PNG (RGBA 8 bits, sans filtre) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = ~0;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return ~c >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
};
function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // type couleur RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filtre « aucun »
    Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- Dessin ----------
const RED = [0.78, 0.16, 0.14];
const WHITE = [1, 1, 1];
const FOLD = [0.84, 0.85, 0.88];
const LINE = [0.8, 0.45, 0.43];
const AMBER = [0.97, 0.66, 0.05];
const AMBER_DARK = [0.68, 0.45, 0.02];
const WOOD = [0.96, 0.82, 0.66];
const TIP = [0.27, 0.18, 0.09];

function inRoundedRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const dx = Math.max(0, Math.max(x0 + r - u, u - (x1 - r)));
  const dy = Math.max(0, Math.max(y0 + r - v, v - (y1 - r)));
  return dx * dx + dy * dy <= r * r;
}
function distSeg(u, v, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(u - (ax + t * dx), v - (ay + t * dy)), t };
}

// u,v ∈ [0,1], v vers le bas ; retourne [r,g,b,a] en flottants
function colorAt(u, v) {
  if (!inRoundedRect(u, v, 0.02, 0.02, 0.98, 0.98, 0.2)) return [0, 0, 0, 0];
  let c = RED;
  const x0 = 0.2;
  const x1 = 0.76;
  const y0 = 0.14;
  const y1 = 0.86;
  const f = 0.18; // taille du coin plié
  if (inRoundedRect(u, v, x0, y0, x1, y1, 0.03)) {
    const inCorner = u > x1 - f && v < y0 + f;
    const dcut = u - (x1 - f) + (y0 + f - v); // > f : au-delà de la diagonale du pli
    if (inCorner && dcut > f) {
      c = RED; // coin découpé : on voit le fond
    } else {
      c = WHITE;
      if (inCorner && dcut > f - 0.09) c = FOLD; // bande du pli
      for (let i = 0; i < 3; i++) {
        const ly = 0.4 + i * 0.13;
        if (v >= ly && v <= ly + 0.05 && u >= x0 + 0.09 && u <= x1 - 0.12) c = LINE;
      }
    }
  }
  const { d, t } = distSeg(u, v, 0.44, 0.93, 0.97, 0.4);
  if (d <= 0.082) c = t < 0.1 ? TIP : t < 0.26 ? WOOD : AMBER;
  else if (d <= 0.1) c = AMBER_DARK; // liseré de contraste
  return [c[0], c[1], c[2], 1];
}

function render(size) {
  const rgba = new Uint8Array(size * size * 4);
  const SS = 3; // sur-échantillonnage 3×3
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += cr * ca;
          g += cg * ca;
          b += cb * ca;
          a += ca;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      // couleurs prémultipliées re-normalisées
      rgba[i] = a > 0 ? Math.round((r / a) * 255) : 0;
      rgba[i + 1] = a > 0 ? Math.round((g / a) * 255) : 0;
      rgba[i + 2] = a > 0 ? Math.round((b / a) * 255) : 0;
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return encodePng(size, size, rgba);
}

fs.mkdirSync(outDir, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), render(size));
}
console.log(`Icônes générées → ${outDir}`);
