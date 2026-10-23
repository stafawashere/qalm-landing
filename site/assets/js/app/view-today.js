import { h, svg, icon, ripple, formatTimeParts, clear } from "./dom.js";
import { countdownParts, countdownText, countdownSpoken, ALERTING } from "./model.js";
import { DAILY_AYAH_KEYS, ayahByRef, surahOf, TOTAL_PAGES, civil, resumeLabel, resumePageLabel } from "./data.js";
import { zonedParts } from "../sky.js";
import { rollText } from "../roll.js";
import { DURATION, EASE } from "../tokens.js";

const ARABIC_NAMES = { fajr: "الفجر", sunrise: "الشروق", dhuhr: "الظهر", asr: "العصر", maghrib: "المغرب", isha: "العشاء" };
export const PRAYER_ICON = { fajr: "fajr", sunrise: "sunrise", dhuhr: "sun", asr: "sun", maghrib: "maghrib", isha: "isha" };
export const ALERT_ICON = { adhan: "speaker", chime: "bell", silent: "bellOff", off: "speakerOff" };
const RING_RADIUS = 49;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const TIMELINE_MARKS = [["fajr", "F"], ["dhuhr", "D"], ["asr", "A"], ["maghrib", "M"], ["isha", "I"]];

const written = new WeakMap();

function put(node, text) {
  if (written.get(node) === text) return false;
  written.set(node, text);
  node.textContent = text;
  return true;
}

function putParts(node, parts) {
  const key = `${parts.time}|${parts.period || ""}`;
  if (written.get(node) === key) return false;
  written.set(node, key);
  clear(node);
  node.append(formatTimeParts(parts));
  return true;
}

function putIcon(node, name, options) {
  if (written.get(node) === name) return;
  written.set(node, name);
  node.replaceChildren(icon(name, options));
}

