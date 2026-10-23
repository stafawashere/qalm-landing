import { isReduced } from "./motion.js";

const QUIET_MS = 1400;
const EASE_IN_SECONDS = 1.1;
const EASE_OUT_SECONDS = 0.22;
const SETTLED = 0.0008;
const TAU = Math.PI * 2;

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "input", "focusin"];

export function createIdle({ root, stage, sheen, activeView }) {
  const { gsap } = window;
  const reducedQuery = matchMedia("(prefers-reduced-motion: reduce)");

  let amount = 0;
  let target = 0;
  let seconds = 0;
  let lastPoke = performance.now();
  let quietTimer = null;
  let isRunning = false;
  let isVisible = true;
  let ambientView = null;

  function canIdle() {
    const isPaused = document.hidden || !isVisible;
    return Boolean(gsap) && !isReduced() && !isPaused;
  }

  function writeDevice() {
    const driftY = Math.sin(seconds * TAU / 7.5) * 3 + Math.sin(seconds * TAU / 4.3 + 1.2) * 1;
    const driftX = Math.sin(seconds * TAU / 11 + 0.6) * 1.4;
    stage.style.translate = `${(driftX * amount).toFixed(3)}px ${(driftY * amount).toFixed(3)}px`;

    const sweep = Math.sin(seconds * TAU / 9);
    const glow = (Math.sin(seconds * TAU / 6.5 + 2) + 1) / 2;
    sheen.style.translate = `${(sweep * 46 * amount).toFixed(2)}px 0`;
    sheen.style.opacity = (0.035 + glow * 0.03 * amount).toFixed(4);
  }

  function clearDevice() {
    stage.style.translate = "";
    sheen.style.translate = "";
    sheen.style.opacity = "";
  }

  function writeView() {
    const view = activeView();
    const hasChanged = view !== ambientView;

    if (hasChanged) {
      ambientView?.ambient?.(seconds, 0);
      ambientView = view;
    }

    view?.ambient?.(seconds, amount);
  }

  function frame(_time, deltaMs) {
    const dt = Math.min(deltaMs / 1000, 1 / 20);
    const isRising = target > amount;
    const span = isRising ? EASE_IN_SECONDS : EASE_OUT_SECONDS;
    const blend = 1 - Math.exp(-dt / span);

    amount += (target - amount) * blend;
    seconds += dt;

    const hasSettledAtRest = target === 0 && amount < SETTLED;
    if (hasSettledAtRest) {
      amount = 0;
      writeView();
      ambientView = null;
      clearDevice();
      stop();
      return;
    }

    writeDevice();
    writeView();
  }

  function start() {
    if (isRunning || !gsap) return;
    isRunning = true;
    gsap.ticker.add(frame);
  }

  function stop() {
    if (!isRunning) return;
    isRunning = false;
    gsap.ticker.remove(frame);
  }

  function arm() {
    quietTimer = null;
    const sinceLastPoke = performance.now() - lastPoke;
    const remaining = QUIET_MS - sinceLastPoke;

    if (remaining > 0) {
      quietTimer = setTimeout(arm, remaining);
      return;
    }

    if (!canIdle()) return;

    target = 1;
    start();
  }

  function schedule() {
    if (quietTimer !== null) return;
    quietTimer = setTimeout(arm, QUIET_MS);
  }

  function poke() {
    lastPoke = performance.now();
    target = 0;

    const isMoving = amount > 0;
    if (isMoving) start();

    schedule();
  }

  function onVisibility() {
    if (canIdle()) {
      poke();
      return;
    }

    target = 0;
    amount = 0;
    stop();
    writeView();
    ambientView = null;
    clearDevice();
  }

  for (const type of ACTIVITY_EVENTS) {
    root.addEventListener(type, poke, { passive: true, capture: true });
  }

  document.addEventListener("visibilitychange", onVisibility);
  reducedQuery.addEventListener("change", onVisibility);

  let observer = null;
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      const latest = entries[entries.length - 1];
      isVisible = latest.isIntersecting;
      onVisibility();
    });
    observer.observe(root);
  }

  schedule();

  return {
    poke,
    get amount() {
      return amount;
    },
    destroy() {
      clearTimeout(quietTimer);
      stop();
      clearDevice();
      for (const type of ACTIVITY_EVENTS) {
        root.removeEventListener(type, poke, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onVisibility);
      observer?.disconnect();
    },
  };
}
