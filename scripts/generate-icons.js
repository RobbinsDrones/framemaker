// Script to generate valid PNG and SVG icons for PWA and Android
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 1. Create Brand SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="frame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#f3efe6"/>
    </linearGradient>
    <linearGradient id="art" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="50%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- App Background -->
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>

  <!-- Outer Picture Frame with Shadow -->
  <rect x="76" y="76" width="360" height="360" rx="16" fill="url(#frame)" filter="url(#shadow)" stroke="#38bdf8" stroke-width="4"/>

  <!-- Inner Mat Bevel / Shadow -->
  <rect x="116" y="116" width="280" height="280" rx="6" fill="#18181b" stroke="#71717a" stroke-width="2"/>

  <!-- Photo Artwork inside Frame -->
  <rect x="136" y="136" width="240" height="240" rx="4" fill="url(#art)"/>

  <!-- Mountain / Sun Landscape Accent in Artwork -->
  <circle cx="210" cy="200" r="28" fill="#fbbf24" opacity="0.9"/>
  <path d="M140 340 L220 230 L270 300 L320 220 L376 340 Z" fill="#ffffff" opacity="0.25"/>
  <path d="M180 340 L250 250 L310 320 L340 280 L376 340 Z" fill="#0f172a" opacity="0.45"/>

  <!-- Crop Corner Marks -->
  <path d="M60 90 L60 60 L90 60" fill="none" stroke="#60a5fa" stroke-width="6" stroke-linecap="round"/>
  <path d="M422 60 L452 60 L452 90" fill="none" stroke="#60a5fa" stroke-width="6" stroke-linecap="round"/>
  <path d="M60 422 L60 452 L90 452" fill="none" stroke="#60a5fa" stroke-width="6" stroke-linecap="round"/>
  <path d="M422 452 L452 452 L452 422" fill="none" stroke="#60a5fa" stroke-width="6" stroke-linecap="round"/>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

// Function to encode uncompressed RGBA pixel buffer into a valid PNG file
function createPng(width, height, getPixelRgba) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression method
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace method

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw image data with scanline filter bytes (0 = None)
  const rowLength = width * 4;
  const rawData = Buffer.alloc(height * (rowLength + 1));

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter byte: 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRgba(x, y, width, height);
      rawData[offset++] = r;
      rawData[offset++] = g;
      rawData[offset++] = b;
      rawData[offset++] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// CRC32 table for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = data.length;
  const chunk = Buffer.alloc(8 + len + 4);
  chunk.writeUInt32BE(len, 0);
  typeBuf.copy(chunk, 4);
  data.copy(chunk, 8);
  const toCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(toCrc);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

// Pixel generators
function framePixel(x, y, w, h, isMaskable = false) {
  const nx = x / w;
  const ny = y / h;

  // Background gradient: Dark Blue/Slate
  const bgR = Math.round(18 + nx * 10);
  const bgG = Math.round(30 + ny * 20);
  const bgB = Math.round(60 + (nx + ny) * 30);

  // Maskable keeps everything strictly inside safe zone (padding 15%)
  const pad = isMaskable ? 0.18 : 0.12;
  const innerPad = pad + 0.08;

  // Outer border check
  if (nx >= pad && nx <= 1 - pad && ny >= pad && ny <= 1 - pad) {
    // Mat border
    if (nx < innerPad || nx > 1 - innerPad || ny < innerPad || ny > 1 - innerPad) {
      // White / Cream mat border
      return [248, 248, 252, 255];
    }
    // Inner thin dark reveal
    if (
      nx < innerPad + 0.015 ||
      nx > 1 - innerPad - 0.015 ||
      ny < innerPad + 0.015 ||
      ny > 1 - innerPad - 0.015
    ) {
      return [24, 24, 27, 255];
    }
    // Photo inside (Vibrant sunset landscape color gradient)
    const artNx = (nx - innerPad) / (1 - 2 * innerPad);
    const artNy = (ny - innerPad) / (1 - 2 * innerPad);
    const artR = Math.round(59 + artNx * 180);
    const artG = Math.round(130 - artNy * 60 + artNx * 40);
    const artB = Math.round(246 - artNx * 80);
    return [artR, artG, artB, 255];
  }

  return [bgR, bgG, bgB, 255];
}

// Generate PNG files
console.log('Generating PNG icons...');
const png192 = createPng(192, 192, (x, y, w, h) => framePixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), png192);

const png512 = createPng(512, 512, (x, y, w, h) => framePixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), png512);

const pngMaskable = createPng(512, 512, (x, y, w, h) => framePixel(x, y, w, h, true));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), pngMaskable);

const appleTouch = createPng(180, 180, (x, y, w, h) => framePixel(x, y, w, h, false));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), appleTouch);

console.log('All icons generated successfully!');
