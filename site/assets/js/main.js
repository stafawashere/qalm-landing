import { computeDay, sunAt, compassWord, zonedParts } from "./sky.js";
import { createDial } from "./dial.js";
import { setupPaper } from "./paper.js";
import { createSky } from "./instruments/sky-gl.js";
import { createAstrolabe, makeDraggable } from "./instruments/astrolabe.js";
import { renderSeal } from "./instruments/guilloche.js";
import { withMethod } from "./methods.js";
import { createStage } from "./stage.js";
import { setupChapters } from "./chapters.js";
import { setupMotion } from "./motion.js";
import { publishTokens } from "./tokens.js";
import { rollText } from "./roll.js";
import { createSunClock } from "./instruments/sun-clock.js";
import { clock } from "./instruments/clock.js";

const DEFAULT_CITY = { name: "New York", cc: "US", lat: 40.7128, lng: -74.006, tz: "America/New_York" };
const LAUNCH = { y: 2027, m: 4, d: 16 };
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const HOLD_TIMEOUT_MS = 1500;
const DAY_MINUTES = 1440;
const OVERRIDE_HOLD_MS = 3000;
const WAKE_GLIDE_AFTER_MS = 180000;
const WAKE_GLIDE_S = 0.8;
const RETURN_GLIDE_S = 0.7;
const ENTRY_BLEND_S = 0.6;
const COPY_FADE_OUT_S = 0.14;
const COPY_FADE_IN_S = 0.22;
const SKY_FADE_S = 0.2;
const GSAP_CDN = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.15.0/";
const PRAYER_KEYS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const root = document.documentElement;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  cities: [],
  city: DEFAULT_CITY,
  asr: null,
  method: null,
  day: null,
  minutes: 940,
  subMs: 0,
  live: true,
  phase: null,
  chapter: "arrival",
  stage: null,
  sky: null,
  astrolabe: null,
  astroControl: null,
  scene: null,
  flat: "",
  introPending: false,
};

const dayHooks = [];
const SCENES = { night: -16 };
const GLARE_BAND = { low: -5, high: 2 };

const textNodes = new Map();
const textValues = new Map();

function nodesFor(selector) {
  let nodes = textNodes.get(selector);
  if (!nodes) {
    nodes = $$(selector);
    textNodes.set(selector, nodes);
  }
  return nodes;
}

function setText(selector, text) {
  if (textValues.get(selector) === text) return;
  textValues.set(selector, text);
  for (const node of nodesFor(selector)) node.textContent = text;
}

function rollSelector(selector, text) {
  if (textValues.get(selector) === text) return;
  textValues.set(selector, text);
  for (const node of nodesFor(selector)) rollText(node, text);
}

const refs = {};
function ref(key, selector) {
  if (!refs[key]) refs[key] = $(selector);
  return refs[key];
}

function cityLabel(city) {
  return `${city.name}, ${city.cc}`;
}

function toCity([name, cc, lat, lng, tz]) {
  return { name, cc, lat, lng, tz };
}

