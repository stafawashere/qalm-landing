import { h, icon, stepper, button, clear } from "./dom.js";
import { METHOD_LIST, REGIONS } from "./data.js";
import { viewScroll, sectionLabel, soonChip } from "./kit.js";
import { zonedParts } from "../sky.js";

function timeText(ctx, date) {
  return ctx.fmtText(date);
}

function minutesIn(date, tz) {
  const { h: hour, min } = zonedParts(date, tz);
  return hour * 60 + min;
}

function clockLabel(totalMinutes) {
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const shown = hour % 12 === 0 ? 12 : hour % 12;
  return `${shown}:${String(minute).padStart(2, "0")} ${period}`;
}

export function createMethodView(ctx) {
  const refs = {};
  let query = "";

  refs.status = h("section", { class: "qm-status", "aria-label": "Current method" });
  refs.input = h("input", { type: "search", class: "qsf-input", id: `${ctx.uid}-method-search`, placeholder: "Search methods", autocomplete: "off", spellcheck: "false", "aria-label": "Search calculation methods" });
  refs.input.addEventListener("input", () => {
    query = refs.input.value.trim().toLowerCase();
    paintList();
  });
  refs.list = h("div", { class: "qm-list" });
  refs.live = h("p", { class: "qsr", role: "status", "aria-live": "polite" });

  const field = h("div", { class: "qsf" }, icon("search", { size: 18, width: 1.8 }), refs.input);
  const el = h("section", { class: "qv qv-method", "aria-label": "Calculation method" },
    viewScroll("qm-scroll", h("div", { class: "qv-toprow" }, ctx.backButton()), ctx.pageTitle("Calculation method"), refs.status, field, refs.live, refs.list),
  );

  function selectMethod(key) {
    ctx.setState({ method: key });
    ctx.toast(`Using ${METHOD_LIST.find((entry) => entry.key === key).name}`, {
      actionLabel: "Undo",
      onAction: () => ctx.setState({ method: "auto" }),
    });
  }

  function paintStatus() {
    clear(refs.status);
    const auto = ctx.auto();
    const isAuto = ctx.model.isAuto();
    const day = ctx.day();
    const label = ctx.model.methodLabel(ctx.now()).replace(/, (the default for|your choice).*$/, "");

    refs.status.append(
      h("span", { class: "qk-kicker" }, isAuto ? "Automatic" : "Your choice"),
      h("h3", { class: "qm-status-name" }, label),
      h("p", { class: "qm-status-text" }, isAuto ? auto.method.reason : `Automatic for ${ctx.state.place.name} would be ${auto.method.short}.`),
      h("p", { class: "qm-status-times" },
        h("span", {}, "Fajr ", h("strong", {}, timeText(ctx, day.times.fajr))),
        h("span", {}, "Isha ", h("strong", {}, timeText(ctx, day.times.isha))),
      ),
    );
    if (!isAuto) {
      refs.status.append(button("Back to automatic", "qb-ghost qb-sm", () => {
        ctx.setState({ method: "auto" });
        ctx.toast("Back to automatic");
      }));
    }
  }

  function methodCard(entry) {
    const now = ctx.now();
    const day = ctx.model.dayForMethod(entry.key, now);
    const isOn = ctx.state.method === entry.key;
    const card = h("button", { type: "button", role: "radio", "aria-checked": String(isOn), class: `qm-card qpress${isOn ? " is-on" : ""}`, onClick: () => selectMethod(entry.key) },
      h("span", { class: "qm-radio", "aria-hidden": "true" }, isOn ? icon("check", { size: 16, width: 2.6 }) : null),
      h("span", { class: "qm-card-copy" },
        h("span", { class: "qm-card-name" }, entry.name),
        h("span", { class: "qm-card-desc" }, entry.description),
        h("span", { class: "qm-card-meta" }, entry.angles),
        h("span", { class: "qm-card-times" },
          h("span", {}, "Fajr ", h("strong", {}, timeText(ctx, day.times.fajr))),
          h("span", {}, "Isha ", h("strong", {}, timeText(ctx, day.times.isha))),
        ),
      ),
    );
    return card;
  }

  function paintList() {
    clear(refs.list);
    let shown = 0;

    for (const region of REGIONS) {
      const entries = METHOD_LIST.filter((entry) => {
        if (entry.region !== region) return false;
        if (!query) return true;
        return `${entry.name} ${entry.description} ${entry.angles}`.toLowerCase().includes(query);
      });
      if (!entries.length) continue;

      shown += entries.length;
      const group = h("div", { class: "qm-group", role: "radiogroup", "aria-label": region });
      entries.forEach((entry) => group.append(methodCard(entry)));
      refs.list.append(sectionLabel(region), group);
    }

    const customOn = ctx.state.method === "custom";
    const isCustomMatch = !query || "custom angles".includes(query);
    if (isCustomMatch) {
      shown += 1;
      refs.list.append(
        sectionLabel("Your own"),
        h("button", { type: "button", class: `qm-card qm-custom qpress${customOn ? " is-on" : ""}`, onClick: () => ctx.openSheet("custom") },
          h("span", { class: "qm-radio", "aria-hidden": "true" }, customOn ? icon("check", { size: 16, width: 2.6 }) : null),
          h("span", { class: "qm-card-copy" },
            h("span", { class: "qm-card-name" }, "Custom angles"),
            h("span", { class: "qm-card-desc" }, customOn ? `Fajr ${ctx.state.custom.fajr}°, Isha ${ctx.state.custom.interval ? `${ctx.state.custom.interval} min` : `${ctx.state.custom.isha}°`}` : "Set your own Fajr and Isha angles."),
          ),
          icon("chevron", { size: 16, width: 2 }),
        ),
      );
    }

    if (!shown) refs.list.append(h("p", { class: "qempty" }, `No method matches "${refs.input.value.trim()}". Try fewer letters.`));
    refs.live.textContent = query ? `${shown} ${shown === 1 ? "method" : "methods"} shown.` : "";

    refs.list.append(
      h("button", { type: "button", class: "qs-link qm-mosque qpress", onClick: () => ctx.go("mosque") },
        h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Match my mosque", soonChip()), h("span", { class: "qs-row-sub" }, "Helps you match your mosque's timetable")),
        icon("chevron", { size: 16, width: 2 }),
      ),
    );
  }

  function update() {
    paintStatus();
    paintList();
  }

  return { el, update };
}

