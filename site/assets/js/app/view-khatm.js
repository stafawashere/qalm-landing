import { h, icon, segmented, stepper, switchControl, button, clear } from "./dom.js";
import { TOTAL_PAGES, MINUTES_PER_PAGE, CONSISTENCY_PATTERN, civil, juzOfPage, juzStartPage, surahOnPage } from "./data.js";
import { plusChip, viewScroll, sectionLabel } from "./kit.js";
import { zonedParts } from "../sky.js";
import { animateFrom, isReduced } from "./motion.js";

const JUZ_COUNT = 30;
const PRESETS = [
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "6 months" },
];

function todayNumber(ctx) {
  const { y, m, d } = zonedParts(ctx.now(), ctx.state.place.tz);
  return civil.fromParts(y, m, d);
}

function isFriday(dayNumber) {
  return civil.parts(dayNumber).weekday === 5;
}

function readingDays(from, to, restFridays) {
  let count = 0;
  for (let day = from; day <= to; day += 1) {
    const isRest = restFridays && isFriday(day);
    if (!isRest) count += 1;
  }
  return Math.max(1, count);
}

export function planFigures(ctx, plan, startPage) {
  const today = todayNumber(ctx);
  const remaining = Math.max(0, TOTAL_PAGES - startPage + 1);
  const days = readingDays(today, plan.finish, plan.restFridays);
  const pagesPerDay = Math.max(1, Math.ceil(remaining / days));
  return { today, remaining, days, pagesPerDay, minutes: pagesPerDay * MINUTES_PER_PAGE };
}

export function ensurePlan(ctx) {
  const { store } = ctx;
  if (store.khatm) return store.khatm;

  store.khatm = { finish: todayNumber(ctx) + 60, restFridays: false, paused: false, unit: "pages", readOn: null, log: [] };
  return store.khatm;
}

function pagesLabel(count) {
  return `${count} ${count === 1 ? "page" : "pages"}`;
}

