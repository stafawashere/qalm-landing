import { computeDay, methodFor, zonedParts } from "../sky.js";
import { CC_FOR_KEY } from "./data.js";

export const PRAYER_ORDER = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
export const ALERTING = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const NOW_WINDOW = 20 * 60000;

export function normalisePlace(place) {
  const isRow = Array.isArray(place);
  if (isRow) {
    const [name, cc, lat, lng, tz] = place;
    return { name, cc, lat, lng, tz };
  }
  const { name, cc, lat, lng, tz } = place;
  return { name, cc, lat, lng, tz };
}

export function createModel(state) {
  const cache = { auto: { key: "", day: null }, chosen: { key: "", day: null } };

  const resolvedAsr = () => state.asr || methodFor(state.place.cc).defaultAsr;
  const isAuto = () => !state.method || state.method === "auto";

  function dayKey(now, extra) {
    const { y, m, d } = zonedParts(now, state.place.tz);
    const { name, lat, lng } = state.place;
    return [name, lat, lng, y, m, d, resolvedAsr(), extra].join("|");
  }

  function autoDay(now) {
    const key = dayKey(now, "auto");
    if (cache.auto.key === key) return cache.auto.day;

    const day = computeDay(state.place, resolvedAsr(), now);
    cache.auto = { key, day };
    return day;
  }

  function customTimes(calendarDate, lat, lng, asr) {
    const { adhan } = window;
    const params = adhan.CalculationMethod.Other();
    params.fajrAngle = state.custom.fajr;
    params.ishaAngle = state.custom.isha;
    if (state.custom.interval) params.ishaInterval = state.custom.interval;
    params.madhab = asr === "hanafi" ? adhan.Madhab.Hanafi : adhan.Madhab.Shafi;

    const exact = new adhan.PrayerTimes(new adhan.Coordinates(lat, lng), calendarDate, params);
    const isValid = ALL_KEYS.every((key) => Number.isFinite(exact[key]?.getTime()));
    if (isValid) return exact;

    const capped = Math.sign(lat) * Math.min(Math.abs(lat), 65);
    return new adhan.PrayerTimes(new adhan.Coordinates(capped, lng), calendarDate, params);
  }

  function chosenDay(now) {
    if (isAuto()) return autoDay(now);

    const extra = state.method === "custom" ? `custom${state.custom.fajr}/${state.custom.isha}/${state.custom.interval}` : state.method;
    const key = dayKey(now, extra);
    if (cache.chosen.key === key) return cache.chosen.day;

    const asr = resolvedAsr();
    let day;

    if (state.method === "custom") {
      const base = autoDay(now);
      const { y, m, d } = base.calendar;
      const today = customTimes(new Date(y, m - 1, d), state.place.lat, state.place.lng, asr);
      const tomorrow = customTimes(new Date(y, m - 1, d + 1), state.place.lat, state.place.lng, asr);
      const standard = customTimes(new Date(y, m - 1, d), state.place.lat, state.place.lng, "standard");
      const hanafi = customTimes(new Date(y, m - 1, d), state.place.lat, state.place.lng, "hanafi");
      const times = Object.fromEntries(PRAYER_ORDER.map((name) => [name, today[name]]));

      day = {
        ...base,
        times,
        tomorrowFajr: tomorrow.fajr,
        asrTimes: { standard: standard.asr, hanafi: hanafi.asr },
        angles: { fajr: state.custom.fajr, isha: state.custom.isha, ishaInterval: state.custom.interval },
        method: { key: "custom", name: "Custom angles", short: "Custom angles", reason: "Your own Fajr and Isha angles.", detail: "" },
      };
    } else {
      day = computeDay({ ...state.place, cc: CC_FOR_KEY[state.method] }, asr, now);
    }

    cache.chosen = { key, day };
    return day;
  }

  function dayForMethod(methodKey, now, asr) {
    const city = { ...state.place, cc: CC_FOR_KEY[methodKey] };
    return computeDay(city, asr || resolvedAsr(), now);
  }

  function times(now) {
    const day = chosenDay(now);
    const out = {};
    for (const key of PRAYER_ORDER) {
      const offset = state.offsets[key] || 0;
      out[key] = new Date(day.times[key].getTime() + offset * 60000);
    }
    out.tomorrowFajr = new Date(day.tomorrowFajr.getTime() + (state.offsets.fajr || 0) * 60000);
    return out;
  }

  function phase(now) {
    const t = times(now);
    const started = ALERTING.filter((key) => t[key] <= now);
    const current = started[started.length - 1];
    const upcoming = ALERTING.find((key) => t[key] > now);

    const isInWindow = current && now - t[current] < NOW_WINDOW;
    if (isInWindow) {
      const after = upcoming ? { key: upcoming, time: t[upcoming] } : { key: "fajr", time: t.tomorrowFajr };
      return { mode: "now", key: current, time: t[current], after };
    }

    if (upcoming) return { mode: "next", key: upcoming, time: t[upcoming] };
    return { mode: "tomorrow", key: "fajr", time: t.tomorrowFajr };
  }

  function nextWindow(now) {
    const t = times(now);
    const current = phase(now);
    const upcoming = current.mode === "now" ? current.after : current;
    const started = ALERTING.filter((key) => t[key] <= now);
    const previous = started.length ? t[started[started.length - 1]] : new Date(t.isha.getTime() - 86400000);
    const raw = (now - previous) / (upcoming.time - previous);

    return { key: upcoming.key, time: upcoming.time, previous, progress: Math.max(0, Math.min(1, raw)), isTomorrow: current.mode === "tomorrow" };
  }

  function nightTimes(now) {
    const t = times(now);
    const night = t.tomorrowFajr.getTime() - t.maghrib.getTime();
    return {
      midnight: new Date(t.maghrib.getTime() + night / 2),
      lastThird: new Date(t.tomorrowFajr.getTime() - night / 3),
    };
  }

  function methodLabel(now) {
    const day = chosenDay(now);
    if (isAuto()) return day.method.short;
    if (state.method === "custom") return "Custom angles, your choice";
    const name = day.method.name.replace(/^the /, "");
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}, your choice`;
  }

  return { autoDay, chosenDay, dayForMethod, times, phase, nextWindow, nightTimes, methodLabel, resolvedAsr, isAuto };
}

const ALL_KEYS = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

export function countdownParts(from, to) {
  const totalSeconds = Math.max(0, Math.ceil((to - from) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { totalSeconds, hours, minutes, seconds };
}

export function countdownText({ totalSeconds, hours, minutes, seconds }) {
  if (totalSeconds >= 3600) {
    return minutes === 0 ? `in ${hours} h` : `in ${hours} h ${minutes} min`;
  }
  const pad = (value) => String(value).padStart(2, "0");
  return `in ${minutes}:${pad(seconds)}`;
}

export function countdownSpoken({ totalSeconds, hours, minutes }) {
  const roundedMinutes = Math.max(1, minutes + (totalSeconds % 60 ? 1 : 0));
  if (hours === 0) return `in ${roundedMinutes} ${roundedMinutes === 1 ? "minute" : "minutes"}`;
  const hourWord = hours === 1 ? "hour" : "hours";
  return minutes === 0 ? `in ${hours} ${hourWord}` : `in ${hours} ${hourWord} ${minutes} minutes`;
}

export function minutesOfDay(date, tz) {
  const { h, min, s } = zonedParts(date, tz);
  return h * 60 + min + s / 60;
}
