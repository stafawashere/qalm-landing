import { DURATION, EASE, isReducedMotion } from "./tokens.js";

const lastChange = new WeakMap();
const running = new WeakMap();
const QUICK_MS = 140;

const HIDDEN_TEXT = "position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap";
const CELL = "display:inline-grid;overflow:clip;";
const LAYER = "grid-area:1/1;";

function settle(element, text) {
  running.get(element)?.kill();
  running.delete(element);
  element.textContent = text;
}

export function rollText(element, next, { direction = 1 } = {}) {
  const { gsap } = window;
  if (!element) return;

  const previous = element.dataset.rolled ?? element.textContent;
  element.dataset.rolled = next;
  if (previous === next) return;

  const now = performance.now();
  const lastAt = lastChange.get(element) ?? 0;
  lastChange.set(element, now);

  const isFirst = !previous;
  const isQuick = now - lastAt < QUICK_MS;
  const isStill = !gsap || isReducedMotion() || isFirst || isQuick || previous.length !== next.length;

  if (isStill) {
    settle(element, next);
    return;
  }

  running.get(element)?.kill();

  const cells = [];
  const pieces = [];
  for (let index = 0; index < next.length; index += 1) {
    const before = previous[index];
    const after = next[index];
    if (before === after) {
      pieces.push(document.createTextNode(after));
      continue;
    }

    const cell = document.createElement("span");
    cell.setAttribute("aria-hidden", "true");
    cell.style.cssText = CELL;
    const outgoing = document.createElement("span");
    const incoming = document.createElement("span");
    outgoing.style.cssText = LAYER;
    incoming.style.cssText = LAYER;
    outgoing.textContent = before;
    incoming.textContent = after;
    cell.append(outgoing, incoming);
    cells.push({ outgoing, incoming });
    pieces.push(cell);
  }

  const spoken = document.createElement("span");
  spoken.style.cssText = HIDDEN_TEXT;
  spoken.textContent = next;
  element.replaceChildren(spoken, ...pieces);

  const tween = gsap.timeline({ onComplete: () => settle(element, next) });
  const outgoing = cells.map((cell) => cell.outgoing);
  const incoming = cells.map((cell) => cell.incoming);
  tween.fromTo(outgoing, { yPercent: 0 }, { yPercent: -110 * direction, duration: DURATION.base, ease: EASE.out, stagger: 0.03 }, 0);
  tween.fromTo(incoming, { yPercent: 110 * direction }, { yPercent: 0, duration: DURATION.base, ease: EASE.out, stagger: 0.03 }, 0);
  running.set(element, tween);
}

export function crossfadeText(element, next, { duration = DURATION.fast } = {}) {
  const { gsap } = window;
  if (!element) return;
  if (element.textContent === next) return;

  const previous = running.get(element);
  previous?.kill();

  if (!gsap || isReducedMotion()) {
    element.textContent = next;
    return;
  }

  const tween = gsap.timeline({ onComplete: () => running.delete(element) });
  tween.to(element, { opacity: 0, duration, ease: EASE.in })
    .add(() => { element.textContent = next; })
    .to(element, { opacity: 1, duration, ease: EASE.out });
  running.set(element, tween);
}

export function slideText(element, next, { duration = DURATION.base } = {}) {
  const { gsap } = window;
  if (!element) return;

  const previous = element.dataset.slid ?? element.textContent;
  element.dataset.slid = next;
  if (previous === next) return;

  const now = performance.now();
  const lastAt = lastChange.get(element) ?? 0;
  lastChange.set(element, now);

  const isQuick = now - lastAt < QUICK_MS * 3;
  if (!gsap || isReducedMotion() || isQuick) {
    settle(element, next);
    return;
  }

  running.get(element)?.kill();

  const frame = document.createElement("span");
  frame.style.cssText = "display:grid;overflow:clip;";
  const outgoing = document.createElement("span");
  const incoming = document.createElement("span");
  outgoing.style.cssText = LAYER;
  incoming.style.cssText = LAYER;
  outgoing.setAttribute("aria-hidden", "true");
  outgoing.textContent = previous;
  incoming.textContent = next;
  frame.append(outgoing, incoming);
  element.replaceChildren(frame);

  const tween = gsap.timeline({ onComplete: () => settle(element, next) });
  tween.fromTo(outgoing, { yPercent: 0 }, { yPercent: -105, duration, ease: EASE.out }, 0);
  tween.fromTo(incoming, { yPercent: 105 }, { yPercent: 0, duration, ease: EASE.out }, 0.04);
  running.set(element, tween);
}
