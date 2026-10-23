import { setupMagnetic, setupLoupes, setupHeroPointer, setupLift } from "./react.js";
import { DURATION, EASE } from "./tokens.js";

const WIDE = "(min-width: 1100px) and (min-height: 760px)";
const REDUCE = "(prefers-reduced-motion: reduce)";
const FAST_SCROLL = 2800;

const REVEALS = [
  ["body", [".day__text > *"]],
  ["plate", [".day__dial", ".day__time"]],
  ["body", [".method__lede", ".method__reason", ".method__small"]],
  ["plate", [".methods"]],
  ["body", [".qibla__text h2", ".qibla__lede", ".qibla__note"]],
  ["aside", [".qibla__turn"]],
  ["body", [".quran__lede"]],
  ["aside", [".reader figcaption"]],
  ["body", [".khatm__lede"]],
  ["plate", [".khatm__plan"]],
  ["body", [".nights__lede"]],
  ["body", [".adhan__lede", ".adhan__caption"]],
  ["body", [".quiet__item"]],
  ["body", [".plan > *"]],
  ["body", [".ask"]],
  ["body", [".launch__text > *", ".remind > *"]],
];

const NARROW_ONLY_REVEALS = [
  ["body", [".heritage__head > p"]],
  ["plate", [".relic"]],
];

const PRESETS = {
  body: { from: { y: 28, opacity: 0 }, stagger: 0.08, duration: DURATION.reveal },
  plate: { from: { y: 44, scale: 0.95, opacity: 0 }, stagger: 0.12, duration: DURATION.reveal + 0.1 },
  aside: { from: { x: 26, opacity: 0 }, stagger: 0.08, duration: DURATION.reveal },
};

const ISLAND_MODES = { nights: "iftar" };
const HANDOVER = ["method", "qibla", "quran", "khatm", "nights", "adhan", "quiet", "price", "questions"];
const HERO_PARTS = ".hero h1, .hero__lede, .today, .hero__launch, .today__list li, .hero__astrolabe, .hero__phone, .hero__margin";

function nodesOf(ctx, selectors) {
  return selectors.flatMap((selector) => ctx.$$(selector));
}

function applyReveals(ctx, groups) {
  const { gsap, ScrollTrigger } = window;

  for (const [role, selectors] of groups) {
    const nodes = nodesOf(ctx, selectors);
    if (!nodes.length) continue;

    const preset = PRESETS[role];
    gsap.set(nodes, preset.from);

    ScrollTrigger.batch(nodes, {
      start: "top 88%",
      once: true,
      onEnter: (batch, triggers) => {
        const velocity = Math.abs(triggers[0]?.getVelocity?.() || 0);
        const isFast = velocity > FAST_SCROLL;
        const target = { x: 0, y: 0, scale: 1, opacity: 1, overwrite: true };

        if (isFast) {
          gsap.to(batch, { ...target, duration: DURATION.fast, ease: EASE.out });
          return;
        }
        gsap.to(batch, { ...target, duration: preset.duration, ease: EASE.out, stagger: preset.stagger });
      },
    });
  }
}

function splitHeadings(ctx) {
  const { gsap, SplitText } = window;
  if (!SplitText) return;

  const headings = ctx.$$("main h2").filter((heading) => {
    const isHidden = heading.classList.contains("visually-hidden");
    const isLive = heading.hasAttribute("data-clause") || heading.id === "qibla-title";
    return !isHidden && !isLive;
  });

  for (const heading of headings) {
    SplitText.create(heading, {
      type: "lines",
      mask: "lines",
      autoSplit: true,
      onSplit: (split) => gsap.from(split.lines, {
        yPercent: 110,
        duration: DURATION.reveal + 0.1,
        ease: EASE.out,
        stagger: 0.09,
        scrollTrigger: { trigger: heading, start: "top 88%", once: true },
      }),
    });
  }
}

