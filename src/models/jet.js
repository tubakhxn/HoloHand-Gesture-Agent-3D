const PI = Math.PI;
import { P, I, merge, frustum, disc, ring, torus, lathe, blades, rod } from './shapes.js';

// Built along +Y, then turned so the engine axis is +X (inlet on the left, exhaust on the right).
const A = (c) => c.rotate(0, 0, -PI / 2);
const K = 0.7; // axial explosion factor
const dU = (u, ex = [0, 0, 0]) => [u * K + ex[0], ex[1], ex[2]];

export function buildJet() {
  const parts = [];

  // Nacelle: two half shells that open up and down
  const nac = (a0, a1) => A(frustum(1.35, 1.28, 4.9, 4600, { a0, a1, rings: 8, lines: 16 }).move(0, -0.55, 0));
  parts.push(
    P('Nacelle', 'Outer casing. It guides the bypass air and carries the engine loads.', '#e9e6ff', [
      I(nac(PI / 2, (3 * PI) / 2), [0, 1.75, 0]),
      I(nac(-PI / 2, PI / 2), [0, -1.75, 0]),
    ]),
  );

  // Fan
  const fan = merge(
    blades(18, 0.36, 1.18, 0.36, 5400, { pitch: 0.75, twist: 0.6 }),
    lathe([[0, -0.34], [0.16, -0.24], [0.33, 0], [0.4, 0.22]], 1300),
    disc(0.3, 0.42, 300, 0.22),
    ring(1.18, 0, 380),
  );
  parts.push(P('Fan', 'Large front fan. Most of its air bypasses the core and makes the thrust.', '#4fe3e0', [I(A(fan.move(0, -2.3, 0)), dU(-2.3))]));

  // Outlet guide vanes
  const vanes = blades(30, 0.62, 1.28, 0.16, 2200, { pitch: 1.3, twist: 0 }).move(0, -1.55, 0);
  parts.push(P('Guide vanes', 'Fixed vanes that straighten the swirling bypass air.', '#8ad7ff', [I(A(vanes), dU(-1.55, [0, 0, 0.9]))]));

  // Low-pressure compressor
  const lpc = merge(frustum(0.27, 0.3, 0.8, 700, { rings: 3, lines: 8 }));
  for (let s = 0; s < 3; s++) lpc.merge(blades(26, 0.28, 0.62 - 0.05 * s, 0.12, 900, { pitch: 0.7, y: -0.3 + s * 0.3 }));
  parts.push(P('Low-pressure compressor', 'First compressor stages. They squeeze the air entering the core.', '#ffd23f', [I(A(lpc.move(0, -1.3, 0)), dU(-1.3))]));

  // High-pressure compressor
  const hpc = merge(frustum(0.5, 0.34, 1.2, 1700, { rings: 6, lines: 12 }));
  for (let s = 0; s < 5; s++) {
    const t = s / 4;
    const rd = 0.5 + (0.34 - 0.5) * t;
    hpc.merge(blades(30, rd, rd + 0.16, 0.1, 720, { pitch: 0.7, y: -0.5 + t }));
  }
  parts.push(P('High-pressure compressor', 'Squeezes the air many times over before it meets the fuel.', '#ff9f2e', [I(A(hpc.move(0, -0.45, 0)), dU(-0.45))]));

  // Combustion chamber
  const comb = merge(
    lathe([[0.72, -0.45], [0.76, -0.2], [0.76, 0.3], [0.64, 0.5]], 1700),
    lathe([[0.34, -0.45], [0.3, 0], [0.3, 0.5]], 900),
    torus(0.52, 0.12, 1000, {}).rotate(0, 0, 0),
  );
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * PI * 2;
    comb.merge(rod([0.52 * Math.cos(a), -0.6, 0.52 * Math.sin(a)], [0.52 * Math.cos(a), -0.38, 0.52 * Math.sin(a)], 0.025, 70));
  }
  parts.push(P('Combustion chamber', 'Fuel burns here with the compressed air, making hot high-pressure gas.', '#ff4f9a', [I(A(comb.move(0, 0.45, 0)), dU(0.45, [0, 0, -0.6]))]));

  // High-pressure turbine
  const hpt = merge();
  for (let s = 0; s < 2; s++) {
    hpt.merge(disc(0.12, 0.55, 520, -0.15 + s * 0.3), blades(36, 0.4, 0.63, 0.11, 950, { pitch: 0.8, y: -0.15 + s * 0.3 }));
  }
  parts.push(P('High-pressure turbine', 'Extracts energy from the hot gas to drive the high-pressure compressor.', '#ff6b4a', [I(A(hpt.move(0, 1.15, 0)), dU(1.15))]));

  // Low-pressure turbine
  const lpt = merge();
  for (let s = 0; s < 4; s++) {
    const r = 0.52 + s * 0.08;
    lpt.merge(disc(0.12, r - 0.05, 420, -0.4 + s * 0.27), blades(40, r - 0.1, r + 0.1, 0.1, 800, { pitch: 0.8, y: -0.4 + s * 0.27 }));
  }
  parts.push(P('Low-pressure turbine', 'Last turbine stages. They spin the fan through the long core shaft.', '#c58bff', [I(A(lpt.move(0, 1.9, 0)), dU(1.9))]));

  // Core shaft
  const shaft = merge(rod([0, -2.6, 0], [0, 2.3, 0], 0.07, 1100, { caps: true }), disc(0.07, 0.17, 160, -0.6), disc(0.07, 0.17, 160, 1.4));
  parts.push(P('Core shaft', 'Connects the turbines at the back to the fan at the front.', '#ffe14d', [I(A(shaft), [0, -0.5, 1.9])]));

  // Exhaust nozzle + tail cone
  const noz = merge(
    lathe([[0.92, -0.5], [0.8, 0], [0.64, 0.5]], 2300),
    lathe([[0.3, -0.4], [0.2, 0.2], [0, 0.7]], 900),
    ring(0.92, -0.5, 260),
    ring(0.64, 0.5, 200),
  );
  parts.push(P('Exhaust nozzle', 'Accelerates the hot gas out of the back to add thrust.', '#f4f1ff', [I(A(noz.move(0, 2.9, 0)), dU(2.9))]));

  return parts;
}
