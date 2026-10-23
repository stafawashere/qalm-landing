import { h, icon, svg, append, button } from "./dom.js";
import { createModel, normalisePlace, countdownParts, countdownText, countdownSpoken } from "./model.js";
import { ramadanBounds, civil } from "./data.js";
import { zonedParts } from "../sky.js";
import { animateFrom, animateTo, clearMotion, isReduced } from "./motion.js";
import { spring } from "../spring.js";
import { EASE, DURATION } from "../tokens.js";
import { rollText } from "../roll.js";
import { createTodayView, PRAYER_ICON } from "./view-today.js";
import { createQiblaView } from "./view-qibla.js";
import { createQuranView, createBookmarksView } from "./view-quran.js";
import { createSearchView } from "./view-search.js";
import { createKhatmView, createKhatmSetupSheet } from "./view-khatm.js";
import { createMethodView, createMosqueView, createCustomAnglesSheet } from "./view-method.js";
import { createNightsView } from "./view-nights.js";
import { createLockView } from "./view-lock.js";
import { createPrivacyView, createMoreView } from "./view-more.js";
import { createReaderView } from "./view-reader.js";
import { createPlusSheet } from "./view-plus.js";
import { createPrayerSheet } from "./view-prayer.js";
import { createIdle } from "./idle.js";

const VIEW_BUILDERS = {
  today: createTodayView,
  quran: createQuranView,
  qibla: createQiblaView,
  more: createMoreView,
  search: createSearchView,
  bookmarks: createBookmarksView,
  khatm: createKhatmView,
  method: createMethodView,
  mosque: createMosqueView,
  nights: createNightsView,
  lock: createLockView,
  privacy: createPrivacyView,
  reader: createReaderView,
};

const SHEET_BUILDERS = {
  prayer: createPrayerSheet,
  custom: createCustomAnglesSheet,
  plus: createPlusSheet,
  "khatm-setup": createKhatmSetupSheet,
};

const TABS = [
  { key: "today", label: "Today", icon: "today" },
  { key: "quran", label: "Quran", icon: "book" },
  { key: "qibla", label: "Qibla", icon: "qibla" },
  { key: "more", label: "More", icon: "more" },
];

const LABELS = {
  today: "Today",
  quran: "Quran",
  qibla: "Qibla",
  more: "More",
  search: "Search",
  bookmarks: "Bookmarks",
  khatm: "Khatm plan",
  method: "Calculation method",
  mosque: "Match my mosque",
  nights: "Last ten nights",
  lock: "Lock Screen",
  privacy: "Privacy",
  reader: "Reader",
  plus: "Qalm Plus",
  "khatm-setup": "Khatm setup",
  prayer: "Prayer",
  custom: "Custom angles",
};

const STACKS = {
  today: ["today"],
  quran: ["quran"],
  qibla: ["qibla"],
  more: ["more"],
  search: ["quran", "search"],
  bookmarks: ["quran", "bookmarks"],
  khatm: ["more", "khatm"],
  method: ["today", "method"],
  mosque: ["today", "method", "mosque"],
  nights: ["more", "nights"],
  lock: ["more", "lock"],
  privacy: ["more", "privacy"],
  reader: ["quran", "reader"],
};

const ROOT_TAB = { today: "today", quran: "quran", qibla: "qibla", more: "more" };
const SHEET_BASE = { "khatm-setup": "khatm" };
const STATUS_ICONS = `<svg viewBox="0 0 76 14" width="76" height="14" fill="currentColor" aria-hidden="true"><rect x="0" y="9" width="3.2" height="4" rx="1"/><rect x="4.8" y="6.5" width="3.2" height="6.5" rx="1"/><rect x="9.6" y="3.8" width="3.2" height="9.2" rx="1"/><rect x="14.4" y="1" width="3.2" height="12" rx="1"/><path d="M31 12.6l2.2-2.4a3.2 3.2 0 0 0-4.4 0zM26 7.8l1.6 1.7a5.2 5.2 0 0 1 6.8 0l1.6-1.7a7.6 7.6 0 0 0-10 0zM23.2 5l1.6 1.7a9.4 9.4 0 0 1 12.4 0L38.8 5a11.8 11.8 0 0 0-15.6 0z"/><rect x="46" y="1.5" width="25" height="11" rx="3.4" fill="none" stroke="currentColor" stroke-width="1" opacity=".4"/><rect x="48" y="3.5" width="21" height="7" rx="2" /><path d="M73 5v4c.8-.3 1.4-1.1 1.4-2S73.8 5.3 73 5z" opacity=".4"/></svg>`;

let instanceCount = 0;