function setupSmoothScroll(ctx) {
  const { gsap, ScrollTrigger, Lenis } = window;
  if (!Lenis) return null;

  const lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.9 });
  const onScroll = () => ScrollTrigger.update();
  const tick = (time) => lenis.raf(time * 1000);

  lenis.on("scroll", onScroll);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const links = ctx.$$('a[href^="#"]');
  const handlers = [];

  for (const link of links) {
    const handler = (event) => {
      const target = ctx.$(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      const isKeyboard = event.detail === 0;
      const distance = Math.abs(target.getBoundingClientRect().top);
      const duration = Math.min(2.2, Math.max(0.9, distance / 9000));

      lenis.scrollTo(target, { offset: 0, immediate: isKeyboard, duration });
      target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    link.addEventListener("click", handler);
    handlers.push([link, handler]);
  }

  ctx.lenis = lenis;
  window.qalm = Object.assign(window.qalm || {}, { lenis });

  return () => {
    for (const [link, handler] of handlers) link.removeEventListener("click", handler);
    gsap.ticker.remove(tick);
    lenis.off?.("scroll", onScroll);
    lenis.destroy();
    ctx.lenis = null;
    if (window.qalm) window.qalm.lenis = null;
  };
}

function buildHeroIntro(ctx) {
  const { gsap, SplitText } = window;
  const timeline = gsap.timeline({ defaults: { ease: EASE.out } });

  const ring = ctx.$("[data-ring-draw]");
  if (ring && gsap.plugins?.drawSVG) timeline.from(ring, { drawSVG: "0%", duration: 1.6, ease: EASE.inOut }, 0);
  else if (ring) timeline.from(ring, { opacity: 0, duration: 1.2 }, 0);

  if (SplitText) {
    const split = SplitText.create(".hero h1", { type: "lines", mask: "lines" });
    timeline.from(split.lines, { yPercent: 110, duration: 1.2, stagger: 0.09 }, 0.15);
  }

  timeline.from(".hero__lede, .today, .hero__launch", { opacity: 0, y: 24, duration: 1, stagger: 0.08 }, 0.45);
  timeline.from(".today__list li", { opacity: 0, y: 12, duration: 0.8, stagger: 0.05 }, 0.7);
  timeline.from(".hero__astrolabe", { opacity: 0, scale: 0.92, rotate: -8, duration: 1.8 }, 0);
  timeline.from(".hero__phone", { opacity: 0, y: 110, duration: 1.3 }, 0.3);
  timeline.from(".hero__margin", { opacity: 0, duration: 1 }, 1);
  return timeline;
}

function runHeroIntro(ctx) {
  const { gsap } = window;
  const root = document.documentElement;
  const wait = Math.max(150, 1350 - performance.now());

  ctx.state.introPending = true;
  const finish = () => {
    ctx.state.introPending = false;
    root.classList.remove("is-held");
  };

  const fontsReady = document.fonts?.ready ?? Promise.resolve();
  const patience = new Promise((resolve) => setTimeout(resolve, wait));

  Promise.race([fontsReady, patience]).then(() => {
    const isStillHeld = root.classList.contains("is-held");
    if (!isStillHeld) {
      ctx.state.introPending = false;
      return;
    }

    try {
      const timeline = buildHeroIntro(ctx);
      gsap.set(HERO_PARTS, { clearProps: "visibility" });
      finish();
      timeline.play(0);
    } catch {
      finish();
    }
  }).catch(finish);
}

function setupParallax(ctx) {
  const { gsap } = window;

  for (const layer of ctx.$$("[data-depth]")) {
    const depth = Number(layer.dataset.depth);
    const section = layer.closest("[data-chapter]");
    if (!depth || !section) continue;

    gsap.fromTo(layer, { y: () => -depth * innerHeight * 0.5 }, {
      y: () => depth * innerHeight * 0.5,
      ease: "none",
      scrollTrigger: { trigger: section, start: "top bottom", end: "bottom top", scrub: true, invalidateOnRefresh: true },
    });
  }
}

function setupDayPin(ctx) {
  const { gsap } = window;
  const progress = { value: 0 };
  let isScrubbing = false;

  gsap.to(progress, {
    value: 1,
    ease: "none",
    onUpdate: () => {
      if (isScrubbing) ctx.scrubDay(progress.value);
    },
    scrollTrigger: {
      trigger: "[data-day-pin]",
      pin: true,
      start: "top top",
      end: "+=300%",
      scrub: 0.8,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onEnter: (self) => {
        isScrubbing = true;
        ctx.beginScrub(self.progress);
      },
      onEnterBack: (self) => {
        isScrubbing = true;
        ctx.beginScrub(self.progress);
      },
      onLeave: () => {
        isScrubbing = false;
        ctx.endScrub();
      },
      onLeaveBack: () => {
        isScrubbing = false;
      },
    },
  });
}

function setupNightfall(ctx, { wide }) {
  const { gsap, ScrollTrigger } = window;

  ScrollTrigger.create({
    trigger: ".hero",
    start: "bottom bottom",
    endTrigger: ".day",
    end: wide ? "top top" : "top 75%",
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      const isBeyond = self.progress === 1 && self.scroll() > self.end + 1;
      if (isBeyond) return;
      ctx.nightfall(self.progress);
    },
    onLeaveBack: () => ctx.endScrub(),
  });

  gsap.to(".hero__astrolabe", {
    opacity: 0,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top+=48 top", endTrigger: ".day__dial", end: "top bottom", scrub: true, invalidateOnRefresh: true },
  });

  if (wide) {
    gsap.fromTo(".day__dial > *", { opacity: 0 }, {
      opacity: 1,
      ease: "none",
      immediateRender: true,
      scrollTrigger: { trigger: ".day", start: "top 22%", end: "top top", scrub: true, invalidateOnRefresh: true },
    });
  }

  gsap.to(".hero__text", {
    opacity: 0,
    yPercent: -7,
    ease: "none",
    scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom 62%", scrub: true, invalidateOnRefresh: true },
  });
}

