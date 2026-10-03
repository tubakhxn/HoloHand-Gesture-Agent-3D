import * as THREE from 'three';
import { glowMat, labelSprite, rng } from '../utils.js';

/** Floating holographic data landscape (animated bar field + orbiting labels). */
export function buildData() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.05;
  group.add(body);

  const N = 15, SP = 0.36, R = 7.4;
  const cells = [];
  for (let x = 0; x < N; x++)
    for (let z = 0; z < N; z++) {
      const dx = x - (N - 1) / 2, dz = z - (N - 1) / 2;
      if (Math.hypot(dx, dz) <= R) cells.push({ x: dx * SP, z: dz * SP, d: Math.hypot(dx, dz) * SP, seed: (x * 7 + z * 13) % 11 });
    }

  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.5, roughness: 0.35 });
  const capMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMat, cells.length);
  const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), capMat, cells.length);
  bars.castShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
  const c1 = new THREE.Color(0x0a5c8a), c2 = new THREE.Color(0x35e6ff), c3 = new THREE.Color(0xffb347), col = new THREE.Color();
  body.add(bars, caps);
  // instanceColor must exist before first render
  cells.forEach((_, i) => { bars.setColorAt(i, c1); caps.setColorAt(i, c2); });

  // rings + orbiting labels
  const ringMat = glowMat(0x35e6ff, 1.6);
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.012, 8, 128), ringMat);
  ring1.rotation.x = Math.PI / 2; ring1.position.y = 0.05;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.01, 8, 128, Math.PI * 1.6), ringMat);
  ring2.rotation.x = Math.PI / 2; ring2.position.y = 2.7;
  body.add(ring1, ring2);

  const rand = rng(21);
  const labels = [];
  const names = ['REV', 'USERS', 'LATENCY', 'GROWTH', 'ACCURACY', 'THROUGHPUT'];
  const fmt = () => `${(rand() * 98 + 1).toFixed(1)}${rand() > 0.5 ? '%' : 'k'}`;
  names.forEach((n, i) => {
    const l = labelSprite(`${n} ${fmt()}`);
    l.name = n; l.a = (i / names.length) * Math.PI * 2;
    body.add(l.sprite);
    labels.push(l);
  });

  let phase = 0, ripple = -1, seed = 0;

  return {
    id: 'DATA_OBJECT', title: 'DATA OBJECT', group,
    size: new THREE.Vector3(5.2, 2.8, 5.2), centerY: 1.4, radius: 3.1, lerpK: 8,
    update(t, dt, ctx) {
      phase += dt;
      if (ripple >= 0) { ripple += dt * 4.5; if (ripple > 6) ripple = -1; }
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        let h = 0.15 + (Math.sin(c.x * 1.5 + phase * 1.2 + seed) * 0.5 + 0.5) * (Math.cos(c.z * 1.4 - phase * 0.9 + c.seed * 0.2) * 0.5 + 0.5) * 2.1;
        if (ripple >= 0) { const d = c.d - ripple; h += Math.exp(-(d * d) / 0.5) * 1.1; }
        pv.set(c.x, h / 2, c.z); sv.set(SP * 0.76, h, SP * 0.76);
        m.compose(pv, q, sv); bars.setMatrixAt(i, m);
        pv.set(c.x, h + 0.02, c.z); sv.set(SP * 0.78, 0.035, SP * 0.78);
        m.compose(pv, q, sv); caps.setMatrixAt(i, m);
        const k = Math.min(1, h / 2.3);
        col.copy(c1).lerp(k < 0.7 ? c2 : c3, k < 0.7 ? k / 0.7 : (k - 0.7) / 0.3);
        bars.setColorAt(i, col);
        col.multiplyScalar(2.4);
        caps.setColorAt(i, col);
      }
      bars.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;
      bars.instanceColor.needsUpdate = caps.instanceColor.needsUpdate = true;
      ring1.rotation.z += dt * 0.3;
      ring2.rotation.z -= dt * 0.5;
      labels.forEach((l, i) => {
        const a = l.a + phase * 0.35;
        l.sprite.position.set(Math.cos(a) * 3.0, 1.6 + Math.sin(phase * 1.2 + i) * 0.25 + (i % 2) * 0.5, Math.sin(a) * 3.0);
      });
    },
    activate() {
      ripple = 0;
      seed = Math.random() * 10;
      labels.forEach((l) => l.set(`${l.name} ${fmt()}`));
    },
    setGesture() {},
  };
}