export function createPhone(host, options = {}) {
  instanceCount += 1;
  const uid = `qp${instanceCount}`;
  const listeners = new Set();
  const built = new Map();
  const stale = new Set();

  const place = normalisePlace(options.place || ["New York", "US", 40.7128, -74.006, "America/New_York"]);
  const state = {
    place,
    asr: options.asr || undefined,
    method: options.method || "auto",
    theme: options.theme === "dark" ? "dark" : "light",
    stack: ["today"],
    sheet: null,
    offsets: {},
    alerts: { fajr: "adhan", dhuhr: "adhan", asr: "adhan", maghrib: "adhan", isha: "chime" },
    custom: { fajr: 15, isha: 15, interval: 0 },
    heading: 14,
    tick: options.tick !== false,
  };

  const clock = {
    anchorDate: options.date ? new Date(options.date).getTime() : Date.now(),
    anchorWall: Date.now(),
    scrub: null,
  };

  const model = createModel(state);
  const store = createStore(model, clock, state);

  const root = h("div", {
    class: "qp",
    "data-ui": "",
    "data-theme": state.theme,
    role: "group",
    "aria-label": "Qalm design preview, Today",
    tabindex: "0",
  });

  const status = h("div", { class: "qp-status", "aria-hidden": "true" },
    h("span", { class: "qp-clock" }),
    h("span", { class: "qp-icons", html: STATUS_ICONS }),
  );
  const ringRadius = 16;
  const ringLength = 2 * Math.PI * ringRadius;
  const ringFill = svg("circle", { cx: 18.5, cy: 18.5, r: ringRadius, fill: "none", "stroke-width": 2.5, "stroke-linecap": "round", class: "qpi-ring-fill", "stroke-dasharray": ringLength.toFixed(2), "stroke-dashoffset": ringLength.toFixed(2), transform: "rotate(-90 18.5 18.5)" });
  const islandParts = {
    ringGlyph: h("span", { class: "qpi-ring-glyph" }),
    glyph: h("span", { class: "qpi-glyph" }),
    left: h("span", { class: "qpi-left" }),
    bigGlyph: h("span", { class: "qpi-bigglyph" }),
    title: h("span", { class: "qpi-title" }),
    sub: h("span", { class: "qpi-sub" }),
    time: h("span", { class: "qpi-time" }),
    fill: h("span", { class: "qpi-fill" }),
  };
  const island = h("button", { type: "button", class: "qp-island", "data-mode": "idle", "aria-hidden": "true", tabindex: "-1" },
    h("span", { class: "qpi-layer qpi-minimal", "aria-hidden": "true" },
      svg("svg", { viewBox: "0 0 37 37", width: 37, height: 37, class: "qpi-ring" },
        svg("circle", { cx: 18.5, cy: 18.5, r: ringRadius, fill: "none", "stroke-width": 2.5, class: "qpi-ring-track" }),
        ringFill,
      ),
      islandParts.ringGlyph,
    ),
    h("span", { class: "qpi-layer qpi-compact", "aria-hidden": "true" },
      h("span", { class: "qpi-wing is-lead" }, islandParts.glyph),
      h("span", { class: "qpi-wing is-trail" }, islandParts.left),
    ),
    h("span", { class: "qpi-layer qpi-expanded", "aria-hidden": "true" },
      h("span", { class: "qpi-row" },
        islandParts.bigGlyph,
        h("span", { class: "qpi-copy" }, islandParts.title, islandParts.sub),
        islandParts.time,
      ),
      h("span", { class: "qpi-bar" }, islandParts.fill),
    ),
  );
  const viewsEl = h("div", { class: "qp-views" });
  const tabPill = h("span", { class: "qp-tabpill", "aria-hidden": "true" });
  const tabButtons = TABS.map((tab) => h("button", { type: "button", class: "qp-tab qpress", "data-tab": tab.key, onClick: () => goTab(tab.key) },
    icon(tab.icon, { size: 22, width: 1.8 }),
    h("span", { class: "qp-tab-label" }, tab.label),
  ));
  const tabbar = h("nav", { class: "qp-tabbar", "aria-label": "Qalm tabs" }, tabPill, ...tabButtons);
  const scrim = h("div", { class: "qp-scrim", hidden: true });
  const sheetEl = h("div", { class: "qp-sheet", role: "dialog", "aria-modal": "true", hidden: true, tabindex: "-1" });
  const toastEl = h("div", { class: "qp-toast", role: "status", "aria-live": "polite" });
  const dialogEl = h("div", { class: "qp-dialog-wrap", hidden: true });
  const glint = h("div", { class: "qp-glint", "aria-hidden": "true" });
  const sheen = h("div", { class: "qp-sheen", "aria-hidden": "true" });
  const homeBar = h("div", { class: "qp-home", "aria-hidden": "true" });
  const screen = h("div", { class: "qp-screen" }, viewsEl, status, island, tabbar, scrim, sheetEl, dialogEl, toastEl, sheen, glint, homeBar);
  const bezel = h("div", { class: "qp-bezel" }, screen);
  const sideButtons = ["action", "up", "down", "power"].map((kind) => h("i", { class: `qp-side qp-side-${kind}`, "aria-hidden": "true" }));
  const stage = h("div", { class: "qp-stage" }, ...sideButtons, bezel);
  const box = h("div", { class: "qp-box" }, stage);
  root.append(box);
  host.append(root);

  let tickTimer = null;
  let stopClock = null;
  let lastPhaseKey = "";
  let toastTimer = null;
  let returnFocus = null;
  let transitionToken = 0;

  const idle = createIdle({
    root,
    stage,
    sheen,
    activeView: () => built.get(state.stack[state.stack.length - 1]) || null,
  });

  const ctx = {
    state,
    store,
    model,
    uid,
    root,
    now: () => currentNow(),
    phase: () => model.phase(currentNow()),
    times: () => model.times(currentNow()),
    day: () => model.chosenDay(currentNow()),
    auto: () => model.autoDay(currentNow()),
    fmtParts: (date) => model.chosenDay(currentNow()).fmt(date),
    fmtText: (date) => model.chosenDay(currentNow()).fmtText(date),
    reduced: isReduced,
    go,
    back,
    goTab,
    openSheet,
    closeSheet,
    toast,
    confirm: openDialog,
    refresh,
    glint: () => sweepGlint({ force: true }),
    setState,
    emit,
    scrubTo,
    isScrubbed: () => clock.scrub !== null,
    backButton,
    sheetHeader,
    pageTitle,
    labelOf: (name) => LABELS[name],
    currentView: () => state.stack[state.stack.length - 1],
  };

  function currentNow() {
    if (clock.scrub !== null) return new Date(clock.scrub);
    const elapsed = state.tick ? Date.now() - clock.anchorWall : 0;
    return new Date(clock.anchorDate + elapsed);
  }

  function scrubTo(date) {
    idle.poke();
    clock.scrub = date === null ? null : date.getTime();
    if (date === null) {
      clock.anchorWall = Date.now();
    }
    refresh();
  }

  function snapshot() {
    return {
      view: state.stack[state.stack.length - 1],
      sheet: state.sheet,
      place: { ...state.place },
      asr: model.resolvedAsr(),
      method: state.method,
      theme: state.theme,
      date: currentNow(),
    };
  }

  function emit() {
    const payload = snapshot();
    for (const listener of listeners) listener(payload);
  }

  function setState(patch, { silent = false } = {}) {
    Object.assign(state, patch);
    root.dataset.theme = state.theme;
    refresh();
    if (!silent) emit();
  }

  function refresh() {
    lastPhaseKey = phaseKey();
    const topName = state.stack[state.stack.length - 1];

    for (const [name, view] of built) {
      const isVisible = name === topName || !view.el.hidden;
      if (isVisible) {
        view.update?.();
        stale.delete(name);
      } else {
        stale.add(name);
      }
    }
    updateStatus();
    paintIsland();
  }

  function phaseKey() {
    const now = currentNow();
    const phase = model.phase(now);
    const { y, m, d } = zonedParts(now, state.place.tz);
    return `${phase.mode}:${phase.key}:${y}-${m}-${d}`;
  }

  const ISLAND_SHAPE = { idle: "idle", minimal: "minimal", compact: "compact", expanded: "expanded", iftar: "compact" };
  const ISLAND_AUTO_COLLAPSE_MS = 6000;
  const islandAbort = new AbortController();
  const islandListen = { signal: islandAbort.signal };

  let restMode = "idle";
  let islandShape = "idle";
  let islandKey = "";
  let islandLabel = "";
  let islandHovering = false;
  let collapseTimer = null;

  const ALERT_HOLD_MS = 3500;
  const ALERT_SETTLE_MS = 300;
  const ALERT_WINDOW_MS = 120000;
  const ALERT_LIVE_GAP_MS = 300000;
  let alertInfo = null;
  let alertTimer = null;
  let settleTimer = null;
  let lastSeenMs = null;
  let isLiveClock = true;
  let canScrubAlert = false;
  const alertedStarts = new Set();

  function islandInfo(now) {
    const times = model.times(now);
    const names = ctx.day().names;
    const dayMs = 86400000;

    if (restMode === "iftar") {
      const hasPassed = times.maghrib <= now;
      const target = hasPassed ? model.times(new Date(now.getTime() + dayMs)).maghrib : times.maghrib;
      const span = times.maghrib - times.fajr;
      const raw = hasPassed ? 1 : (now - times.fajr) / span;
      return { key: "maghrib", glyph: "moon", title: "Iftar", target, progress: raw, sub: "until Maghrib" };
    }

    const upcoming = model.nextWindow(now);
    return { key: upcoming.key, glyph: PRAYER_ICON[upcoming.key], title: names[upcoming.key], target: upcoming.time, progress: upcoming.progress, sub: "until " + names[upcoming.key] };
  }

  function alertView() {
    const names = ctx.day().names;
    const title = `${names[alertInfo.key]}, it's time`;
    return { glyph: PRAYER_ICON[alertInfo.key], title, target: alertInfo.time, progress: 1, sub: "Now" };
  }

  function wingCountdown(parts) {
    const pad = (value) => String(value).padStart(2, "0");
    const hasHours = parts.totalSeconds >= 3600;
    if (!hasHours) return `${parts.minutes}:${pad(parts.seconds)}`;

    return `${parts.hours}:${pad(parts.minutes)}`;
  }

  function paintIsland() {
    if (islandShape === "idle") return;
    const now = currentNow();
    const isAlerting = alertInfo !== null;
    const info = isAlerting ? alertView() : islandInfo(now);
    const parts = countdownParts(now, info.target);
    const countdown = isAlerting ? info.sub : countdownText(parts);
    const timeText = ctx.fmtText(info.target);
    const glyphKey = `${info.glyph}`;
    const progress = Math.max(0.02, Math.min(1, info.progress));

    if (glyphKey !== islandKey) {
      islandKey = glyphKey;
      islandParts.ringGlyph.replaceChildren(icon(info.glyph, { size: 15, width: 1.8 }));
      islandParts.glyph.replaceChildren(icon(info.glyph, { size: 18, width: 1.8 }));
      islandParts.bigGlyph.replaceChildren(icon(info.glyph, { size: 24, width: 1.7 }));
    }

    islandParts.left.textContent = isAlerting ? "Now" : wingCountdown(parts);
    islandParts.title.textContent = info.title;
    islandParts.sub.textContent = countdown;
    islandParts.time.textContent = timeText;
    islandParts.fill.style.transform = `scaleX(${progress.toFixed(3)})`;
    ringFill.style.strokeDashoffset = (ringLength * (1 - progress)).toFixed(2);

    const spoken = isAlerting ? "" : ` ${countdownSpoken(parts)}`;
    const label = `Live Activity. ${info.title}${spoken}, at ${timeText}.`;
    if (label !== islandLabel) {
      islandLabel = label;
      island.setAttribute("aria-label", label);
    }
  }

  function isUserOpen() {
    const isExpanded = islandShape === "expanded";
    const isRestingOpen = restMode === "expanded";
    return isExpanded && !isRestingOpen;
  }

  function isIslandEngaged() {
    const hasKeyboardFocus = island.matches(":focus-visible");
    return islandHovering || hasKeyboardFocus;
  }

  function clearCollapseTimer() {
    if (collapseTimer === null) return;
    clearTimeout(collapseTimer);
    collapseTimer = null;
  }

  function armCollapse() {
    clearCollapseTimer();
    if (!isUserOpen()) return;
    if (isIslandEngaged()) return;

    collapseTimer = setTimeout(() => {
      collapseTimer = null;
      if (isIslandEngaged()) return;
      collapseIsland();
    }, ISLAND_AUTO_COLLAPSE_MS);
  }

  function bindOutsideTap(shouldBind) {
    document.removeEventListener("pointerdown", onOutsidePointer, true);
    if (!shouldBind) return;

    document.addEventListener("pointerdown", onOutsidePointer, true);
  }

  function onOutsidePointer(event) {
    const isInsideIsland = island.contains(event.target);
    if (isInsideIsland) return;

    const isInsidePhone = root.contains(event.target);
    const isChapterOpen = restMode === "expanded";
    const ignoreTap = isChapterOpen && !isInsidePhone;
    if (ignoreTap) return;

    collapseIsland();
  }

  function collapseIsland() {
    const target = restMode === "expanded" ? "compact" : ISLAND_SHAPE[restMode];
    if (target === islandShape) return;
    applyIslandShape(target);
  }

  function applyIslandShape(nextShape) {
    clearCollapseTimer();
    if (nextShape !== "expanded") cancelAlert();
    bindOutsideTap(false);

    islandShape = nextShape;
    island.dataset.mode = nextShape;
    root.dataset.island = nextShape;

    if (nextShape === "idle") {
      islandHovering = false;
      if (document.activeElement === island) island.blur();
      island.setAttribute("aria-hidden", "true");
      island.setAttribute("tabindex", "-1");
      island.removeAttribute("aria-expanded");
      island.removeAttribute("aria-label");
      islandLabel = "";
      return;
    }

    island.removeAttribute("aria-hidden");
    island.removeAttribute("tabindex");
    island.setAttribute("aria-expanded", String(nextShape === "expanded"));
    islandKey = "";
    paintIsland();

    if (nextShape === "expanded") bindOutsideTap(true);
    armCollapse();
  }

  function setIsland(mode) {
    idle.poke();
    if (mode === undefined) return restMode;
    if (!(mode in ISLAND_SHAPE)) return restMode;

    const isSameMode = mode === restMode;
    const hasOverride = islandShape !== ISLAND_SHAPE[restMode];
    const isAlerting = alertInfo !== null;
    if (isSameMode && (!hasOverride || isAlerting)) return restMode;

    restMode = mode;
    applyIslandShape(ISLAND_SHAPE[mode]);
    return restMode;
  }

  function clearAlertTimers() {
    clearTimeout(alertTimer);
    clearTimeout(settleTimer);
    alertTimer = null;
    settleTimer = null;
  }

  function cancelAlert() {
    clearTimeout(alertTimer);
    alertTimer = null;
    alertInfo = null;
  }

  function presentAlert(key, time) {
    if (islandShape === "idle") return;

    clearTimeout(alertTimer);
    alertInfo = { key, time };
    applyIslandShape("expanded");
    alertTimer = setTimeout(() => {
      alertTimer = null;
      applyIslandShape(ISLAND_SHAPE[restMode]);
    }, ALERT_HOLD_MS);
  }

  function rememberStart(time) {
    if (alertedStarts.size > 24) alertedStarts.clear();
    alertedStarts.add(time.getTime());
  }

  function detectLiveCrossing(previousMs, nowMs) {
    if (previousMs === null) return;

    const gap = nowMs - previousMs;
    const isPlausible = gap > 0 && gap <= ALERT_LIVE_GAP_MS;
    if (!isPlausible) return;

    const phase = model.phase(new Date(nowMs));
    if (phase.mode !== "now") return;

    const startMs = phase.time.getTime();
    const hasCrossed = previousMs < startMs && startMs <= nowMs;
    const isNew = !alertedStarts.has(startMs);
    if (!(hasCrossed && isNew)) return;

    rememberStart(phase.time);
    presentAlert(phase.key, phase.time);
  }

  function settleScrubAlert() {
    settleTimer = null;
    if (!canScrubAlert) return;

    const now = currentNow();
    const phase = model.phase(now);
    if (phase.mode !== "now") return;

    const since = now.getTime() - phase.time.getTime();
    const isInWindow = since >= 0 && since < ALERT_WINDOW_MS;
    const isNew = !alertedStarts.has(phase.time.getTime());
    if (!(isInWindow && isNew)) return;

    rememberStart(phase.time);
    presentAlert(phase.key, phase.time);
  }

  function observeClock(isLive, canAlertOnScrub) {
    const nowMs = currentNow().getTime();
    const wasScrubbing = !isLiveClock;
    isLiveClock = isLive;
    canScrubAlert = canAlertOnScrub;

    if (isLive) {
      clearTimeout(settleTimer);
      settleTimer = null;
      if (wasScrubbing) alertedStarts.clear();
      const previous = wasScrubbing ? null : lastSeenMs;
      lastSeenMs = nowMs;
      detectLiveCrossing(previous, nowMs);
      return;
    }

    lastSeenMs = null;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settleScrubAlert, ALERT_SETTLE_MS);
  }

  function showAlert(key) {
    idle.poke();
    const now = currentNow();
    const next = model.nextWindow(now);
    const wanted = key || next.key;
    const time = wanted === next.key ? next.time : model.times(now)[wanted];
    if (!time) return;

    presentAlert(wanted, time);
  }

  function dropAlert() {
    clearAlertTimers();
    alertedStarts.clear();
    if (alertInfo === null) return;

    applyIslandShape(ISLAND_SHAPE[restMode]);
  }

  function collapseIslandForNavigation() {
    if (isUserOpen()) collapseIsland();
  }

  function teardownIsland() {
    clearCollapseTimer();
    clearAlertTimers();
    bindOutsideTap(false);
    islandAbort.abort();
  }

  island.addEventListener("click", () => {
    if (islandShape === "idle") return;
    if (islandShape === "expanded") collapseIsland();
    else applyIslandShape("expanded");
  }, islandListen);

  island.addEventListener("keydown", (event) => {
    const isEscape = event.key === "Escape";
    const isOpen = islandShape === "expanded";
    const shouldCollapse = isEscape && isOpen;
    if (!shouldCollapse) return;

    event.preventDefault();
    event.stopPropagation();
    collapseIsland();
  }, islandListen);

  island.addEventListener("pointerenter", (event) => {
    if (event.pointerType !== "mouse") return;
    islandHovering = true;
    armCollapse();
  }, islandListen);

  island.addEventListener("pointerleave", () => {
    islandHovering = false;
    armCollapse();
  }, islandListen);

  island.addEventListener("focusin", armCollapse, islandListen);
  island.addEventListener("focusout", armCollapse, islandListen);

  function updateStatus() {
    const parts = ctx.fmtParts(currentNow());
    clockEl.textContent = parts.time;
    clockEl.dataset.rolled = parts.time;
  }

  const clockEl = status.querySelector(".qp-clock");

  function tick() {
    const now = currentNow();
    const key = phaseKey();
    const phase = model.phase(now);

    updateStatus();
    paintIsland();

    if (isLiveClock) {
      const nowMs = now.getTime();
      detectLiveCrossing(lastSeenMs, nowMs);
      lastSeenMs = nowMs;
    }

    if (key !== lastPhaseKey) {
      refresh();
      return;
    }

    const view = built.get(state.stack[state.stack.length - 1]);
    view?.tick?.(now, phase);
  }

  function startTicking() {
    stopTicking();

    if (options.clock) {
      const offSecond = options.clock.on("second", tick);
      const offWake = options.clock.on("wake", () => {
        lastSeenMs = null;
        refresh();
      });
      stopClock = () => {
        offSecond();
        offWake();
      };
      return;
    }

    tickTimer = setInterval(tick, 1000);
  }

  function stopTicking() {
    if (tickTimer) clearInterval(tickTimer);
    tickTimer = null;
    stopClock?.();
    stopClock = null;
  }

  function ensureView(name) {
    if (built.has(name)) return built.get(name);

    const builder = VIEW_BUILDERS[name];
    const view = builder(ctx);
    view.el.dataset.view = name;
    view.el.hidden = true;
    view.el.inert = true;
    viewsEl.append(view.el);
    built.set(name, view);
    view.update?.();
    return view;
  }

  function prebuild(name) {
    if (!VIEW_BUILDERS[name] || built.has(name)) return;
    ensureView(name);
  }

  function stackFor(name) {
    return STACKS[name] ? [...STACKS[name]] : ["today"];
  }

  function labelRoot() {
    const top = state.stack[state.stack.length - 1];
    const current = state.sheet || top;
    root.setAttribute("aria-label", `Qalm design preview, ${LABELS[current] || current}`);
  }

  function applyChrome() {
    const top = state.stack[state.stack.length - 1];
    labelRoot();
    const activeTab = ROOT_TAB[state.stack[0]];
    const hasTabbar = top !== "lock";
    tabbar.hidden = !hasTabbar;

    tabButtons.forEach((node, index) => {
      const isActive = TABS[index].key === activeTab;
      node.classList.toggle("is-active", isActive);
      if (isActive) node.setAttribute("aria-current", "page");
      else node.removeAttribute("aria-current");
      if (isActive) movePill(index);
    });

    const dark = top === "lock";
    root.classList.toggle("is-lock", dark);
  }

  const pillSpring = spring((x) => {
    const stretch = 1 + Math.min(0.14, Math.abs(pillSpring.velocity) / 7000);
    tabPill.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0) scaleX(${stretch.toFixed(3)})`;
  }, { stiffness: 260, damping: 22 });

  function movePill(index) {
    const x = index * 82;
    const isFirst = tabPill.dataset.ready !== "true";
    tabPill.dataset.ready = "true";

    if (isFirst) {
      pillSpring.set(x);
      return;
    }
    pillSpring.to(x);
  }

  function labelBackButtons(viewName) {
    const index = state.stack.indexOf(viewName);
    const previous = state.stack[index - 1];
    const view = built.get(viewName);
    if (!view || !previous) return;

    for (const node of view.el.querySelectorAll("[data-back-label]")) {
      node.textContent = LABELS[previous];
    }
  }

  let activeMove = null;
  let moveTimeline = null;

  function buildMove(prevEl, nextEl, kind) {
    const { gsap } = window;
    const timeline = gsap.timeline({ paused: true, defaults: { ease: "none" } });

    if (kind === "tab") {
      timeline
        .fromTo(nextEl, { y: 12, opacity: 0 }, { y: 0, opacity: 1 }, 0)
        .fromTo(prevEl, { opacity: 1 }, { opacity: 0 }, 0);
      return timeline;
    }

    const isPop = kind === "pop";
    prevEl.style.zIndex = isPop ? "2" : "1";
    nextEl.style.zIndex = isPop ? "1" : "2";
    (isPop ? prevEl : nextEl).classList.add("is-sliding");

    if (isPop) {
      timeline
        .fromTo(prevEl, { xPercent: 0 }, { xPercent: 100 }, 0)
        .fromTo(nextEl, { xPercent: -26, opacity: 0.55 }, { xPercent: 0, opacity: 1 }, 0);
    } else {
      timeline
        .fromTo(nextEl, { xPercent: 100 }, { xPercent: 0 }, 0)
        .fromTo(prevEl, { xPercent: 0, opacity: 1 }, { xPercent: -26, opacity: 0.55 }, 0);
    }
    return timeline;
  }

  function stopMove() {
    activeMove?.kill();
    moveTimeline?.kill();
    activeMove = null;
    moveTimeline = null;
  }

  function transition(from, to, kind, dragged = null) {
    idle.poke();
    transitionToken += 1;
    const token = transitionToken;
    const active = document.activeElement;
    const focusWasInside = Boolean(active) && active !== root && root.contains(active) && !screen.inert;
    const pointerDrove = performance.now() - lastPointerAt < 1500;
    const pointerOnTabbar = pointerDrove && lastPointerTarget && tabbar.contains(lastPointerTarget);
    const focusWasOnTabbar = tabbar.contains(active) || Boolean(pointerOnTabbar);
    const isTabSwitch = kind === "tab";
    const shouldMoveFocus = Boolean(from) && (focusWasInside || pointerDrove) && !(isTabSwitch && focusWasOnTabbar) && !screen.inert;
    const nextView = ensureView(to);
    if (stale.delete(to)) nextView.update?.();
    nextView.onShow?.();
    const prevView = from ? built.get(from) : null;

    for (const [name, view] of built) {
      const isKept = name === to || name === from;
      if (!isKept) {
        view.el.hidden = true;
        view.el.inert = true;
        clearMotion(view.el);
      }
    }

    if (!dragged) {
      stopMove();
      clearMotion(nextView.el);
      if (prevView) clearMotion(prevView.el);
    }

    nextView.el.hidden = false;
    nextView.el.inert = false;
    viewsEl.classList.add("is-moving");
    if (shouldMoveFocus) focusIntoView(nextView);

    const finish = () => {
      if (token !== transitionToken) return;
      if (prevView && prevView !== nextView) {
        prevView.el.hidden = true;
        prevView.el.inert = true;
        clearMotion(prevView.el);
        prevView.el.classList.remove("is-sliding");
      }
      clearMotion(nextView.el);
      nextView.el.classList.remove("is-sliding");
      viewsEl.classList.remove("is-moving");
      nextView.onEnter?.();
    };

    const canAnimate = prevView && prevView !== nextView && window.gsap && !isReduced();
    if (!canAnimate) {
      if (prevView && prevView !== nextView) {
        prevView.el.hidden = true;
        prevView.el.inert = true;
      }
      finish();
      return;
    }

    const { gsap } = window;
    moveTimeline = dragged || buildMove(prevView.el, nextView.el, kind);
    const remaining = 1 - moveTimeline.progress();
    const duration = (kind === "tab" ? DURATION.base : DURATION.view) * Math.max(0.35, remaining);
    activeMove = gsap.to(moveTimeline, { progress: 1, duration, ease: EASE.out, onComplete: finish });
  }

  let hasShownGlint = false;

  function sweepGlint({ force = false } = {}) {
    if (isReduced() || !window.gsap) return;
    if (hasShownGlint && !force) return;
    hasShownGlint = true;
    window.gsap.fromTo(glint, { x: -180, opacity: 0 }, { x: 640, opacity: 1, duration: 1.1, ease: "power2.inOut", overwrite: "auto", onComplete: () => window.gsap.set(glint, { opacity: 0 }) });
  }

  function setStack(next, kind, dragged = null) {
    const from = state.stack[state.stack.length - 1];
    state.stack = next;
    const to = next[next.length - 1];
    collapseIslandForNavigation();
    closeSheetNow();
    applyChrome();
    transition(from === to ? null : from, to, kind, dragged);
    labelBackButtons(to);
    updateStatus();
  }

  function goTab(key) {
    const isSame = state.stack.length === 1 && state.stack[0] === key;
    if (isSame) {
      built.get(key)?.scrollTop?.();
      return;
    }
    setStack([key], "tab");
    emit();
  }

  function go(name) {
    const existingIndex = state.stack.indexOf(name);
    if (existingIndex !== -1) {
      setStack(state.stack.slice(0, existingIndex + 1), "pop");
      emit();
      return;
    }
    if (ROOT_TAB[name]) {
      goTab(name);
      return;
    }
    setStack([...state.stack, name], "push");
    emit();
  }

  function back() {
    if (state.stack.length < 2) return;
    setStack(state.stack.slice(0, -1), "pop");
    emit();
  }

  function backButton(extraClass = "") {
    return h("button", { type: "button", class: `qv-back qpress ${extraClass}`.trim(), onClick: back },
      icon("chevronLeft", { size: 22, width: 2.2 }),
      h("span", { "data-back-label": "" }, "Back"),
    );
  }

  function pageTitle(title, ...trailing) {
    return h("div", { class: "qv-titlerow" }, h("h2", { class: "qv-title" }, title), trailing.length ? h("div", { class: "qv-trailing" }, ...trailing) : null);
  }

  function sheetHeader(title) {
    return h("div", { class: "qs-head" },
      h("h2", { class: "qs-title" }, title),
      h("button", { type: "button", class: "qs-close qpress", onClick: () => closeSheet() }, "Close"),
    );
  }

  let lastPointerTarget = null;
  let lastPointerAt = 0;

  root.addEventListener("pointerdown", (event) => {
    lastPointerAt = performance.now();
    lastPointerTarget = event.target.closest("button, [href], input, select, textarea, [tabindex]") || null;
  }, true);

  function openerFor(active) {
    const hasKeyboardFocus = active && active !== document.body && active !== root;
    if (hasKeyboardFocus) return active;
    const hasPointerOpener = lastPointerTarget && lastPointerTarget.isConnected && root.contains(lastPointerTarget);
    return hasPointerOpener ? lastPointerTarget : active;
  }

  function focusIntoView(view) {
    const heading = view.el.querySelector(".qv-title, .qs-title");
    const fallback = focusables(view.el)[0] || view.el.querySelector(".qv-scroll");
    const target = heading || fallback;
    if (!target) return;
    if (heading && heading.tabIndex < 0) heading.tabIndex = -1;
    target.focus({ preventScroll: true });
  }

  function trapTab(event) {
    const container = !dialogEl.hidden ? dialogEl : state.sheet ? sheetEl : null;
    if (!container) return;

    const isClosing = container.inert;
    if (isClosing) return;

    const nodes = focusables(container);
    if (!nodes.length) {
      event.preventDefault();
      return;
    }

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    const isOutside = !container.contains(active) || active === container;
    const wrapsBackward = event.shiftKey && (active === first || isOutside);
    const wrapsForward = !event.shiftKey && (active === last || isOutside);

    if (wrapsBackward) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (wrapsForward) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function focusables(container) {
    return [...container.querySelectorAll("button, input, [href], select, textarea, [tabindex]:not([tabindex='-1'])")].filter((node) => !node.disabled && !node.hidden && node.offsetParent !== null);
  }

  function setBackdropInert(isInert) {
    viewsEl.inert = isInert;
    tabbar.inert = isInert;
  }

  let sheetP = 0;
  let sheetDrag = 0;

  function paintSheet() {
    const offset = (1 - sheetP) * 104;
    const fade = Math.max(0, Math.min(1, sheetP)) * (1 - Math.min(0.5, Math.max(0, sheetDrag) / 700));
    sheetEl.style.transform = `translate3d(0, calc(${offset.toFixed(2)}% + ${sheetDrag.toFixed(1)}px), 0)`;
    scrim.style.opacity = fade.toFixed(3);
  }

  const sheetSpring = spring((value) => {
    sheetP = Math.min(1.004, value);
    paintSheet();
  }, { stiffness: 230, damping: 28, precision: 0.001 });

  function openSheet(name, props = {}) {
    idle.poke();
    const baseView = SHEET_BASE[name];
    if (baseView && state.stack[state.stack.length - 1] !== baseView) {
      state.stack = stackFor(baseView);
      applyChrome();
      transition(null, baseView, "tab");
    }

    if (state.sheet) closeSheetNow();

    const builder = SHEET_BUILDERS[name];
    const content = builder(ctx, props);
    state.sheet = name;
    returnFocus = openerFor(document.activeElement);
    labelRoot();

    sheetEl.dataset.sheet = name;
    sheetEl.setAttribute("aria-label", content.label || name);
    content.el.setAttribute("data-lenis-prevent", "");
    sheetEl.replaceChildren(h("div", { class: "qs-grab", "aria-hidden": "true" }, h("span")), content.el);
    sheetEl.dataset.tall = content.tall ? "true" : "false";
    sheetEl.dataset.dark = content.dark ? "true" : "false";
    scrim.dataset.dark = content.dark ? "true" : "false";
    sheetEl.__content = content;

    scrim.hidden = false;
    sheetEl.hidden = false;
    setBackdropInert(true);
    sheetDrag = 0;
    sheetSpring.set(0);
    sheetSpring.to(1);

    const target = focusables(sheetEl).find((node) => !node.classList.contains("qs-close") && node.tabIndex >= 0) || sheetEl;
    requestAnimationFrame(() => target.focus({ preventScroll: true }));
    emit();
  }

  function closeSheetNow() {
    if (!state.sheet) return;
    sheetSpring.set(0);
    sheetDrag = 0;
    sheetEl.style.transform = "";
    scrim.style.opacity = "";
    sheetEl.hidden = true;
    scrim.hidden = true;
    sheetEl.__content?.onClose?.();
    sheetEl.replaceChildren();
    state.sheet = null;
    setBackdropInert(false);
    labelRoot();
  }

  function closeSheet() {
    idle.poke();
    if (!state.sheet) return;

    const focusTarget = returnFocus;
    const canAnimate = window.gsap && !isReduced();
    const done = () => {
      closeSheetNow();
      const canReturn = focusTarget && focusTarget.isConnected && focusTarget !== document.body && !focusTarget.closest("[hidden]");
      if (canReturn) focusTarget.focus({ preventScroll: true });
      else focusIntoView(built.get(state.stack[state.stack.length - 1]));
      emit();
    };

    if (!canAnimate) {
      done();
      return;
    }

    sheetEl.inert = true;
    sheetSpring.to(0, () => { sheetEl.inert = false; done(); });
  }

  function openDialog({ title, body, confirmLabel, destructive = false }, onConfirm) {
    const previousFocus = document.activeElement;
    const cancel = button("Cancel", "qb-quiet qdlg-btn", () => close());
    const confirmButton = button(confirmLabel, `qdlg-btn ${destructive ? "qb-danger" : "qb-ghost"}`, () => { close(); onConfirm(); });
    const card = h("div", { class: "qdlg", role: "alertdialog", "aria-modal": "true", "aria-label": title },
      h("h3", { class: "qdlg-title" }, title),
      h("p", { class: "qdlg-body" }, body),
      h("div", { class: "qdlg-actions" }, cancel, confirmButton),
    );

    function close() {
      dialogEl.hidden = true;
      dialogEl.replaceChildren();
      setBackdropInert(Boolean(state.sheet));
      sheetEl.inert = false;
      previousFocus?.focus?.({ preventScroll: true });
    }

    dialogEl.__close = close;
    dialogEl.replaceChildren(h("div", { class: "qdlg-scrim", onClick: close }), card);
    dialogEl.hidden = false;
    setBackdropInert(true);
    sheetEl.inert = true;
    animateFrom(card, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.32, ease: "power3.out" });
    cancel.focus({ preventScroll: true });
  }

  function toast(text, { actionLabel, onAction, duration } = {}) {
    clearTimeout(toastTimer);
    const message = h("span", { class: "qt-text" }, text);
    const action = actionLabel ? h("button", { type: "button", class: "qt-action qpress", onClick: () => { onAction?.(); hide(); } }, actionLabel) : null;
    toastEl.replaceChildren(h("div", { class: "qt" }, message, action));
    toastEl.dataset.open = "true";
    animateFrom(toastEl.firstChild, { y: 18, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: "power3.out" });
    toastTimer = setTimeout(hide, duration || (actionLabel ? 10000 : 3600));

    function hide() {
      clearTimeout(toastTimer);
      toastEl.dataset.open = "false";
      toastEl.replaceChildren();
    }
  }

  root.addEventListener("keydown", (event) => {
    if (event.key === "Tab") {
      trapTab(event);
      return;
    }

    if (event.key !== "Escape") {
      const isRoot = event.target === root;
      const isEnter = event.key === "Enter" || event.key === " ";
      if (isRoot && isEnter && screen.inert) {
        event.preventDefault();
        unpark();
      }
      return;
    }

    if (!dialogEl.hidden) {
      dialogEl.__close?.();
      event.stopPropagation();
      return;
    }
    if (state.sheet) {
      closeSheet();
      event.stopPropagation();
      return;
    }
    if (state.stack.length > 1) {
      back();
      event.stopPropagation();
      return;
    }
    park();
  });

  root.addEventListener("pointerdown", () => {
    if (screen.inert) unpark();
  });

  function park() {
    screen.inert = true;
    root.dataset.parked = "true";
    root.focus({ preventScroll: true });
  }

  function unpark() {
    screen.inert = false;
    delete root.dataset.parked;
    const first = focusables(screen)[0];
    first?.focus({ preventScroll: true });
  }

  setupSheetDrag();

  function setupSheetDrag() {
    let startY = null;
    let lastY = 0;
    let lastAt = 0;
    let velocity = 0;

    sheetEl.addEventListener("pointerdown", (event) => {
      const onHandle = event.target.closest(".qs-grab, .qs-head");
      const isButton = event.target.closest("button");
      if (!onHandle || isButton) return;
      startY = event.clientY;
      lastY = startY;
      lastAt = performance.now();
      velocity = 0;
      sheetSpring.stop();
      sheetEl.setPointerCapture(event.pointerId);
    });

    sheetEl.addEventListener("pointermove", (event) => {
      if (startY === null) return;
      const scale = root.getBoundingClientRect().width / 440 || 1;
      const raw = (event.clientY - startY) / scale;
      const now = performance.now();
      const elapsed = Math.max(1, now - lastAt);

      velocity = velocity * 0.5 + (((event.clientY - lastY) / scale) / elapsed) * 1000 * 0.5;
      lastY = event.clientY;
      lastAt = now;

      sheetDrag = raw >= 0 ? raw : -Math.sqrt(-raw) * 3.2;
      paintSheet();
    });

    const release = () => {
      if (startY === null) return;
      startY = null;

      const height = sheetEl.offsetHeight || 600;
      const shouldClose = sheetDrag > 110 || velocity > 700;
      const fromP = 1 - sheetDrag / (height * 1.04);

      sheetP = fromP;
      sheetDrag = 0;
      sheetSpring.set(fromP);
      paintSheet();

      if (shouldClose) {
        sheetSpring.kick(-velocity / height / 1.04);
        closeSheet();
        return;
      }

      sheetSpring.kick(-velocity / height / 1.04);
      sheetSpring.to(1);
    };
    sheetEl.addEventListener("pointerup", release);
    sheetEl.addEventListener("pointercancel", release);
  }

  function setupEdgeSwipe() {
    const edge = h("div", { class: "qp-edge", "aria-hidden": "true" });
    screen.insertBefore(edge, viewsEl.nextSibling);

    let swipe = null;

    edge.addEventListener("pointerdown", (event) => {
      const canSwipe = state.stack.length > 1 && !state.sheet && window.gsap && !isReduced();
      if (!canSwipe) return;

      const topName = state.stack[state.stack.length - 1];
      const underName = state.stack[state.stack.length - 2];
      const topView = built.get(topName);
      const underView = ensureView(underName);
      if (!topView) return;

      stopMove();
      transitionToken += 1;
      if (stale.delete(underName)) underView.update?.();
      clearMotion(topView.el);
      clearMotion(underView.el);
      underView.el.hidden = false;
      underView.el.inert = false;
      viewsEl.classList.add("is-moving");

      swipe = {
        startX: event.clientX,
        lastX: event.clientX,
        lastAt: performance.now(),
        velocity: 0,
        timeline: buildMove(topView.el, underView.el, "pop"),
        topView,
        underView,
      };
      swipe.timeline.progress(0.0001);
      edge.setPointerCapture(event.pointerId);
    });

    edge.addEventListener("pointermove", (event) => {
      if (!swipe) return;
      const scale = root.getBoundingClientRect().width / 440 || 1;
      const now = performance.now();
      const elapsed = Math.max(1, now - swipe.lastAt);

      swipe.velocity = swipe.velocity * 0.5 + (((event.clientX - swipe.lastX) / scale) / elapsed) * 1000 * 0.5;
      swipe.lastX = event.clientX;
      swipe.lastAt = now;
      swipe.timeline.progress(Math.max(0, Math.min(1, (event.clientX - swipe.startX) / scale / 440)));
    });

    const release = () => {
      if (!swipe) return;
      const current = swipe;
      swipe = null;

      const progress = current.timeline.progress();
      const shouldCommit = progress > 0.4 || current.velocity > 520;

      if (shouldCommit) {
        setStack(state.stack.slice(0, -1), "pop", current.timeline);
        emit();
        return;
      }

      window.gsap.to(current.timeline, {
        progress: 0,
        duration: DURATION.base,
        ease: EASE.out,
        onComplete: () => {
          current.timeline.kill();
          current.underView.el.hidden = true;
          current.underView.el.inert = true;
          clearMotion(current.underView.el);
          clearMotion(current.topView.el);
          current.topView.el.classList.remove("is-sliding");
          viewsEl.classList.remove("is-moving");
        },
      });
    };
    edge.addEventListener("pointerup", release);
    edge.addEventListener("pointercancel", release);
  }

  function setupRipples() {
    const targets = ".qgroup-row, .qlist-row, .qr-row, .qb, .qs-row, .qbm-row";

    screen.addEventListener("pointerdown", (event) => {
      if (isReduced() || !window.gsap) return;
      const target = event.target.closest(targets);
      if (!target || target.disabled || target.classList.contains("qgroup-static")) return;

      const box = target.getBoundingClientRect();
      const scale = box.width / target.offsetWidth || 1;
      const reach = Math.hypot(box.width, box.height) / scale;
      const host = h("span", { class: "qp-ripple-host", "aria-hidden": "true" });
      const dot = h("span", { class: "qp-ripple" });

      dot.style.width = `${reach * 2}px`;
      dot.style.height = `${reach * 2}px`;
      dot.style.left = `${(event.clientX - box.left) / scale - reach}px`;
      dot.style.top = `${(event.clientY - box.top) / scale - reach}px`;
      host.append(dot);
      target.classList.add("qp-rip");
      target.append(host);

      window.gsap.fromTo(dot, { scale: 0.08, opacity: 0.16 }, {
        scale: 1,
        opacity: 0,
        duration: DURATION.slow,
        ease: "power2.out",
        onComplete: () => host.remove(),
      });
    }, { passive: true });
  }

  setupEdgeSwipe();
  setupRipples();

  scrim.addEventListener("click", () => closeSheet());

  const api = {
    element: root,
    prebuild,
    show(name, extra) {
      const isSheet = Boolean(SHEET_BUILDERS[name]) && name !== "prayer" && name !== "custom";
      if (isSheet) {
        if (name === "plus" && !state.stack.length) state.stack = ["today"];
        openSheet(name, extra);
        return;
      }

      closeSheetNow();
      const next = stackFor(name);
      const same = next.join() === state.stack.join();
      if (same) {
        emit();
        return;
      }
      setStack(next, ROOT_TAB[name] && next.length === 1 ? "tab" : "push");
      emit();
    },
    set(patch = {}) {
      const next = {};
      if (patch.place) next.place = normalisePlace(patch.place);
      if ("asr" in patch) next.asr = patch.asr || undefined;
      if ("method" in patch) next.method = patch.method || "auto";
      if (patch.theme) next.theme = patch.theme === "dark" ? "dark" : "light";
      if ("tick" in patch) next.tick = patch.tick !== false;

      if (patch.date) {
        clock.anchorDate = new Date(patch.date).getTime();
        clock.anchorWall = Date.now();
        clock.scrub = null;
      }

      Object.assign(state, next);
      root.dataset.theme = state.theme;
      if (next.place) store.resetForPlace();
      refresh();
      if (patch.date) observeClock(patch.live !== false, patch.scrubAlerts === true);
    },
    island: setIsland,
    idle,
    alert: showAlert,
    cancelAlert: dropAlert,
    on(type, callback) {
      if (type !== "change") return () => {};
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    get element() {
      return root;
    },
    destroy() {
      idle.destroy();
      stopTicking();
      teardownIsland();
      stopMove();
      sheetSpring.stop();
      pillSpring.stop();
      clearTimeout(toastTimer);
      listeners.clear();
      for (const view of built.values()) view.destroy?.();
      built.clear();
      root.remove();
    },
  };

  applyChrome();
  transition(null, "today", "tab");
  updateStatus();
  lastPhaseKey = phaseKey();
  startTicking();

  if ("IntersectionObserver" in window) {
    const firstSight = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      firstSight.disconnect();
      setTimeout(() => sweepGlint(), 700);
    });
    firstSight.observe(root);
  }

  return api;
}

function createStore(model, clock, state) {
  const store = {
    khatm: null,
    resume: { surah: 18, ayah: 45, page: 299 },
    bookmarks: [],
    recents: [],
    nights: { reminders: new Set([21, 23, 25, 27, 29]), suggestions: ["Long recitation", "Dua for family", "Give charity"] },
    plusPlan: "yearly",
    location: true,
    resetForPlace() {
      store.khatm = null;
    },
    ramadan() {
      const now = new Date(clock.anchorDate);
      const { y, m, d } = zonedParts(now, state.place.tz);
      return ramadanBounds(civil.fromParts(y, m, d));
    },
  };
  return store;
}