function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function nearestCity(point) {
  let best = null;
  let bestDistance = Infinity;

  for (const city of state.cities) {
    const distance = distanceKm(point, city);
    if (distance < bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }

  return { city: best, distance: bestDistance };
}

function guessCity() {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return state.cities.find((city) => city.tz === zone) || DEFAULT_CITY;
}

function minutesSinceMidnight(date, tz) {
  const { h, min } = zonedParts(date, tz);
  return h * 60 + min;
}

function wrapMinutes(value) {
  return ((value % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
}

function wrapDelta(value) {
  const wrapped = wrapMinutes(value);
  return wrapped > DAY_MINUTES / 2 ? wrapped - DAY_MINUTES : wrapped;
}

function momentDate() {
  const subMs = state.live ? state.subMs : 0;
  return new Date(state.day.midnight.getTime() + wrapMinutes(state.minutes) * 60000 + subMs);
}

function phaseAt(date, times) {
  if (date < times.fajr) return "night";
  if (date < times.sunrise) return "fajr";
  if (date < times.dhuhr) return "sunrise";
  if (date < times.asr) return "dhuhr";
  if (date < times.maghrib) return "asr";
  if (date < times.isha) return "maghrib";
  return "isha";
}

function bandFor(phase, altitude) {
  if (phase === "night" || phase === "isha") return "night";
  if (altitude < 0) return "twilight";
  if (altitude < 12) return "golden";
  return "day";
}

const CLAUSES = {
  night: () => "Night, before the first light",
  fajr: (day) => `Fajr, at ${day.angles.fajr}° below the horizon`,
  sunrise: () => "Sunrise, and Fajr ends",
  dhuhr: () => "Dhuhr, as the sun peaks",
  asr: () => "Asr, when the shadow grows",
  maghrib: () => "Maghrib, as the sun sets",
  isha: () => "Isha, when the last light goes",
};

function ruleFor(phase, day) {
  const at = (key) => day.fmtText(day.times[key]);
  const noon = day.noonShadow || 0;
  const fajrAngle = day.angles.fajr;

  if (phase === "night") return `The sky is dark. Fajr begins when the sun climbs to ${fajrAngle}° below the horizon.`;
  if (phase === "fajr") return `Light reaches the sky while the sun is still ${fajrAngle}° below the horizon. That angle is the ${day.method.name.replace(/^the /, "")} rule.`;
  if (phase === "sunrise") return `Fajr ends as the sun's upper edge clears the horizon at ${at("sunrise")}.`;
  if (phase === "dhuhr") return `The sun crosses the meridian at ${at("dhuhr")}. Its shadow is shortest now: ${noon.toFixed(2)} times the stick.`;
  if (phase === "maghrib") return `Maghrib begins at sunset, ${at("maghrib")}.`;

  if (phase === "isha") {
    const usesInterval = day.angles.ishaInterval > 0;
    if (usesInterval) return `Isha begins ${day.angles.ishaInterval} minutes after Maghrib, at ${at("isha")}.`;
    return `Isha begins when the sun is ${day.angles.isha}° below the horizon, at ${at("isha")}.`;
  }

  if (day.asr === "hanafi") {
    return `A stick's shadow reaches twice its length plus its noon shadow, ${(noon + 2).toFixed(2)} times the stick, at ${at("asr")}. That is the Hanafi rule, and Asr comes later.`;
  }
  return `A stick's shadow reaches its length plus its noon shadow, ${(noon + 1).toFixed(2)} times the stick, at ${at("asr")}.`;
}

function renderSummary(day) {
  for (const [key, time] of Object.entries(day.times)) rollSelector(`[data-time="${key}"]`, day.fmtText(time));

  setText("[data-city-name]", day.city.name);
  setText("[data-method-name]", `${day.method.name.charAt(0).toUpperCase()}${day.method.name.slice(1)}, ${day.method.detail}.`);
  setText("[data-method-reason]", day.method.reason);
  setText("[data-qibla]", `${day.qibla.toFixed(1)}°`);
  setText("[data-qibla-word]", compassWord(day.qibla));
  setText("[data-alerts-until]", day.alertsUntil);

  $("[data-estimate]").hidden = !day.estimated;
  $(`[data-asr] input[value="${day.asr}"]`).checked = true;
}

let shownNextKey = "";
let shownNextDay = null;

function paintNext(date) {
  const day = state.day;
  const upcoming = PRAYER_KEYS.find((key) => day.times[key] > date);
  const key = upcoming || "fajr";
  const time = upcoming ? day.times[key] : day.tomorrowFajr;
  const name = day.names[key];
  const timeText = day.fmtText(time);

  const isChanged = key !== shownNextKey || day !== shownNextDay;
  if (isChanged) {
    shownNextKey = key;
    shownNextDay = day;
    for (const row of $$(".today__list li")) row.classList.toggle("is-next", row.dataset.prayer === key);
  }

  setText("[data-next-line]", `Next in ${day.city.name}: ${name} at ${timeText}.`);
  setText("[data-next-prayer]", `${name} ${timeText}`);
}

function renderTrackMarks(day) {
  const marks = Object.values(day.times).map((time) => {
    const mark = document.createElement("span");
    mark.className = "track__mark";
    mark.style.left = `${(minutesSinceMidnight(time, day.city.tz) / 1439) * 100}%`;
    return mark;
  });

  $(".track").replaceChildren($("[data-track-fill]"), ...marks);
}

let shadowKey = "";
const shadow = { x: "10px", y: "28px", a: "0.22" };

function castShadows(sample) {
  const isUp = sample.altitude > 0;
  const length = isUp ? Math.min(46, 10 + 6 * Math.min(sample.shadow || 6, 6)) : 14;
  const bearing = ((isUp ? sample.shadowBearing : 200) * Math.PI) / 180;
  const x = `${Math.round(Math.sin(bearing) * length)}px`;
  const y = `${Math.round(-Math.cos(bearing) * length * 0.8 + 10)}px`;
  const a = isUp ? "0.26" : "0.12";

  const key = `${x}|${y}|${a}`;
  if (key === shadowKey) return;

  shadowKey = key;
  shadow.x = x;
  shadow.y = y;
  shadow.a = a;
  paintShadows();
}

function paintShadows() {
  const hosts = [];
  if (state.stage) hosts.push(...state.stage.slots, state.stage.layer);
  if (state.chapter === "heritage") hosts.push($("[data-heritage-track]"));

  for (const host of hosts) {
    if (!host) continue;
    host.style.setProperty("--shadow-x", shadow.x);
    host.style.setProperty("--shadow-y", shadow.y);
    host.style.setProperty("--shadow-a", shadow.a);
  }
}

let copyWanted = "";
let copyTween = null;

function copySpan(node) {
  const existing = node.firstElementChild;
  if (existing?.classList.contains("copy")) return existing;

  const span = document.createElement("span");
  span.className = "copy";
  span.textContent = node.textContent;
  node.replaceChildren(span);
  return span;
}

function showDayCopy(clauseText, ruleText, shouldFade) {
  const { gsap } = window;
  const clause = ref("clause", "[data-clause]");
  const ruleNode = ref("rule", "[data-rule]");

  const wanted = `${clauseText}|${ruleText}`;
  if (wanted === copyWanted) return;
  copyWanted = wanted;
  copyTween?.kill();

  const canFade = shouldFade && gsap && !reducedMotion.matches;
  const write = () => {
    copySpan(clause).textContent = clauseText;
    copySpan(ruleNode).textContent = ruleText;
  };

  if (!canFade) {
    write();
    if (gsap) gsap.set([copySpan(clause), copySpan(ruleNode)], { opacity: 1 });
    return;
  }

  const spans = [copySpan(clause), copySpan(ruleNode)];
  copyTween = gsap.timeline()
    .to(spans, { opacity: 0, duration: COPY_FADE_OUT_S, ease: "power1.in" })
    .add(write)
    .to(spans, { opacity: 1, duration: COPY_FADE_IN_S, ease: "power1.out" });
}

function phoneState() {
  const isClose = state.chapter === "close";
  const date = isClose ? new Date() : momentDate();
  const isNight = ["night", "maghrib", "isha"].includes(state.phase);
  const theme = isClose || isNight ? "dark" : "light";
  const isScrubbing = !state.live && !isClose;
  const scrubAlerts = isScrubbing && state.chapter === "day";

  return { date, place: state.city, asr: state.day.asr, method: state.day.method.key, theme, live: !isScrubbing, scrubAlerts };
}

const devices = { module: null, host: null, mounted: false, key: "" };

function deviceKey(phoneNow) {
  const minute = Math.floor(phoneNow.date.getTime() / 60000);
  return `${phoneNow.place.name}|${phoneNow.asr}|${phoneNow.method}|${phoneNow.theme}|${minute}`;
}

function syncDevices(phoneNow) {
  if (!devices.mounted) return;

  const key = deviceKey(phoneNow);
  if (key === devices.key) return;

  devices.key = key;
  devices.module.updateDevices?.(phoneNow);
}

let phonePending = false;
function syncPhone() {
  if (!state.stage || !state.day || phonePending) return;
  phonePending = true;

  requestAnimationFrame(() => {
    phonePending = false;
    const phoneNow = phoneState();
    state.stage.phone.set(phoneNow);
    syncDevices(phoneNow);
  });
}

function fitDevices(host) {
  const plates = [...host.querySelectorAll(".qd")];
  if (!plates.length) return;

  const apply = () => {
    for (const plate of plates) {
      const nativeWidth = parseFloat(plate.style.getPropertyValue("--qd-w"));
      const room = plate.parentElement?.clientWidth || 0;
      if (!nativeWidth || !room) continue;
      plate.style.setProperty("--qd-scale", Math.min(1, room / nativeWidth).toFixed(4));
    }
  };

  apply();
  if (typeof ResizeObserver === "undefined") return;

  let timer = 0;
  new ResizeObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(apply, 100);
  }).observe(host);
}

function setupDevices() {
  const host = $("[data-devices]");
  if (!host || typeof IntersectionObserver === "undefined") return;

  const observer = new IntersectionObserver(async (entries) => {
    const isNear = entries.some((entry) => entry.isIntersecting);
    if (!isNear) return;

    observer.disconnect();

    try {
      const module = await import("./app/devices.js");
      if (typeof module.mountDevices !== "function") return;

      devices.module = module;
      devices.host = host;
      const phoneNow = phoneState();
      module.mountDevices(host, phoneNow);
      fitDevices(host);
      devices.key = deviceKey(phoneNow);
      devices.mounted = true;
    } catch {
      devices.mounted = false;
    }
  }, { rootMargin: "150% 0px" });

  observer.observe(host.closest("section") || host);
}

let lastPhaseShown = "";
let lastBand = "";
let lastValueText = "";
let lastSliderValue = "";
let lastTrack = "";

function renderMoment(dial) {
  const day = state.day;
  const date = momentDate();
  const sample = dial.setTime(date, day);
  const phase = phaseAt(date, day.times);
  const phaseChanged = phase !== state.phase;
  state.phase = phase;

  const clauseText = CLAUSES[phase](day);
  const rule = ruleFor(phase, day);
  const isSwap = phaseChanged && lastPhaseShown !== "";
  showDayCopy(clauseText, rule, isSwap);
  lastPhaseShown = phase;

  rollSelector("[data-readout-time]", day.fmtText(date));
  paintNext(date);

  const altitude = Math.round(Math.abs(sample.altitude));
  const aboveWord = sample.altitude >= 0 ? "above" : "below";
  setText("[data-readout-sun]", `Sun ${altitude}° ${aboveWord} the horizon`);
  setText("[data-readout-shadow]", sample.shadow && sample.shadow < 20 ? `Shadow ${sample.shadow.toFixed(1)} × the stick` : "No shadow to read");

  const band = bandFor(phase, sample.altitude);
  if (band !== lastBand) {
    lastBand = band;
    ref("day", ".day").dataset.band = band;
  }

  const minuteOfDay = wrapMinutes(state.minutes);
  const track = `scaleX(${(minuteOfDay / 1439).toFixed(4)})`;
  if (track !== lastTrack) {
    lastTrack = track;
    ref("trackFill", "[data-track-fill]").style.transform = track;
  }

  const slider = ref("slider", "[data-slider]");
  const sliderValue = String(Math.round(minuteOfDay));
  if (sliderValue !== lastSliderValue) {
    lastSliderValue = sliderValue;
    slider.value = sliderValue;
  }

  const valueText = `${day.fmtText(date)}, ${clauseText}`;
  if (valueText !== lastValueText) {
    lastValueText = valueText;
    slider.setAttribute("aria-valuetext", valueText);
  }

  if (phaseChanged) {
    for (const button of nodesFor("[data-stop]")) button.classList.toggle("is-current", button.dataset.stop === phase);
  }

  state.astrolabe?.setTime(date);
  state.astroControl?.sync();

  const { lat, lng } = day.city;
  const margin = `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? "N" : "S"}, ${Math.abs(lng).toFixed(2)}° ${lng >= 0 ? "E" : "W"}. ${day.dateLabel}, ${day.fmtText(date)}. Sun ${altitude}° ${aboveWord} the horizon.`;
  setText("[data-margin]", margin);

  castShadows(sample);
  paintSky();
  syncPhone();
}

function paintSky(altitudeOverride) {
  if (!state.sky || !state.day) return;

  const sun = sunAt(momentDate(), state.day.city.lat, state.day.city.lng);
  const sceneAltitude = state.scene === null ? null : SCENES[state.scene];
  const wanted = altitudeOverride ?? sceneAltitude ?? sun.altitude;
  const isInGlare = wanted > GLARE_BAND.low && wanted < GLARE_BAND.high;
  const nearerEdge = wanted < (GLARE_BAND.low + GLARE_BAND.high) / 2 ? GLARE_BAND.low : GLARE_BAND.high;
  const altitude = isInGlare ? nearerEdge : wanted;
  state.sky.setSun(altitude, sun.sunBearing - 180);

  const flat = state.sky.flatColor();
  if (flat === state.flat) return;
  state.flat = flat;
  document.body.style.backgroundColor = flat;
}

function setupSky() {
  const canvas = $("[data-sky]");
  const applyInk = (ink) => { document.documentElement.dataset.ink = ink; };
  state.sky = createSky(canvas, { onInkChange: applyInk });
  applyInk(state.sky.inkOnSky());
}

function setupAstrolabe() {
  const host = $("[data-astrolabe]");
  if (!host) return;

  const size = Math.round(host.clientWidth);
  if (!size) return;

  const canTurn = matchMedia("(pointer: fine)").matches;
  state.astrolabe = createAstrolabe(host, {
    lat: state.city.lat,
    lng: state.city.lng,
    size,
    label: canTurn ? "Brass astrolabe turned to the sky over your city. Drag to turn the day." : "Brass astrolabe turned to the sky over your city.",
  });

  if (!canTurn) state.astrolabe.element.style.touchAction = "pan-y";
}

function loadScript(src) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

async function ensureDragLibs() {
  if (!window.gsap) return;
  if (!window.Draggable) await loadScript(`${GSAP_CDN}Draggable.min.js`);
  if (!window.InertiaPlugin) await loadScript(`${GSAP_CDN}InertiaPlugin.min.js`);
}

function wireAstrolabe(stopGlide) {
  const instrument = state.astrolabe;
  if (!instrument || state.astroControl) return;

  const host = $("[data-astrolabe]");
  const canTurn = matchMedia("(pointer: fine)").matches;
  const scope = host?.closest(".hero") || document;

  state.astroControl = makeDraggable(instrument, {
    label: "Time of day. Arrow keys move ten minutes, Page Up and Page Down jump between prayers.",
    slider: $(".astro-slider[role=slider]", scope) || undefined,
    hit: $("svg.astro-hit", scope) || undefined,
    drag: canTurn,
    minutesOf: (date) => minutesSinceMidnight(date, state.city.tz),
    format: (date) => state.day.fmtText(date),
    onPress: stopGlide,
    onTime: (date) => {
      state.live = false;
      state.minutes = minutesSinceMidnight(date, state.city.tz);
      state.onMoment?.();
      state.onOverride?.();
    },
  });
}

function setupScenes() {
  const { ScrollTrigger } = window;
  if (!ScrollTrigger) return;

  for (const section of $$("[data-sky-scene]")) {
    const scene = section.dataset.skyScene;

    ScrollTrigger.create({
      trigger: section,
      start: "top 55%",
      end: "bottom 45%",
      onToggle: ({ isActive }) => {
        if (isActive) state.scene = scene;
        else if (state.scene === scene) state.scene = null;
        paintSky();
      },
    });
  }
}

function drawLimbs() {
  const limbLines = [];
  for (let degree = 0; degree < 360; degree += 2) {
    const radians = (degree * Math.PI) / 180;
    const isMajor = degree % 30 === 0;
    const outer = isMajor ? 112 : degree % 10 === 0 ? 109 : 106.5;
    const [x1, y1] = [104 * Math.sin(radians), -104 * Math.cos(radians)];
    const [x2, y2] = [outer * Math.sin(radians), -outer * Math.cos(radians)];
    limbLines.push(`<line${isMajor ? ' class="is-major"' : ""} x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}"/>`);
  }
  const limb = `<circle r="104"/>${limbLines.join("")}`;
  for (const ring of $$("[data-limb]")) ring.innerHTML = limb;
}

function drawSeal() {
  const seal = $("[data-seal]");
  if (!seal) return;

  const paint = () => {
    const size = Math.round(Math.min(560, innerWidth * 0.7));
    renderSeal(seal, { size, ink: "92,196,160", gold: "217,180,90", paper: "22,28,25" });
  };

  if (typeof IntersectionObserver === "undefined") {
    paint();
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    paint();
  }, { rootMargin: "120% 0px" });
  observer.observe(seal);
}

