import { h, icon, button } from "./dom.js";
import { civil } from "./data.js";
import { zonedParts } from "../sky.js";
import { spring } from "../spring.js";
import { rollText } from "../roll.js";

export function createLockView(ctx) {
  const refs = {};

  refs.time = h("div", { class: "ql-time" });
  refs.date = h("div", { class: "ql-date" });
  refs.title = h("span", { class: "ql-note-title" });
  refs.body = h("span", { class: "ql-note-body" });

  refs.note = h("div", { class: "ql-note", role: "group", "aria-label": "Prayer notification" },
    h("span", { class: "ql-note-icon", "aria-hidden": "true" }, icon("bell", { size: 20, width: 1.8 })),
    h("span", { class: "ql-note-copy" },
      h("span", { class: "ql-note-app" }, h("span", {}, "Qalm"), h("span", { class: "ql-note-when" }, "now")),
      refs.title,
      refs.body,
    ),
  );

  const stripKeys = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
  const stripCells = new Map(stripKeys.map((key) => {
    const name = h("span", { class: "ql-strip-name" });
    const time = h("span", { class: "ql-strip-time" });
    return [key, { cell: h("li", { class: "ql-strip-cell" }, name, time), name, time }];
  }));
  const strip = h("ul", { class: "ql-strip", "aria-label": "Today's prayer times" }, ...[...stripCells.values()].map((entry) => entry.cell));

  const replay = button("Replay", "qb-onaccent qb-sm", () => play(), { "aria-label": "Replay the notification" });
  const caption = h("p", { class: "ql-caption" }, "The sound comes with the app.");

  const el = h("section", { class: "qv qv-lock", "aria-label": "Lock Screen preview" },
    h("div", { class: "ql-top" }, ctx.backButton("ql-back")),
    h("div", { class: "ql-center" }, refs.date, refs.time),
    refs.note,
    strip,
    h("div", { class: "ql-bottom" }, replay, caption),
  );

  const noteSpring = spring((progress) => {
    const lift = Math.max(0, progress);
    refs.note.style.transformOrigin = "50% 0%";
    refs.note.style.transform = `translate3d(0, ${((1 - lift) * -150).toFixed(1)}px, 0) scale(${(0.6 + 0.4 * lift).toFixed(4)})`;
    refs.note.style.opacity = String(Math.min(1, lift * 2.2));
  }, { stiffness: 170, damping: 17 });

  function paint() {
    const now = ctx.now();
    const parts = ctx.fmtParts(now);
    rollText(refs.time, parts.time);

    const { y, m, d } = zonedParts(now, ctx.state.place.tz);
    refs.date.textContent = civil.label(civil.fromParts(y, m, d), { year: false });

    const phase = ctx.phase();
    const names = ctx.day().names;
    refs.title.textContent = names[phase.key];
    const times = ctx.times();
    for (const [key, entry] of stripCells) {
      entry.name.textContent = names[key];
      entry.time.textContent = ctx.fmtText(times[key]);
      entry.cell.classList.toggle("is-next", key === phase.key);
    }

    refs.body.textContent = `${names[phase.key]} ${phase.mode === "next" ? "begins" : "began"} at ${ctx.fmtText(phase.time)} in ${ctx.state.place.name}.`;
  }

  function play() {
    noteSpring.set(0);
    noteSpring.to(1, () => {
      refs.note.style.transform = "";
      refs.note.style.opacity = "";
    });
  }

  paint();
  return { el, update: paint, tick: paint, onShow: () => { paint(); play(); } };
}