export function createTodayView(ctx) {
  const refs = {};
  const rowRefs = new Map();
  let isDragging = false;
  let lastMinuteKey = "";

  refs.place = h("span", { class: "qh-place-name" });
  refs.date = h("span", { class: "qd-date" });
  refs.hijri = h("span", { class: "qd-hijri" });

  const head = h("header", { class: "qd-head" },
    h("div", { class: "qd-place" }, icon("pin", { size: 18, width: 1.8 }), refs.place),
    h("div", { class: "qd-datebox" }, refs.date, refs.hijri),
  );

  const hero = buildHero();
  refs.banner = h("div", { class: "qd-banner", hidden: true });
  refs.alertLine = h("button", { type: "button", class: "qd-alerts qpress", onClick: () => ctx.openSheet("prayer", { key: ctx.phase().mode === "now" ? ctx.phase().after.key : ctx.phase().key }) },
    icon("shield", { size: 20, width: 1.8 }),
    h("span", { class: "qd-alerts-text" }),
    icon("chevron", { size: 14, width: 2 }),
  );
  const rows = buildRows();
  const ayah = buildAyah();
  const resume = buildResume();
  const footer = h("p", { class: "qd-footer" }, "Times are calculated on your iPhone. Nothing is sent anywhere.");

  const scroll = h("div", { class: "qv-scroll qd-scroll", "data-lenis-prevent": "", tabindex: "-1" },
    head, hero, refs.banner, refs.alertLine, rows, ayah, resume, footer,
  );
  const el = h("section", { class: "qv qv-today", "aria-label": "Today" }, scroll);

  function buildHero() {
    refs.kicker = h("span", { class: "qh-kicker" });
    refs.name = h("span", { class: "qh-name" });
    refs.arabic = h("span", { class: "qh-arabic", lang: "ar", dir: "rtl" });
    refs.time = h("div", { class: "qh-time", "aria-hidden": "true" });
    refs.countdown = h("div", { class: "qh-count", "aria-hidden": "true" });
    refs.live = h("p", { class: "qsr", "aria-live": "polite", "aria-atomic": "true" });
    refs.ringProgress = svg("circle", { cx: 52, cy: 52, r: RING_RADIUS, fill: "none", "stroke-width": 3, "stroke-linecap": "round", class: "qh-ring-fill", "stroke-dasharray": RING_LENGTH });
    refs.ringGlyph = h("span", { class: "qh-ring-glyph" });
    refs.ring = h("div", { class: "qh-ring", "aria-hidden": "true", hidden: true },
      svg("svg", { viewBox: "0 0 104 104", width: 104, height: 104 }, svg("circle", { cx: 52, cy: 52, r: RING_RADIUS, fill: "none", "stroke-width": 3, class: "qh-ring-track" }), refs.ringProgress),
      refs.ringGlyph,
    );

    refs.methodChip = h("button", { type: "button", class: "qh-chip qpress", onClick: () => ctx.go("method") },
      icon("tag", { size: 16, width: 1.9 }),
      h("span", { class: "qh-chip-text" }),
      icon("chevron", { size: 12, width: 2.2 }),
    );
    refs.reset = h("button", { type: "button", class: "qh-reset qpress", hidden: true, onClick: () => ctx.scrubTo(null) }, "Back to now");

    const timeline = buildTimeline();

    return h("section", { class: "qh", "aria-label": "Next prayer" },
      ripple({ size: 260, className: "qh-ripple" }),
      refs.live,
      refs.ring,
      h("div", { class: "qh-top" },
        refs.kicker,
        h("div", { class: "qh-namerow", "aria-hidden": "true" }, refs.name, refs.arabic),
        refs.time,
        refs.countdown,
      ),
      timeline,
      h("div", { class: "qh-foot" }, refs.methodChip, refs.reset),
    );
  }

  function buildTimeline() {
    refs.track = h("div", { class: "qtl-track" });
    refs.fill = h("div", { class: "qtl-fill" });
    refs.dots = new Map();
    const marks = TIMELINE_MARKS.map(([key, letter]) => {
      const dot = h("span", { class: "qtl-dot" });
      const label = h("span", { class: "qtl-label" }, letter);
      const mark = h("span", { class: "qtl-mark" }, dot, label);
      refs.dots.set(key, { mark, dot, label });
      return mark;
    });

    refs.knob = h("div", {
      class: "qtl-knob",
      role: "slider",
      tabindex: "0",
      "aria-label": "Time of day. Drag to preview another moment",
    }, h("span", { class: "qtl-knob-core" }));

    const root = h("div", { class: "qtl", "data-lenis-prevent": "" }, refs.track, refs.fill, ...marks, refs.knob);
    refs.timeline = root;

    const moveTo = (clientX) => {
      const rect = root.getBoundingClientRect();
      const scale = rect.width / root.offsetWidth || 1;
      const inner = root.offsetWidth - 16;
      const x = Math.min(Math.max((clientX - rect.left) / scale - 8, 0), inner);
      const range = timelineRange();
      const minutes = Math.round((range.start + (x / inner) * (range.end - range.start)) / 60000);
      ctx.scrubTo(new Date(minutes * 60000));
    };

    refs.knob.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      isDragging = true;
      refs.knob.setPointerCapture(event.pointerId);
      refs.knob.classList.add("is-drag");
    });
    refs.knob.addEventListener("pointermove", (event) => {
      if (isDragging) moveTo(event.clientX);
    });
    const stop = () => {
      isDragging = false;
      refs.knob.classList.remove("is-drag");
    };
    refs.knob.addEventListener("pointerup", stop);
    refs.knob.addEventListener("pointercancel", stop);

    root.addEventListener("pointerdown", (event) => {
      if (event.target.closest(".qtl-knob")) return;
      moveTo(event.clientX);
    });

    refs.knob.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 60, PageDown: -60 }[event.key];
      const isHome = event.key === "Home";
      const isEnd = event.key === "End";
      if (step === undefined && !isHome && !isEnd) return;

      event.preventDefault();
      const range = timelineRange();
      const now = ctx.now().getTime();
      const size = event.shiftKey ? 6 : 1;
      let next = now + (step || 0) * 60000 * size;
      if (isHome) next = range.start;
      if (isEnd) next = range.end;
      next = Math.min(Math.max(next, range.start), range.end);
      ctx.scrubTo(new Date(Math.round(next / 60000) * 60000));
    });

    return root;
  }

  function timelineRange() {
    const t = ctx.times();
    return { start: t.fajr.getTime() - 60 * 60000, end: t.isha.getTime() + 60 * 60000 };
  }

  function positionOf(date, range) {
    const fraction = (date.getTime() - range.start) / (range.end - range.start);
    return Math.min(Math.max(fraction, 0), 1);
  }

  function buildRows() {
    const card = h("section", { class: "qr", "aria-label": "Prayer times" });
    for (const key of ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]) {
      const isSecondary = key === "sunrise";
      const name = h("span", { class: "qr-name" });
      const badge = h("span", { class: "qr-badge" });
      const time = h("span", { class: "qr-time" });
      const alert = h("span", { class: "qr-alert" });
      const iconWrap = h("span", { class: "qr-icon" }, icon(PRAYER_ICON[key], { size: 22, width: 1.7 }));
      const row = h("button", { type: "button", class: `qr-row qpress${isSecondary ? " is-secondary" : ""}`, onClick: () => ctx.openSheet("prayer", { key }) },
        iconWrap,
        h("span", { class: "qr-label" }, name, badge),
        time,
        alert,
      );
      rowRefs.set(key, { row, name, badge, time, alert });
      card.append(row);
    }

    refs.moreList = h("div", { class: "qr-more-list", id: `${ctx.uid}-more` });
    refs.moreWrap = h("div", { class: "qr-more-wrap", inert: true }, refs.moreList);
    refs.moreToggle = h("button", { type: "button", class: "qr-more qpress", "aria-expanded": "false", "aria-controls": `${ctx.uid}-more`, onClick: toggleMore },
      h("span", {}, "More times"),
      icon("chevron", { size: 14, width: 2, className: "qr-more-chevron" }),
    );
    card.append(refs.moreToggle, refs.moreWrap);
    return card;
  }

  function toggleMore() {
    const open = refs.moreToggle.getAttribute("aria-expanded") !== "true";
    refs.moreToggle.setAttribute("aria-expanded", String(open));
    refs.moreToggle.classList.toggle("is-open", open);

    refs.moreWrap.classList.toggle("is-open", open);
    refs.moreWrap.inert = !open;
  }

  function buildAyah() {
    refs.ayahText = h("div", { class: "qa-text", lang: "ar", dir: "rtl" });
    refs.ayahRef = h("span", { class: "qa-ref" });
    return h("section", { class: "qc qa", "aria-label": "Daily ayah" },
      h("div", { class: "qc-label" }, icon("sparkle", { size: 16, width: 1.7, className: "qi-ornament" }), "Daily ayah"),
      refs.ayahText,
      h("div", { class: "qa-foot" },
        refs.ayahRef,
        h("button", { type: "button", class: "qa-share qpress", onClick: () => ctx.toast("The share sheet opens in the app.") }, icon("share", { size: 16, width: 1.8 }), "Share"),
      ),
    );
  }

  function buildResume() {
    refs.resumeTitle = h("span", { class: "qc-title" });
    refs.resumePage = h("span", { class: "qc-meta" });
    refs.resumeFill = h("div", { class: "qp-bar-fill" });
    return h("button", { type: "button", class: "qc qres qpress", onClick: () => ctx.goTab("quran") },
      h("div", { class: "qres-row" },
        h("span", { class: "qres-copy" }, h("span", { class: "qc-label" }, "Continue reading"), refs.resumeTitle),
        refs.resumePage,
        icon("chevron", { size: 14, width: 2 }),
      ),
      h("div", { class: "qp-bar" }, refs.resumeFill),
    );
  }

  function updateHeader() {
    const day = ctx.day();
    put(refs.place, ctx.state.place.name);
    put(refs.date, day.dateLabel.replace(",", ""));
    put(refs.hijri, day.hijriLabel);
  }

  function updateHero(now) {
    const phase = ctx.phase();
    const t = ctx.times();
    const names = ctx.day().names;
    const mode = phase.mode;

    put(refs.kicker, mode === "now" ? "Now" : mode === "tomorrow" ? "Tomorrow" : "Next prayer");
    put(refs.name, names[phase.key]);
    put(refs.arabic, ARABIC_NAMES[phase.key]);

    const timeChanged = putParts(refs.time, ctx.fmtParts(phase.time));
    const { gsap } = window;
    const canAnimate = timeChanged && gsap && !ctx.reduced() && !ctx.isScrubbed() && refs.time.dataset.seen === "true";
    refs.time.dataset.seen = "true";
    if (canAnimate) {
      gsap.fromTo(refs.time, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: DURATION.base, ease: EASE.out, overwrite: "auto" });
    }

    put(refs.methodChip.querySelector(".qh-chip-text"), ctx.model.methodLabel(now));
    refs.reset.hidden = !ctx.isScrubbed();

    putIcon(refs.ringGlyph, PRAYER_ICON[phase.key], { size: 36, width: 1.5 });
    updateCountdown(now, phase);
    updateTimeline(now, t);
  }

  function updateCountdown(now, phase) {
    if (phase.mode === "now") {
      const minutes = Math.max(0, Math.floor((now - phase.time) / 60000));
      const afterIn = countdownText(countdownParts(now, phase.after.time));
      const afterName = ctx.day().names[phase.after.key];
      put(refs.countdown, minutes < 1 ? `Started just now, ${afterName} ${afterIn}` : `Started ${minutes} min ago, ${afterName} ${afterIn}`);
      refs.countdown.dataset.rolled = refs.countdown.textContent;
      refs.ring.hidden = true;
      return;
    }

    const parts = countdownParts(now, phase.time);
    const text = countdownText(parts);
    if (ctx.isScrubbed() || phase.mode !== "next") {
      put(refs.countdown, text);
      refs.countdown.dataset.rolled = text;
    } else {
      rollText(refs.countdown, text);
      written.set(refs.countdown, text);
    }

    const insideHour = parts.totalSeconds < 3600 && phase.mode === "next";
    refs.ring.hidden = !insideHour;
    if (insideHour) {
      const fraction = parts.totalSeconds / 3600;
      const offset = String(RING_LENGTH * (1 - fraction));
      if (refs.ringProgress.getAttribute("stroke-dashoffset") !== offset) refs.ringProgress.setAttribute("stroke-dashoffset", offset);
    }
  }

  function updateLive(now, phase) {
    const names = ctx.day().names;
    const parts = ctx.fmtParts(phase.time);
    const timeText = `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
    const lead = phase.mode === "now" ? "Now" : phase.mode === "tomorrow" ? "Tomorrow" : "Next prayer";

    if (phase.mode === "now") {
      put(refs.live, `${lead}: ${names[phase.key]}, started at ${timeText}.`);
      return;
    }
    const spoken = countdownSpoken(countdownParts(now, phase.time));
    put(refs.live, `${lead}: ${names[phase.key]} at ${timeText}, ${spoken}.`);
  }

  function updateTimeline(now, t) {
    const range = timelineRange();
    const phase = ctx.phase();
    const nowFraction = positionOf(now, range);
    const nextKey = phase.mode === "now" ? phase.after.key : phase.key;
    const isTomorrow = phase.mode === "tomorrow";
    const size = refs.timeline.offsetWidth || 340;
    const inner = size - 16;

    for (const [key, node] of refs.dots) {
      const fraction = positionOf(t[key], range);
      const left = `${8 + fraction * inner}px`;
      if (node.mark.style.left !== left) node.mark.style.left = left;
      const isPassed = t[key] <= now;
      const isNext = !isTomorrow && key === nextKey && !isPassed;
      node.dot.classList.toggle("is-passed", isPassed);
      node.dot.classList.toggle("is-next", isNext);
      node.label.classList.toggle("is-next", isNext);
    }

    positionKnob(nowFraction, inner);

    const label = ctx.fmtParts(now);
    refs.knob.setAttribute("aria-valuemin", String(Math.round(range.start / 60000)));
    refs.knob.setAttribute("aria-valuemax", String(Math.round(range.end / 60000)));
    refs.knob.setAttribute("aria-valuenow", String(Math.round(now.getTime() / 60000)));
    refs.knob.setAttribute("aria-valuetext", `${label.time}${label.period ? ` ${label.period}` : ""}`);
  }

  function positionKnob(fraction, inner) {
    const travel = fraction * inner;
    if (refs.fill.dataset.span !== String(inner)) {
      refs.fill.dataset.span = String(inner);
      refs.fill.style.width = `${inner}px`;
      refs.fill.style.transformOrigin = "0 50%";
    }
    refs.knob.style.translate = `${travel.toFixed(2)}px 0`;
    refs.fill.style.transform = `scaleX(${fraction.toFixed(4)})`;
  }

  function updateRows(now) {
    const t = ctx.times();
    const phase = ctx.phase();
    const day = ctx.day();
    const nextKey = phase.mode === "now" ? phase.after.key : phase.key;
    const highlightKey = phase.mode === "now" ? phase.key : phase.mode === "tomorrow" ? null : phase.key;

    for (const [key, node] of rowRefs) {
      const isPassed = t[key] <= now;
      const isHighlight = key === highlightKey;
      put(node.name, day.names[key]);
      putParts(node.time, ctx.fmtParts(t[key]));
      node.row.classList.toggle("is-next", isHighlight);
      node.row.classList.toggle("is-passed", isPassed && !isHighlight);
      put(node.badge, isHighlight ? (phase.mode === "now" ? "Now" : "Next") : "");

      const label = rowSpeech(key, day, t, isHighlight, phase);
      if (node.row.getAttribute("aria-label") !== label) node.row.setAttribute("aria-label", label);

      const isAlerting = ALERTING.includes(key);
      if (isAlerting) {
        const style = ctx.state.alerts[key];
        putIcon(node.alert, ALERT_ICON[style], { size: 22, width: 1.7 });
      } else if (written.has(node.alert)) {
        written.delete(node.alert);
        clear(node.alert);
      }
      node.row.dataset.next = key === nextKey ? "true" : "false";
    }

    if (ctx.reduced()) refs.moreWrap.inert = false;

    const night = ctx.model.nightTimes(now);
    const extras = [["Middle of the night", night.midnight], ["Last third of the night", night.lastThird]];
    const extraKey = extras.map(([label, date]) => `${label}${ctx.fmtParts(date).time}`).join("|");
    if (written.get(refs.moreList) !== extraKey) {
      written.set(refs.moreList, extraKey);
      clear(refs.moreList);
      for (const [label, date] of extras) {
        refs.moreList.append(h("div", { class: "qr-extra" }, h("span", {}, label), formatTimeParts(ctx.fmtParts(date))));
      }
    }
  }

  function rowSpeech(key, day, t, isHighlight, phase) {
    const parts = ctx.fmtParts(t[key]);
    const time = `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
    const tag = isHighlight ? (phase.mode === "now" ? ", now" : ", next") : "";
    return `${day.names[key]}, ${time}${tag}. Opens details`;
  }

  function updateAlertLine() {
    const alerts = ctx.state.alerts;
    const states = ALERTING.map((key) => alerts[key]);
    const offCount = states.filter((state) => state === "off").length;
    const allOff = offCount === ALERTING.length;
    const allAdhan = states.every((state) => state === "adhan");
    const text = refs.alertLine.querySelector(".qd-alerts-text");
    const day = ctx.day();

    refs.banner.hidden = !allOff;
    refs.alertLine.hidden = allOff;
    clear(refs.banner);

    if (allOff) {
      refs.banner.append(icon("bellOff", { size: 22, width: 1.8 }), h("span", {}, "Alerts are off. Qalm will not notify you for any prayer."));
      return;
    }

    if (allAdhan) text.textContent = "Adhan alerts are on for all five prayers";
    else if (offCount > 0) text.textContent = `Alerts are on for ${ALERTING.length - offCount} of 5 prayers`;
    else text.textContent = `Alerts on until ${day.alertsUntil}`;
  }

  function updateAyah(now) {
    const { y, m, d } = zonedParts(now, ctx.state.place.tz);
    const dayNumber = civil.fromParts(y, m, d);
    const ref = DAILY_AYAH_KEYS[((dayNumber % DAILY_AYAH_KEYS.length) + DAILY_AYAH_KEYS.length) % DAILY_AYAH_KEYS.length];
    const entry = ayahByRef(ref);
    put(refs.ayahText, entry.text);
    put(refs.ayahRef, `${surahOf(entry.s).name} ${entry.s}:${entry.a}`);
  }

  function updateResume() {
    const { resume } = ctx.store;
    refs.resumeTitle.textContent = resumeLabel(resume);
    refs.resumePage.textContent = resumePageLabel(resume);
    refs.resumeFill.style.width = `${Math.round((resume.page / TOTAL_PAGES) * 100)}%`;
  }

  function update() {
    const now = ctx.now();
    updateHeader();
    updateRows(now);
    updateHero(now);
    updateAlertLine();
    updateAyah(now);
    updateResume();
    updateLive(now, ctx.phase());
    lastMinuteKey = minuteKey(now);
  }

  function minuteKey(now) {
    return `${Math.floor(now.getTime() / 60000)}`;
  }

  function tick(now, phase) {
    updateCountdown(now, phase);

    const currentKey = minuteKey(now);
    if (currentKey !== lastMinuteKey) {
      lastMinuteKey = currentKey;
      updateLive(now, phase);
    }

    if (!isDragging && !ctx.isScrubbed()) {
      const range = timelineRange();
      const inner = (refs.timeline.offsetWidth || 340) - 16;
      positionKnob(positionOf(now, range), inner);
    }
  }

  function onEnter() {
    updateTimeline(ctx.now(), ctx.times());
  }

  function ambient(seconds, amount) {
    const swell = (Math.sin(seconds * Math.PI * 2 / 6.5) + 1) / 2;
    const knobCore = refs.knob.firstElementChild;
    const isResting = amount === 0;

    refs.ring.style.scale = isResting ? "" : (1 + swell * 0.022 * amount).toFixed(4);
    refs.ringGlyph.style.scale = isResting ? "" : (1 - swell * 0.03 * amount).toFixed(4);
    knobCore.style.scale = isResting ? "" : (1 + swell * 0.09 * amount).toFixed(4);
    knobCore.style.boxShadow = isResting ? "" : `0 2px 6px rgba(0, 0, 0, 0.3), 0 0 0 ${(swell * 5 * amount).toFixed(2)}px rgba(255, 255, 255, ${(0.18 * (1 - swell) * amount).toFixed(3)})`;
  }

  return { el, update, tick, onEnter, ambient, scrollTop: () => scroll.scrollTo({ top: 0, behavior: ctx.reduced() ? "auto" : "smooth" }) };
}
