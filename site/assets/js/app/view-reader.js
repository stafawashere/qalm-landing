import { h, ripple } from "./dom.js";
import { ayahByRef, surahOf, arabicNumber, resumePageLabel } from "./data.js";
import { viewScroll } from "./kit.js";
import { seedBookmarks } from "./view-quran.js";

const SURAH_NUMBER = 1;
const SIZE_STEPS = [
  { key: "small", label: "Small" },
  { key: "medium", label: "Medium" },
  { key: "large", label: "Large" },
];

export function createReaderView(ctx) {
  const surah = surahOf(SURAH_NUMBER);
  const refs = {};
  const markers = new Map();
  let sizeIndex = 1;

  seedBookmarks(ctx.store);

  refs.size = h("button", { type: "button", class: "qrd-size qpress" }, h("span", { "aria-hidden": "true" }, "Aa"));
  refs.size.addEventListener("click", cycleSize);
  refs.live = h("p", { class: "qsr", role: "status", "aria-live": "polite" });
  refs.list = h("div", { class: "qrd-list", lang: "ar", dir: "rtl" });
  refs.note = h("p", { class: "qk-note qrd-note" });

  const head = h("header", { class: "qrd-head" },
    ripple({ size: 560, className: "qrz-ripple" }),
    h("span", { class: "qrd-kicker" }, `Surah ${surah.number}`),
    h("h2", { class: "qv-title qrd-name" }, surah.name),
    h("span", { class: "qrd-arabic", lang: "ar", dir: "rtl" }, surah.arabic),
    h("span", { class: "qrd-meta" }, `${surah.ayat} ayat, ${resumePageLabel({ page: surah.page }).toLowerCase()}`),
  );

  const scroll = viewScroll("qrd-scroll",
    h("div", { class: "qv-toprow" }, ctx.backButton(), refs.size),
    head,
    refs.list,
    refs.note,
    refs.live,
  );
  scroll.dataset.size = SIZE_STEPS[sizeIndex].key;

  const el = h("section", { class: "qv qv-reader", "aria-label": "Reader" }, scroll);

  function isSaved(ref) {
    return ctx.store.bookmarks.some((entry) => entry.ref === ref);
  }

  function toggle(ref, number) {
    const index = ctx.store.bookmarks.findIndex((entry) => entry.ref === ref);

    if (index === -1) {
      ctx.store.bookmarks.unshift({ ref, daysAgo: 0 });
      ctx.toast(`Bookmarked ${ref}`);
    } else {
      ctx.store.bookmarks.splice(index, 1);
      ctx.toast(`Removed bookmark ${ref}`);
    }

    paintMarker(ref, number);
  }

  function paintMarker(ref, number) {
    const marker = markers.get(ref);
    if (!marker) return;
    const saved = isSaved(ref);
    marker.setAttribute("aria-pressed", String(saved));
    marker.setAttribute("aria-label", `Bookmark ayah ${number}`);
  }

  function buildMarker(ref, number) {
    const ring = `<svg viewBox="0 0 44 44" width="44" height="44" aria-hidden="true" focusable="false"><circle cx="22" cy="22" r="19.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="22" cy="22" r="15.5" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/></svg>`;
    const marker = h("button", { type: "button", class: "qrd-marker qpress", "aria-pressed": "false" },
      h("span", { class: "qrd-ring", html: ring }),
      h("span", { class: "qrd-num", "aria-hidden": "true" }, arabicNumber(number)),
    );
    marker.addEventListener("click", () => toggle(ref, number));
    markers.set(ref, marker);
    return marker;
  }

  function build() {
    let shown = 0;

    for (let number = 1; number <= surah.ayat; number += 1) {
      const ref = `${SURAH_NUMBER}:${number}`;
      const ayah = ayahByRef(ref);
      if (!ayah) continue;

      shown += 1;
      refs.list.append(h("div", { class: "qrd-ayah" },
        h("p", { class: "qrd-text" }, ayah.text),
        buildMarker(ref, number),
      ));
      paintMarker(ref, number);
    }

    const isPartial = shown < surah.ayat;
    refs.note.hidden = !isPartial;
    refs.note.textContent = isPartial ? `This preview shows ${shown} of ${surah.ayat} ayat. The full surah comes with the app.` : "";
  }

  function cycleSize() {
    sizeIndex = (sizeIndex + 1) % SIZE_STEPS.length;
    paintSize(true);
  }

  function paintSize(announce) {
    const step = SIZE_STEPS[sizeIndex];
    scroll.dataset.size = step.key;
    refs.size.setAttribute("aria-label", `Text size, ${step.label.toLowerCase()}. Change`);
    if (announce) refs.live.textContent = `Text size ${step.label.toLowerCase()}.`;
  }

  function update() {
    markers.forEach((_marker, ref) => paintMarker(ref, Number(ref.split(":")[1])));
  }

  build();
  paintSize(false);

  return { el, update, onShow: update };
}
