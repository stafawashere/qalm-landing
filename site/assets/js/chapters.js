import { compassWord } from "./sky.js";
import { METHOD_KEYS, fajrAndIsha } from "./methods.js";
import { rollText, crossfadeText } from "./roll.js";
import { DURATION, EASE } from "./tokens.js";

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

function ringTicks(target, { radius, longRadius, step, longEvery }) {
  const lines = [];
  for (let degree = 0; degree < 360; degree += step) {
    const radians = (degree * Math.PI) / 180;
    const isLong = degree % longEvery === 0;
    const inner = isLong ? longRadius : radius - 10;
    const x1 = (inner * Math.sin(radians)).toFixed(1);
    const y1 = (-inner * Math.cos(radians)).toFixed(1);
    const x2 = (radius * Math.sin(radians)).toFixed(1);
    const y2 = (-radius * Math.cos(radians)).toFixed(1);
    lines.push(`<line${isLong ? ' class="is-long"' : ""} x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
  }
  target.innerHTML = lines.join("");
}

function setupMethod(ctx) {
  const { $, $$ } = ctx;
  const { gsap, Flip } = window;
  const reasonLine = $("[data-method-reason-line]");
  const bar = document.createElement("span");
  bar.className = "methods__bar";
  bar.setAttribute("aria-hidden", "true");

  function moveBar(row) {
    const isPlaced = bar.parentElement === row;
    if (isPlaced) return;

    const canFlip = gsap && Flip && bar.parentElement && !reducedMotion.matches;
    if (!canFlip) {
      row.prepend(bar);
      return;
    }

    const state = Flip.getState(bar);
    row.prepend(bar);
    Flip.from(state, { duration: DURATION.base, ease: EASE.out, scale: true, overwrite: true });
  }

  ctx.onDay((day) => {
    let chosenRow = null;

    for (const row of $$("[data-method-row]")) {
      const key = row.dataset.methodRow;
      const times = fajrAndIsha(day, key);
      const fajr = $("[data-method-fajr]", row);
      const isha = $("[data-method-isha]", row);
      rollText(fajr, times ? day.fmtText(times.fajr) : "Estimate");
      rollText(isha, times ? day.fmtText(times.isha) : "Estimate");

      const input = $("input", row);
      input.checked = key === day.method.key;
      row.classList.toggle("is-chosen", input.checked);
      if (input.checked) chosenRow = row;
    }

    if (chosenRow) moveBar(chosenRow);

    const isListed = METHOD_KEYS.includes(day.method.key);
    const prefix = isListed ? "" : `${day.method.name} is the usual method here. `;
    crossfadeText(reasonLine, `${prefix}${day.method.reason}`);
  });

  for (const input of $$("[data-methods] input")) {
    input.addEventListener("change", () => ctx.setMethod(input.value));
  }
}

function setupQibla(ctx) {
  const { $, $$ } = ctx;
  const { gsap } = window;
  const needle = $("[data-qibla-needle]");
  const rose = $(".qr__rose");
  const ticks = $("[data-qibla-ticks]");
  const slider = $("[data-heading]");
  const readout = $("[data-heading-state]");
  const motionButton = $("[data-motion]");
  const ring = $("[data-qibla-ring]");

  ringTicks(ticks, { radius: 248, longRadius: 228, step: 5, longEvery: 15 });

  let bearing = 58.5;
  let heading = 0;
  let isAligned = false;
  let isFollowing = false;

  function describe() {
    const relative = ((bearing - heading + 540) % 360) - 180;
    const amount = Math.round(Math.abs(relative));
    const facing = compassWord(heading);
    const aligned = Math.abs(relative) <= 3;

    if (aligned) readout.textContent = "Aligned with the Qibla.";
    else readout.textContent = `Facing ${facing}. Turn ${relative > 0 ? "right" : "left"} ${amount} degrees.`;

    if (aligned !== isAligned) {
      isAligned = aligned;
      ring.classList.toggle("is-aligned", aligned);
    }
  }

  function apply({ animate } = {}) {
    const needleAngle = bearing - heading;
    const roseAngle = -heading;
    const vars = { svgOrigin: "0 0" };

    if (animate && gsap && !reducedMotion.matches) {
      if (!isFollowing) gsap.to(needle, { rotation: needleAngle, ...vars, duration: 1.8, ease: "expo.out", overwrite: "auto" });
      gsap.to([rose, ticks], { rotation: roseAngle, ...vars, duration: 1.8, ease: "expo.out", overwrite: "auto" });
    } else if (gsap) {
      if (!isFollowing) gsap.set(needle, { rotation: needleAngle, ...vars });
      gsap.set([rose, ticks], { rotation: roseAngle, ...vars });
    }

    describe();
  }

  ctx.onDay((day) => {
    bearing = day.qibla;
    apply({ animate: true });
  });

  slider.addEventListener("input", () => {
    heading = Number(slider.value);
    apply();
  });

  const canHover = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (canHover && gsap) {
    let frameRequest = 0;
    let lastEvent = null;

    function follow() {
      frameRequest = 0;
      if (!lastEvent || reducedMotion.matches) return;

      const rect = ring.getBoundingClientRect();
      const dx = lastEvent.clientX - (rect.left + rect.width / 2);
      const dy = lastEvent.clientY - (rect.top + rect.height / 2);
      const pointerAngle = (Math.atan2(dx, -dy) * 180) / Math.PI;
      const current = Number(gsap.getProperty(needle, "rotation")) || 0;
      const shortest = ((pointerAngle - current + 540) % 360) - 180;

      gsap.to(needle, { rotation: current + shortest, svgOrigin: "0 0", duration: DURATION.slow, ease: "power3.out", overwrite: "auto" });
    }

    ring.addEventListener("pointerenter", () => { isFollowing = true; });
    ring.addEventListener("pointermove", (event) => {
      lastEvent = event;
      if (!frameRequest) frameRequest = requestAnimationFrame(follow);
    });
    ring.addEventListener("pointerleave", () => {
      isFollowing = false;
      lastEvent = null;
      cancelAnimationFrame(frameRequest);
      frameRequest = 0;
      const current = Number(gsap.getProperty(needle, "rotation")) || 0;
      const target = bearing - heading;
      const shortest = ((target - current + 540) % 360) - 180;
      gsap.to(needle, { rotation: current + shortest, svgOrigin: "0 0", duration: 1.1, ease: EASE.out, overwrite: "auto" });
    });
  }

  const canSense = "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches;
  if (canSense) {
    motionButton.hidden = false;
    motionButton.addEventListener("click", async () => {
      const asksFirst = typeof DeviceOrientationEvent.requestPermission === "function";
      let granted = true;

      if (asksFirst) {
        try { granted = (await DeviceOrientationEvent.requestPermission()) === "granted"; }
        catch { granted = false; }
      }

      if (!granted) {
        readout.textContent = "Showing the bearing from north instead.";
        return;
      }

      motionButton.hidden = true;
      addEventListener("deviceorientation", (event) => {
        const compass = event.webkitCompassHeading ?? (event.alpha === null ? null : 360 - event.alpha);
        if (compass === null || compass === undefined) return;
        heading = Math.round(compass) % 360;
        slider.value = heading;
        apply();
      });
    });
  }

  return {
    swing() {
      if (!gsap || reducedMotion.matches) return;
      gsap.fromTo(needle, { rotation: 0 }, { rotation: bearing - heading, svgOrigin: "0 0", duration: 2.4, ease: "expo.out", overwrite: "auto" });
    },
  };
}

function setupKhatm(ctx) {
  const { $, $$ } = ctx;
  const { gsap } = window;
  const segments = $$(".juz", $("[data-khatm-bar]"));
  const fills = segments.map((segment) => {
    const fill = document.createElement("i");
    fill.className = "juz__fill";
    segment.append(fill);
    return fill;
  });
  const out = $("[data-days-out]");
  const amount = $("[data-khatm-amount]");
  const finish = $("[data-khatm-finish]");
  let days = 30;

  function perDayText(perDay) {
    const rounded = Math.round(perDay * 10) / 10;
    const label = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return perDay >= 1 ? `${label} juz a day` : `About ${Math.round(perDay * 100) / 100} of a juz a day`;
  }

  function render() {
    const perDay = 30 / days;
    const formatter = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: ctx.state.city.tz });
    const end = new Date(Date.now() + days * 86400000);

    rollText(out, `${days} days`);
    crossfadeText(amount, perDayText(perDay));
    crossfadeText(finish, `Finish on ${formatter.format(end)}.`);

    const origin = Math.min(segments.length - 1, Math.max(0, Math.floor(perDay)));
    fills.forEach((fill, index) => {
      const level = Math.max(0, Math.min(1, perDay - index));
      if (gsap && !reducedMotion.matches) {
        gsap.to(fill, { scaleX: level, duration: DURATION.slow, delay: Math.abs(index - origin) * 0.014, ease: EASE.out, overwrite: "auto" });
      } else {
        fill.style.transform = `scaleX(${level})`;
      }
    });
  }

  for (const button of $$("[data-days-step]")) {
    button.addEventListener("click", () => {
      days = Math.max(10, Math.min(120, days + Number(button.dataset.daysStep)));
      render();
    });
  }

  ctx.onDay(render);
  render();
}

function setupChime(ctx) {
  const chime = ctx.$("[data-chime]");
  if (!chime) return;

  const points = [];
  for (let x = 0; x <= 210; x += 1.5) {
    const decay = Math.exp(-x / 70);
    points.push(`${(15 + x).toFixed(1)} ${(40 - 30 * decay * Math.sin(x * 0.42)).toFixed(1)}`);
  }
  chime.setAttribute("d", `M${points.join(" L")}`);
}

function setupClose(ctx) {
  const { $ } = ctx;
  const { gsap } = window;
  const ticks = $("[data-close-ticks]");
  const needle = $("[data-close-needle]");
  let bearing = 58.5;

  ringTicks(ticks, { radius: 150, longRadius: 126, step: 6, longEvery: 30 });
  if (gsap) gsap.set(needle, { rotation: bearing, svgOrigin: "0 0" });

  ctx.onDay((day) => {
    bearing = day.qibla;
  });

  return {
    settle() {
      if (!gsap) return;
      if (reducedMotion.matches) {
        gsap.set(needle, { rotation: bearing, svgOrigin: "0 0" });
        return;
      }
      gsap.fromTo(needle, { rotation: bearing + 720 }, { rotation: bearing, svgOrigin: "0 0", duration: 3.2, ease: "expo.out", overwrite: "auto" });
    },
  };
}

function setupLoupeKeys(ctx) {
  const { gsap } = window;
  if (!gsap) return;

  for (const lens of ctx.$$("[data-loupe]")) {
    const picture = lens.querySelector("img");
    lens.tabIndex = 0;
    lens.setAttribute("role", "group");
    lens.setAttribute("aria-label", "Instrument photograph. Arrow keys look closer.");

    let across = 0;
    let down = 0;

    function look(zoom) {
      gsap.to(picture, { scaleX: zoom, scaleY: zoom, xPercent: across, yPercent: down, duration: 0.5, ease: "power3.out", overwrite: "auto" });
    }

    lens.addEventListener("focus", () => look(1.7));
    lens.addEventListener("blur", () => { across = 0; down = 0; look(1); });
    lens.addEventListener("keydown", (event) => {
      const step = { ArrowLeft: [8, 0], ArrowRight: [-8, 0], ArrowUp: [0, 8], ArrowDown: [0, -8] }[event.key];
      if (!step) return;
      event.preventDefault();
      across = Math.max(-22, Math.min(22, across + step[0]));
      down = Math.max(-22, Math.min(22, down + step[1]));
      look(1.7);
    });
  }
}

export function setupChapters(ctx) {
  setupMethod(ctx);
  const qibla = setupQibla(ctx);
  setupKhatm(ctx);
  setupChime(ctx);
  const close = setupClose(ctx);
  setupLoupeKeys(ctx);
  return { qibla, close };
}
