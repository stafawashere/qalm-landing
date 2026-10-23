import { h, icon, segmented, switchControl, button } from "./dom.js";
import { RECENT_SEARCHES } from "./data.js";
import { plusChip, viewScroll, sectionLabel } from "./kit.js";

function linkRow(ctx, { glyph, title, sub, target, plus = false }) {
  return h("button", { type: "button", class: "qgroup-row qpress", onClick: () => ctx.go(target) },
    h("span", { class: "qgroup-glyph" }, icon(glyph, { size: 20, width: 1.7 })),
    h("span", { class: "qgroup-text" }, h("span", { class: "qgroup-title" }, title, plus ? plusChip() : null), sub ? h("span", { class: "qgroup-sub" }, sub) : null),
    icon("chevron", { size: 16, width: 2 }),
  );
}

export function createMoreView(ctx) {
  const refs = {};

  refs.method = h("span", { class: "qgroup-sub" });

  const methodRow = h("button", { type: "button", class: "qgroup-row qpress", onClick: () => ctx.go("method") },
    h("span", { class: "qgroup-glyph" }, icon("gear", { size: 20, width: 1.7 })),
    h("span", { class: "qgroup-text" }, h("span", { class: "qgroup-title" }, "Calculation method"), refs.method),
    icon("chevron", { size: 16, width: 2 }),
  );

  refs.asr = segmented({
    label: "Asr calculation",
    options: [{ value: "standard", label: "Standard" }, { value: "hanafi", label: "Hanafi" }],
    value: ctx.model.resolvedAsr(),
    onChange: (value) => ctx.setState({ asr: value }),
  });

  refs.theme = segmented({
    label: "Appearance",
    options: [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }],
    value: ctx.state.theme,
    onChange: (value) => ctx.setState({ theme: value }),
  });

  const plusCard = h("button", { type: "button", class: "qmore-plus qpress", onClick: () => ctx.openSheet("plus", { context: "More" }) },
    h("span", { class: "qmore-plus-copy" },
      h("span", { class: "qmore-plus-title" }, "Qalm Plus"),
      h("span", { class: "qmore-plus-sub" }, "Khatm plan, notes and full-length adhan alarms."),
    ),
    icon("chevron", { size: 18, width: 2 }),
  );

  const el = h("section", { class: "qv qv-more", "aria-label": "More" },
    viewScroll("qmore-scroll",
      ctx.pageTitle("More"),
      plusCard,
      sectionLabel("Reading and worship"),
      h("div", { class: "qgroup" },
        linkRow(ctx, { glyph: "book", title: "Khatm plan", sub: "Finish the Quran at your pace", target: "khatm", plus: true }),
        linkRow(ctx, { glyph: "moon", title: "Last ten nights", sub: "Dates, Maghrib and reminders", target: "nights" }),
      ),
      sectionLabel("Prayer times"),
      h("div", { class: "qgroup" }, methodRow),
      h("div", { class: "qs-field" }, h("span", { class: "qs-field-label" }, "Asr calculation"), refs.asr),
      sectionLabel("Appearance"),
      h("div", { class: "qs-field" }, refs.theme),
      sectionLabel("About"),
      h("div", { class: "qgroup" },
        linkRow(ctx, { glyph: "lock", title: "Lock Screen preview", sub: "How a prayer alert looks", target: "lock" }),
        linkRow(ctx, { glyph: "shield", title: "Privacy", sub: "What stays on this device", target: "privacy" }),
      ),
      h("p", { class: "qk-note qmore-foot" }, "Qalm design preview. No ads. Nothing collected."),
    ),
  );

  function update() {
    refs.method.textContent = ctx.model.methodLabel(ctx.now()).replace(/, (the default for|your choice).*$/, "");
    refs.asr.set(ctx.model.resolvedAsr());
    refs.theme.set(ctx.state.theme);
  }

  update();
  return { el, update };
}

export function createPrivacyView(ctx) {
  const refs = {};

  const rows = [
    { key: "location", title: "Use my location", sub: "Only to find your city and Qibla. It never leaves this device." },
    { key: "saveplace", title: "Remember my place in the Quran", sub: "Kept on this device." },
  ];

  const switches = rows.map((row) => {
    const id = `${ctx.uid}-priv-${row.key}`;
    const checked = row.key === "location" ? ctx.store.location : ctx.store.rememberPlace !== false;
    return h("div", { class: "qgroup-row qgroup-static" },
      h("label", { class: "qgroup-text", for: id }, h("span", { class: "qgroup-title" }, row.title), h("span", { class: "qgroup-sub" }, row.sub)),
      switchControl({
        id,
        label: row.title,
        checked,
        onChange: (value) => {
          if (row.key === "location") ctx.store.location = value;
          else ctx.store.rememberPlace = value;
        },
      }),
    );
  });

  function resetAll() {
    ctx.store.resume = { surah: 18, ayah: 45, page: 299 };
    ctx.store.bookmarks = [];
    ctx.store.bookmarksSeeded = true;
    ctx.store.khatm = null;
    ctx.store.nights.reminders = new Set();
    ctx.store.plusPlan = "yearly";
    ctx.state.offsets = {};
    RECENT_SEARCHES.length = 0;
    ctx.refresh();
    ctx.toast("Local data deleted");
  }

  const deleteButton = button("Delete local data", "qb-danger qb-wide", () => {
    ctx.confirm({
      title: "Delete local data?",
      body: "Your place in the Quran, bookmarks, plans and time adjustments are removed from this device. This cannot be undone.",
      confirmLabel: "Delete",
      destructive: true,
    }, resetAll);
  });

  const el = h("section", { class: "qv qv-privacy", "aria-label": "Privacy" },
    viewScroll("qpriv-scroll",
      h("div", { class: "qv-toprow" }, ctx.backButton()),
      ctx.pageTitle("Privacy"),
      h("section", { class: "qpriv-card" },
        icon("shield", { size: 28, width: 1.6 }),
        h("h3", { class: "qpriv-title" }, "Qalm is built to collect nothing."),
        h("p", { class: "qpriv-body" }, "No accounts, no ads, no analytics. Prayer times are calculated on your device, and what you save stays here."),
      ),
      h("div", { class: "qgroup" }, ...switches),
      deleteButton,
    ),
  );

  return { el, update: () => {} };
}