function setupReducedDay(ctx) {
  const { ScrollTrigger } = window;

  ScrollTrigger.create({
    trigger: ".day",
    start: "top 70%",
    end: "bottom 30%",
    onToggle: (self) => {
      if (self.isActive) ctx.crossfadeTo("opening");
      else ctx.endScrub();
    },
  });
}

function setupDayFree(ctx) {
  const { ScrollTrigger } = window;

  ScrollTrigger.create({
    trigger: ".day",
    start: "top 75%",
    end: "bottom 35%",
    onEnter: (self) => ctx.beginScrub(self.progress),
    onEnterBack: (self) => ctx.beginScrub(self.progress),
    onUpdate: (self) => ctx.scrubDay(self.progress),
    onLeave: () => ctx.endScrub(),
  });
}

function setupHeritage(ctx) {
  const { gsap } = window;
  const track = ctx.$("[data-heritage-track]");
  const view = ctx.$(".heritage__view");
  const distance = () => Math.max(0, track.scrollWidth - view.clientWidth);

  const travel = gsap.to(track, {
    x: () => -distance(),
    ease: "none",
    scrollTrigger: {
      trigger: "[data-heritage-pin]",
      pin: true,
      start: "top top",
      end: () => `+=${distance()}`,
      scrub: 0.9,
      invalidateOnRefresh: true,
    },
  });

  for (const relic of ctx.$$(".relic", track)) {
    const passing = { trigger: relic, containerAnimation: travel, start: "left right", end: "right left", scrub: true };
    gsap.fromTo(ctx.$(".relic__limb", relic), { rotation: -40 }, { rotation: 40, ease: "none", scrollTrigger: passing });
    gsap.fromTo(ctx.$(".relic__pic img", relic), { scale: 1.06 }, { scale: 1, ease: "none", scrollTrigger: passing });
  }

  for (const caption of ctx.$$(".relic figcaption", track)) {
    gsap.from(caption, {
      opacity: 0,
      x: 60,
      ease: "power2.out",
      scrollTrigger: { trigger: caption, containerAnimation: travel, start: "left 92%", end: "left 62%", scrub: true },
    });
  }
}

