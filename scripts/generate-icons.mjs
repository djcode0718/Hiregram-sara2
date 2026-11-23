import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
}

const crcTable = createCrcTable();
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Scanlines with filter byte 0
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowOffset = y * (1 + width * 4);
    scanlines[rowOffset] = 0; // Filter: None
    const srcRowOffset = y * width * 4;
    rgbaBuffer.copy(scanlines, rowOffset + 1, srcRowOffset, srcRowOffset + width * 4);
  }

  const idatData = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Generate icon with Hiregram purple/indigo brand (#6366F1 / #4F46E5) and white mic mark
function renderIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  // Colors
  const bgR = 0x63, bgG = 0x66, bgB = 0xf1; // Indigo #6366f1
  const fgR = 0xff, fgG = 0xff, fgB = 0xff; // White

  const radius = size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Rounded rect background
      const dx = Math.max(0, Math.abs(x - cx + 0.5) - (cx - radius));
      const dy = Math.max(0, Math.abs(y - cy + 0.5) - (cy - radius));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Pixel is inside rounded icon base
        // Draw microphone geometry
        const nx = (x - cx) / size; // -0.5 to 0.5
        const ny = (y - cy) / size;

        // Mic capsule: cx=0, cy=-0.08, width=0.22, height=0.38
        const inMicCapsule = Math.abs(nx) <= 0.11 && ny >= -0.25 && ny <= 0.08;
        // Capsule top circle
        const distTop = Math.hypot(nx, ny - (-0.17));
        // Capsule bottom circle
        const distBot = Math.hypot(nx, ny - 0.01);
        const micBody = inMicCapsule || distTop <= 0.11 || distBot <= 0.11;

        // Mic cup (horseshoe around bottom)
        const cupDist = Math.hypot(nx, ny - (-0.02));
        const inCupRing = cupDist >= 0.16 && cupDist <= 0.22 && ny >= -0.04 && ny <= 0.16;

        // Mic stem & stand base
        const inStem = Math.abs(nx) <= 0.04 && ny >= 0.15 && ny <= 0.25;
        const inBase = Math.abs(nx) <= 0.16 && ny >= 0.23 && ny <= 0.28;

        if (micBody || inCupRing || inStem || inBase) {
          buf[idx] = fgR;
          buf[idx + 1] = fgG;
          buf[idx + 2] = fgB;
          buf[idx + 3] = 255;
        } else {
          buf[idx] = bgR;
          buf[idx + 1] = bgG;
          buf[idx + 2] = bgB;
          buf[idx + 3] = 255;
        }
      } else {
        // Transparent outside
        buf[idx + 3] = 0;
      }
    }
  }

  return encodePng(size, size, buf);
}

const outDir = path.resolve('extension/icons');
fs.mkdirSync(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = renderIcon(size);
  fs.writeFileSync(path.join(outDir, `icon${size}.png`), png);
  console.log(`Generated icon${size}.png (${png.length} bytes)`);
}
