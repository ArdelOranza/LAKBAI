// Generate the Capacitor icon/splash sources from the PWA icon.
// Run: node scripts/make-assets.mjs && npx capacitor-assets generate --android
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const source = path.resolve(root, '../client/public/pwa-512.png');
const out = path.join(root, 'resources');

await mkdir(out, { recursive: true });

await sharp(source)
  .resize(1024, 1024, { kernel: 'lanczos3' })
  .png()
  .toFile(path.join(out, 'icon.png'));

const logo = await sharp(source).resize(760, 760, { kernel: 'lanczos3' }).png().toBuffer();
await sharp({ create: { width: 2732, height: 2732, channels: 4, background: '#FFFFFF' } })
  .composite([{ input: logo, gravity: 'center' }])
  .png()
  .toFile(path.join(out, 'splash.png'));

console.log('wrote resources/icon.png and resources/splash.png');
