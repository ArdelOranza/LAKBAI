import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
mkdirSync('public', { recursive: true });
const svg = readFileSync('public/logo.svg');
// square icons: logo on transparent, padded
await sharp(svg, { density: 300 }).resize(192, 192).toFile('public/pwa-192.png');
await sharp(svg, { density: 300 }).resize(512, 512).toFile('public/pwa-512.png');
await sharp(svg, { density: 300 }).resize(180, 180).toFile('public/apple-touch-icon.png');
// maskable: full-bleed blue gradient canvas, mark at 60% safe zone
const maskSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2280E8"/><stop offset="1" stop-color="#0A3D8F"/></linearGradient></defs><rect width="512" height="512" fill="url(#g)"/></svg>`;
await sharp(Buffer.from(maskSvg))
  .composite([
    { input: await sharp(svg, { density: 300 }).resize(320, 320).toBuffer(), gravity: 'centre' },
  ])
  .png()
  .toFile('public/maskable-512.png');
console.log('icons done');