function setupDay(dial) {
  function refresh({ keepTime } = {}) {
    let day = computeDay(state.city, state.asr);
    if (state.method) day = withMethod(day, state.method);
    state.day = day;

    dial.setDay(day);
    renderSummary(day);
    renderTrackMarks(day);

    if (!keepTime) state.minutes = minutesSinceMidnight(new Date(), state.city.tz);

    if (state.astrolabe) {
      state.astrolabe.setLocation(state.city.lat, state.city.lng);
      state.astrolabe.setPrayers(day.times);
    }

    for (const hook of dayHooks) hook(day);
    renderMoment(dial);
  }

  const cityInput = $("#city");
  const cityNote = $("[data-city-note]");

  function chooseCity(city, note = "") {
    state.city = city;
    state.asr = null;
    state.method = null;
    state.live = true;
    cityInput.value = cityLabel(city);
    cityNote.textContent = note;
    cityNote.hidden = !note;
    refresh();
  }

  cityInput.addEventListener("change", () => {
    const typed = cityInput.value.trim().toLowerCase();
    const match = state.cities.find((city) => cityLabel(city).toLowerCase() === typed)
      || state.cities.find((city) => city.name.toLowerCase() === typed.split(",")[0].trim());

    if (match) chooseCity(match);
    else {
      cityNote.textContent = "That city is not in the list. Try a nearby larger city, or use your location.";
      cityNote.hidden = false;
    }
  });

  $("[data-locate]").addEventListener("click", () => {
    if (!navigator.geolocation) {
      cityNote.textContent = "This browser cannot share a location. Choose a city instead.";
      cityNote.hidden = false;
      return;
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const point = { lat: coords.latitude, lng: coords.longitude };
        const { city } = nearestCity(point);
        const here = { ...city, name: `Near ${city.name}`, lat: point.lat, lng: point.lng };
        chooseCity(here, "Worked out in your browser. Your location is not sent anywhere.");
      },
      () => {
        cityNote.textContent = "Location was not shared. Choose a city instead.";
        cityNote.hidden = false;
      },
      { maximumAge: 600000, timeout: 10000 },
    );
  });

  function setAsr(value) {
    state.asr = value;
    refresh({ keepTime: true });
  }

  for (const input of $$("[data-asr] input")) input.addEventListener("change", () => setAsr(input.value));

  let glide = null;
  let returnTimer = null;
  let skyFade = null;
  const entry = { active: false, from: 0, t: 1, tween: null };
  let scrubProgress = 0;

  function liveMinute() {
    return minutesSinceMidnight(new Date(), state.city.tz);
  }

  function holdOverride() {
    clearTimeout(returnTimer);
    returnTimer = null;
    glide?.kill();
  }

  function scheduleReturn(delay) {
    clearTimeout(returnTimer);
    returnTimer = null;
    if (state.chapter === "day") return;

    returnTimer = setTimeout(() => {
      returnTimer = null;
      endScrub();
    }, delay);
  }

  state.onOverride = () => scheduleReturn(OVERRIDE_HOLD_MS);

  function syncDay(now, { keepTime }) {
    const { y, m, d } = zonedParts(now, state.city.tz);
    const known = state.day.calendar;
    const isSameDay = known.y === y && known.m === m && known.d === d;
    if (isSameDay) return false;

    refresh({ keepTime });
    return true;
  }

  function finishLive() {
    state.live = true;
    state.subMs = 0;
    state.minutes = liveMinute();
    renderMoment(dial);
  }

  function crossfadeTo(target) {
    const { gsap } = window;
    const canvas = $("[data-sky]");
    skyFade?.kill();
    glide?.kill();
    clearTimeout(returnTimer);

    const apply = () => {
      if (target === null) finishLive();
      else {
        state.live = false;
        state.minutes = target === "opening" ? scrubBounds().first : target;
        renderMoment(dial);
      }
    };

    if (!gsap || !canvas) {
      apply();
      return;
    }

    skyFade = gsap.timeline()
      .to(canvas, { opacity: 0, duration: SKY_FADE_S, ease: "power1.in" })
      .add(apply)
      .to(canvas, { opacity: 1, duration: SKY_FADE_S, ease: "power1.out" });
  }

  function glideTo(from, delta, seconds, onDone) {
    const { gsap } = window;
    glide?.kill();
    state.live = false;
    glide = gsap.to(state, {
      minutes: from + delta,
      duration: seconds,
      ease: "power2.inOut",
      onUpdate: () => renderMoment(dial),
      onComplete: onDone,
    });
  }

  function jumpTo(key) {
    const { gsap } = window;
    const target = minutesSinceMidnight(state.day.times[key], state.city.tz);
    state.live = false;
    glide?.kill();
    state.onOverride?.();

    if (!gsap || reducedMotion.matches) {
      state.minutes = target;
      renderMoment(dial);
      return;
    }

    glide = gsap.to(state, {
      minutes: target,
      duration: 0.8,
      ease: "power3.inOut",
      snap: { minutes: 1 },
      onUpdate: () => renderMoment(dial),
      onComplete: () => { state.minutes = target; renderMoment(dial); },
    });
  }

  $("[data-slider]").addEventListener("input", (event) => {
    glide?.kill();
    state.live = false;
    state.minutes = Number(event.target.value);
    renderMoment(dial);
    state.onOverride?.();
  });

  state.onMoment = () => renderMoment(dial);

  const live = $("[data-live]");
  for (const button of $$("[data-stop]")) {
    button.addEventListener("click", () => {
      const key = button.dataset.stop;
      jumpTo(key);
      live.textContent = `${state.day.names[key]}, ${state.day.fmtText(state.day.times[key])}`;
    });
  }

  function scrubBounds() {
    const day = state.day;
    const first = Math.max(0, minutesSinceMidnight(day.times.fajr, day.city.tz) - 60);
    const last = Math.min(1439, minutesSinceMidnight(day.times.isha, day.city.tz) + 90);
    return { first, last };
  }

  function applyScrub() {
    const { first, last } = scrubBounds();
    const target = first + (last - first) * scrubProgress;

    if (entry.active) state.minutes = entry.from + wrapDelta(target - entry.from) * entry.t;
    else state.minutes = target;
  }

  function scrubDay(progress) {
    holdOverride();
    state.live = false;
    state.subMs = 0;
    scrubProgress = progress;
    applyScrub();
    renderMoment(dial);
  }

  function beginScrub(progress = 0) {
    const { gsap } = window;
    const { first, last } = scrubBounds();
    const target = first + (last - first) * progress;
    const delta = wrapDelta(target - state.minutes);
    const isFar = Math.abs(delta) >= 2;
    const canBlend = isFar && gsap && !reducedMotion.matches;

    entry.tween?.kill();
    entry.active = false;
    if (canBlend) {
      entry.active = true;
      entry.from = state.minutes;
      entry.t = 0;
      entry.tween = gsap.to(entry, {
        t: 1,
        duration: ENTRY_BLEND_S,
        ease: "power2.out",
        onUpdate: () => {
          applyScrub();
          renderMoment(dial);
        },
        onComplete: () => { entry.active = false; },
      });
    }

    scrubDay(progress);
  }

  function nightfall(progress) {
    const { gsap } = window;
    const { first } = scrubBounds();
    const origin = liveMinute();
    const end = first > origin ? first : first + DAY_MINUTES;
    const ease = gsap ? gsap.parseEase("sine.inOut") : (value) => value;

    holdOverride();
    entry.tween?.kill();
    entry.active = false;
    state.live = false;
    state.subMs = 0;
    state.minutes = origin + (end - origin) * ease(progress);
    renderMoment(dial);
  }

  function endScrub() {
    const { gsap } = window;
    holdOverride();
    entry.tween?.kill();
    entry.active = false;

    const target = liveMinute();
    const delta = wrapDelta(target - state.minutes);
    const isReduced = reducedMotion.matches || !gsap;

    if (isReduced && Math.abs(delta) >= 1) {
      crossfadeTo(null);
      return;
    }

    if (Math.abs(delta) < 1) {
      finishLive();
      return;
    }

    glideTo(state.minutes, delta, RETURN_GLIDE_S, () => {
      finishLive();
      syncDay(new Date(), { keepTime: false });
    });
  }

  function resync(gap, now) {
    const { gsap } = window;
    if (!state.day || !state.live) return;

    const from = state.minutes;
    const rolled = syncDay(now, { keepTime: true });
    const target = liveMinute();
    const delta = wrapMinutes(target - from);
    const isLong = gap > WAKE_GLIDE_AFTER_MS || rolled;
    const canGlide = isLong && delta >= 1 && gsap && !reducedMotion.matches;

    if (!canGlide) {
      finishLive();
      return;
    }

    glideTo(from, delta, WAKE_GLIDE_S, finishLive);
  }

  const onMinute = (now) => {
    syncDay(now, { keepTime: false });
    finishLive();
  };

  createSunClock({
    watch: $$(".hero, .day"),
    isLive: () => state.live && Boolean(state.day),
    onMinute,
    onSub: (now) => {
      state.subMs = now.getSeconds() * 1000 + now.getMilliseconds();
      const date = momentDate();
      const sample = dial.setTime(date, state.day);
      state.astrolabe?.setTime(date);
      castShadows(sample);
      paintSky();
    },
    onWake: resync,
  });

  return { refresh, chooseCity, setAsr, scrubDay, beginScrub, nightfall, crossfadeTo, endScrub, stopGlide: () => holdOverride() };
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function icsDate({ y, m, d }) {
  return `${y}${pad(m)}${pad(d)}`;
}

