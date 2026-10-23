import { h, icon, ripple, segmented, button, clear } from "./dom.js";
import { SURAHS, TOTAL_PAGES, BOOKMARKS, ayahByRef, surahOf, juzOfPage, arabicNumber, juzStartPage, surahOnPage, resumeLabel, resumePageLabel } from "./data.js";
import { gateCard, plusChip, viewScroll } from "./kit.js";

function parseGoTo(raw) {
  const text = raw.trim().toLowerCase();
  if (!text) return { error: "Type an ayah like 2:255, a page like p 200 or a juz like j 5." };

  const ayah = text.match(/^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/);
  const page = text.match(/^p(?:age)?\.?\s*(\d{1,4})$/);
  const juz = text.match(/^j(?:uz)?\.?\s*(\d{1,3})$/);
  const surah = text.match(/^(\d{1,3})$/);

  if (ayah) {
    const s = Number(ayah[1]);
    const a = Number(ayah[2]);
    if (s < 1 || s > 114) return { error: `There are 114 surahs. ${s} is not one of them.` };

    const entry = surahOf(s);
    if (a < 1 || a > entry.ayat) return { error: `${entry.name} has ${entry.ayat} ayat.` };

    const next = SURAHS[s] ? SURAHS[s].page : TOTAL_PAGES;
    const estimate = Math.min(TOTAL_PAGES, entry.page + Math.floor(((a - 1) / entry.ayat) * Math.max(0, next - entry.page)));
    return { resume: { surah: s, ayah: a, page: a === 1 ? entry.page : estimate, approx: a !== 1 } };
  }

  if (page) {
    const p = Number(page[1]);
    if (p < 1 || p > TOTAL_PAGES) return { error: `The Quran has ${TOTAL_PAGES} pages.` };

    const entry = surahOnPage(p);
    return { resume: { surah: entry.number, ayah: entry.page === p ? 1 : null, page: p } };
  }

  if (juz) {
    const j = Number(juz[1]);
    if (j < 1 || j > 30) return { error: "There are 30 juz." };

    const start = juzStartPage(j);
    const entry = surahOnPage(start);
    return { resume: { surah: entry.number, ayah: entry.page === start ? 1 : null, page: start } };
  }

  if (surah) {
    const s = Number(surah[1]);
    if (s < 1 || s > 114) return { error: `There are 114 surahs. ${s} is not one of them.` };
    return { resume: { surah: s, ayah: 1, page: surahOf(s).page } };
  }

  return { error: "Try 2:255, p 200 or j 5." };
}

export function seedBookmarks(store) {
  if (store.bookmarks.length || store.bookmarksSeeded) return;
  store.bookmarks = BOOKMARKS.map((entry) => ({ ...entry }));
  store.bookmarksSeeded = true;
}

