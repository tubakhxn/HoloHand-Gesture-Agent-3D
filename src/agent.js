// Deterministic local "agent": PERCEPTION -> INTENT -> ACTION -> STATUS.
// Swap `decide()` for an LLM / planner call later – the world API stays the same.
//
// World API used here:
//   setPointer(p|null, gesture, pinch), grab(), dragTo(), release(), rotateBy(rad),
//   activate(), select(bool), setPaused(bool), cycleMode(dir) -> name, current.id
const DEAD_ZONE = 0.0025;

export class Agent {
  constructor(world, onEvent) {
    this.world = world;
    this.onEvent = onEvent;
    this.grabbed = false;
    this.lastPtr = null;
    this.lastMoveT = -9;
    this.lastActivate = -9;
    this.lostAt = -1;
    this.prev = { handed: false, gesture: 'NONE', intent: '', action: '', status: '', object: '' };
    this.out = {
      perception: 'NO HAND', intent: 'AWAIT_HAND', action: 'IDLE', status: 'STANDBY',
      selected: 'NONE', gesture: 'NONE', stage: 0,
    };
  }

  log(kind, msg) { this.onEvent && this.onEvent(kind, msg); }

  step(p, t) {
    const w = this.world;
    const name = w.current.id;
    let intent = 'AWAIT_HAND', action = 'IDLE', status = 'STANDBY', perception = 'SEARCHING FOR HAND';
    let stage = 0; // 0 see, 1 understand, 2 decide, 3 act

    if (!p.handed) {
      if (this.grabbed) { w.release(); this.grabbed = false; }
      w.setPointer(null, 'NONE', 1);
      w.setPaused(false);
      if (this.lostAt < 0) this.lostAt = t;
      if (t - this.lostAt > 2.2 && w.selected) w.select(false);
      this.lastPtr = null;
    } else {
      this.lostAt = -1;
      perception = p.held ? 'HAND TRACKING (HOLD)' : 'HAND DETECTED';
      const g = p.gesture;
      w.setPointer(p.pointer, g, p.pinch);
      stage = 1;

      // movement bookkeeping (dead zone against jitter)
      if (this.lastPtr) {
        const mv = Math.hypot(p.pointer.x - this.lastPtr.x, p.pointer.y - this.lastPtr.y);
        if (mv > DEAD_ZONE) this.lastMoveT = t;
      }
      this.lastPtr = { ...p.pointer };

      if (g === 'FIST') {
        if (this.grabbed) { w.release(); this.grabbed = false; }
        w.setPaused(true);
        intent = 'HOLD_POSITION'; action = 'FREEZE_SYSTEM'; status = 'PAUSED'; stage = 3;
      } else {
        w.setPaused(false);

        if (p.swipe) {
          const nm = w.cycleMode(p.swipe === 'RIGHT' ? 1 : -1);
          this.log('ACTION', `SWIPE ${p.swipe} -> MODE ${nm}`);
          this.swipeFlash = t;
        }

        if (g === 'PINCH') {
          if (!this.grabbed) {
            w.grab(); w.select(true); this.grabbed = true;
            this.log('OBJECT', name);
            intent = 'SELECT_OBJECT'; action = 'GRAB'; this.grabT = t;
          } else {
            w.dragTo();
            const moving = t - this.lastMoveT < 0.3;
            intent = moving ? 'MOVE_OBJECT' : 'HOLD_OBJECT';
            action = moving ? `MOVE ${name}` : `HOLD ${name}`;
          }
          status = 'EXECUTING'; stage = 3;
        } else {
          if (this.grabbed) {
            w.release(); this.grabbed = false;
            intent = 'RELEASE_OBJECT'; action = 'RELEASE'; status = 'EXECUTING'; stage = 3;
          }
          if (g === 'ROTATE') {
            w.rotateBy(p.rollDelta * 1.6 + p.rollDelta * 0);
            // horizontal motion also spins the object – easier than wrist roll alone
            if (this.prevPtrX !== undefined) w.rotateBy((p.pointer.x - this.prevPtrX) * 5);
            intent = 'ROTATE_OBJECT'; action = `ROTATE ${name}`; status = 'EXECUTING'; stage = 3;
          } else if (g === 'OPEN_PALM') {
            w.select(true);
            if (t - this.lastActivate > 0.9 && this.prev.gesture !== 'OPEN_PALM') {
              w.activate(); this.lastActivate = t; this.log('OBJECT', name);
            }
            intent = 'ACTIVATE_OBJECT'; action = `ACTIVATE ${name}`; status = 'EXECUTING'; stage = 3;
          } else if (g === 'POINT') {
            intent = 'DIRECT_POINTER'; action = 'TRACK_POINTER'; status = 'EXECUTING'; stage = 3;
          } else if (!this.grabbed) {
            intent = 'TRACK_HAND'; action = 'OBSERVE'; status = 'ARMED'; stage = 2;
          }
        }
        this.prevPtrX = p.pointer.x;
      }
    }

    // ---- telemetry (log only on change) ----
    const pv = this.prev;
    if (p.handed !== pv.handed) this.log('HAND', p.handed ? 'HAND DETECTED' : 'HAND LOST');
    if (p.handed && p.gesture !== pv.gesture && p.gesture !== 'NONE') this.log('GESTURE', p.gesture);
    if (intent !== pv.intent && intent !== 'AWAIT_HAND') this.log('INTENT', intent);
    if (action !== pv.action && action !== 'IDLE' && action !== 'OBSERVE') this.log('ACTION', action.split(' ')[0] === 'MOVE' ? 'MOVE_OBJECT' : action);
    if (status !== pv.status && status !== 'STANDBY') this.log('STATUS', status);
    this.prev = { handed: p.handed, gesture: p.handed ? p.gesture : 'NONE', intent, action, status, object: name };

    this.out = {
      perception, intent, action, status, stage,
      selected: w.selected ? name : 'NONE',
      gesture: p.handed ? p.gesture : 'NONE',
      swipeFlash: this.swipeFlash ?? -9,
    };
    return this.out;
  }
}
