const WAKE_GAP_MS = 5000;
const listeners = { second: new Set(), wake: new Set() };

let isRunning = false;
let lastPulseMs = Date.now();
let lastSecond = Math.floor(lastPulseMs / 1000);
let hiddenAtMs = null;

function emit(type, payload) {
  for (const listener of [...listeners[type]]) listener(payload);
}

function pulse() {
  const nowMs = Date.now();
  const gap = nowMs - lastPulseMs;
  lastPulseMs = nowMs;

  const hasSlept = gap > WAKE_GAP_MS;
  if (hasSlept) {
    lastSecond = Math.floor(nowMs / 1000);
    emit("wake", { gap, now: new Date(nowMs) });
    return;
  }

  const second = Math.floor(nowMs / 1000);
  if (second === lastSecond) return;

  lastSecond = second;
  emit("second", new Date(nowMs));
}

function onVisibility() {
  if (document.hidden) {
    hiddenAtMs = Date.now();
    return;
  }

  const nowMs = Date.now();
  const awayFor = hiddenAtMs === null ? 0 : nowMs - hiddenAtMs;
  const gap = Math.max(awayFor, nowMs - lastPulseMs);
  hiddenAtMs = null;
  lastPulseMs = nowMs;
  lastSecond = Math.floor(nowMs / 1000);
  emit("wake", { gap, now: new Date(nowMs) });
}

function start() {
  if (isRunning) return;
  isRunning = true;

  const { gsap } = window;
  if (gsap) gsap.ticker.add(pulse);
  else {
    const loop = () => {
      pulse();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  document.addEventListener("visibilitychange", onVisibility);
}

export const clock = {
  on(type, listener) {
    listeners[type].add(listener);
    start();
    return () => listeners[type].delete(listener);
  },
  now: () => new Date(),
};
