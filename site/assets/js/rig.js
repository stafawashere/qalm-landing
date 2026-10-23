import { isReducedMotion } from "./tokens.js";

const finePointer = matchMedia("(pointer: fine)");

export function canRig() {
  return Boolean(window.gsap) && finePointer.matches && !isReducedMotion();
}

export function createRig() {
  const { gsap } = window;
  const pointer = { x: 0, y: 0 };
  const items = new Set();
  const listeners = new Set();
  let isRunning = false;
  let target = { x: 0, y: 0 };

  const moveX = gsap.quickTo(pointer, "x", { duration: 1, ease: "power3.out" });
  const moveY = gsap.quickTo(pointer, "y", { duration: 1, ease: "power3.out" });

  function wake() {
    if (isRunning) return;
    isRunning = true;
    gsap.ticker.add(frame);
  }

  function frame() {
    const isSettled = Math.abs(pointer.x - target.x) < 0.0004 && Math.abs(pointer.y - target.y) < 0.0004;

    for (const item of items) {
      if (!item.isVisible) continue;
      item.apply(pointer.x, pointer.y);
    }
    for (const listener of listeners) listener(pointer.x, pointer.y);

    if (isSettled) {
      isRunning = false;
      gsap.ticker.remove(frame);
    }
  }

  function onMove(event) {
    target = { x: event.clientX / innerWidth - 0.5, y: event.clientY / innerHeight - 0.5 };
    moveX(target.x);
    moveY(target.y);
    wake();
  }

  function onLeave() {
    target = { x: 0, y: 0 };
    moveX(0);
    moveY(0);
    wake();
  }

  addEventListener("pointermove", onMove, { passive: true });
  document.documentElement.addEventListener("pointerleave", onLeave);

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      for (const item of items) {
        if (item.element === entry.target) item.isVisible = entry.isIntersecting;
      }
    }
  });

  return {
    add(element, { depth = 0.04, tilt = 0, spec = null } = {}) {
      if (!element) return () => {};

      const reach = depth * 900;
      const item = {
        element,
        isVisible: true,
        apply(x, y) {
          element.style.translate = `${(x * reach).toFixed(2)}px ${(y * reach * 0.7).toFixed(2)}px`;
          if (!tilt) return;
          gsap.set(element, { rotationY: x * tilt * 2, rotationX: -y * tilt * 2 });
          if (spec) {
            spec.style.translate = `${(x * 220).toFixed(1)}px ${(y * 260).toFixed(1)}px`;
          }
        },
      };

      items.add(item);
      observer.observe(element);

      return () => {
        items.delete(item);
        observer.unobserve(element);
        element.style.translate = "";
        if (tilt) gsap.set(element, { rotationY: 0, rotationX: 0 });
      };
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      observer.disconnect();
      gsap.ticker.remove(frame);
      items.clear();
      listeners.clear();
    },
  };
}