export function createMosqueView(ctx) {
  const refs = {};
  const base = ctx.day();
  const draft = {
    fajr: Math.round(minutesIn(base.times.fajr, ctx.state.place.tz) / 5) * 5,
    isha: Math.round(minutesIn(base.times.isha, ctx.state.place.tz) / 5) * 5,
  };

  refs.fajr = h("span", { class: "qs-offset-value qm-clock" });
  refs.isha = h("span", { class: "qs-offset-value qm-clock" });
  refs.results = h("div", { class: "qm-results", role: "status", "aria-live": "polite" });

  function paintValues() {
    refs.fajr.textContent = clockLabel(draft.fajr);
    refs.isha.textContent = clockLabel(draft.isha);
  }

  function adjust(key, delta) {
    draft[key] = (draft[key] + delta + 1440) % 1440;
    paintValues();
    clear(refs.results);
  }

  const fajrRow = h("div", { class: "qs-row" }, h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Fajr at your mosque"), refs.fajr), stepper({ label: "Fajr time in 5 minute steps", onDec: () => adjust("fajr", -5), onInc: () => adjust("fajr", 5) }));
  const ishaRow = h("div", { class: "qs-row" }, h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Isha at your mosque"), refs.isha), stepper({ label: "Isha time in 5 minute steps", onDec: () => adjust("isha", -5), onInc: () => adjust("isha", 5) }));

  function findMatches() {
    const now = ctx.now();
    const tz = ctx.state.place.tz;

    const scored = METHOD_LIST.map((entry) => {
      const day = ctx.model.dayForMethod(entry.key, now);
      const fajrGap = Math.abs(minutesIn(day.times.fajr, tz) - draft.fajr);
      const ishaGap = Math.abs(minutesIn(day.times.isha, tz) - draft.isha);
      return { entry, day, fajrGap, ishaGap, total: fajrGap + ishaGap };
    }).sort((first, second) => first.total - second.total).slice(0, 3);

    clear(refs.results);
    refs.results.append(sectionLabel("Closest matches"));

    scored.forEach((item, index) => {
      const within = Math.max(item.fajrGap, item.ishaGap);
      const summary = within === 0 ? "Matches both times" : `Within ${within} ${within === 1 ? "minute" : "minutes"}`;
      refs.results.append(h("div", { class: "qm-match" },
        h("div", { class: "qm-match-copy" },
          h("span", { class: "qm-card-name" }, `${index + 1}. ${item.entry.name}`),
          h("span", { class: "qm-card-desc" }, summary),
          h("span", { class: "qm-card-times" },
            h("span", {}, "Fajr ", h("strong", {}, timeText(ctx, item.day.times.fajr))),
            h("span", {}, "Isha ", h("strong", {}, timeText(ctx, item.day.times.isha))),
          ),
        ),
        button("Use", "qb-ghost qb-sm", () => {
          ctx.setState({ method: item.entry.key });
          ctx.toast(`Using ${item.entry.name}`, { actionLabel: "Undo", onAction: () => ctx.setState({ method: "auto" }) });
        }, { "aria-label": `Use ${item.entry.name}` }),
      ));
    });
  }

  const el = h("section", { class: "qv qv-mosque", "aria-label": "Match my mosque" },
    viewScroll("qm-scroll",
      h("div", { class: "qv-toprow" }, ctx.backButton()),
      ctx.pageTitle("Match my mosque"),
      h("p", { class: "qm-soon" }, soonChip(), h("span", {}, "In this design preview only.")),
      h("p", { class: "qm-lead" }, "Enter the Fajr and Isha times on your mosque's timetable for today. Qalm helps you match the method that comes closest."),
      h("div", { class: "qs-card" }, fajrRow, ishaRow),
      button("Find matches", "qb-primary qb-wide", findMatches),
      refs.results,
    ),
  );

  paintValues();
  return { el, update: () => {} };
}

export function createCustomAnglesSheet(ctx) {
  const current = ctx.state.custom;
  const draft = { fajr: current.fajr, isha: current.isha, interval: current.interval };
  const refs = {
    fajr: h("span", { class: "qs-offset-value" }),
    isha: h("span", { class: "qs-offset-value" }),
    interval: h("span", { class: "qs-offset-value" }),
    preview: h("p", { class: "qk-summary", role: "status", "aria-live": "polite" }),
  };

  function previewTimes() {
    const saved = { ...ctx.state.custom };
    const savedMethod = ctx.state.method;
    Object.assign(ctx.state.custom, draft);
    ctx.state.method = "custom";
    const day = ctx.model.chosenDay(ctx.now());
    const text = `Fajr ${timeText(ctx, day.times.fajr)}, Isha ${timeText(ctx, day.times.isha)}`;
    Object.assign(ctx.state.custom, saved);
    ctx.state.method = savedMethod;
    return text;
  }

  function paint() {
    refs.fajr.textContent = `${draft.fajr}°`;
    refs.isha.textContent = draft.interval ? "Not used" : `${draft.isha}°`;
    refs.interval.textContent = draft.interval ? `${draft.interval} min after Maghrib` : "Off";
    refs.preview.textContent = `With these settings: ${previewTimes()}.`;
  }

  const clampAngle = (value) => Math.min(25, Math.max(0, Math.round(value * 2) / 2));

  const rows = [
    h("div", { class: "qs-row" }, h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Fajr angle"), refs.fajr),
      stepper({ label: "Fajr angle", onDec: () => { draft.fajr = clampAngle(draft.fajr - 0.5); paint(); }, onInc: () => { draft.fajr = clampAngle(draft.fajr + 0.5); paint(); } })),
    h("div", { class: "qs-row" }, h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Isha angle"), refs.isha),
      stepper({ label: "Isha angle", onDec: () => { draft.isha = clampAngle(draft.isha - 0.5); paint(); }, onInc: () => { draft.isha = clampAngle(draft.isha + 0.5); paint(); } })),
    h("div", { class: "qs-row" }, h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Isha interval"), refs.interval),
      stepper({ label: "Isha interval in minutes", onDec: () => { draft.interval = Math.max(0, draft.interval - 5); paint(); }, onInc: () => { draft.interval = Math.min(120, draft.interval + 5); paint(); } })),
  ];

  function apply() {
    ctx.setState({ method: "custom", custom: { ...draft } });
    ctx.closeSheet();
    ctx.toast("Using your custom angles", { actionLabel: "Undo", onAction: () => ctx.setState({ method: "auto" }) });
  }

  const el = h("div", { class: "qs-body" },
    ctx.sheetHeader("Custom angles"),
    h("p", { class: "qm-lead" }, "Angles are how far the sun sits below the horizon. Set an Isha interval to use minutes after Maghrib instead."),
    h("div", { class: "qs-card" }, ...rows),
    h("div", { class: "qk-summary-card" }, refs.preview),
    button("Use these angles", "qb-primary qb-wide", apply),
  );

  paint();
  return { el, label: "Custom angles" };
}
