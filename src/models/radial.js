import { Cloud, P, I, merge, frustum, disc, ring, torus, lathe, ellipsoid, rod, R, rand } from './shapes.js';

const PI = Math.PI;
const N = 9;
// Everything is built in the XY plane (radial layout) with the crankshaft along +Z (toward the viewer).
const Z = (c) => c.rotate(PI / 2, 0, 0); // +Y axis shape -> +Z axis

/** Cooling-fin barrel along +Y */
function finned(r, h, n) {
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const y = R(-h / 2, h / 2);
    const rr = r + (Math.sin(y * 42) > 0 ? 0.07 : 0);
    const a = rand() * PI * 2;
    c.add(rr * Math.cos(a), y, rr * Math.sin(a));
  }
  return c;
}

export function buildRadial() {
  const parts = [];
  const dirs = Array.from({ length: N }, (_, k) => {
    const th = (k / N) * PI * 2 + PI / 2;
    return [Math.cos(th), Math.sin(th), 0];
  });
  const along = (c, d, rho) => c.align(d).move(d[0] * rho, d[1] * rho, d[2] * rho);

  // Crankcase
  const cc = merge(ellipsoid(0.82, 0.82, 0.42, 3600), torus(0.82, 0.04, 500).rotate(PI / 2, 0, 0), disc(0.3, 0.55, 600, 0).rotate(PI / 2, 0, 0).move(0, 0, 0.42));
  parts.push(P('Crankcase', 'Central housing. It holds the crankshaft and ties all nine cylinders together.', '#46d9d0', [I(cc, [0, 0, 0.2])]));

  // Cylinders
  parts.push(
    P(
      'Cylinders (9)',
      'Nine finned cylinders around the crankcase. Air flowing past the fins cools them.',
      '#d4c9ff',
      dirs.map((d) => {
        const barrel = merge(finned(0.19, 0.85, 1500), ellipsoid(0.25, 0.15, 0.25, 520).move(0, 0.47, 0), ring(0.26, -0.42, 160));
        return I(along(barrel, d, 0.78 + 0.425), [d[0] * 1.6, d[1] * 1.6, 0]);
      }),
    ),
  );

  // Pistons
  parts.push(
    P(
      'Pistons',
      'Each piston is pushed by burning fuel and drives the crankshaft.',
      '#ffd23f',
      dirs.map((d) => {
        const pst = merge(frustum(0.15, 0.15, 0.22, 380, { rings: 3, cap1: true }));
        return I(along(pst, d, 0.98), [d[0] * 0.85, d[1] * 0.85, 0]);
      }),
    ),
  );

  // Connecting rods
  parts.push(
    P(
      'Connecting rods',
      'Link every piston to the master rod on the crankshaft.',
      '#38c9b8',
      dirs.map((d) => I(along(rod([0, 0, 0], [0, 0.78, 0], 0.028, 160), d, 0.15), [d[0] * 0.45, d[1] * 0.45, 0])),
    ),
  );

  // Crankshaft + master rod disc
  const crank = merge(Z(frustum(0.14, 0.14, 1.3, 1200, { rings: 4, lines: 6, cap0: true, cap1: true })), Z(disc(0.05, 0.46, 900, 0)), ellipsoid(0.12, 0.12, 0.12, 220).move(0.3, 0, 0.12));
  parts.push(P('Crankshaft', 'Turns the up-and-down piston motion into rotation for the propeller.', '#ffffff', [I(crank, [0, 0, -1.0])]));

  // Reduction gear / prop hub
  const hub = merge(Z(disc(0.18, 0.98, 1700, 0)), Z(torus(0.98, 0.05, 520)), Z(frustum(0.18, 0.22, 0.4, 500, { rings: 2, lines: 8 })).move(0, 0, -0.2)).move(0, 0, -0.6);
  parts.push(P('Propeller hub', 'Reduction gear cover. The propeller bolts onto this.', '#ff5a52', [I(hub, [0, 0, -2.5])]));

  // Exhaust ring
  const exh = merge(Z(torus(1.95, 0.09, 1500)));
  for (const d of dirs) exh.merge(along(rod([0, 0, 0], [0, 0.4, 0], 0.035, 90), d, 1.55));
  parts.push(P('Exhaust ring', 'Collects the hot exhaust from every cylinder into one outlet.', '#ffa53a', [I(exh.move(0, 0, 0.15), [0, 0, 1.8])]));

  // Supercharger
  const sc = merge(ellipsoid(0.58, 0.58, 0.34, 1900), lathe([[0.2, 0.3], [0.16, 0.8]], 400).rotate(PI / 2, 0, 0).move(0, 0, 0.1), ring(0.58, 0, 280).rotate(PI / 2, 0, 0)).move(0, 0, 0.8);
  parts.push(P('Supercharger', 'Pumps extra air into the engine for more power at altitude.', '#ff3d5a', [I(sc, [0, 0, 3.0])]));

  return parts;
}