function openHeritageForReducedMotion(ctx) {
  const view = ctx.$(".heritage__view");
  const pin = ctx.$("[data-heritage-pin]");
  if (!view || !pin) return null;

  const isClipped = getComputedStyle(view).overflowX === "clip";
  if (!isClipped) return null;

  const previous = {
    overflowX: view.style.overflowX,
    snap: view.style.scrollSnapType,
    pinOverflow: pin.style.overflow,
    tabindex: view.getAttribute("tabindex"),
    role: view.getAttribute("role"),
    label: view.getAttribute("aria-label"),
  };

  view.style.overflowX = "auto";
  view.style.scrollSnapType = "x proximity";
  view.setAttribute("tabindex", "0");
  view.setAttribute("role", "region");
  view.setAttribute("aria-label", "Instrument plates. Scroll sideways to browse.");
  pin.style.overflow = "visible";

  return () => {
    view.style.overflowX = previous.overflowX;
    view.style.scrollSnapType = previous.snap;
    pin.style.overflow = previous.pinOverflow;
    for (const [name, value] of [["tabindex", previous.tabindex], ["role", previous.role], ["aria-label", previous.label]]) {
      if (value === null) view.removeAttribute(name);
      else view.setAttribute(name, value);
    }
  };
}

function setupChapterMotion(ctx, chapters, { reduce }) {
  const { gsap, ScrollTrigger, SplitText } = window;
  const { $ } = ctx;

  const ayah = $("[data-reader]");
  if (SplitText && ayah) {
    const split = SplitText.create(ayah, { type: "words" });
    gsap.fromTo(split.words, { opacity: 0.12, y: 24 }, {
      opacity: 1,
      y: 0,
      stagger: 0.18,
      ease: "power1.out",
      scrollTrigger: { trigger: ".reader", start: "top 85%", end: "top 35%", scrub: 0.8 },
    });
  }

  gsap.from(".qibla__ring svg", {
    rotation: -25,
    opacity: 0,
    duration: 1.8,
    ease: EASE.out,
    scrollTrigger: { trigger: ".qibla", start: "top 70%", once: true, onEnter: () => chapters.qibla.swing() },
  });

  gsap.from(".juz", {
    scaleY: 0.2,
    opacity: 0.3,
    stagger: 0.025,
    duration: 0.9,
    ease: EASE.out,
    transformOrigin: "50% 100%",
    scrollTrigger: { trigger: ".khatm__bar", start: "top 88%", once: true },
  });

  gsap.from(".night", {
    y: 90,
    opacity: 0,
    stagger: 0.08,
    ease: "power2.out",
    scrollTrigger: { trigger: ".nights__list", start: "top 90%", end: "top 40%", scrub: 0.8 },
  });

  setupNightGlow(ctx);

  const rings = $(".adhan__rings");
  const wave = $(".adhan__wave .wave");
  ScrollTrigger.create({
    trigger: ".adhan",
    start: "top 55%",
    end: "bottom 15%",
    onToggle: (self) => {
      rings.classList.toggle("is-ringing", self.isActive);
      if (!self.isActive || !gsap.plugins?.drawSVG || !wave) return;
      gsap.fromTo(wave, { drawSVG: "0%" }, { drawSVG: "100%", duration: 2.2, ease: EASE.inOut, overwrite: true });
    },
  });

  gsap.fromTo(".window__bar span", { scaleX: 0 }, {
    scaleX: 1,
    ease: "none",
    transformOrigin: "0 50%",
    scrollTrigger: { trigger: ".window", start: "top 85%", end: "top 45%", scrub: 0.6 },
  });

  gsap.fromTo(".price__seal", { rotation: -60 }, {
    rotation: 60,
    ease: "none",
    scrollTrigger: { trigger: ".price", start: "top bottom", end: "bottom top", scrub: 0.8 },
  });

  ScrollTrigger.create({
    trigger: ".launch",
    start: "top 60%",
    once: true,
    onEnter: () => chapters.close.settle(),
  });

  if (SplitText) {
    const split = SplitText.create(".foot__name", { type: "chars", mask: "chars" });
    gsap.from(split.chars, {
      yPercent: 100,
      duration: 1.4,
      ease: EASE.out,
      stagger: 0.07,
      scrollTrigger: { trigger: ".foot", start: "top 85%", once: true },
    });
  }

  if (reduce) return;
  setupLift(".plan");
}

