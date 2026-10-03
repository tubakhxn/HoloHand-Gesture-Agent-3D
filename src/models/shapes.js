// Point-cloud primitives. Every shape is built around the origin, axis = +Y unless noted.
import * as THREE from 'three';
import { rng } from '../utils.js';

const rnd = rng(20260111);
export const TAU = Math.PI * 2;
export const R = (a, b) => a + (b - a) * rnd();
export const rand = rnd;

export class Cloud {
  constructor() {
    this.p = [];
  }
  get n() {
    return this.p.length / 3;
  }
  add(x, y, z) {
    this.p.push(x, y, z);
    return this;
  }
  merge(...cs) {
    for (const c of cs) {
      const q = c.p;
      for (let i = 0; i < q.length; i++) this.p.push(q[i]);
    }
    return this;
  }
  move(x, y = 0, z = 0) {
    const p = this.p;
    for (let i = 0; i < p.length; i += 3) {
      p[i] += x;
      p[i + 1] += y;
      p[i + 2] += z;
    }
    return this;
  }
  scale(sx, sy = sx, sz = sx) {
    const p = this.p;
    for (let i = 0; i < p.length; i += 3) {
      p[i] *= sx;
      p[i + 1] *= sy;
      p[i + 2] *= sz;
    }
    return this;
  }
  rotate(ex, ey = 0, ez = 0) {
    const e = new THREE.Euler(ex, ey, ez);
    const v = new THREE.Vector3();
    const p = this.p;
    for (let i = 0; i < p.length; i += 3) {
      v.set(p[i], p[i + 1], p[i + 2]).applyEuler(e);
      p[i] = v.x;
      p[i + 1] = v.y;
      p[i + 2] = v.z;
    }
    return this;
  }
  /** rotate so that +Y points along dir */
  align(dir) {
    const d = new THREE.Vector3(...dir).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    const v = new THREE.Vector3();
    const p = this.p;
    for (let i = 0; i < p.length; i += 3) {
      v.set(p[i], p[i + 1], p[i + 2]).applyQuaternion(q);
      p[i] = v.x;
      p[i + 1] = v.y;
      p[i + 2] = v.z;
    }
    return this;
  }
  centroid() {
    const p = this.p;
    const n = Math.max(1, p.length / 3);
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < p.length; i += 3) {
      x += p[i];
      y += p[i + 1];
      z += p[i + 2];
    }
    return [x / n, y / n, z / n];
  }
}

export const merge = (...cs) => new Cloud().merge(...cs);

/** Part = one labelled component. Instance = one separately-exploding body of it. */
export const P = (name, desc, color, instances) => ({ name, desc, color, instances });
export const I = (cloud, dir = [0, 0, 0], anchor) => ({ cloud, dir, anchor: anchor || cloud.centroid() });

// ---------------------------------------------------------------- primitives
/** Cone / cylinder shell with optional ring + line wireframe emphasis and angular range. */
export function frustum(r0, r1, h, n, o = {}) {
  const { a0 = 0, a1 = TAU, rings = 0, lines = 0, cap0 = false, cap1 = false } = o;
  const c = new Cloud();
  const span = a1 - a0;
  const full = span >= TAU - 1e-6;
  const rAt = (t) => r0 + (r1 - r0) * t;
  const y0 = -h / 2;
  const nGrid = rings || lines ? Math.floor(n * 0.45) : 0;
  const nCap = (cap0 ? 1 : 0) + (cap1 ? 1 : 0);
  const nCapPts = nCap ? Math.floor(n * 0.08) : 0;
  const nRand = n - nGrid - nCapPts * nCap;
  for (let i = 0; i < nRand; i++) {
    const t = rnd();
    const a = a0 + span * rnd();
    const r = rAt(t);
    c.add(r * Math.cos(a), y0 + h * t, r * Math.sin(a));
  }
  if (rings) {
    const per = Math.floor((nGrid * (lines ? 0.5 : 1)) / rings);
    for (let k = 0; k < rings; k++) {
      const t = rings > 1 ? k / (rings - 1) : 0.5;
      const r = rAt(t);
      for (let j = 0; j < per; j++) {
        const a = a0 + span * rnd();
        c.add(r * Math.cos(a), y0 + h * t, r * Math.sin(a));
      }
    }
  }
  if (lines) {
    const per = Math.floor((nGrid * (rings ? 0.5 : 1)) / lines);
    for (let k = 0; k < lines; k++) {
      const f = full ? k / lines : lines > 1 ? k / (lines - 1) : 0.5;
      const a = a0 + span * f;
      for (let j = 0; j < per; j++) {
        const t = rnd();
        const r = rAt(t);
        c.add(r * Math.cos(a), y0 + h * t, r * Math.sin(a));
      }
    }
  }
  const capDisc = (r, y) => {
    for (let i = 0; i < nCapPts; i++) {
      const rr = r * Math.sqrt(rnd());
      const a = a0 + span * rnd();
      c.add(rr * Math.cos(a), y, rr * Math.sin(a));
    }
  };
  if (cap0) capDisc(r0, y0);
  if (cap1) capDisc(r1, y0 + h);
  return c;
}

export function disc(r0, r1, n, y = 0) {
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const r = Math.sqrt(R(r0 * r0, r1 * r1));
    const a = rnd() * TAU;
    c.add(r * Math.cos(a), y, r * Math.sin(a));
  }
  return c;
}

export function ring(r, y, n) {
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU;
    c.add(r * Math.cos(a), y, r * Math.sin(a));
  }
  return c;
}