function shiftDays({ y, m, d }, days) {
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

function escapeIcs(text) {
  return text.replace(/[\\;,]/g, (character) => `\\${character}`).replace(/\r?\n/g, " ");
}

function setupCalendar() {
  const form = $("[data-calendar]");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = escapeIcs(form.elements.title.value.trim() || "Qalm on the App Store");
    const remindsEarly = form.elements.when.value === "7";
    const end = shiftDays(LAUNCH, 1);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
    const description = "Qalm is planned for the App Store on 16 April 2027. The date can move.";
    const alarmAt = remindsEarly ? "-P6DT15H" : "PT9H";

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Qalm//Launch reminder//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:qalm-launch-${icsDate(LAUNCH)}@qalm.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(LAUNCH)}`,
      `DTEND;VALUE=DATE:${icsDate(end)}`,
      `SUMMARY:${title}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${title}`,
      `TRIGGER:${alarmAt}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/calendar" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "qalm-launch.ics";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
}

async function loadCities() {
  try {
    const response = await fetch("assets/data/cities.json");
    const rows = await response.json();
    state.cities = rows.map(toCity);
  } catch {
    state.cities = [DEFAULT_CITY];
  }

  const options = state.cities.map((city) => new Option(cityLabel(city)));
  $("#city-list").replaceChildren(...options);
}

function nextPaint() {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 120);
    requestAnimationFrame(() => setTimeout(() => {
      clearTimeout(fallback);
      resolve();
    }));
  });
}

async function guarded(name, task) {
  try {
    return await task();
  } catch (error) {
    console.warn(`Qalm: ${name} did not start`, error);
    return null;
  }
}

function releaseHold() {
  root.classList.remove("is-held");
}

async function boot() {
  setupCalendar();
  setupPaper();
  drawLimbs();
  drawSeal();
  await nextPaint();

  const canCompute = window.adhan && window.SunCalc;
  if (!canCompute) {
    root.dataset.ink = "paper";
    return;
  }

  const dragLibs = ensureDragLibs();

  await loadCities();
  state.city = guessCity();
  setupSky();
  await nextPaint();

  setupAstrolabe();
  await nextPaint();

  const dial = createDial($("[data-dial]"));
  const day = setupDay(dial);

  const ctx = {
    state,
    $,
    $$,
    onDay: (hook) => dayHooks.push(hook),
    setMethod: (key) => {
      state.method = key;
      day.refresh({ keepTime: true });
    },
    scrubDay: day.scrubDay,
    beginScrub: day.beginScrub,
    nightfall: day.nightfall,
    crossfadeTo: day.crossfadeTo,
    endScrub: day.endScrub,
    clock,
    syncPhone,
    showView: (name) => state.stage?.phone.show(name),
    isHorizontal: () => false,
  };

  const chapterStub = { qibla: { swing() {} }, close: { settle() {} } };
  const chapters = (await guarded("chapters", () => setupChapters(ctx))) || chapterStub;
  await nextPaint();

  day.chooseCity(guessCity());
  state.sky.snap();
  requestAnimationFrame(() => root.classList.add("is-sky-ready"));
  await nextPaint();

  const hasMotionLibs = Boolean(window.gsap && window.ScrollTrigger);
  if (!hasMotionLibs) return;

  state.stage = await guarded("stage", () => createStage({
    state,
    phoneOptions: {
      clock,
      place: state.city,
      date: momentDate(),
      asr: state.day.asr,
      method: state.day.method.key,
      theme: "light",
    },
    onChange: (next) => {
      if (next.asr && next.asr !== state.day.asr) day.setAsr(next.asr);
      if (next.method && next.method !== state.day.method.key) ctx.setMethod(next.method);
    },
  }));
  if (!state.stage) return;

  ctx.stage = state.stage;
  state.stage.phone.island?.("compact");
  paintShadows();
  syncPhone();
  await nextPaint();

  await Promise.race([dragLibs, new Promise((resolve) => setTimeout(resolve, 800))]);
  wireAstrolabe(day.stopGlide);
  setupDevices();
  await nextPaint();

  const motionStarted = await guarded("motion", () => {
    setupMotion(ctx, chapters);
    return true;
  });
  if (!motionStarted) {
    state.introPending = false;
    releaseHold();
  }

  await guarded("scenes", () => setupScenes());
}

async function start() {
  publishTokens();
  if (!reducedMotion.matches) root.classList.add("is-held");
  setTimeout(releaseHold, HOLD_TIMEOUT_MS);

  try {
    await boot();
  } catch (error) {
    console.warn("Qalm: startup stopped early", error);
  } finally {
    if (!state.introPending) releaseHold();
  }
}

start();
