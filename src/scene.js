import * as THREE from 'three';
import { clamp, damp } from './utils.js';

const MAXP = 24; // max parts per model (must match the shader array size)
const CAM_Z = 9.5;
const FOV = 38;
const FIT = 2.7; // exploded radius in world units

const VERT = /* glsl */ `
attribute vec3 aDir;
attribute vec3 aColor;
attribute float aPart;
attribute vec3 aRand;
attribute float aSeed;
uniform float uExplode;
uniform float uTime;
uniform float uSize;
uniform float uPR;
uniform float uScatter;
uniform float uHi;
uniform float uSel;
uniform vec3 uOff[${MAXP}];
varying vec3 vColor;
varying float vA;
void main() {
  int idx = int(aPart + 0.5);
  vec3 p = position + aDir * uExplode + uOff[idx];
  p += 0.010 * vec3(sin(uTime * 1.3 + aSeed * 40.0), cos(uTime * 1.1 + aSeed * 31.0), sin(uTime * 0.9 + aSeed * 23.0));
  p += aRand * uScatter * 4.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float hi = abs(aPart - uHi) < 0.5 ? 1.0 : 0.0;
  float sel = abs(aPart - uSel) < 0.5 ? 1.0 : 0.0;
  float tw = 0.82 + 0.18 * sin(uTime * 2.0 + aSeed * 60.0);
  float boost = max(hi, sel);
  gl_PointSize = uSize * uPR * (0.8 + 0.5 * fract(aSeed * 7.13)) * (1.0 + 0.7 * boost) * (${CAM_Z.toFixed(1)} / -mv.z);
  vColor = mix(aColor * tw, vec3(1.0), 0.45 * boost);
  vA = (0.9 - 0.9 * uScatter) * (1.0 + 0.2 * boost);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
varying vec3 vColor;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vColor, a * vA);
}`;

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class HoloScene {
  constructor(canvas, models) {
    this.models = models;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.camera.position.set(0, 0, CAM_Z);
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.uniforms = {
      uExplode: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 2.7 },
      uPR: { value: 1 },
      uScatter: { value: 1 },
      uHi: { value: -1 },
      uSel: { value: -1 },
      uOff: { value: Array.from({ length: MAXP }, () => new THREE.Vector3()) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    // live state
    this.explode = 0;
    this.explodeTarget = 0.85;
    this.intensity = 1;
    this.rot = { x: 0, y: 0, z: 0 };
    this.vel = { x: 0, y: 0 };
    this.scale = 1;
    this.scaleTarget = 1;
    this.holdVel = false; // true while a hand / mouse is steering the rotation
    this.autoSpin = true;
    this.idle = 0; // seconds since last interaction
    this.scatterTarget = 0;
    this.pending = -1;
    this.index = -1;
    this.hover = -1;
    this.sel = -1;
    this.shift = 0;
    this.offT = Array.from({ length: MAXP }, () => new THREE.Vector3());
    this.cache = new Map();
    this.onModel = null;

    this.resize();
    addEventListener('resize', () => this.resize());
    this._load(0);
  }

  get partCount() {
    return this.parts.length;
  }
  get shownExplode() {
    return this.explode * this.intensity;
  }

  resize() {
    const W = innerWidth, H = innerHeight;
    this.W = W;
    this.H = H;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H, false);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this.uniforms.uPR.value = this.renderer.getPixelRatio();
    const unitsPerPx = (2 * Math.tan((FOV * Math.PI) / 360) * CAM_Z) / H;
    const panel = W > 900 ? 300 : 0;
    this.shift = (panel / 2) * unitsPerPx;
    this.unitsPerPx = unitsPerPx;
  }

  // ------------------------------------------------------------------ models
  _geometry(i) {
    if (this.cache.has(i)) return this.cache.get(i);
    const def = this.models[i];
    const parts = def.build();
    let total = 0;
    for (const p of parts) for (const inst of p.instances) total += inst.cloud.n;

    // centre on the middle of (assembled + exploded) bounds
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    const mn2 = [1e9, 1e9, 1e9], mx2 = [-1e9, -1e9, -1e9];
    for (const p of parts)
      for (const inst of p.instances) {
        const q = inst.cloud.p;
        for (let k = 0; k < q.length; k += 3)
          for (let a = 0; a < 3; a++) {
            const v = q[k + a];
            const w = v + inst.dir[a];
            if (v < mn[a]) mn[a] = v;
            if (v > mx[a]) mx[a] = v;
            if (w < mn2[a]) mn2[a] = w;
            if (w > mx2[a]) mx2[a] = w;
          }
      }
    const c = [0, 1, 2].map((a) => (mn[a] + mx[a] + mn2[a] + mx2[a]) / 4);

    const pos = new Float32Array(total * 3);
    const dir = new Float32Array(total * 3);
    const col = new Float32Array(total * 3);
    const part = new Float32Array(total);
    const rnd = new Float32Array(total * 3);
    const seed = new Float32Array(total);
    let maxR = 0;
    let k = 0;
    const meta = [];
    parts.forEach((p, pi) => {
      const rgb = hexRgb(p.color);
      const anchors = [];
      const samples = [];
      p.instances.forEach((inst) => {
        anchors.push({ a: [inst.anchor[0] - c[0], inst.anchor[1] - c[1], inst.anchor[2] - c[2]], d: inst.dir });
        const q = inst.cloud.p;
        const n = q.length / 3;
        for (let i = 0; i < n; i++, k++) {
          const x = q[i * 3] - c[0], y = q[i * 3 + 1] - c[1], z = q[i * 3 + 2] - c[2];
          pos.set([x, y, z], k * 3);
          dir.set(inst.dir, k * 3);
          const br = 0.78 + 0.32 * Math.random();
          col.set([rgb[0] * br, rgb[1] * br, rgb[2] * br], k * 3);
          part[k] = pi;
          const rr = Math.random(), tt = Math.random() * Math.PI * 2, uu = Math.random() * 2 - 1;
          const s = Math.sqrt(1 - uu * uu);
          rnd.set([s * Math.cos(tt) * rr, uu * rr, s * Math.sin(tt) * rr], k * 3);
          seed[k] = Math.random();
          maxR = Math.max(maxR, Math.hypot(x + inst.dir[0], y + inst.dir[1], z + inst.dir[2]));
          if (Math.random() < 160 / Math.max(160, n)) samples.push(x, y, z, inst.dir[0], inst.dir[1], inst.dir[2]);
        }
      });
      meta.push({ name: p.name, desc: p.desc, color: p.color, anchors, samples: new Float32Array(samples) });
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);
    const entry = { geo, meta, fit: FIT / Math.max(0.5, maxR), count: total };
    this.cache.set(i, entry);
    return entry;
  }

  _load(i) {
    const g = this._geometry(i);
    if (this.points) this.group.remove(this.points);
    this.points = new THREE.Points(g.geo, this.material);
    this.points.frustumCulled = false;
    this.group.add(this.points);
    this.parts = g.meta;
    this.fit = g.fit;
    this.count = g.count;
    this.index = i;
    this.hover = -1;
    this.sel = -1;
    this.uniforms.uHi.value = -1;
    this.uniforms.uSel.value = -1;
    this.releaseAll(true);
    const v = this.models[i].view;
    this.rot.x = v.x;
    this.rot.y = v.y;
    this.rot.z = v.z;
    this.vel.x = this.vel.y = 0;
    this.scatterTarget = 0;
    if (this.onModel) this.onModel(i, this.models[i], g);
  }

  setModel(i) {
    const n = this.models.length;
    i = ((i % n) + n) % n;
    if (i === this.index && this.pending < 0) return;
    this.pending = i;
    this.scatterTarget = 1;
  }
  next(d = 1) {
    this.setModel((this.pending >= 0 ? this.pending : this.index) + d);
  }

  // ------------------------------------------------------------------ interaction API
  setHover(i) {
    this.hover = i;
    this.uniforms.uHi.value = i;
  }
  setSel(i) {
    this.sel = i;
    this.uniforms.uSel.value = i;
  }
  rotateBy(dyaw, dpitch, dt = 1 / 60) {
    this.rot.y += dyaw;
    this.rot.x = clamp(this.rot.x + dpitch, -1.4, 1.4);
    this.vel.y += (dyaw / Math.max(dt, 0.008) - this.vel.y) * 0.3;
    this.vel.x += (dpitch / Math.max(dt, 0.008) - this.vel.x) * 0.3;
    this.idle = 0;
  }
  rollBy(d) {
    this.rot.z = clamp(this.rot.z + d, -1.2, 1.2);
    this.idle = 0;
  }
  zoomBy(f) {
    this.scaleTarget = clamp(this.scaleTarget * f, 0.5, 2.6);
  }
  resetView() {
    const v = this.models[this.index].view;
    this.rot.x = v.x;
    this.rot.y = v.y;
    this.rot.z = v.z;
    this.vel.x = this.vel.y = 0;
    this.scaleTarget = 1;
    this.releaseAll();
    this.setSel(-1);
  }
  /** move a part by a screen-space pixel delta */
  dragPart(i, dx, dy) {
    if (i < 0 || i >= this.parts.length) return;
    const v = new THREE.Vector3(dx * this.unitsPerPx, -dy * this.unitsPerPx, 0);
    v.applyQuaternion(this.group.quaternion.clone().invert()).divideScalar(Math.max(1e-4, this.group.scale.x));
    this.offT[i].add(v);
    this.idle = 0;
  }
  releaseAll(snap = false) {
    for (let i = 0; i < MAXP; i++) {
      this.offT[i].set(0, 0, 0);
      if (snap) this.uniforms.uOff.value[i].set(0, 0, 0);
    }
  }

  // ------------------------------------------------------------------ projection
  _toScreen(local, out) {
    out.set(local[0], local[1], local[2]).applyMatrix4(this.group.matrixWorld).project(this.camera);
    return { x: (out.x * 0.5 + 0.5) * this.W, y: (-out.y * 0.5 + 0.5) * this.H, z: out.z };
  }

  /** Nearest part to a screen point (px). Returns part index or -1. */
  pick(px, py, maxDist = 100) {
    const e = this.shownExplode;
    const v = new THREE.Vector3();
    let best = -1;
    let bd = maxDist;
    this.group.updateMatrixWorld(true);
    this.parts.forEach((p, i) => {
      const s = p.samples;
      const off = this.uniforms.uOff.value[i];
      for (let k = 0; k < s.length; k += 6) {
        const sp = this._toScreen([s[k] + s[k + 3] * e + off.x, s[k + 1] + s[k + 4] * e + off.y, s[k + 2] + s[k + 5] * e + off.z], v);
        const d = Math.hypot(sp.x - px, sp.y - py);
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    });
    return best;
  }

  /** Screen position of each part's label anchor. */
  labelPoints() {
    const e = this.shownExplode;
    const v = new THREE.Vector3();
    this.group.updateMatrixWorld(true);
    return this.parts.map((p, i) => {
      const { a, d } = p.anchors[0];
      const off = this.uniforms.uOff.value[i];
      const s = this._toScreen([a[0] + d[0] * e + off.x, a[1] + d[1] * e + off.y, a[2] + d[2] * e + off.z], v);
      return { i, x: s.x, y: s.y, name: p.name, color: p.color };
    });
  }
  centerScreen() {
    const v = new THREE.Vector3();
    this.group.updateMatrixWorld(true);
    return this._toScreen([0, 0, 0], v);
  }

  // ------------------------------------------------------------------ frame
  update(dt, t) {
    this.idle += dt;
    this.explode = damp(this.explode, this.explodeTarget, 5, dt);
    this.scale = damp(this.scale, this.scaleTarget, 6, dt);

    // scatter transition between models
    this.uniforms.uScatter.value = damp(this.uniforms.uScatter.value, this.scatterTarget, this.scatterTarget ? 7 : 3.2, dt);
    if (this.pending >= 0 && this.uniforms.uScatter.value > 0.97) {
      const i = this.pending;
      this.pending = -1;
      this._load(i);
      this.scatterTarget = 0;
      this.uniforms.uScatter.value = 1;
    }

    if (!this.holdVel) {
      this.rot.y += this.vel.y * dt;
      this.rot.x = clamp(this.rot.x + this.vel.x * dt, -1.4, 1.4);
      const k = Math.exp(-2.6 * dt);
      this.vel.x *= k;
      this.vel.y *= k;
      if (this.autoSpin && this.idle > 2.0 && Math.hypot(this.vel.x, this.vel.y) < 0.05) this.rot.y += 0.14 * dt;
    }

    const off = this.uniforms.uOff.value;
    for (let i = 0; i < MAXP; i++) {
      const grabbed = this.offT[i].lengthSq() > 1e-6;
      off[i].lerp(this.offT[i], 1 - Math.exp(-(grabbed ? 16 : 4) * dt));
    }

    this.uniforms.uExplode.value = this.explode * this.intensity;
    this.uniforms.uTime.value = t;
    this.group.rotation.set(this.rot.x, this.rot.y, this.rot.z, 'YXZ');
    this.group.scale.setScalar(this.fit * this.scale);
    this.group.position.x = this.shift;
    this.group.updateMatrixWorld(true);
    this.renderer.render(this.scene, this.camera);
  }
}
