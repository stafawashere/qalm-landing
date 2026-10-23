import { createRig, canRig } from "./rig.js";
import { EASE, isReducedMotion } from "./tokens.js";

const PHONE_WIDTH = 440;
const PHONE_HEIGHT = 956;
const REST_EDGE = 0.002;
const PREBUILD_GAP = 140;
const OPEN_AHEAD = 2;
const DOCK_BEGIN = 1.05;
const DOCK_SPAN = 0.75;
const CLOSE_BEHIND = -0.15;
const REOPEN_BEHIND = -0.05;
const narrowQuery = matchMedia("(max-width: 1099px)");
const SLOT_TILT_Z = { qibla: -4 };
const NOTE_STAGGER = 0.14;

function stubPhone(host, options) {
  const element = document.createElement("div");
  element.className = "phone-stub";
  element.dataset.ui = "";
  element.innerHTML = `<p>${options.place?.name || "Qalm"}</p><p>Design preview</p>`;
  host.append(element);

  return {
    element,
    show() {},
    set() {},
    on() {},
    prebuild() {},
    destroy() { element.remove(); },
  };
}

async function loadPhoneFactory() {
  try {
    const module = await import("./app/phone.js");
    return module.createPhone;
  } catch {
    return stubPhone;
  }
}

function whenIdle(task) {
  if ("requestIdleCallback" in window) {
    requestIdleCallback(task, { timeout: 2400 });
    return;
  }
  setTimeout(task, PREBUILD_GAP);
}

