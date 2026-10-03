import * as THREE from 'three';
import { glowMat, damp, angleDelta, clamp } from '../utils.js';

/** Simulated humanoid robot (faces +Z). Not connected to any hardware. */
export function buildRobot() {
  const group = new THREE.Group();
  const walker = new THREE.Group(); // heading while walking
  group.add(walker);

  const metal = new THREE.MeshStandardMaterial({ color: 0xaab6c4, metalness: 0.9, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x141a25, metalness: 0.7, roughness: 0.4 });
  const eye = glowMat(0x35e6ff, 2.6);
  const core = glowMat(0x35e6ff, 2.4);
  const cast = (m) => { m.castShadow = true; return m; };

  // pelvis + legs
  const pelvis = cast(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.26, 0.4), dark));
  pelvis.position.y = 1.12;
  walker.add(pelvis);
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.26, 1.08, 0);
    const leg = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.7, 6, 14), metal));
    leg.position.y = -0.5;
    const knee = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 12), dark);
    knee.position.set(0, -0.5, 0.08);
    const foot = cast(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.46), dark));
    foot.position.set(0, -1.02, 0.08);
    pivot.add(leg, knee, foot);
    walker.add(pivot);
    legs.push(pivot);
  }

  // upper body
  const upper = new THREE.Group();
  upper.position.y = 1.25;
  walker.add(upper);
  const torso = cast(new THREE.Mesh(new THREE.BoxGeometry(0.98, 1.0, 0.56), metal));
  torso.position.y = 0.55;
  upper.add(torso);
  const chestCore = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), core);
  chestCore.position.set(0, 0.7, 0.285);
  upper.add(chestCore);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.015, 8, 32), dark);
  ring.position.set(0, 0.7, 0.285);
  upper.add(ring);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.58), dark);
  belt.position.y = 0.1;
  upper.add(belt);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.16, 12), dark);
  neck.position.y = 1.08;
  upper.add(neck);

  const head = new THREE.Group();
  head.position.y = 1.43;
  upper.add(head);
  const skull = cast(new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.46, 0.52), metal));
  head.add(skull);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.13, 0.04), eye);
  visor.position.set(0, 0.03, 0.27);
  head.add(visor);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), dark);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(s * 0.34, 0, 0);
    head.add(ear);
  }
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25, 6), dark);
  ant.position.y = 0.34;
  const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), core);
  antTip.position.y = 0.48;
  head.add(ant, antTip);

  // arms
  const makeArm = (s) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.64, 0.98, 0);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), dark);
    const up = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.45, 6, 12), metal));
    up.position.y = -0.37;
    const elbow = new THREE.Group();
    elbow.position.y = -0.72;
    const fore = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.4, 6, 12), metal));
    fore.position.y = -0.3;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 14), core);
    hand.position.y = -0.64;
    elbow.add(fore, hand);
    shoulder.add(ball, up, elbow);
    upper.add(shoulder);
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  let phase = 0, gait = 0, walkAmt = 0, wave = 0, gesture = 'NONE', armR_z = 0.08;

  return {
    id: 'ROBOT', title: 'ROBOT', group,
    size: new THREE.Vector3(1.9, 3.1, 1.1), centerY: 1.55, radius: 1.5, lerpK: 2.6,
    update(t, dt, ctx) {
      const frozen = ctx.frozen;
      phase += dt;
      wave = Math.max(0, wave - dt);
      // eyes: red when frozen
      eye.color.setHex(frozen ? 0xff4d5e : 0x35e6ff).multiplyScalar(2.6);
      core.color.setHex(frozen ? 0xff4d5e : 0x35e6ff).multiplyScalar(2.4);

      // walking
      const walking = clamp(ctx.speed / 1.1, 0, 1);
      walkAmt = damp(walkAmt, walking, 8, Math.max(dt, 0.0001));
      gait += dt * (3 + ctx.speed * 3.5);
      legs[0].rotation.x = Math.sin(gait) * 0.65 * walkAmt;
      legs[1].rotation.x = -Math.sin(gait) * 0.65 * walkAmt;
      armL.shoulder.rotation.x = -Math.sin(gait) * 0.5 * walkAmt;
      armL.shoulder.rotation.z = -0.1;

      // face movement direction
      if (ctx.speed > 0.2 && dt > 0) {
        const want = Math.atan2(ctx.vel.x, ctx.vel.z) - group.rotation.y;
        walker.rotation.y += angleDelta(walker.rotation.y, want) * Math.min(1, 7 * dt);
      }

      // upper body turns toward the pointer while POINTing
      let upperYaw = 0;
      if (gesture === 'POINT' && ctx.pointerWorld && !frozen) {
        const dx = ctx.pointerWorld.x - ctx.pos.x;
        const dz = ctx.pointerWorld.z - ctx.pos.z;
        const want = Math.atan2(dx, dz) - group.rotation.y - walker.rotation.y;
        upperYaw = clamp(angleDelta(0, want), -1.9, 1.9);
      }
      if (dt > 0) upper.rotation.y = damp(upper.rotation.y, upperYaw, 7, dt);

      // raise hand on OPEN_PALM / activate
      const raise = (gesture === 'OPEN_PALM' || wave > 0) && !frozen;
      const target = raise ? 2.85 : 0.08;
      if (dt > 0) armR_z = damp(armR_z, target, 9, dt);
      armR.shoulder.rotation.z = armR_z;
      armR.elbow.rotation.z = raise ? Math.sin(phase * 8) * 0.35 : 0;
      armR.shoulder.rotation.x = raise ? 0 : Math.sin(gait) * 0.5 * walkAmt;

      // idle breathing
      upper.position.y = 1.25 + Math.sin(phase * 1.8) * 0.012;
      head.rotation.z = Math.sin(phase * 0.9) * 0.02;
      antTip.scale.setScalar(1 + Math.sin(phase * 5) * 0.25);
    },
    activate() { wave = 2.6; },
    setGesture(g) { gesture = g; },
  };
}