export function createQuranView(ctx) {
  const refs = {};
  let listMode = "surah";

  const searchButton = h("button", { type: "button", class: "qv-roundbtn qpress", "aria-label": "Search the Quran", onClick: () => ctx.go("search") }, icon("search", { size: 22, width: 1.8 }));
  const bookmarkButton = h("button", { type: "button", class: "qv-roundbtn qpress", "aria-label": "Bookmarks", onClick: () => ctx.go("bookmarks") }, icon("bookmark", { size: 22, width: 1.8 }));

  refs.resumeTitle = h("span", { class: "qrz-title" });
  refs.resumeArabic = h("span", { class: "qrz-arabic", lang: "ar", dir: "rtl" });
  refs.resumeMeta = h("span", { class: "qrz-meta" });
  refs.resumeFill = h("div", { class: "qrz-fill" });

  const resume = h("section", { class: "qrz", "aria-label": "Continue reading" },
    ripple({ size: 560, className: "qrz-ripple" }),
    h("span", { class: "qrz-kicker" }, "Continue reading"),
    h("div", { class: "qrz-row" }, refs.resumeTitle, refs.resumeArabic),
    refs.resumeMeta,
    h("div", { class: "qrz-bar" }, refs.resumeFill),
    button("Open reader", "qb-onaccent", () => ctx.go("reader")),
  );

  refs.input = h("input", { type: "text", class: "qgo-input", id: `${ctx.uid}-goto`, placeholder: "2:255, p 200 or j 5", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "go", "aria-describedby": `${ctx.uid}-goto-msg` });
  refs.message = h("p", { class: "qgo-msg", id: `${ctx.uid}-goto-msg`, role: "status", "aria-live": "polite" });
  const form = h("form", { class: "qgo", novalidate: "" },
    h("label", { class: "qgo-label", for: `${ctx.uid}-goto` }, "Go to ayah, page or juz"),
    h("div", { class: "qgo-field" }, refs.input, h("button", { type: "submit", class: "qgo-submit qpress" }, "Go")),
    refs.message,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const outcome = parseGoTo(refs.input.value);
    if (outcome.error) {
      refs.message.textContent = outcome.error;
      refs.message.classList.add("is-error");
      refs.input.setAttribute("aria-invalid", "true");
      return;
    }
    refs.message.classList.remove("is-error");
    refs.input.removeAttribute("aria-invalid");
    moveResume(outcome.resume);
    refs.input.value = "";
  });
  refs.input.addEventListener("input", () => {
    refs.message.textContent = "";
    refs.message.classList.remove("is-error");
    refs.input.removeAttribute("aria-invalid");
  });

  function moveResume(next) {
    const previous = { ...ctx.store.resume };
    ctx.store.resume = next;
    ctx.refresh();
    refs.message.textContent = `Moved to ${resumeLabel(next)}.`;
    ctx.toast(`Place set to ${resumeLabel(next)}`, {
      actionLabel: "Undo",
      onAction: () => {
        ctx.store.resume = previous;
        refs.message.textContent = "";
        ctx.refresh();
      },
    });
  }

  const segment = segmented({
    label: "List by",
    options: [{ value: "surah", label: "Surah" }, { value: "juz", label: "Juz" }],
    value: listMode,
    onChange: (value) => {
      listMode = value;
      paintList();
    },
  });

  refs.list = h("div", { class: "qlist", role: "list" });

  function paintList() {
    clear(refs.list);
    if (listMode === "surah") {
      for (const surah of SURAHS) {
        refs.list.append(h("button", { type: "button", role: "listitem", class: "qlist-row qpress", onClick: () => moveResume({ surah: surah.number, ayah: 1, page: surah.page }), "aria-label": `${surah.name}, ${surah.ayat} ayat, page ${surah.page}. Set as my place` },
          h("span", { class: "qlist-num" }, String(surah.number)),
          h("span", { class: "qlist-copy" }, h("span", { class: "qlist-name" }, surah.name), h("span", { class: "qlist-sub" }, `${surah.ayat} ayat, page ${surah.page}`)),
          h("span", { class: "qlist-ar", lang: "ar", dir: "rtl" }, surah.arabic),
        ));
      }
      return;
    }

    for (let juz = 1; juz <= 30; juz += 1) {
      const start = juzStartPage(juz);
      const entry = surahOnPage(start);
      refs.list.append(h("button", { type: "button", role: "listitem", class: "qlist-row qpress", onClick: () => moveResume({ surah: entry.number, ayah: entry.page === start ? 1 : null, page: start }), "aria-label": `Juz ${juz}, starts on page ${start}. Set as my place` },
        h("span", { class: "qlist-num" }, String(juz)),
        h("span", { class: "qlist-copy" }, h("span", { class: "qlist-name" }, `Juz ${juz}`), h("span", { class: "qlist-sub" }, `Starts on page ${start}, in ${entry.name}`)),
        h("span", { class: "qlist-ar", lang: "ar", dir: "rtl" }, `الجزء ${arabicNumber(juz)}`),
      ));
    }
  }

  function update() {
    const { resume: place } = ctx.store;
    refs.resumeTitle.textContent = resumeLabel(place);
    refs.resumeArabic.textContent = surahOf(place.surah).arabic;
    refs.resumeMeta.textContent = `${resumePageLabel(place)}, juz ${juzOfPage(place.page)}`;
    refs.resumeFill.style.width = `${Math.round((place.page / TOTAL_PAGES) * 100)}%`;
  }

  let isListBuilt = false;

  function onShow() {
    if (isListBuilt) return;
    isListBuilt = true;
    paintList();
  }

  const el = h("section", { class: "qv qv-quran", "aria-label": "Quran" },
    viewScroll("qq2-scroll", ctx.pageTitle("Quran", searchButton, bookmarkButton), resume, form, segment, refs.list),
  );

  return { el, update, onShow };
}

