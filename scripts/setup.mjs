// Runs automatically after `npm install`.
// 1) copies the MediaPipe WASM runtime into /public/wasm
// 2) downloads the hand-landmarker model into /public/models (optional – the app falls back to a CDN)
// Never fails the install.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dst = path.join(root, 'public/wasm');

try {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  console.log('[setup] MediaPipe WASM copied to public/wasm');
} catch (e) {
  console.log('[setup] WASM copy skipped (app will use CDN):', e.message);
}

const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const modelDir = path.join(root, 'public/models');
const modelFile = path.join(modelDir, 'hand_landmarker.task');

if (!fs.existsSync(modelFile)) {
  try {
    fs.mkdirSync(modelDir, { recursive: true });
    const r = await fetch(MODEL_URL);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    fs.writeFileSync(modelFile, Buffer.from(await r.arrayBuffer()));
    console.log('[setup] hand_landmarker.task downloaded');
  } catch (e) {
    console.log('[setup] model download skipped (app will fetch it from CDN at runtime):', e.message);
  }
}
process.exit(0);
