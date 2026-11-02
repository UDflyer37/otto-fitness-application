// Generates the PWA / iOS home screen icons as PNGs with no image dependencies.
// Run with: npm run icons
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const OUT_DIR = join(process.cwd(), "public", "icons");

const BG = [12, 12, 15, 255];
const ACCENT = [255, 107, 53, 255];
const LIGHT = [242, 242, 245, 255];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Signed distance to a rounded rectangle centred in a unit square. */
function sdRoundedRect(px, py, width, height, radius) {
  const qx = Math.abs(px - 0.5) - (width / 2 - radius);
  const qy = Math.abs(py - 0.5) - (height / 2 - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

const SHAPES = [
  // background tile
  { sd: (x, y) => sdRoundedRect(x, y, 1, 1, 0.235), color: BG },
  // bar
  { sd: (x, y) => sdRoundedRect(x, y, 0.68, 0.075, 0.0375), color: ACCENT },
  // plates
  { sd: (x, y) => sdRoundedRect(x - 0.31, y, 0.11, 0.46, 0.045), color: LIGHT },
  { sd: (x, y) => sdRoundedRect(x + 0.31, y, 0.11, 0.46, 0.045), color: LIGHT },
  // inner collars
  { sd: (x, y) => sdRoundedRect(x - 0.2, y, 0.05, 0.26, 0.02), color: ACCENT },
  { sd: (x, y) => sdRoundedRect(x + 0.2, y, 0.05, 0.26, 0.02), color: ACCENT },
];

function renderIcon(size) {
  const scale = 4;
  const big = size * scale;
  const pixels = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < scale; sy += 1) {
        for (let sx = 0; sx < scale; sx += 1) {
          const ux = (x * scale + sx + 0.5) / big;
          const uy = (y * scale + sy + 0.5) / big;
          let pixel = [0, 0, 0, 0];
          for (const shape of SHAPES) {
            if (shape.sd(ux, uy) <= 0) pixel = shape.color;
          }
          r += pixel[0];
          g += pixel[1];
          b += pixel[2];
          a += pixel[3];
        }
      }

      const samples = scale * scale;
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(r / samples);
      pixels[offset + 1] = Math.round(g / samples);
      pixels[offset + 2] = Math.round(b / samples);
      pixels[offset + 3] = Math.round(a / samples);
    }
  }

  return encodePng(size, size, pixels);
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  const file = join(OUT_DIR, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderIcon(size));
  console.log(`wrote public/icons/${name}`);
}
