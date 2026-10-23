import { h, icon, segmented, stepper, formatTimeParts, clear } from "./dom.js";
import { PRAYER_ICON } from "./view-today.js";
import { soonChip } from "./kit.js";

const DETAIL_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

function explain(ctx, key) {
  const day = ctx.day();
  const label = ctx.model.methodLabel(ctx.now()).replace(/, (the default for|your choice).*$/, "");
  const { angles } = day;

  if (key === "fajr") return `Fajr begins when the sun is ${angles.fajr} degrees below the horizon before sunrise. Method: ${label}.`;
  if (key === "sunrise") return "Sunrise is when the top edge of the sun first shows over the horizon.";
  if (key === "dhuhr") return "Dhuhr begins just after solar noon, once the sun has passed its highest point.";
  if (key === "maghrib") return "Maghrib begins at sunset, when the sun has fully gone below the horizon.";

  if (key === "asr") {
    const standard = ctx.fmtParts(day.asrTimes.standard);
    const hanafi = ctx.fmtParts(day.asrTimes.hanafi);
    const text = (parts) => `${parts.time}${parts.period ? ` ${parts.period}` : ""}`;
    return `Asr begins when an object's shadow is as long as the object plus its noon shadow. Standard gives ${text(standard)}. Hanafi uses twice the object and gives ${text(hanafi)}.`;
  }

  if (angles.ishaInterval) return `Isha begins ${angles.ishaInterval} minutes after Maghrib. Method: ${label}.`;
  return `Isha begins when the sun is ${angles.isha} degrees below the horizon after sunset. Method: ${label}.`;
}

export function createPrayerSheet(ctx, { key = "fajr" } = {}) {
  const safeKey = DETAIL_KEYS.includes(key) ? key : "fajr";
  const names = ctx.day().names;
  const hasAlerts = safeKey !== "sunrise";
  const timeBox = h("div", { class: "qs-bigtime" });
  const explainText = h("p", { class: "qs-explain" });
  const offsetValue = h("span", { class: "qs-offset-value" });

  function offset() {
    return ctx.state.offsets[safeKey] || 0;
  }

  function paint() {
    const times = ctx.times();
    clear(timeBox);
    timeBox.append(formatTimeParts(ctx.fmtParts(times[safeKey])));
    explainText.textContent = explain(ctx, safeKey);

    const value = offset();
    if (value === 0) offsetValue.textContent = "No change";
    else offsetValue.textContent = `${value > 0 ? "+" : "-"}${Math.abs(value)} min ${value > 0 ? "later" : "earlier"}`;
  }

  function changeOffset(delta) {
    const next = Math.min(30, Math.max(-30, offset() + delta));
    ctx.state.offsets[safeKey] = next;
    ctx.refresh();
    paint();
  }

  const calculation = h("section", { class: "qs-card qs-well" },
    h("h3", { class: "qs-card-title" }, "How this time is calculated"),
    explainText,
  );

  const offsetRow = h("div", { class: "qs-row" },
    h("span", { class: "qs-row-copy" }, h("span", { class: "qs-row-title" }, "Adjust time"), offsetValue),
    stepper({ label: `${names[safeKey]} offset in minutes`, onDec: () => changeOffset(-1), onInc: () => changeOffset(1) }),
  );

  const alertControl = segmented({
    label: `${names[safeKey]} alert style`,
    options: [{ value: "adhan", label: "Adhan" }, { value: "chime", label: "Chime" }, { value: "silent", label: "Silent" }, { value: "off", label: "Off" }],
    value: ctx.state.alerts[safeKey],
    onChange: (value) => {
      ctx.state.alerts[safeKey] = value;
      ctx.refresh();
    },
  });

  const asrControl = safeKey === "asr"
    ? segmented({
      label: "Asr calculation",
      options: [{ value: "standard", label: "Standard" }, { value: "hanafi", label: "Hanafi" }],
      value: ctx.model.resolvedAsr(),
      onChange: (value) => {
        ctx.setState({ asr: value });
        paint();
      },
    })
    : null;

  const soundRow = h("button", { type: "button", class: "qs-link qpress", onClick: () => ctx.toast("Sound plays in the app. This preview is silent.") },
    h("span", {}, "Test sound"),
    icon("speaker", { size: 20, width: 1.7 }),
  );
  const mosqueRow = h("button", { type: "button", class: "qs-link qpress", onClick: () => { ctx.closeSheet(); setTimeout(() => ctx.go("mosque"), 360); } },
    h("span", {}, "Match my mosque", soonChip()),
    icon("chevron", { size: 16, width: 2 }),
  );

  const el = h("div", { class: "qs-body" },
    h("div", { class: "qs-head" },
      h("div", { class: "qs-headtitle" }, h("span", { class: "qs-glyph" }, icon(PRAYER_ICON[safeKey], { size: 26, width: 1.6 })), h("h2", { class: "qs-title" }, names[safeKey])),
      h("button", { type: "button", class: "qs-close qpress", onClick: () => ctx.closeSheet() }, "Close"),
    ),
    timeBox,
    calculation,
    hasAlerts ? h("div", { class: "qs-card" }, offsetRow) : null,
    asrControl ? h("div", { class: "qs-field" }, h("span", { class: "qs-field-label" }, "Asr calculation"), asrControl) : null,
    hasAlerts ? h("div", { class: "qs-field" }, h("span", { class: "qs-field-label" }, "Alert style"), alertControl) : null,
    hasAlerts ? h("div", { class: "qs-card qs-links" }, soundRow, mosqueRow) : null,
  );

  paint();
  return { el, label: `${names[safeKey]} details` };
}