export function torus(Rr, r, n, o = {}) {
  const { a0 = 0, a1 = TAU } = o;
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const u = a0 + (a1 - a0) * rnd();
    const v = rnd() * TAU;
    const rr = Rr + r * Math.cos(v);
    c.add(rr * Math.cos(u), r * Math.sin(v), rr * Math.sin(u));
  }
  return c;
}

export function unitVec() {
  for (;;) {
    const x = R(-1, 1), y = R(-1, 1), z = R(-1, 1);
    const l = x * x + y * y + z * z;
    if (l > 1 || l < 1e-4) continue;
    const s = Math.sqrt(l);
    return [x / s, y / s, z / s];
  }
}

export function ellipsoid(rx, ry, rz, n) {
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    const [x, y, z] = unitVec();
    c.add(x * rx, y * ry, z * rz);
  }
  return c;
}

/** Box shell with extra points along the 12 edges for a wireframe feel. */
export function box(w, h, d, n, o = {}) {
  const { edges = 0.25, noBottom = false } = o;
  const c = new Cloud();
  const faces = [
    [w * h, () => [R(-w / 2, w / 2), R(-h / 2, h / 2), d / 2]],
    [w * h, () => [R(-w / 2, w / 2), R(-h / 2, h / 2), -d / 2]],
    [w * d, () => [R(-w / 2, w / 2), h / 2, R(-d / 2, d / 2)]],
    [noBottom ? 0 : w * d, () => [R(-w / 2, w / 2), -h / 2, R(-d / 2, d / 2)]],
    [h * d, () => [w / 2, R(-h / 2, h / 2), R(-d / 2, d / 2)]],
    [h * d, () => [-w / 2, R(-h / 2, h / 2), R(-d / 2, d / 2)]],
  ];
  const tot = faces.reduce((s, f) => s + f[0], 0);
  const nFace = Math.floor(n * (1 - edges));
  for (let i = 0; i < nFace; i++) {
    let pick = rnd() * tot;
    let f = faces[0];
    for (const q of faces) {
      if (pick < q[0]) { f = q; break; }
      pick -= q[0];
    }
    const p = f[1]();
    c.add(p[0], p[1], p[2]);
  }
  const dims = [w, h, d];
  for (let i = nFace; i < n; i++) {
    const ax = Math.floor(rnd() * 3);
    const p = [0, 0, 0];
    for (let k = 0; k < 3; k++) p[k] = k === ax ? R(-dims[k] / 2, dims[k] / 2) : (rnd() < 0.5 ? -1 : 1) * dims[k] / 2;
    if (noBottom && p[1] < 0) p[1] = h / 2;
    c.add(p[0], p[1], p[2]);
  }
  return c;
}

/** Twisted fan / turbine blades in the XZ plane around +Y. */
export function blades(count, rIn, rOut, chord, n, o = {}) {
  const { pitch = 0.6, twist = 0.5, y = 0 } = o;
  const c = new Cloud();
  const per = Math.floor(n / count);
  for (let k = 0; k < count; k++) {
    const th = (k / count) * TAU;
    const cs = Math.cos(th), sn = Math.sin(th);
    for (let j = 0; j < per; j++) {
      const u = rnd();
      const v = rnd() - 0.5;
      const pp = pitch + twist * (u - 0.5);
      const rad = rIn + u * (rOut - rIn);
      const tang = v * chord * Math.cos(pp);
      const yy = v * chord * Math.sin(pp);
      c.add(cs * rad - sn * tang, y + yy, sn * rad + cs * tang);
    }
  }
  return c;
}

/** Surface of revolution from [[radius, y], ...] */
export function lathe(profile, n, o = {}) {
  const { a0 = 0, a1 = TAU } = o;
  const segs = [];
  let tot = 0;
  for (let i = 0; i < profile.length - 1; i++) {
    const [ra, ya] = profile[i];
    const [rb, yb] = profile[i + 1];
    const a = Math.hypot(rb - ra, yb - ya) * ((ra + rb) / 2 + 0.02);
    segs.push(a);
    tot += a;
  }
  const c = new Cloud();
  for (let i = 0; i < n; i++) {
    let pick = rnd() * tot;
    let s = 0;
    while (s < segs.length - 1 && pick > segs[s]) { pick -= segs[s]; s++; }
    const [ra, ya] = profile[s];
    const [rb, yb] = profile[s + 1];
    const t = rnd();
    const r = ra + (rb - ra) * t;
    const a = a0 + (a1 - a0) * rnd();
    c.add(r * Math.cos(a), ya + (yb - ya) * t, r * Math.sin(a));
  }
  return c;
}

/** Thin cylinder between two points. */
export function rod(a, b, r, n = 200, o = {}) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const L = A.distanceTo(B);
  const c = frustum(r, r, L, n, { cap0: o.caps, cap1: o.caps });
  c.align(B.clone().sub(A));
  const m = A.clone().add(B).multiplyScalar(0.5);
  return c.move(m.x, m.y, m.z);
}

/** Tube following a Catmull-Rom path. */
export function tube(pts, r, n, o = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), !!o.closed);
  const c = new Cloud();
  const up = new THREE.Vector3(0, 1, 0);
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const t = rnd();
    const Pp = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    N.crossVectors(T, up);
    if (N.lengthSq() < 1e-4) N.set(1, 0, 0).cross(T);
    N.normalize();
    B.crossVectors(T, N);
    const a = rnd() * TAU;
    const rr = r * (o.taper ? o.taper(t) : 1);
    c.add(
      Pp.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rr,
      Pp.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rr,
      Pp.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rr,
    );
  }
  return c;
}
