import * as THREE from 'three';
import { Cloud, P, I, merge, frustum, disc, torus, ellipsoid, box, rod, tube, R } from './shapes.js';
import { clamp } from '../utils.js';

const PI = Math.PI;

// Side profile of the roofline (x = length, front is +X), tabulated for lookup
const prof = new THREE.SplineCurve(
  [[2.25, 0.02], [2.15, 0.18], [1.7, 0.34], [1.1, 0.42], [0.6, 0.48], [0.15, 0.92], [-0.2, 0.96], [-0.7, 0.9], [-1.15, 0.6], [-1.6, 0.5], [-2.1, 0.45], [-2.25, 0.3]].map(
    (p) => new THREE.Vector2(p[0], p[1]),
  ),
).getPoints(400);
function topY(x) {
  for (let i = 0; i < prof.length - 1; i++) {
    const a = prof[i], b = prof[i + 1];
    if ((x <= a.x && x >= b.x) || (x >= a.x && x <= b.x)) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return x > 0 ? 0.02 : 0.3;
}
const halfW = (x) => 0.92 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(x) / 2.3, 5)), 0.4);

/** top skin between x0..x1 */
function skin(x0, x1, n) {
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const x = R(x0, x1);
    const y = topY(x);
    const w = halfW(x) * (1 - 0.3 * clamp((y - 0.45) / 0.45, 0, 1));
    const z = R(-w, w);
    c.add(x, y - 0.06 * (z / w) * (z / w), z);
  }
  return c;
}
/** side panel on one side between x0..x1 */
function side(x0, x1, sgn, n) {
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const x = R(x0, x1);
    const y = R(0.04, Math.max(0.1, topY(x) - 0.03));
    const w = halfW(x) * (1 - 0.3 * clamp((y - 0.45) / 0.5, 0, 1));
    c.add(x, y, sgn * w);
  }
  return c;
}

