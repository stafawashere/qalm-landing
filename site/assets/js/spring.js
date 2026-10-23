import { SPRING, isReducedMotion } from "./tokens.js";

const MAX_STEP = 1 / 30;
const SUBSTEP = 1 / 240;

export function spring(write, { from = 0, stiffness = SPRING.stiffness, damping = SPRING.damping, mass = 1, precision = 0.002 } = {}) {
  const { gsap } = window;
  let value = from;
  let target = from;
  let velocity = 0;
  let isRunning = false;
  let onRest = null;

  function step(_time, deltaMs) {
    let remaining = Math.min(deltaMs / 1000, MAX_STEP);

    while (remaining > 0) {
      const dt = Math.min(SUBSTEP, remaining);
      const force = -stiffness * (value - target) - damping * velocity;
      velocity += (force / mass) * dt;
      value += velocity * dt;
      remaining -= dt;
    }

    const isSettled = Math.abs(value - target) < precision && Math.abs(velocity) < precision * 4;
    if (isSettled) {
      value = target;
      velocity = 0;
      stop();
    }

    write(value);

    if (isSettled && onRest) {
      const done = onRest;
      onRest = null;
      done();
    }
  }

  function start() {
    if (isRunning || !gsap) return;
    isRunning = true;
    gsap.ticker.add(step);
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;
    gsap.ticker.remove(step);
  }

  return {
    get value() { return value; },
    get velocity() { return velocity; },
    to(next, done = null) {
      target = next;
      onRest = done;
      if (!gsap || isReducedMotion()) {
        stop();
        value = next;
        velocity = 0;
        write(value);
        onRest = null;
        done?.();
        return;
      }
      start();
    },
    kick(extraVelocity) {
      velocity += extraVelocity;
      start();
    },
    set(next) {
      stop();
      onRest = null;
      value = next;
      target = next;
      velocity = 0;
      write(value);
    },
    stop,
  };
}
