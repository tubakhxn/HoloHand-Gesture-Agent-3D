import * as THREE from 'three';
import { glowTexture, rng } from '../utils.js';

/** Holographic neural brain with firing waves. */
export function buildBrain() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 1.65;
  group.add(body);

  // ---- brain surface (displaced icosphere with a central fissure) ----
  const geo = new THREE.IcosahedronGeometry(1, 10);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const fold = Math.sin(v.x * 9 + 1.2) * Math.sin(v.y * 8) * 0.5 + Math.sin(v.z * 10 + v.x * 4) * 0.5;
    let r = 1 + 0.055 * fold;
    const fis = Math.exp(-Math.pow(v.x / 0.07, 2));
    if (v.y > -0.2) r -= 0.14 * fis * Math.max(0, v.y + 0.2);
    let y = v.y * r * 0.88;
    if (y < -0.55) y = -0.55 + (y + 0.55) * 0.3;
    pos.setXYZ(i, v.x * r * 1.3, y, v.z * r * 1.1);
  }
  geo.computeVertexNormals();

  const solid = new THREE.Mesh(
    geo,
    new THREE.MeshPhysicalMaterial({
      color: 0x0a2a4a, emissive: 0x0a3a66, emissiveIntensity: 0.7, transparent: true, opacity: 0.5,
      roughness: 0.3, metalness: 0.2, clearcoat: 1,
    })
  );
  solid.castShadow = true;
  const wire = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: 0x35e6ff, wireframe: true, transparent: true, opacity: 0.14,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  wire.scale.setScalar(1.004);
  body.add(solid, wire);

  // brain stem
  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.12, 0.7, 16),
    new THREE.MeshStandardMaterial({ color: 0x0a2a4a, emissive: 0x0a3a66, emissiveIntensity: 0.6, metalness: 0.3, roughness: 0.4 })
  );
  stem.position.set(0.1, -0.85, -0.1);
  stem.rotation.z = 0.12;
  body.add(stem);

  // ---- neural nodes + connections ----
  const rand = rng(7);
  const NODES = 230;
  const nodes = [];
  while (nodes.length < NODES) {
    const k = Math.floor(rand() * pos.count);
    const p = new THREE.Vector3().fromBufferAttribute(pos, k).multiplyScalar(1.02);
    if (nodes.every((n) => n.distanceTo(p) > 0.17)) nodes.push(p);
  }
  const nodePos = new Float32Array(NODES * 3);
  const nodeCol = new Float32Array(NODES * 3);
  nodes.forEach((n, i) => n.toArray(nodePos, i * 3));
  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeCol, 3));
  const points = new THREE.Points(
    nodeGeo,
    new THREE.PointsMaterial({
      size: 0.11, map: glowTexture(64), vertexColors: true, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    })
  );
  body.add(points);

  const pairs = [];
  for (let i = 0; i < NODES; i++) {
    const near = [];
    for (let j = 0; j < NODES; j++) if (i !== j) near.push([nodes[i].distanceTo(nodes[j]), j]);
    near.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < 3; k++) if (near[k][0] < 0.55) pairs.push([i, near[k][1]]);
  }
  const linePos = new Float32Array(pairs.length * 6);
  const lineCol = new Float32Array(pairs.length * 6);
  pairs.forEach(([a, b], i) => {
    nodes[a].toArray(linePos, i * 6);
    nodes[b].toArray(linePos, i * 6 + 3);
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute('color', new THREE.BufferAttribute(lineCol, 3));
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  body.add(lines);

  // ---- hologram base ----
  const baseMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x35e6ff).multiplyScalar(1.6), toneMapped: false });
  const base1 = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.012, 8, 96), baseMat);
  base1.rotation.x = Math.PI / 2; base1.position.y = 0.06;
  const base2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.01, 8, 96, Math.PI * 1.5), baseMat);
  base2.rotation.x = Math.PI / 2; base2.position.y = 0.1;
  const orbit = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.008, 8, 128), baseMat);
  orbit.position.y = 1.65; orbit.rotation.x = Math.PI / 2.4;
  group.add(base1, base2, orbit);

  // ---- firing waves ----
  const waves = [];
  const fire = (idx, speed = 2.2) => waves.push({ o: nodes[idx], r: 0, speed });
  const dimC = new THREE.Color(0x0b6e8a), hotC = new THREE.Color(0xffd27a), midC = new THREE.Color(0x7df9ff);
  const tmp = new THREE.Color();
  const nodeI = new Float32Array(NODES);
  let timer = 0, phase = 0;

  return {
    id: 'NEURAL_BRAIN', title: 'NEURAL BRAIN', group,
    size: new THREE.Vector3(3.1, 2.2, 2.6), centerY: 1.6, radius: 2.0, lerpK: 8,
    update(t, dt, ctx) {
      phase += dt;
      timer -= dt;
      if (timer <= 0 && dt > 0) { fire(Math.floor(Math.random() * NODES), 1.6 + Math.random()); timer = 0.35; }
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].r += waves[i].speed * dt;
        if (waves[i].r > 4) waves.splice(i, 1);
      }
      for (let i = 0; i < NODES; i++) {
        let e = 0.18;
        for (const w of waves) {
          const d = nodes[i].distanceTo(w.o) - w.r;
          e += Math.exp(-(d * d) / 0.07);
        }
        nodeI[i] = Math.min(e, 1.6);
        if (e < 0.6) tmp.copy(dimC).lerp(midC, e / 0.6);
        else tmp.copy(midC).lerp(hotC, Math.min(1, (e - 0.6) / 0.8));
        tmp.multiplyScalar(0.55 + nodeI[i] * 1.3);
        nodeCol[i * 3] = tmp.r; nodeCol[i * 3 + 1] = tmp.g; nodeCol[i * 3 + 2] = tmp.b;
      }
      nodeGeo.attributes.color.needsUpdate = true;
      for (let k = 0; k < pairs.length; k++) {
        const a = pairs[k][0], b = pairs[k][1];
        const e = Math.max(nodeI[a], nodeI[b]) * 0.5;
        lineCol[k * 6] = lineCol[k * 6 + 3] = 0.05 + e * 0.5;
        lineCol[k * 6 + 1] = lineCol[k * 6 + 4] = 0.35 * e + 0.2;
        lineCol[k * 6 + 2] = lineCol[k * 6 + 5] = 0.45 * e + 0.3;
      }
      lineGeo.attributes.color.needsUpdate = true;

      body.rotation.y += dt * (ctx.grabbed ? 0.1 : 0.2);
      body.position.y = 1.65 + Math.sin(phase * 1.3) * 0.06;
      base2.rotation.z += dt * 0.8;
      orbit.rotation.z += dt * 0.3;
    },
    activate() {
      for (let i = 0; i < 4; i++) fire(Math.floor(Math.random() * NODES), 3.2);
    },
    setGesture() {},
  };
}