function minutesLabel(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function juzBar(filledUntilPage, { label } = {}) {
  const bar = h("div", { class: "qjuz", role: "img", "aria-label": label || `Juz ${juzOfPage(filledUntilPage)} of 30` });
  const reachedJuz = juzOfPage(filledUntilPage);

  for (let juz = 1; juz <= JUZ_COUNT; juz += 1) {
    const start = juzStartPage(juz);
    const end = juz === JUZ_COUNT ? TOTAL_PAGES : juzStartPage(juz + 1) - 1;
    let fill = 0;

    if (juz < reachedJuz) fill = 1;
    else if (juz === reachedJuz) fill = Math.min(1, (filledUntilPage - start + 1) / (end - start + 1));

    const level = Math.max(0, fill);
    const fillBar = h("i", { class: "qjuz-fill", "data-level": String(level) });
    fillBar.style.transform = `scaleX(${level})`;
    bar.append(h("span", { class: "qjuz-seg" }, fillBar));
  }
  return bar;
}

function fillJuzBars(root) {
  const { gsap } = window;
  const fills = [...root.querySelectorAll(".qjuz-fill")];
  const canAnimate = gsap && !isReduced() && fills.length;
  if (!canAnimate) return;

  gsap.fromTo(fills, { scaleX: 0 }, {
    scaleX: (_index, fill) => Number(fill.dataset.level),
    duration: 0.7,
    ease: "expo.out",
    stagger: 0.014,
    overwrite: "auto",
  });
}

export function createKhatmView(ctx) {
  const refs = {};
  let mode = "plan";

  ensurePlan(ctx);

  refs.body = h("div", { class: "qk-body" });
  const segment = segmented({
    label: "Khatm views",
    options: [{ value: "plan", label: "Plan" }, { value: "consistency", label: "Consistency" }],
    value: mode,
    onChange: (value) => {
      mode = value;
      paint(true);
    },
  });

  const topRow = h("div", { class: "qv-toprow" }, ctx.backButton(), plusChip());
  const el = h("section", { class: "qv qv-khatm", "aria-label": "Khatm plan" },
    viewScroll("qk-scroll", topRow, ctx.pageTitle("Khatm plan"), segment, refs.body),
  );

  function currentPage() {
    return ctx.store.resume.page;
  }

  function readNow(figures) {
    const plan = ensurePlan(ctx);
    const previous = { resume: { ...ctx.store.resume }, readOn: plan.readOn, log: [...plan.log] };
    const nextPage = Math.min(TOTAL_PAGES, currentPage() + figures.pagesPerDay);
    const entry = surahOnPage(nextPage);

    ctx.store.resume = { surah: entry.number, ayah: entry.page === nextPage ? 1 : null, page: nextPage, approx: entry.page !== nextPage };
    plan.readOn = figures.today;
    if (!plan.log.includes(figures.today)) plan.log.push(figures.today);
    ctx.refresh();

    ctx.toast(`Marked ${pagesLabel(figures.pagesPerDay)} as read`, {
      actionLabel: "Undo",
      onAction: () => {
        ctx.store.resume = previous.resume;
        plan.readOn = previous.readOn;
        plan.log = previous.log;
        ctx.refresh();
      },
    });
  }

  function paintPlan() {
    const plan = ensurePlan(ctx);
    const page = currentPage();
    const figures = planFigures(ctx, plan, page);
    const isDone = page >= TOTAL_PAGES;
    const readToday = plan.readOn === figures.today;
    const finishLabel = civil.label(plan.finish);

    const countBox = h("div", { class: "qk-count" },
      h("span", { class: "qk-count-num" }, plan.paused ? "0" : String(figures.pagesPerDay)),
      h("span", { class: "qk-count-unit" }, plan.paused ? "pages today" : figures.pagesPerDay === 1 ? "page today" : "pages today"),
    );

    const subline = plan.paused
      ? "Plan paused. Nothing is due."
      : isDone ? "You reached the last page." : `About ${minutesLabel(figures.minutes)} of reading`;

    const readLabel = isDone ? "Khatm complete" : readToday ? "Read today" : "Read now";
    const readButton = button(readLabel, "qb-primary qb-wide", () => readNow(figures), { disabled: plan.paused || readToday || isDone });

    const hero = h("section", { class: "qk-hero", "aria-label": "Today's reading" },
      h("span", { class: "qk-kicker" }, "Today's reading"),
      countBox,
      h("p", { class: "qk-sub" }, subline),
      juzBar(page, { label: `Juz ${juzOfPage(page)} of 30, page ${page} of ${TOTAL_PAGES}` }),
      h("p", { class: "qk-progress" }, `Juz ${juzOfPage(page)} of 30, page ${page} of ${TOTAL_PAGES}`),
      readButton,
    );

    const forecast = h("div", { class: "qk-forecast" },
      icon("calendar", { size: 22, width: 1.7 }),
      h("p", {}, plan.paused ? "The finish date holds while the plan is paused." : `At this pace you finish on ${finishLabel}. ${figures.remaining} pages to go over ${figures.days} reading ${figures.days === 1 ? "day" : "days"}.`),
    );

    const finishRow = h("div", { class: "qgroup-row qgroup-static" },
      h("span", { class: "qgroup-text" }, h("span", { class: "qgroup-title" }, "Finish date"), h("span", { class: "qgroup-sub", "data-finish": "" }, civil.long(plan.finish))),
      stepper({
        label: "finish date in days",
        onDec: () => moveFinish(-1),
        onInc: () => moveFinish(1),
      }),
    );

    const restRow = h("div", { class: "qgroup-row qgroup-static" },
      h("label", { class: "qgroup-text", for: `${ctx.uid}-rest` }, h("span", { class: "qgroup-title" }, "Rest on Fridays"), h("span", { class: "qgroup-sub" }, "Fridays do not count as reading days")),
      switchControl({ id: `${ctx.uid}-rest`, label: "Rest on Fridays", checked: plan.restFridays, onChange: (value) => { plan.restFridays = value; repaint(); } }),
    );

    const pauseRow = h("div", { class: "qgroup-row qgroup-static" },
      h("label", { class: "qgroup-text", for: `${ctx.uid}-pause` }, h("span", { class: "qgroup-title" }, "Pause plan"), h("span", { class: "qgroup-sub" }, "Travel, illness, or a quiet week")),
      switchControl({ id: `${ctx.uid}-pause`, label: "Pause plan", checked: plan.paused, onChange: (value) => { plan.paused = value; repaint(); } }),
    );

    const editRow = h("button", { type: "button", class: "qgroup-row qpress", onClick: () => ctx.openSheet("khatm-setup") },
      h("span", { class: "qgroup-text" }, h("span", { class: "qgroup-title" }, "Change the plan")),
      icon("chevron", { size: 16, width: 2 }),
    );

    refs.body.append(hero, forecast, sectionLabel("Plan"), h("div", { class: "qgroup" }, finishRow, restRow, pauseRow, editRow));
  }

  function moveFinish(delta) {
    const plan = ensurePlan(ctx);
    const today = todayNumber(ctx);
    const next = Math.min(today + 365, Math.max(today + 7, plan.finish + delta));
    plan.finish = next;
    repaint();
  }

  function repaint() {
    const focused = document.activeElement;
    const label = focused?.getAttribute?.("aria-label");
    paint(false);
    if (label) {
      const again = [...refs.body.querySelectorAll("[aria-label]")].find((node) => node.getAttribute("aria-label") === label);
      again?.focus({ preventScroll: true });
    } else if (focused?.id) {
      document.getElementById(focused.id)?.focus({ preventScroll: true });
    }
  }

  function paintConsistency() {
    const plan = ensurePlan(ctx);
    const weeks = CONSISTENCY_PATTERN;
    const total = weeks.length * 7;
    const read = weeks.join("").split("").filter((cell) => cell === "1").length + (plan.log.length || 0);
    const labels = ["M", "T", "W", "T", "F", "S", "S"];

    const grid = h("div", { class: "qcons-grid", role: "img", "aria-label": `Read on ${read} of the last ${total} days` });
    grid.append(h("div", { class: "qcons-days", "aria-hidden": "true" }, ...labels.map((day) => h("span", {}, day))));
    const columns = h("div", { class: "qcons-cols", "aria-hidden": "true" });
    weeks.forEach((week) => {
      const column = h("div", { class: "qcons-col" });
      week.split("").forEach((cell) => column.append(h("span", { class: `qcons-dot${cell === "1" ? " is-on" : ""}` })));
      columns.append(column);
    });
    grid.append(columns);

    const rate = Math.round((read / total) * 100);
    refs.body.append(
      h("section", { class: "qcons" },
        h("span", { class: "qk-kicker" }, "Last 12 weeks"),
        h("div", { class: "qcons-figure" }, h("span", { class: "qcons-num" }, String(read)), h("span", { class: "qcons-of" }, `of ${total} days`)),
        h("p", { class: "qk-sub" }, `You read on ${rate} percent of days.`),
        grid,
      ),
      h("p", { class: "qk-note" }, "Missed days never reset your plan. The daily page count adjusts to the days left."),
    );
  }

  function paint(animate) {
    clear(refs.body);
    if (mode === "plan") paintPlan();
    else paintConsistency();

    if (animate) animateFrom([...refs.body.children], { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.06, ease: "power3.out", clearProps: "transform,opacity" });
  }

  paint(false);
  return { el, update: () => paint(false), onShow: () => { mode = "plan"; segment.set("plan"); paint(false); fillJuzBars(refs.body); } };
}

export function createKhatmSetupSheet(ctx) {
  const plan = ensurePlan(ctx);
  const today = todayNumber(ctx);
  const draft = {
    days: Math.max(7, plan.finish - today),
    restFridays: plan.restFridays,
    unit: plan.unit || "pages",
    from: "place",
  };
  const refs = {};

  const presetGroup = segmented({
    label: "Preset",
    options: PRESETS.map((preset) => ({ value: String(preset.days), label: preset.label })),
    value: PRESETS.some((preset) => preset.days === draft.days) ? String(draft.days) : "",
    onChange: (value) => {
      draft.days = Number(value);
      paint();
    },
  });

  const daysStepper = stepper({
    label: "days to finish",
    onDec: () => { draft.days = Math.max(7, draft.days - 1); paint(); },
    onInc: () => { draft.days = Math.min(365, draft.days + 1); paint(); },
  });

  const unitControl = segmented({
    label: "Show reading as",
    options: [{ value: "pages", label: "Pages" }, { value: "juz", label: "Juz" }],
    value: draft.unit,
    onChange: (value) => { draft.unit = value; paint(); },
  });

  const fromControl = segmented({
    label: "Start from",
    options: [{ value: "place", label: "My place" }, { value: "start", label: "Page 1" }],
    value: draft.from,
    onChange: (value) => { draft.from = value; paint(); },
  });

  const restSwitch = switchControl({ id: `${ctx.uid}-setup-rest`, label: "Rest on Fridays", checked: draft.restFridays, onChange: (value) => { draft.restFridays = value; paint(); } });

  refs.daysValue = h("span", { class: "qs-offset-value" });
  refs.summary = h("p", { class: "qk-summary", role: "status", "aria-live": "polite" });
  refs.bar = h("div", { class: "qk-summary-bar" });

  function figures() {
    const startPage = draft.from === "start" ? 1 : ctx.store.resume.page;
    const finish = today + draft.days;
    const base = planFigures(ctx, { finish, restFridays: draft.restFridays }, startPage);
    return { ...base, startPage, finish };
  }

  function paint() {
    const result = figures();
    refs.daysValue.textContent = `${draft.days} days, until ${civil.short(result.finish)}`;

    const isPreset = PRESETS.some((preset) => String(preset.days) === String(draft.days));
    presetGroup.set(isPreset ? String(draft.days) : "");

    const perDay = draft.unit === "juz"
      ? `About ${(result.pagesPerDay / 20).toFixed(1)} juz a day`
      : `About ${pagesLabel(result.pagesPerDay)} a day`;
    refs.summary.textContent = `${perDay}, ${minutesLabel(result.minutes)}.`;

    clear(refs.bar);
    const weekPage = Math.min(TOTAL_PAGES, result.startPage + result.pagesPerDay * 7);
    refs.bar.append(juzBar(weekPage, { label: `After one week you reach juz ${juzOfPage(weekPage)}` }), h("p", { class: "qk-note" }, `After a week you reach juz ${juzOfPage(weekPage)}.`));
  }

  function save() {
    const result = figures();
    plan.finish = result.finish;
    plan.restFridays = draft.restFridays;
    plan.unit = draft.unit;
    plan.paused = false;

    if (draft.from === "start") {
      ctx.store.resume = { surah: 1, ayah: 1, page: 1 };
    }

    ctx.closeSheet();
    ctx.refresh();
    ctx.toast(`Plan set for ${civil.short(result.finish)}`);
  }

  const el = h("div", { class: "qs-body" },
    ctx.sheetHeader("Khatm plan"),
    h("div", { class: "qs-field" }, h("span", { class: "qs-field-label" }, "Finish in"), presetGroup),
    h("div", { class: "qs-card" },
      h("div", { class: "qs-row" }, h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Days"), refs.daysValue), daysStepper),
    ),
    h("div", { class: "qs-field" }, h("span", { class: "qs-field-label" }, "Start from"), fromControl),
    h("div", { class: "qs-field" }, h("span", { class: "qs-field-label" }, "Show reading as"), unitControl),
    h("div", { class: "qs-card" },
      h("div", { class: "qs-row" }, h("label", { class: "qs-row-copy", for: `${ctx.uid}-setup-rest` }, h("span", { class: "qs-row-title" }, "Rest on Fridays")), restSwitch),
    ),
    h("div", { class: "qk-summary-card" }, refs.summary, refs.bar),
    button("Start plan", "qb-primary qb-wide", save),
  );

  paint();
  return { el, label: "Khatm plan setup", tall: true };
}