function setupNightGlow(ctx) {
  const { gsap, ScrollTrigger } = window;
  const list = ctx.$(".nights__list");
  const dots = ctx.$$(".night__dot", list);
  if (!list || !dots.length) return;

  const glows = dots.map((dot) => {
    const isOdd = dot.closest(".night--odd");
    if (!isOdd) return null;

    const glow = document.createElement("i");
    glow.className = "night__glow";
    dot.append(glow);
    return glow;
  });

  list.classList.add("has-glow");
  const lastOdd = glows.filter(Boolean).at(-1);

  gsap.set(dots, { scale: 0.6, opacity: 0.2 });
  gsap.set(glows.filter(Boolean), { scale: 0.6, opacity: 0 });

  ScrollTrigger.batch(dots, {
    start: "top 62%",
    once: true,
    onEnter: (batch) => {
      batch.forEach((dot, order) => {
        const glow = glows[dots.indexOf(dot)];
        const isLast = glow && glow === lastOdd;
        const delay = order * 0.12;
        const restOpacity = glow ? 1 : 0.7;

        gsap.to(dot, { scale: 1, opacity: restOpacity, duration: DURATION.slow, delay, ease: EASE.out });
        if (!glow) return;
        gsap.to(glow, { scale: 1, opacity: 0.5, duration: isLast ? 1.4 : DURATION.slow + 0.2, delay, ease: EASE.out });
      });
    },
  });
}

function setupHandovers(ctx) {
  const { gsap } = window;

  HANDOVER.forEach((key) => {
    const section = ctx.$(`[data-chapter="${key}"]`);
    const next = section?.nextElementSibling;
    if (!section || !next) return;

    gsap.to(section, {
      scale: 0.965,
      opacity: 0.55,
      y: () => -innerHeight * 0.03,
      transformOrigin: "50% 100%",
      ease: "none",
      scrollTrigger: { trigger: next, start: "top bottom", end: "top 25%", scrub: true, invalidateOnRefresh: true },
    });
  });
}

function setupPhoneChapters(ctx) {
  const { ScrollTrigger } = window;
  const stage = ctx.stage;
  const progressOf = new Map();
  let shown = "";

  const showFor = (slot) => {
    const section = slot.closest("[data-chapter]");
    const key = section?.dataset.chapter;
    if (!key) return;

    const early = slot.dataset.view;
    const late = slot.dataset.viewLate;
    const wanted = late && (progressOf.get(key) || 0) > 0.5 ? late : early;

    const phone = ctx.state.stage?.phone;
    const isNewChapter = ctx.state.chapter !== key;
    if (isNewChapter) phone?.cancelAlert?.();

    ctx.state.chapter = key;
    phone?.island?.(ISLAND_MODES[key] || "compact");
    if (wanted && wanted !== shown) {
      shown = wanted;
      ctx.showView(wanted);
    }
    ctx.syncPhone();
    if (isNewChapter && key === "adhan") phone?.alert?.();
  };

  stage.onDominant((slot) => showFor(slot));

  for (const section of ctx.$$("[data-chapter]")) {
    const slot = section.querySelector("[data-phone-slot]");
    const late = slot?.dataset.viewLate;
    if (!slot || !late) continue;

    const key = section.dataset.chapter;
    ScrollTrigger.create({
      trigger: section,
      start: "top 62%",
      end: "bottom 38%",
      onUpdate: (self) => {
        const before = progressOf.get(key) || 0;
        const after = self.progress;
        progressOf.set(key, after);

        const crossedForward = before <= 0.55 && after > 0.55;
        const crossedBack = before >= 0.45 && after < 0.45;
        const isCurrent = stage.dominant === slot;
        if (isCurrent && (crossedForward || crossedBack)) showFor(slot);
      },
    });
  }

  showFor(stage.dominant);
}

