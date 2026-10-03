import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

const CDN_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const CDN_MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

async function localExists(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    const type = r.headers.get('content-type') || '';
    return r.ok && !type.includes('text/html');
  } catch {
    return false;
  }
}

export class HandTracker {
  constructor() {
    this.landmarker = null;
    this.ready = false;
    this.info = '';
  }

  /** Tries local files first, then CDN. GPU first, then CPU. Throws if everything fails. */
  async init() {
    let lastErr = null;
    const wasmBases = [];
    if (await localExists('/wasm/vision_wasm_internal.js')) wasmBases.push({ url: '/wasm', tag: 'LOCAL' });
    wasmBases.push({ url: CDN_WASM, tag: 'CDN' });

    const models = [];
    if (await localExists('/models/hand_landmarker.task')) models.push({ url: '/models/hand_landmarker.task', tag: 'LOCAL' });
    models.push({ url: CDN_MODEL, tag: 'CDN' });

    for (const wb of wasmBases) {
      let fileset;
      try {
        fileset = await FilesetResolver.forVisionTasks(wb.url);
      } catch (e) {
        lastErr = e;
        continue;
      }
      for (const m of models) {
        for (const delegate of ['GPU', 'CPU']) {
          try {
            this.landmarker = await HandLandmarker.createFromOptions(fileset, {
              baseOptions: { modelAssetPath: m.url, delegate },
              runningMode: 'VIDEO',
              numHands: 2,
              minHandDetectionConfidence: 0.55,
              minHandPresenceConfidence: 0.5,
              minTrackingConfidence: 0.5,
            });
            this.ready = true;
            this.info = `${delegate} / ${m.tag}`;
            return;
          } catch (e) {
            lastErr = e;
          }
        }
      }
    }
    throw lastErr || new Error('HandLandmarker failed to initialise');
  }

  /** Returns an array of { landmarks, score, label } (0, 1 or 2 hands). Call once per new video frame. */
  detect(video, nowMs) {
    if (!this.ready) return [];
    let res;
    try {
      res = this.landmarker.detectForVideo(video, nowMs);
    } catch {
      return [];
    }
    if (!res || !res.landmarks || !res.landmarks.length) return [];
    return res.landmarks.map((landmarks, i) => ({
      landmarks,
      score: res.handedness?.[i]?.[0]?.score ?? 0.9,
      label: res.handedness?.[i]?.[0]?.categoryName || (i ? 'Left' : 'Right'),
    }));
  }
}