export function createBookmarksView(ctx) {
  let editing = false;
  let tab = "bookmarks";
  const refs = {};

  seedBookmarks(ctx.store);

  refs.edit = h("button", { type: "button", class: "qv-textbtn qpress", onClick: () => { editing = !editing; paint(); } }, "Edit");
  refs.body = h("div", { class: "qbm-body" });
  const segment = segmented({
    label: "Saved items",
    options: [{ value: "bookmarks", label: "Bookmarks" }, { value: "notes", label: "Notes" }],
    value: tab,
    onChange: (value) => {
      tab = value;
      paint();
    },
  });
  segment.querySelector("[data-value='notes']").append(plusChip());

  const topRow = h("div", { class: "qv-toprow" }, ctx.backButton(), refs.edit);
  const el = h("section", { class: "qv qv-bookmarks", "aria-label": "Bookmarks" },
    viewScroll("qbm-scroll", topRow, ctx.pageTitle("Bookmarks"), segment, refs.body),
  );

  function dateText(daysAgo) {
    const date = new Date(ctx.now().getTime() - daysAgo * 86400000);
    return new Intl.DateTimeFormat("en-GB", { timeZone: ctx.state.place.tz, day: "numeric", month: "short" }).format(date);
  }

  function paint() {
    clear(refs.body);
    refs.edit.hidden = tab !== "bookmarks";
    refs.edit.textContent = editing ? "Done" : "Edit";

    if (tab === "notes") {
      refs.body.append(gateCard(ctx, { title: "Notes are part of Qalm Plus.", body: "Write a note on any ayah and find it again here.", context: "Notes" }));
      return;
    }

    const list = ctx.store.bookmarks;
    if (!list.length) {
      refs.body.append(h("p", { class: "qempty" }, "No bookmarks yet. Tap the ayah marker in the reader to save one."));
      return;
    }

    const card = h("div", { class: "qbm", role: "list" });
    list.forEach((entry, index) => {
      const ayah = ayahByRef(entry.ref);
      const surah = surahOf(ayah.s);
      const remove = editing
        ? h("button", { type: "button", class: "qbm-remove qpress", "aria-label": `Remove bookmark ${entry.ref}`, onClick: () => removeAt(index) }, icon("minus", { size: 18, width: 2.4 }))
        : null;

      card.append(h("div", { class: "qbm-row", role: "listitem" },
        remove,
        h("div", { class: "qbm-copy" },
          h("div", { class: "qbm-head" }, h("span", { class: "qbm-ref" }, entry.ref), h("span", { class: "qbm-surah" }, surah.name), h("span", { class: "qbm-date" }, dateText(entry.daysAgo))),
          h("div", { class: "qbm-ar", lang: "ar", dir: "rtl" }, ayah.text),
        ),
      ));
    });
    refs.body.append(card);
  }

  function removeAt(index) {
    const [removed] = ctx.store.bookmarks.splice(index, 1);
    paint();
    ctx.toast(`Removed ${removed.ref}`, {
      actionLabel: "Undo",
      onAction: () => {
        ctx.store.bookmarks.splice(index, 0, removed);
        paint();
      },
    });
  }

  paint();
  return { el, update: paint, onShow: () => { editing = false; paint(); } };
}