function setupStageSync(ctx) {
  const { ScrollTrigger } = window;
  const stage = ctx.stage;

  const trigger = ScrollTrigger.create({
    start: 0,
    end: "max",
    onUpdate: () => stage.sync(),
  });
  const onRefreshed = () => stage.sync();
  ScrollTrigger.addEventListener("refresh", onRefreshed);
  ScrollTrigger.addEventListener("scrollEnd", onRefreshed);

  stage.sync();

  return () => {
    trigger.kill();
    ScrollTrigger.removeEventListener("refresh", onRefreshed);
    ScrollTrigger.removeEventListener("scrollEnd", onRefreshed);
  };
}

function build(ctx, chapters, { wide, reduce }) {
  const { gsap, ScrollTrigger } = window;
  const cleanups = [];

  ctx.isHorizontal = () => wide && !reduce;
  ctx.stage.fit();

  if (reduce) {
    const restore = wide ? openHeritageForReducedMotion(ctx) : null;
    if (restore) cleanups.push(restore);
    setupPhoneChapters(ctx);
    setupReducedDay(ctx);
    cleanups.push(setupStageSync(ctx));
    return () => cleanups.forEach((undo) => undo());
  }

  const stopSmooth = setupSmoothScroll(ctx);
  if (stopSmooth) cleanups.push(stopSmooth);

  if (wide) {
    setupDayPin(ctx);
    setupHeritage(ctx);
  } else {
    setupDayFree(ctx);
  }

  setupNightfall(ctx, { wide });

  setupParallax(ctx);
  splitHeadings(ctx);
  applyReveals(ctx, wide ? REVEALS : [...REVEALS, ...NARROW_ONLY_REVEALS]);
  setupChapterMotion(ctx, chapters, { reduce });
  setupHandovers(ctx);
  setupPhoneChapters(ctx);
  cleanups.push(setupStageSync(ctx));

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  gsap.delayedCall(0.2, () => ScrollTrigger.refresh());

  return () => cleanups.forEach((undo) => undo());
}

export function setupMotion(ctx, chapters) {
  const { gsap, ScrollTrigger, SplitText, Flip } = window;
  const canAnimate = Boolean(gsap && ScrollTrigger);
  if (!canAnimate) {
    document.documentElement.classList.remove("is-held");
    return;
  }

  const plugins = [ScrollTrigger, SplitText, Flip, window.DrawSVGPlugin, window.ScrambleTextPlugin].filter(Boolean);
  gsap.registerPlugin(...plugins);

  const reduceNow = matchMedia(REDUCE).matches;
  if (!reduceNow) runHeroIntro(ctx);

  const media = gsap.matchMedia();
  media.add({ always: "(min-width: 0px)", wide: WIDE, reduce: REDUCE }, (context) => {
    const { wide, reduce } = context.conditions;
    return build(ctx, chapters, { wide, reduce });
  });

  if (!reduceNow) {
    setupMagnetic();
    setupLoupes();
  }

  const stage = ctx.stage;
  setupHeroPointer({
    hero: ctx.$(".hero"),
    astrolabe: ctx.state.astrolabe,
    sky: ctx.state.sky,
    rig: stage.rig,
  });
}