export async function createStage({ state, phoneOptions, onChange }) {
  const { gsap } = window;
  const slots = [...document.querySelectorAll("[data-phone-slot]")];
  const slotByKey = Object.fromEntries(slots.map((slot) => [slot.dataset.phoneSlot, slot]));
  const firstSlot = slotByKey.arrival;

  const createPhone = await loadPhoneFactory();
  const phone = createPhone(firstSlot, phoneOptions);
  phone.on?.("change", onChange);

  const element = phone.element;
  const box = element.querySelector(".qp-box");
  const bezel = element.querySelector(".qp-bezel");

  const layer = document.createElement("div");
  layer.className = "qp-layer";
  layer.setAttribute("aria-hidden", "false");
  const flight = document.createElement("div");
  flight.className = "qp-flight";
  layer.append(flight);
  document.body.append(layer);

  let current = firstSlot;
  let dominant = firstSlot;
  let mode = "rest";
  let restedSlot = null;
  let flightScale = 0.8;
  let swap = null;
  let rig = null;
  const hooks = { dominant: null, flightStart: null, flightEnd: null };

  function visibleSlots() {
    return slots.filter((slot) => slot.getClientRects().length > 0);
  }

  function fit() {
    const isNarrow = innerWidth < 900;
    const margin = innerWidth < 600 ? 28 : 48;
    let largest = 0.3;

    for (const slot of slots) {
      const base = Number(slot.dataset.scale) || 0.8;
      const reserve = Number(slot.dataset.fit) || 140;
      const byWidth = (innerWidth - margin * 2) / PHONE_WIDTH;
      const byHeight = isNarrow ? (innerHeight - 140) / PHONE_HEIGHT : (innerHeight - reserve) / PHONE_HEIGHT;
      const scale = Math.max(0.3, Math.min(base, byWidth, byHeight));
      slot.style.setProperty("--phone-scale", scale.toFixed(4));
      largest = Math.max(largest, scale);
    }

    flightScale = largest;
    flight.style.setProperty("--phone-scale", largest.toFixed(4));
    flight.style.width = `${PHONE_WIDTH * largest}px`;
    flight.style.height = `${PHONE_HEIGHT * largest}px`;
  }

  let refreshTimer = null;
  let focusBeforeRefresh = null;

  window.ScrollTrigger?.addEventListener("refreshInit", () => {
    const active = document.activeElement;
    const hasFocus = active && active !== document.body;
    focusBeforeRefresh = hasFocus ? active : null;
  });

  window.ScrollTrigger?.addEventListener("refresh", () => {
    const held = focusBeforeRefresh;
    focusBeforeRefresh = null;
    if (!held) return;

    const isAdrift = document.activeElement === document.body || document.activeElement === null;
    const canRestore = held.isConnected && !held.closest("[inert], [hidden]");
    if (isAdrift && canRestore) held.focus({ preventScroll: true });
  });

  function settleLayout() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => window.ScrollTrigger?.refresh(), 160);
  }

  let isShaping = false;

  function shapeSlots(list, keep) {
    const height = innerHeight;
    let changed = false;
    isShaping = true;

    list.forEach((slot) => {
      const isOpen = slot.hasAttribute("data-open");
      const isHolding = element.parentElement === slot || keep.has(slot);
      const rect = slot.getBoundingClientRect();
      const isBehind = isOpen ? rect.bottom < height * CLOSE_BEHIND : rect.top < height * REOPEN_BEHIND;
      const isNear = rect.top < height * (isOpen ? OPEN_AHEAD + 0.3 : OPEN_AHEAD);
      const shouldOpen = isHolding || (isNear && !isBehind);

      if (shouldOpen === isOpen) return;

      const isAbove = isOpen ? rect.bottom <= 0 : rect.top <= 0;
      const heightBefore = document.documentElement.scrollHeight;
      slot.toggleAttribute("data-open", shouldOpen);
      changed = true;

      if (!isAbove) return;

      const shift = document.documentElement.scrollHeight - heightBefore;
      if (!shift) return;

      const target = scrollY + shift;
      const lenis = window.qalm?.lenis;
      if (lenis) lenis.scrollTo(target, { immediate: true, force: true });
      else scrollTo(0, target);
    });

    isShaping = false;
    if (changed) settleLayout();
  }

  function adopt(parent) {
    if (element.parentElement === parent) return;
    if (parent.matches("[data-phone-slot]")) parent.setAttribute("data-open", "");

    const focused = element.contains(document.activeElement) ? document.activeElement : null;
    const scrolled = [...element.querySelectorAll("[data-lenis-prevent]")]
      .filter((node) => node.scrollTop > 0)
      .map((node) => [node, node.scrollTop]);

    parent.append(element);
    settleLayout();

    for (const [node, top] of scrolled) node.scrollTop = top;
    focused?.focus({ preventScroll: true });
  }

  const notesBySlot = new Map();
  let shownNotes = null;

  function labelWidth(note) {
    const range = document.createRange();
    range.selectNodeContents(note);
    return range.getBoundingClientRect().width;
  }

  function placeNotes(slot, notes) {
    const box = slot.getBoundingClientRect();
    for (const note of notes) note.style.display = "";
    const widest = Math.max(...notes.map(labelWidth));
    const chrome = 12 + 10 + 7;
    const edge = 28;
    const roomRight = innerWidth - edge - box.right - 8 - chrome - widest;
    const roomLeft = box.left - edge - 8 - chrome - widest;
    const minRule = 28;

    const fitsRight = roomRight >= minRule;
    const fitsLeft = roomLeft >= minRule;
    const isLeft = !fitsRight && fitsLeft;
    const room = isLeft ? roomLeft : roomRight;
    const rule = Math.round(Math.min(72, Math.max(minRule, room)));
    const hasRoom = fitsRight || fitsLeft;

    for (const note of notes) {
      note.classList.toggle("is-left", isLeft);
      note.style.setProperty("--note-rule", `${rule}px`);
      note.style.display = hasRoom ? "" : "none";
    }
  }

  function buildNotes() {
    for (const slot of slots) {
      const raw = slot.dataset.notes;
      if (!raw) continue;

      let entries = [];
      try {
        entries = JSON.parse(raw);
      } catch {
        continue;
      }

      const nodes = entries.map(({ label, y }) => {
        const note = document.createElement("span");
        note.className = "phone-note";
        note.setAttribute("aria-hidden", "true");
        note.textContent = label;
        note.style.top = `${Math.round(y * 100)}%`;
        note.style.opacity = "0";
        slot.append(note);
        return note;
      });

      notesBySlot.set(slot, nodes);
    }
  }

  function hideNotes() {
    if (!shownNotes) return;

    const nodes = shownNotes;
    shownNotes = null;
    gsap.killTweensOf(nodes);
    gsap.to(nodes, { opacity: 0, duration: isReducedMotion() ? 0 : 0.12, ease: "none", overwrite: true });
  }

  function showNotes(slot) {
    const nodes = notesBySlot.get(slot);
    if (!nodes || shownNotes === nodes) return;

    hideNotes();
    shownNotes = nodes;
    placeNotes(slot, nodes);
    gsap.killTweensOf(nodes);

    if (isReducedMotion()) {
      gsap.set(nodes, { opacity: 1, x: 0 });
      return;
    }

    const side = nodes[0].classList.contains("is-left") ? 14 : -14;
    gsap.fromTo(nodes, { opacity: 0, x: side }, { opacity: 1, x: 0, duration: 0.55, ease: EASE.out, stagger: NOTE_STAGGER, delay: 0.25, overwrite: true });
  }

  function keepFocus(event) {
    const lost = event.target;
    if (!(lost instanceof HTMLElement)) return;
    if (event.relatedTarget) return;

    requestAnimationFrame(() => {
      const isAdrift = document.activeElement === document.body || document.activeElement === null;
      const isStillUsable = lost.isConnected && !lost.inert && !lost.closest("[inert], [hidden]") && lost.getClientRects().length > 0;
      if (!isAdrift || isStillUsable) return;

      const wasInPhone = element.contains(lost);
      const section = lost.closest?.("[data-chapter]") || null;
      const anchor = wasInPhone ? element : section;
      if (!anchor) return;

      if (anchor !== element && !anchor.hasAttribute("tabindex")) anchor.setAttribute("tabindex", "-1");
      anchor.focus({ preventScroll: true });
    });
  }

  function tiltOf(slot) {
    return {
      rotationY: Number(slot.dataset.tiltY) || 0,
      rotationX: Number(slot.dataset.tiltX) || 0,
      rotationZ: Number(slot.dataset.tiltZ) || SLOT_TILT_Z[slot.dataset.phoneSlot] || 0,
      opacity: Number(slot.dataset.dim) || 1,
    };
  }

  function restAt(slot) {
    const isSettled = mode === "rest" && restedSlot === slot && element.parentElement === slot;
    if (isSettled) return;

    const flat = isReducedMotion();
    const tilt = tiltOf(slot);

    if (mode === "flight") {
      mode = "rest";
      adopt(slot);
      hooks.flightEnd?.();
    } else {
      adopt(slot);
    }

    current = slot;
    restedSlot = slot;
    gsap.set(element, {
      rotationY: flat ? 0 : tilt.rotationY,
      rotationX: flat ? 0 : tilt.rotationX,
      rotationZ: flat ? 0 : tilt.rotationZ,
      opacity: tilt.opacity,
      transformPerspective: 1400,
    });
    element.style.pointerEvents = "";
    showNotes(slot);
  }

  function fly(from, to, raw) {
    const ease = gsap.parseEase(EASE.inOut);
    const t = ease(raw);
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const fromTilt = tiltOf(from);
    const toTilt = tiltOf(to);

    const width = a.width + (b.width - a.width) * t;
    const scale = width / (PHONE_WIDTH * flightScale);
    const x = a.left + (b.left - a.left) * t;
    const y = a.top + (b.top - a.top) * t;

    const isNarrow = innerWidth < 900;
    const swell = Math.sin(Math.PI * t);
    const dip = isNarrow ? Math.min(1, 7 * swell) : 0.18 * swell;
    const blend = (start, end) => start + (end - start) * t;

    phone.idle?.poke();
    gsap.set(flight, { x, y, scale, transformOrigin: "0 0" });

    if (mode !== "flight") {
      mode = "flight";
      restedSlot = null;
      hideNotes();
      adopt(flight);
      element.style.pointerEvents = "none";
      hooks.flightStart?.();
    }

    gsap.set(element, {
      rotationY: blend(fromTilt.rotationY, toTilt.rotationY),
      rotationX: blend(fromTilt.rotationX, toTilt.rotationX),
      rotationZ: blend(fromTilt.rotationZ, toTilt.rotationZ),
      opacity: blend(fromTilt.opacity, toTilt.opacity) * (1 - dip),
      transformPerspective: 1400,
    });
  }

  function crossfadeTo(slot) {
    if (slot === current) return;
    current = slot;
    swap?.kill();
    swap = gsap.timeline()
      .to(element, { opacity: 0, duration: 0.075, ease: "none" })
      .add(() => restAt(slot))
      .to(element, { opacity: tiltOf(slot).opacity, duration: 0.075, ease: "none" });
  }

  function setDominant(slot) {
    if (slot === dominant) return;
    dominant = slot;
    hooks.dominant?.(slot);
  }

  const quietSections = [...document.querySelectorAll('[data-chapter="devices"], [data-phone-hide]')];
  let isLayerHidden = false;

  function fadeForQuietSections() {
    if (!quietSections.length) return;

    const height = innerHeight;
    let covered = 0;
    for (const section of quietSections) {
      const rect = section.getBoundingClientRect();
      const shown = Math.min(rect.bottom, height) - Math.max(rect.top, 0);
      covered = Math.max(covered, shown / height);
    }

    const fade = Math.min(1, Math.max(0, (covered - 0.12) / 0.25));
    layer.style.opacity = fade > 0 ? String(1 - fade) : "";

    const shouldHide = fade >= 0.98;
    if (shouldHide === isLayerHidden) return;

    isLayerHidden = shouldHide;
    if (shouldHide && layer.contains(document.activeElement)) {
      const section = quietSections.find((node) => node.getBoundingClientRect().top < height);
      if (section) {
        section.setAttribute("tabindex", "-1");
        section.focus({ preventScroll: true });
      }
    }
    layer.style.visibility = shouldHide ? "hidden" : "";
  }

  function sync() {
    if (isShaping) return;
    fadeForQuietSections();

    const list = visibleSlots();
    if (!list.length) return;

    const isNarrow = narrowQuery.matches;
    const height = innerHeight;
    const markers = isNarrow ? list : list.map((slot) => slot.closest("[data-chapter]") || slot);
    const begin = isNarrow ? height * DOCK_BEGIN : height;
    const span = isNarrow ? height * DOCK_SPAN : height;

    function locate() {
      const found = markers.map((marker) => marker.getBoundingClientRect().top);
      let reached = 0;
      for (let i = 1; i < list.length; i += 1) {
        const isReached = isNarrow ? found[i] < begin : found[i] < height * (1 - REST_EDGE);
        if (isReached) reached = i;
      }
      return { found, reached };
    }

    if (isNarrow) {
      const { found, reached } = locate();
      const keep = new Set([list[reached]]);
      const isDocked = reached > 0 && (begin - found[reached]) / span >= 1 - REST_EDGE;
      if (reached > 0 && !isDocked) keep.add(list[reached - 1]);
      shapeSlots(list, keep);
    }

    const { found: tops, reached: index } = locate();

    if (index === 0) {
      setDominant(list[0]);
      if (isReducedMotion()) crossfadeTo(list[0]);
      else restAt(list[0]);
      return;
    }

    const progress = Math.min(1, Math.max(0, (begin - tops[index]) / span));
    const to = list[index];
    const from = list[index - 1];

    setDominant(progress >= 0.5 ? to : from);

    if (isReducedMotion()) {
      crossfadeTo(progress >= 0.5 ? to : from);
      return;
    }

    if (swap) {
      swap.kill();
      swap = null;
    }

    if (progress >= 1 - REST_EDGE) {
      restAt(to);
      return;
    }

    if (progress <= REST_EDGE) {
      restAt(from);
      return;
    }

    fly(from, to, progress);
  }

  function travelTo(key) {
    const slot = slotByKey[key];
    if (slot) crossfadeTo(slot);
    return Promise.resolve();
  }

  function setupRig() {
    if (!canRig() || !box || !bezel) return;

    const gloss = document.createElement("div");
    gloss.className = "qp-gloss";
    gloss.setAttribute("aria-hidden", "true");
    const spec = document.createElement("i");
    spec.className = "qp-spec";
    gloss.append(spec);
    box.append(gloss);

    gsap.set(box, { transformPerspective: 1400 });
    rig = createRig();
    rig.add(box, { depth: 0.008, tilt: 3.5, spec });
  }

  function prebuildViews() {
    const names = new Set();
    for (const slot of slots) {
      if (slot.dataset.view) names.add(slot.dataset.view);
      if (slot.dataset.viewLate) names.add(slot.dataset.viewLate);
    }
    names.add("lock");
    names.add("search");

    const queue = [...names];
    const next = () => {
      const name = queue.shift();
      if (!name) return;
      phone.prebuild?.(name);
      whenIdle(next);
    };
    whenIdle(next);
  }

  firstSlot.setAttribute("data-open", "");
  buildNotes();
  document.addEventListener("focusout", keepFocus);
  fit();
  addEventListener("resize", fit);
  gsap.set(element, { transformPerspective: 1400 });
  restAt(firstSlot);
  setupRig();
  prebuildViews();

  return {
    phone,
    slots,
    slotByKey,
    layer,
    rig,
    sync,
    travelTo,
    travel: (slot) => crossfadeTo(slot),
    fit,
    onDominant(fn) { hooks.dominant = fn; },
    onFlight(start, end) {
      hooks.flightStart = start;
      hooks.flightEnd = end;
    },
    get current() { return current; },
    get dominant() { return dominant; },
    get flying() { return mode === "flight"; },
  };
}
