import { isReducedMotion } from "../tokens.js";
import { clock } from "./clock.js";

export function createSunClock({ isLive, onMinute, onSub, onWake, watch = [] }) {
  let lastMinute = Math.floor(Date.now() / 60000);
  let isNear = true;

  const nearSet = new Set(watch);
  const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) nearSet.add(entry.target);
      else nearSet.delete(entry.target);
    }
    isNear = nearSet.size > 0;
  });

  nearSet.clear();
  for (const node of watch) observer?.observe(node);
  if (!observer) isNear = true;

  const stopSecond = clock.on("second", (now) => {
    const minute = Math.floor(now.getTime() / 60000);
    const hasMinuteChanged = minute !== lastMinute;
    lastMinute = minute;

    const canUpdate = !document.hidden && isLive();
    if (!canUpdate) return;

    if (hasMinuteChanged) {
      onMinute(now);
      return;
    }

    const shouldSkipSub = isReducedMotion() || !isNear;
    if (shouldSkipSub) return;
    onSub(now);
  });

  const stopWake = clock.on("wake", ({ gap, now }) => {
    lastMinute = Math.floor(now.getTime() / 60000);
    onWake?.(gap, now);
  });

  return {
    destroy() {
      stopSecond();
      stopWake();
      observer?.disconnect();
    },
  };
}
