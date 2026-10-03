// Raw MediaPipe landmarks -> stable per-hand state: gesture, openness (0 fist .. 1 open palm),
// smoothed palm / fingertip / pinch positions in viewport space, and wrist roll.
import { clamp, angleDelta } from './utils.js';

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const FINGERS = [[8, 5], [12, 9], [16, 13], [20, 17]]; // [tip, mcp] for index, middle, ring, pinky

class HandState {
  constructor() {
    this.stable = 'NONE';
    this.cand = 'NONE';
    this.streak = 0;
    this.pinching = false;
    this.palm = null;
    this.tip = null;
    this.pp = null;
    this.lastRoll = null;
    this.rollSm = 0;
    this.open = 0.5;
    this.missing = 0;
    this.last = null;
  }
}

const smooth = (prev, cur, dt) => {
  if (!prev) return { ...cur };
  const speed = Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt;
  const a = clamp(0.18 + speed * 0.6, 0.18, 0.85);
  return { x: prev.x + (cur.x - prev.x) * a, y: prev.y + (cur.y - prev.y) * a };
};

export class GestureEngine {
  constructor() {
    this.states = new Map();
    this.lastT = 0;
  }
  reset() {
    this.states.clear();
  }

  /**
   * hands: [{ landmarks, score, label }]
   * map:   raw camera landmark -> viewport-normalised {x,y} (mirroring + crop already applied)
   * aspect: video width / height
   */
  update(hands, t, map, aspect = 16 / 9) {
    const dt = clamp(t - this.lastT, 0.001, 0.1);
    this.lastT = t;
    const items = hands.map((h) => ({ h, label: h.label }));
    if (items.length === 2 && items[0].label === items[1].label) items[1].label = items[0].label === 'Left' ? 'Right' : 'Left';
    const seen = new Set();
    const out = [];
    for (const { h, label } of items) {
      seen.add(label);
      let st = this.states.get(label);
      if (!st) {
        st = new HandState();
        this.states.set(label, st);
      }
      out.push(this._process(st, label, h, dt, map, aspect));
    }
    for (const [id, st] of [...this.states]) {
      if (seen.has(id)) continue;
      st.missing++;
      if (st.missing > 6 || !st.last) this.states.delete(id);
      else out.push({ ...st.last, held: true, rollDelta: 0 });
    }
    out.sort((a, b) => (a.id < b.id ? -1 : 1));
    return { hands: out };
  }

  _process(st, id, h, dt, map, aspect) {
    st.missing = 0;
    const raw = h.landmarks;
    // mirrored, aspect-corrected space for distance maths
    const L = raw.map((p) => ({ x: (1 - p.x) * aspect, y: p.y }));
    const d = (a, b) => Math.hypot(L[a].x - L[b].x, L[a].y - L[b].y);
    const size = Math.max(1e-4, d(0, 9));

    const ratios = FINGERS.map(([tp, mc]) => d(tp, 0) / Math.max(1e-4, d(mc, 0)));
    const ext = ratios.map((r) => r > 1.5);
    const curl = ratios.map((r) => r < 1.32);
    const avg = (ratios[0] + ratios[1] + ratios[2] + ratios[3]) / 4;
    const rawOpen = clamp((avg - 1.05) / (1.8 - 1.05), 0, 1);
    st.open += (rawOpen - st.open) * 0.45;

    // pinch with hysteresis
    const pr = d(4, 8) / size;
    const canPinch = d(8, 0) / Math.max(1e-4, d(6, 0)) > 0.88;
    if (!st.pinching && pr < 0.32 && canPinch) st.pinching = true;
    else if (st.pinching && (pr > 0.5 || !canPinch)) st.pinching = false;

    let g = 'NONE';
    if (st.pinching) g = 'PINCH';
    else if (ext[0] && ext[1] && ext[2] && ext[3]) g = 'OPEN';
    else if (ext[0] && ext[1] && curl[2] && curl[3]) g = 'PEACE';
    else if (ext[0] && curl[1] && curl[2] && curl[3]) g = 'POINT';
    else if (curl[0] && curl[1] && curl[2] && curl[3]) g = 'FIST';

    if (g === st.cand) st.streak++;
    else {
      st.cand = g;
      st.streak = 1;
    }
    const need = g === 'PINCH' ? 2 : g === 'PEACE' ? 8 : 3;
    if (st.streak >= need && st.stable !== st.cand) st.stable = st.cand;

    // viewport-space positions
    const M = raw.map(map);
    const avgPts = (idx) => ({
      x: idx.reduce((s, k) => s + M[k].x, 0) / idx.length,
      y: idx.reduce((s, k) => s + M[k].y, 0) / idx.length,
    });
    st.palm = smooth(st.palm, avgPts([0, 5, 9, 13, 17]), dt);
    st.tip = smooth(st.tip, M[8], dt);
    st.pp = smooth(st.pp, avgPts([4, 8]), dt);

    // wrist roll (twist)
    const rawRoll = Math.atan2(L[9].x - L[0].x, -(L[9].y - L[0].y));
    let rd = 0;
    if (st.lastRoll !== null) rd = angleDelta(st.lastRoll, rawRoll);
    st.lastRoll = rawRoll;
    st.rollSm = st.rollSm * 0.6 + rd * 0.4;
    const rollDelta = Math.abs(st.rollSm) < 0.004 ? 0 : st.rollSm;

    st.last = {
      id,
      held: false,
      score: h.score,
      gesture: st.stable,
      lm: M,
      palm: { ...st.palm },
      tip: { ...st.tip },
      pinchPt: { ...st.pp },
      openness: st.open,
      pinching: st.pinching,
      rollDelta,
    };
    return st.last;
  }
}
