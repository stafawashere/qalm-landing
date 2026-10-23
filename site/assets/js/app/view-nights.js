import { h, icon, switchControl, clear } from "./dom.js";
import { civil, ramadanBounds, SUGGESTION_POOL } from "./data.js";
import { viewScroll } from "./kit.js";
import { computeDay } from "../sky.js";
import { animateFrom } from "./motion.js";
import { EASE } from "../tokens.js";

const NIGHT_NUMBERS = [21, 22, 23, 24, 25, 26, 27, 28, 29, 30];

function nightStart(ctx, nightNumber, ramadan) {
  const eveningOf = ramadan.start + nightNumber - 2;
  const noon = new Date(civil.toDate(eveningOf).getTime() + 12 * 3600000);
  const day = computeDay(ctx.state.place, ctx.model.resolvedAsr(), noon);
  return { eveningOf, maghrib: day.times.maghrib, fmt: day.fmtText };
}

export function createNightsView(ctx) {
  const refs = {};
  let editing = false;

  refs.edit = h("button", { type: "button", class: "qv-textbtn qpress", onClick: () => { editing = !editing; paint(); } }, "Edit");
  refs.intro = h("p", { class: "qm-lead" });
  refs.list = h("div", { class: "qn-list", role: "list" });
  refs.chips = h("div", { class: "qn-chips" });

  const el = h("section", { class: "qv qv-nights", "aria-label": "Last ten nights" },
    viewScroll("qn-scroll",
      h("div", { class: "qv-toprow" }, ctx.backButton(), refs.edit),
      ctx.pageTitle("Last ten nights"),
      refs.intro,
      refs.chips,
      refs.list,
      h("p", { class: "qk-note" }, "Dates can differ by a day with moon sighting."),
    ),
  );

  function paintChips() {
    clear(refs.chips);
    const { suggestions } = ctx.store.nights;
    refs.chips.append(h("h3", { class: "qsec-label" }, "Ideas for the nights"));
    const row = h("div", { class: "qn-chiprow" });

    suggestions.forEach((text, index) => {
      const chip = h("span", { class: "qn-chip" }, text);
      if (editing) {
        chip.append(h("button", { type: "button", class: "qn-chip-x qpress", "aria-label": `Remove ${text}`, onClick: () => {
          suggestions.splice(index, 1);
          paintChips();
          row.querySelector(".qn-chip-x")?.focus({ preventScroll: true });
        } }, icon("close", { size: 14, width: 2.4 })));
      }
      row.append(chip);
    });

    const unused = SUGGESTION_POOL.find((entry) => !suggestions.includes(entry));
    if (editing && unused) {
      row.append(h("button", { type: "button", class: "qn-chip qn-add qpress", onClick: () => {
        suggestions.push(unused);
        paintChips();
      } }, icon("plus", { size: 14, width: 2.4 }), `Add ${unused.toLowerCase()}`));
    }
    refs.chips.append(row);
  }

  function paint() {
    refs.edit.textContent = editing ? "Done" : "Edit";
    const ramadan = ctx.store.ramadan();
    if (!ramadan) return;

    refs.intro.textContent = `Ramadan ${ramadan.year} AH. Odd nights are the ones many people seek Laylat al-Qadr in.`;
    paintChips();
    clear(refs.list);

    const reminders = ctx.store.nights.reminders;
    for (const nightNumber of NIGHT_NUMBERS) {
      const info = nightStart(ctx, nightNumber, ramadan);
      const isOdd = nightNumber % 2 === 1;
      const id = `${ctx.uid}-night-${nightNumber}`;
      const dateText = civil.label(info.eveningOf, { year: false });

      refs.list.append(h("div", { class: `qn-card${isOdd ? " is-odd" : ""}`, role: "listitem" },
        h("span", { class: "qn-num" }, String(nightNumber)),
        h("label", { class: "qn-copy", for: id },
          h("span", { class: "qn-title" }, `Night ${nightNumber}`, isOdd ? h("span", { class: "qn-odd" }, "Odd night") : null),
          h("span", { class: "qn-sub" }, `Begins ${dateText} at Maghrib, ${info.fmt(info.maghrib)}`),
        ),
        switchControl({
          id,
          label: `Remind me on night ${nightNumber}`,
          checked: reminders.has(nightNumber),
          onChange: (value) => {
            if (value) reminders.add(nightNumber);
            else reminders.delete(nightNumber);
          },
        }),
      ));
    }
  }

  paint();
  function onShow() {
    editing = false;
    paint();
    animateFrom([...refs.list.children], { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.04, ease: EASE.out, clearProps: "transform,opacity" });
  }

  return { el, update: paint, onShow };
}
