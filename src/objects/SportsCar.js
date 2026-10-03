import * as THREE from 'three';
import { glowMat, glowTexture } from '../utils.js';

const PAINTS = [0x0a5c8a, 0xff7a1a, 0xe8eef5, 0x9b1030, 0x16161d];

/** Procedural futuristic sports car (faces +X). */
export function buildCar() {
  const group = new THREE.Group();
  const car = new THREE.Group();
  group.add(car);

  const paint = new THREE.MeshPhysicalMaterial({
    color: PAINTS[0], metalness: 0.85, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04,
  });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x03070d, metalness: 1, roughness: 0.04, clearcoat: 1 });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x0b0d12, metalness: 0.6, roughness: 0.42 });
  const cyan = glowMat(0x35e6ff, 2.4);
  const head = glowMat(0xeaf8ff, 3);
  const tail = glowMat(0xff2a3a, 3);
  const headBase = head.color.clone();

  // ---- lower body (side profile extruded across the width) ----
  const prof = new THREE.Shape();
  prof.moveTo(-2.2, 0.28);
  prof.lineTo(2.0, 0.28);
  prof.quadraticCurveTo(2.3, 0.3, 2.3, 0.52);
  prof.quadraticCurveTo(2.3, 0.67, 2.05, 0.71);
  prof.lineTo(1.0, 0.83);
  prof.lineTo(0.4, 0.93);
  prof.lineTo(-0.9, 0.96);
  prof.lineTo(-1.9, 0.96);
  prof.quadraticCurveTo(-2.26, 0.92, -2.29, 0.6);
  prof.lineTo(-2.2, 0.28);
  const bodyGeo = new THREE.ExtrudeGeometry(prof, {
    depth: 1.7, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.14, bevelSegments: 5, curveSegments: 18,
  });
  bodyGeo.translate(0, 0, -0.85);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  car.add(body);

  // ---- cabin ----
  const cab = new THREE.Shape();
  cab.moveTo(0.78, 0.9);
  cab.quadraticCurveTo(0.2, 1.0, -0.15, 1.28);
  cab.lineTo(-0.95, 1.3);
  cab.quadraticCurveTo(-1.5, 1.2, -1.78, 0.9);
  cab.lineTo(0.78, 0.9);
  const cabGeo = new THREE.ExtrudeGeometry(cab, {
    depth: 1.15, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.12, bevelSegments: 4, curveSegments: 18,
  });
  cabGeo.translate(0, 0, -0.575);
  const cabin = new THREE.Mesh(cabGeo, glass);
  cabin.castShadow = true;
  car.add(cabin);

  // roof stripe + side light strips
  const roof = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.02, 0.5), carbon);
  roof.position.set(-0.55, 1.425, 0);
  car.add(roof);
  for (const s of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.03, 0.02), cyan);
    strip.position.set(-0.05, 0.4, s * 1.0);
    car.add(strip);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.14), paint);
    mirror.position.set(0.62, 1.0, s * 0.98);
    car.add(mirror);
  }

  // ---- aero ----
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 2.0), carbon);
  splitter.position.set(2.2, 0.26, 0);
  car.add(splitter);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 1.9), carbon);
  wing.position.set(-2.15, 1.22, 0);
  wing.rotation.z = 0.08;
  car.add(wing);
  for (const s of [-0.55, 0.55]) {
    const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.3, 0.06), carbon);
    pylon.position.set(-2.1, 1.05, s);
    car.add(pylon);
  }
  for (const s of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.025), cyan);
    plate.position.set(-2.15, 1.2, s * 0.96);
    car.add(plate);
  }

  // ---- lights ----
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.5), head);
    hl.position.set(2.2, 0.64, s * 0.62);
    hl.rotation.y = s * 0.12;
    car.add(hl);
    const drl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.4), cyan);
    drl.position.set(2.22, 0.57, s * 0.62);
    car.add(drl);
  }
  const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 1.5), tail);
  tl.position.set(-2.33, 0.74, 0);
  car.add(tl);

  // headlight beam (faint volumetric cone)
  const coneH = 6;
  const coneGeo = new THREE.ConeGeometry(1.4, coneH, 32, 1, true);
  coneGeo.translate(0, -coneH / 2, 0);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0x9fe8ff, transparent: true, opacity: 0.045, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    })
  );
  cone.rotation.z = Math.PI / 2;
  cone.position.set(2.3, 0.62, 0);
  car.add(cone);

  // ---- wheels ----
  const wheels = [];
  const tire = new THREE.MeshStandardMaterial({ color: 0x08090c, roughness: 0.85, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd8e3, metalness: 1, roughness: 0.2 });
  const makeWheel = (x, z) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.4, z);
    const side = Math.sign(z);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.34, 36), tire);
    tr.rotation.x = Math.PI / 2;
    tr.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.35, 28), rimMat);
    rim.rotation.x = Math.PI / 2;
    const spinner = new THREE.Group(); // rotates about Z (wheel axle)
    for (let k = 0; k < 5; k++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.055, 0.04), rimMat);
      spoke.rotation.z = (k * Math.PI * 2) / 10;
      spinner.add(spoke);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), cyan);
    cap.rotation.x = Math.PI / 2;
    spinner.add(cap);
    spinner.position.z = side * 0.18;
    const disc = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.012, 8, 40), cyan);
    disc.position.z = side * 0.18;
    pivot.add(tr, rim, spinner, disc);
    car.add(pivot);
    wheels.push({ pivot, spinner });
  };
  makeWheel(1.4, 0.93); makeWheel(1.4, -0.93);
  makeWheel(-1.4, 0.93); makeWheel(-1.4, -0.93);

  // ---- underglow ----
  const glowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 3.6),
    new THREE.MeshBasicMaterial({
      map: glowTexture(128, '53,230,255'), transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    })
  );
  glowPlane.rotation.x = -Math.PI / 2;
  glowPlane.position.y = 0.025;
  car.add(glowPlane);
  const under = new THREE.PointLight(0x35e6ff, 6, 6, 2);
  under.position.set(0, 0.25, 0);
  car.add(under);

  let spin = 0, rev = 0, flash = 0, paintIdx = 0, phase = 0;

  return {
    id: 'SPORTS_CAR', title: 'SPORTS CAR', group,
    size: new THREE.Vector3(4.7, 1.45, 2.1), centerY: 0.72, radius: 2.9, lerpK: 9,
    update(t, dt, ctx) {
      phase += dt;
      const yaw = group.rotation.y;
      const signed = ctx.vel.x * Math.cos(yaw) - ctx.vel.z * Math.sin(yaw);
      spin -= (signed / 0.4) * dt + rev * dt;
      rev *= Math.exp(-2.4 * dt);
      for (const w of wheels) w.spinner.rotation.z = spin;
      flash = Math.max(0, flash - dt * 1.4);
      head.color.copy(headBase).multiplyScalar(1 + flash * 1.8);
      cone.material.opacity = 0.045 + flash * 0.12;
      under.intensity = 6 + Math.sin(phase * 2) * 1.2 + flash * 10 + (ctx.grabbed ? 6 : 0);
      car.position.y = Math.sin(phase * 1.7) * 0.008;
      car.rotation.z = THREE.MathUtils.clamp(-signed * 0.01, -0.05, 0.05);
    },
    activate() {
      paintIdx = (paintIdx + 1) % PAINTS.length;
      paint.color.setHex(PAINTS[paintIdx]);
      flash = 1;
      rev = 26;
    },
    setGesture() {},
  };
}
