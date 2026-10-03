import { Cloud, P, I, merge, ellipsoid, lathe, rod, tube, unitVec, R } from './shapes.js';

const PI = Math.PI;
const RX = 1.15, RY = 0.92, RZ = 1.55; // front of the head = +Z

function cortexPoint() {
  for (;;) {
    const [dx, dy0, dz] = unitVec();
    if (dz < -0.3 && dy0 < -0.35) continue; // room for the cerebellum
    let dy = dy0;
    if (dy < -0.2) dy = -0.2 + (dy + 0.2) * 0.5; // flatter underside
    const fis = dy > 0 ? 1 - 0.22 * Math.exp(-(dx * dx) / 0.006) * Math.min(1, dy * 2.5) : 1; // longitudinal fissure
    const g =
      1 +
      0.045 * Math.sin(10 * dx + 3 * Math.sin(7 * dy)) * Math.sin(9 * dz + 2 * Math.sin(6 * dx)) +
      0.03 * Math.sin(15 * dy + 6 * dz);
    const k = g * fis;
    return { d: [dx, dy0, dz], p: [RX * dx * k, RY * dy * k, RZ * dz * k] };
  }
}

export function buildBrain() {
  const parts = [];
  const lobes = { frontal: [new Cloud(), new Cloud()], parietal: [new Cloud(), new Cloud()], occipital: [new Cloud(), new Cloud()], temporal: [new Cloud(), new Cloud()] };
  for (let i = 0; i < 34000; i++) {
    const { d, p } = cortexPoint();
    const [, dy, dz] = d;
    let name;
    if (dz > 0.35 && dy > -0.25) name = 'frontal';
    else if (dz < -0.35) name = 'occipital';
    else if (dy > 0.2) name = 'parietal';
    else name = 'temporal';
    lobes[name][p[0] < 0 ? 0 : 1].add(p[0], p[1], p[2]);
  }
  const L = (key, name, desc, color, dl, dr) => parts.push(P(name, desc, color, [I(lobes[key][1], dr), I(lobes[key][0], dl)]));
  L('frontal', 'Frontal lobe', 'Planning, decisions, speech and voluntary movement.', '#c9b6ff', [-0.9, 0.2, 1.4], [0.9, 0.2, 1.4]);
  L('parietal', 'Parietal lobe', 'Processes touch and helps you sense where your body is in space.', '#ff8fd0', [-0.9, 1.25, -0.3], [0.9, 1.25, -0.3]);
  L('occipital', 'Occipital lobe', 'The visual centre. It turns signals from the eyes into images.', '#ff6f6f', [-0.9, 0.2, -1.45], [0.9, 0.2, -1.45]);
  L('temporal', 'Temporal lobe', 'Hearing, language comprehension and memory.', '#ffc247', [-1.7, -0.6, 0.1], [1.7, -0.6, 0.1]);

  const callosum = tube([[0, 0.1, 0.85], [0, 0.35, 0.55], [0, 0.5, 0], [0, 0.35, -0.6], [0, 0.05, -0.9]], 0.11, 2000, { taper: (t) => 0.6 + 0.4 * Math.sin(PI * t) });
  parts.push(P('Corpus callosum', 'A thick band of fibres that lets the two hemispheres talk to each other.', '#ffe14d', [I(callosum, [0, 0.55, 0])]));

  parts.push(P('Thalamus', 'Relay station that routes sensory signals to the cortex.', '#ffb02e', [I(ellipsoid(0.2, 0.16, 0.26, 600).move(0.24, 0.02, 0), [0.7, -0.2, 0]), I(ellipsoid(0.2, 0.16, 0.26, 600).move(-0.24, 0.02, 0), [-0.7, -0.2, 0])]));

  const hip = (s) => tube([[0.5 * s, -0.45, 0.35], [0.62 * s, -0.5, 0.0], [0.6 * s, -0.4, -0.45], [0.45 * s, -0.2, -0.85]], 0.07, 800, { taper: (t) => 0.7 + 0.5 * t });
  parts.push(P('Hippocampus', 'Forms new memories. Named after the seahorse it resembles.', '#4fe3e0', [I(hip(1), [1.0, -0.9, -0.1]), I(hip(-1), [-1.0, -0.9, -0.1])]));

  parts.push(P('Amygdala', 'Handles emotion, especially fear and alertness.', '#ff4fa8', [I(ellipsoid(0.13, 0.13, 0.13, 320).move(0.55, -0.32, 0.5), [1.2, -1.0, 0.6]), I(ellipsoid(0.13, 0.13, 0.13, 320).move(-0.55, -0.32, 0.5), [-1.2, -1.0, 0.6])]));

  const hyp = merge(ellipsoid(0.14, 0.1, 0.14, 380).move(0, -0.38, 0.28), ellipsoid(0.07, 0.07, 0.07, 160).move(0, -0.62, 0.35), rod([0, -0.4, 0.3], [0, -0.58, 0.35], 0.02, 60));
  parts.push(P('Hypothalamus & pituitary', 'Controls hormones, hunger, sleep and body temperature.', '#ff8ac8', [I(hyp, [0, -1.3, 0.7])]));

  const stem = lathe([[0.2, 0], [0.17, -0.35], [0.15, -0.8]], 1500).move(0, -0.55, -0.3);
  parts.push(P('Brainstem', 'Links the brain to the spinal cord and runs breathing and heartbeat.', '#52e0d0', [I(stem, [0, -1.5, -0.3])]));

  const cb = new Cloud();
  for (let i = 0; i < 4800; i++) {
    const [x, y, z] = unitVec();
    if (y > 0.5) continue;
    const k = 1 + 0.05 * Math.sin(26 * y);
    cb.add(0.78 * x * k, -0.62 + 0.42 * y * k, -1.0 + 0.52 * z * k);
  }
  parts.push(P('Cerebellum', 'The "little brain". It fine-tunes balance and coordination.', '#ff5bd2', [I(cb, [0, -0.9, -1.4])]));

  return parts;
}
