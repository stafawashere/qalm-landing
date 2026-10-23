import { h, icon, segmented, clear } from "./dom.js";
import { AYAT, SURAHS, RECENT_SEARCHES, findMatches, surahOf, arabicNumber, normaliseArabic } from "./data.js";
import { viewScroll } from "./kit.js";
import { animateFrom } from "./motion.js";

export function createSearchView(ctx) {
  const refs = {};
  let scope = "arabic";
  let recents = [...RECENT_SEARCHES];
  let typeTimer = null;

  refs.input = h("input", { type: "search", class: "qsf-input", id: `${ctx.uid}-search`, placeholder: "Search the Quran", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-label": "Search the Quran" });
  refs.input.addEventListener("input", () => paint(true));
  refs.clear = h("button", { type: "button", class: "qsf-clear qpress", hidden: true, "aria-label": "Clear the search", onClick: () => { refs.input.value = ""; paint(false); refs.input.focus(); } }, icon("close", { size: 14, width: 2.4 }));

  const field = h("div", { class: "qsf" }, icon("search", { size: 18, width: 1.8 }), refs.input, refs.clear);
  const topRow = h("div", { class: "qsf-row" }, field, h("button", { type: "button", class: "qv-textbtn qpress", onClick: ctx.back }, "Cancel"));

  const segment = segmented({
    label: "Search in",
    options: [{ value: "arabic", label: "Arabic" }, { value: "surah", label: "Surah names" }],
    value: scope,
    onChange: (value) => {
      scope = value;
      refs.input.placeholder = value === "arabic" ? "Search the Quran" : "Search surah names";
      paint(false);
    },
  });

  refs.body = h("div", { class: "qsr-body" });
  refs.status = h("p", { class: "qsr", role: "status", "aria-live": "polite" });

  const el = h("section", { class: "qv qv-search", "aria-label": "Search the Quran" },
    viewScroll("qsch-scroll", topRow, segment, refs.status, refs.body),
  );

  function highlighted(text, query) {
    const found = findMatches(text, query);
    const node = h("span", { class: "qsr-ar", lang: "ar", dir: "rtl" });
    if (!found.ranges || !found.ranges.length) {
      node.textContent = text;
      return node;
    }
    let cursor = 0;
    for (const [start, end] of found.ranges) {
      node.append(found.characters.slice(cursor, start).join(""));
      node.append(h("mark", { class: "qsr-mark" }, found.characters.slice(start, end).join("")));
      cursor = end;
    }
    node.append(found.characters.slice(cursor).join(""));
    return node;
  }

  function renderRecents() {
    clear(refs.body);
    refs.status.textContent = "";
    if (!recents.length) return;

    refs.body.append(h("div", { class: "qsr-recent-head" },
      h("h3", { class: "qsec-label" }, "Recent searches"),
      h("button", { type: "button", class: "qv-textbtn qpress", onClick: () => { recents = []; renderRecents(); } }, "Clear"),
    ));
    const card = h("div", { class: "qgroup", role: "list" });
    for (const term of recents) {
      const isArabic = /[؀-ۿ]/.test(term);
      card.append(h("button", { type: "button", role: "listitem", class: "qgroup-row qpress", onClick: () => { scope = "arabic"; segment.set("arabic"); refs.input.value = term; paint(true); } },
        icon("clock", { size: 18, width: 1.7 }),
        h("span", { class: "qgroup-text", lang: isArabic ? "ar" : "en" }, term),
        icon("chevron", { size: 16, width: 2 }),
      ));
    }
    refs.body.append(card);
  }

  function paint(typing) {
    const query = refs.input.value;
    refs.clear.hidden = !query;
    clearTimeout(typeTimer);

    const trimmed = query.trim();
    if (trimmed.length === 0) {
      renderRecents();
      return;
    }

    if (trimmed.length < 2) {
      clear(refs.body);
      refs.body.append(h("p", { class: "qempty" }, "Type at least 2 characters."));
      refs.status.textContent = "";
      return;
    }

    const results = scope === "arabic" ? searchArabic(trimmed) : searchSurahs(trimmed);
    const before = typing ? captureResults() : null;
    clear(refs.body);

    if (!results.length) {
      const hint = scope === "arabic" && /^[\x00-\x7F]+$/.test(trimmed) ? " Arabic search needs Arabic letters. Switch to Surah names to search in English letters." : "";
      refs.body.append(h("p", { class: "qempty" }, `Nothing found for "${trimmed}". Try fewer letters.${hint}`));
      refs.status.textContent = `Nothing found for ${trimmed}.`;
      return;
    }

    refs.status.textContent = `${results.length} ${results.length === 1 ? "result" : "results"}.`;
    const card = h("div", { class: "qgroup qsr-results", role: "list" });
    results.forEach((result) => card.append(result));
    refs.body.append(card);

    if (typing) flipResults(card, before);
  }

  function captureResults() {
    const { Flip } = window;
    const items = refs.body.querySelectorAll("[data-flip-id]");
    if (!Flip || ctx.reduced()) return null;
    return Flip.getState(items);
  }

  function flipResults(card, before) {
    const { Flip, gsap } = window;
    const items = [...card.children];
    const canFlip = Flip && gsap && before && !ctx.reduced();

    if (!canFlip) {
      animateFrom(items, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.06, ease: "power3.out", clearProps: "transform,opacity" });
      return;
    }

    Flip.killFlipsOf(items);
    Flip.from(before, {
      targets: items,
      duration: 0.28,
      ease: "expo.out",
      onEnter: (entering) => gsap.fromTo(entering, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "expo.out", stagger: 0.03, clearProps: "transform,opacity" }),
    });
  }

  function searchArabic(query) {
    const needle = normaliseArabic(query);
    return AYAT.filter((entry) => normaliseArabic(entry.text).includes(needle)).map((entry) => {
      const surah = surahOf(entry.s);
      const count = findMatches(entry.text, query).ranges.length;
      return h("button", { type: "button", role: "listitem", class: "qsr-item qpress", "data-flip-id": `ayah-${entry.s}-${entry.a}`, onClick: () => ctx.toast(`${surah.name} ${entry.s}:${entry.a} opens in the reader in the app.`) },
        h("span", { class: "qsr-ref" }, h("strong", {}, `${entry.s}:${entry.a}`), ` ${surah.name}`),
        highlighted(entry.text, query),
        h("span", { class: "qsr-count" }, `${count} ${count === 1 ? "match" : "matches"}`),
      );
    });
  }

  function searchSurahs(query) {
    const lowered = query.toLowerCase().replace(/[^a-z0-9]/g, "");
    const arabicNeedle = normaliseArabic(query);
    const hits = SURAHS.filter((surah) => {
      const latin = surah.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      const isLatinHit = lowered.length >= 2 && latin.includes(lowered);
      const isArabicHit = /[؀-ۿ]/.test(query) && normaliseArabic(surah.arabic).includes(arabicNeedle);
      return isLatinHit || isArabicHit || String(surah.number) === query.trim();
    });
    return hits.slice(0, 12).map((surah) => h("button", { type: "button", role: "listitem", class: "qsr-item qsr-surah qpress", "data-flip-id": `surah-${surah.number}`, onClick: () => { ctx.store.resume = { surah: surah.number, ayah: 1, page: surah.page }; ctx.refresh(); ctx.toast(`Place set to ${surah.name}`); } },
      h("span", { class: "qlist-num" }, String(surah.number)),
      h("span", { class: "qlist-copy" }, h("span", { class: "qlist-name" }, surah.name), h("span", { class: "qlist-sub" }, `${surah.ayat} ayat, page ${surah.page}`)),
      h("span", { class: "qlist-ar", lang: "ar", dir: "rtl" }, surah.arabic),
    ));
  }

  function typeIn(text) {
    refs.input.value = "";
    let index = 0;
    const step = () => {
      index += 1;
      refs.input.value = text.slice(0, index);
      paint(index === text.length);
      if (index < text.length) typeTimer = setTimeout(step, 110);
    };
    typeTimer = setTimeout(step, 260);
  }

  function onShow() {
    scope = "arabic";
    segment.set("arabic");
    refs.input.placeholder = "Search the Quran";
    refs.input.value = "";
    paint(false);
    if (!ctx.reduced()) typeIn("الصبر");
    else {
      refs.input.value = "الصبر";
      paint(false);
    }
  }

  paint(false);
  return { el, update: () => paint(false), onShow, destroy: () => clearTimeout(typeTimer) };
}