export function buildCar() {
  const parts = [];

  parts.push(P('Hood', 'Covers the engine bay and shapes the airflow over the nose.', '#ff4f6e', [I(skin(0.55, 2.2, 3200), [0.7, 1.25, 0])]));
  parts.push(P('Windshield', 'Laminated glass. It carries the cabin loads in a crash.', '#6fe3ff', [I(skin(-0.15, 0.55, 1500), [0.2, 1.75, 0])]));
  parts.push(P('Roof', 'Closes the cabin and ties the pillars together.', '#ff8fb8', [I(skin(-0.75, -0.15, 1500), [0, 2.2, 0])]));
  parts.push(P('Trunk lid', 'Rear deck over the luggage space.', '#ff4f6e', [I(skin(-2.25, -0.75, 2600), [-0.7, 1.25, 0])]));
  parts.push(P('Doors', 'Side panels with the door frame and side-impact beams.', '#ff8fb8', [I(side(-0.95, 0.55, 1, 2000), [0, 0.3, 1.8]), I(side(-0.95, 0.55, -1, 2000), [0, 0.3, -1.8])]));
  parts.push(P('Front fenders', 'Front wing panels that wrap the front wheels.', '#ff3d54', [I(side(0.55, 2.25, 1, 2000), [0.5, 0.2, 1.8]), I(side(0.55, 2.25, -1, 2000), [0.5, 0.2, -1.8])]));
  parts.push(P('Rear fenders', 'Rear wing panels that wrap the rear wheels.', '#ff3d54', [I(side(-2.25, -0.95, 1, 1700), [-0.5, 0.2, 1.8]), I(side(-2.25, -0.95, -1, 1700), [-0.5, 0.2, -1.8])]));

  const spoiler = merge(box(0.5, 0.03, 1.5, 900, { edges: 0.4 }).move(-2.2, 0.78, 0), rod([-2.2, 0.45, 0.5], [-2.2, 0.78, 0.5], 0.03, 120), rod([-2.2, 0.45, -0.5], [-2.2, 0.78, -0.5], 0.03, 120));
  parts.push(P('Rear spoiler', 'Adds downforce so the car stays planted at speed.', '#ff3d4e', [I(spoiler, [-1.3, 1.9, 0])]));

  parts.push(
    P('Headlights', 'LED headlamp units in the front corners.', '#fff06a', [
      I(ellipsoid(0.12, 0.07, 0.17, 380).move(2.05, 0.28, 0.6), [1.2, 0.6, 0.5]),
      I(ellipsoid(0.12, 0.07, 0.17, 380).move(2.05, 0.28, -0.6), [1.2, 0.6, -0.5]),
    ]),
  );

  // Interior
  const seat = (z) =>
    merge(box(0.45, 0.1, 0.42, 520).move(-0.45, 0.28, z), box(0.1, 0.5, 0.42, 520).rotate(0, 0, 0.18).move(-0.68, 0.52, z));
  parts.push(P('Seats', 'Bucket seats with side bolsters.', '#ff7ad0', [I(seat(0.32), [-0.4, 1.3, 0.6]), I(seat(-0.32), [-0.4, 1.3, -0.6])]));

  const wheel = merge(torus(0.14, 0.018, 420).rotate(0, 0, 1.0), rod([0, 0, 0], [0.12, -0.2, 0], 0.014, 90)).move(0.05, 0.52, -0.32);
  parts.push(P('Steering wheel', 'Leather-wrapped wheel with the steering column.', '#ffffff', [I(wheel, [0.7, 1.6, -0.3])]));

  // Drivetrain
  const eng = merge(box(0.9, 0.42, 0.7, 2300, { edges: 0.3 }).move(1.0, 0.12, 0), box(0.5, 0.12, 0.5, 400).move(1.0, 0.42, 0));
  for (let i = 0; i < 6; i++) eng.merge(frustum(0.07, 0.07, 0.2, 200, { cap1: true }).move(0.7 + (i % 3) * 0.3, 0.38, i < 3 ? 0.17 : -0.17));
  parts.push(P('Engine', 'Mid-front V6 that provides the power.', '#ffd23f', [I(eng, [1.2, 0.5, 0])]));

  const drive = merge(rod([0.5, -0.05, 0], [-1.35, -0.05, 0], 0.06, 700, { caps: true }), ellipsoid(0.22, 0.18, 0.3, 700).move(-1.35, -0.05, 0));
  parts.push(P('Driveshaft', 'Carries power from the gearbox to the rear differential.', '#ff9f2e', [I(drive, [-0.2, -2.0, 0])]));

  const exh = merge(
    tube([[0.5, -0.1, 0.3], [-0.3, -0.15, 0.32], [-1.2, -0.15, 0.35], [-2.1, -0.12, 0.35]], 0.05, 800),
    frustum(0.12, 0.12, 0.6, 520, { rings: 3, cap0: true, cap1: true }).rotate(0, 0, PI / 2).move(-1.7, -0.14, 0.35),
    frustum(0.07, 0.09, 0.2, 200).rotate(0, 0, PI / 2).move(-2.25, -0.1, 0.3),
    frustum(0.07, 0.09, 0.2, 200).rotate(0, 0, PI / 2).move(-2.25, -0.1, 0.55),
  );
  parts.push(P('Exhaust', 'Routes exhaust gas past the muffler and out the back.', '#ff6a3d', [I(exh, [-1.3, -1.5, 0.9])]));

  // Chassis
  const chassis = merge(
    rod([-2.0, -0.1, 0.55], [2.0, -0.1, 0.55], 0.035, 900),
    rod([-2.0, -0.1, -0.55], [2.0, -0.1, -0.55], 0.035, 900),
    ...[-1.8, -1.0, -0.2, 0.6, 1.4, 2.0].map((x) => rod([x, -0.1, -0.55], [x, -0.1, 0.55], 0.03, 420)),
    rod([1.35, 0, -0.95], [1.35, 0, 0.95], 0.03, 340),
    rod([-1.35, 0, -0.95], [-1.35, 0, 0.95], 0.03, 340),
  );
  parts.push(P('Chassis frame', 'The structural skeleton. Everything else bolts onto it.', '#ffffff', [I(chassis, [0, -1.1, 0])]));

  // Wheels + brakes
  const corners = [];
  for (const sx of [1, -1]) for (const sz of [1, -1]) corners.push([sx * 1.35, sz]);
  const wheelCloud = () => {
    const w = merge(torus(0.34, 0.14, 1500).rotate(PI / 2, 0, 0), disc(0, 0.24, 520).rotate(PI / 2, 0, 0));
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * PI * 2;
      w.merge(rod([0, 0, 0], [0.24 * Math.cos(a), 0.24 * Math.sin(a), 0], 0.018, 90));
    }
    return w;
  };
  parts.push(P('Wheels & tires', 'Alloy wheels with performance tires.', '#f4f1ff', corners.map(([x, sz]) => I(wheelCloud().move(x, 0.02, sz * 0.95), [x * 0.2, -0.15, sz * 1.5]))));
  parts.push(P('Brake discs', 'Ventilated discs that stop the car.', '#4fe3e0', corners.map(([x, sz]) => I(merge(disc(0.07, 0.21, 380).rotate(PI / 2, 0, 0)).move(x, 0.02, sz * 0.74), [0, 0, sz * 0.9]))));

  return parts;
}
