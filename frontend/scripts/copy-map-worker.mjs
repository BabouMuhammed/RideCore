// MapLibre parses vector map tiles in a Web Worker. Its web build finds the
// worker file next to itself via import.meta.url, which the Expo (Metro)
// bundle doesn't preserve, so the worker never starts and vector maps stay
// blank. This copies the worker into public/ (served at the site root);
// MapCanvas.web.tsx points MapLibre at it with setWorkerUrl. Runs on every
// install so the worker always matches the installed MapLibre version.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const source = join(
  dirname(require.resolve('maplibre-gl/package.json')),
  'dist',
  'maplibre-gl-worker.mjs',
);
mkdirSync(join(root, 'public'), { recursive: true });
copyFileSync(source, join(root, 'public', 'maplibre-gl-worker.mjs'));
