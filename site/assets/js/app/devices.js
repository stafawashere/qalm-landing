import { h, icon, svg } from "./dom.js";
import { createModel, normalisePlace, countdownParts, countdownText, countdownSpoken, ALERTING } from "./model.js";
import { PRAYER_ICON } from "./view-today.js";

const DAY_MS = 86400000;
const SIX = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];

const DEVICES = [
  { key: "lock", name: "Lock Screen", note: "Design preview. Coming to iPhone.", width: 300, height: 620, build: buildLock },
  { key: "home", name: "Home Screen", note: "Design preview. Widgets for the Home Screen, Lock Screen and StandBy.", width: 300, height: 620, build: buildHome },
  { key: "standby", name: "StandBy", note: "Design preview. Coming to iPhone.", width: 640, height: 296, build: buildStandBy },
  { key: "watch", name: "Apple Watch", note: "Design preview. Coming to Apple Watch.", width: 214, height: 258, build: buildWatch },
  { key: "mac", name: "Mac menu bar", note: "Design preview. Coming to Mac.", width: 560, height: 372, build: buildMac },
];

const mounts = new Set();

export function mountDevices(host, state = {}) {
  const model = createModel(modelState(state));
  const mount = { host, model, figures: [] };

  for (const device of DEVICES) {
    const art = h("div", { class: "qdx-art", "aria-hidden": "true" });
    const frame = h("div", { class: "qdx-frame" }, art);
    const caption = h("figcaption", { class: "qdx-caption" },
      h("span", { class: "qdx-name" }, device.name),
      h("span", { class: "qdx-note" }, device.note),
    );
    const figure = h("figure", {
      class: "qd",
      "data-device": device.key,
      "data-ui": "",
      role: "img",
      style: `--qd-w: ${device.width}; --qd-h: ${device.height};`,
    }, frame, caption);

    mount.figures.push({ device, figure, art });
    host.append(figure);
  }

  mounts.add(mount);
  paint(mount, state);
  return mount;
}

export function updateDevices(state = {}) {
  for (const mount of mounts) {
    if (!mount.host.isConnected) {
      mounts.delete(mount);
      continue;
    }

    mount.model = createModel(modelState(state));
    paint(mount, state);
  }
}

function modelState(state) {
  const place = normalisePlace(state.place || ["New York", "US", 40.7128, -74.006, "America/New_York"]);
  return {
    place,
    asr: state.asr || undefined,
    method: state.method || "auto",
    offsets: {},
    custom: { fajr: 15, isha: 15, interval: 0 },
  };
}

function paint(mount, state) {
  const now = new Date(state.date || Date.now());
  const data = snapshot(mount.model, now);
  const theme = state.theme === "dark" ? "dark" : "light";

  for (const { device, figure, art } of mount.figures) {
    figure.dataset.theme = theme;
    const built = device.build(data);
    art.replaceChildren(built.el);
    figure.setAttribute("aria-label", `${device.name}, design preview. ${built.label}`);
  }
}

function snapshot(model, now) {
  const day = model.chosenDay(now);
  const times = model.times(now);
  const upcoming = model.nextWindow(now);
  const tomorrow = model.times(new Date(now.getTime() + DAY_MS));
  const place = model.chosenDay(now).city;
  const parts = countdownParts(now, upcoming.time);
  const pad = (value) => String(value).padStart(2, "0");
  const minutesRounded = parts.minutes + (parts.seconds > 0 ? 1 : 0);
  const shortCountdown = parts.hours > 0 ? `${parts.hours}:${pad(parts.minutes)}` : `${Math.max(1, minutesRounded)} min`;
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: place.tz, weekday: "short" }).format(now);

  return {
    now,
    day,
    names: day.names,
    place: place.name,
    times,
    tomorrow,
    upcoming,
    parts,
    countdown: parts.hours > 0 ? countdownText(parts) : `in ${Math.max(1, minutesRounded)} min`,
    spoken: countdownSpoken(parts),
    shortCountdown,
    clock: day.fmt(now),
    weekday,
    dateLabel: day.dateLabel,
    fmt: day.fmt,
    text: day.fmtText,
    methodLabel: model.methodLabel(now),
  };
}

function timeNode(data, date, className = "") {
  const parts = data.fmt(date);
  const node = h("span", { class: `qdx-t ${className}`.trim() }, parts.time);
  if (parts.period) node.append(h("span", { class: "qdx-p" }, ` ${parts.period}`));
  return node;
}

function ring({ size, stroke, progress, glyph, glyphSize, className = "" }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;
  const arc = svg("circle", {
    cx: centre, cy: centre, r: radius, fill: "none", class: "qdx-ring-arc", "stroke-width": stroke, "stroke-linecap": "round",
    "stroke-dasharray": `${(circumference * progress).toFixed(2)} ${circumference.toFixed(2)}`,
    transform: `rotate(-90 ${centre} ${centre})`,
  });
  const track = svg("circle", { cx: centre, cy: centre, r: radius, fill: "none", class: "qdx-ring-track", "stroke-width": stroke });
  const art = svg("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size }, track, arc);
  return h("span", { class: `qdx-ring ${className}`.trim(), style: `width:${size}px;height:${size}px` }, art, glyph ? h("span", { class: "qdx-ring-glyph" }, icon(glyph, { size: glyphSize || 22, width: 1.7 })) : null);
}

function statusBar(data, withIsland = true) {
  return h("div", { class: "qdx-status" },
    h("span", { class: "qdx-status-time" }, data.clock.time),
    withIsland ? h("span", { class: "qdx-island" }) : null,
    h("span", { class: "qdx-status-dots" }, h("i"), h("i"), h("i")),
  );
}

function liveActivity(data) {
  const { upcoming, names } = data;
  return h("div", { class: "qdx-live" },
    h("div", { class: "qdx-live-row" },
      h("span", { class: "qdx-live-glyph" }, icon(PRAYER_ICON[upcoming.key], { size: 24, width: 1.7 })),
      h("span", { class: "qdx-live-copy" },
        h("span", { class: "qdx-live-title" }, names[upcoming.key]),
        h("span", { class: "qdx-live-sub" }, data.countdown),
      ),
      timeNode(data, upcoming.time, "qdx-live-time"),
    ),
    h("div", { class: "qdx-live-bar" }, h("span", { style: `transform: scaleX(${Math.max(0.02, upcoming.progress).toFixed(3)})` })),
  );
}

function buildLock(data) {
  const { upcoming, names } = data;
  const widget = h("div", { class: "qdx-circle" },
    ring({ size: 68, stroke: 5, progress: upcoming.progress }),
    h("span", { class: "qdx-circle-copy" },
      icon(PRAYER_ICON[upcoming.key], { size: 16, width: 1.8 }),
      h("span", { class: "qdx-circle-time" }, data.fmt(upcoming.time).time),
    ),
  );

  const el = h("div", { class: "qdx-screen qdx-lock" },
    h("span", { class: "qdx-island" }),
    h("p", { class: "qdx-lock-date" }, data.dateLabel),
    h("p", { class: "qdx-lock-clock" }, data.clock.time),
    h("div", { class: "qdx-lock-widgets" }, widget),
    liveActivity(data),
    h("span", { class: "qdx-lock-btn is-left" }, icon("sun", { size: 22, width: 1.6 })),
    h("span", { class: "qdx-lock-btn is-right" }, icon("compass", { size: 22, width: 1.6 })),
    h("span", { class: "qdx-homebar" }),
  );

  const label = `The Lock Screen shows ${data.text(data.now)} on ${data.dateLabel}. A Live Activity shows ${names[upcoming.key]} ${data.spoken}, at ${data.text(upcoming.time)}. A small circular widget shows ${names[upcoming.key]} at ${data.text(upcoming.time)}. Coming to iPhone.`;
  return { el, label };
}

function timesGrid(data) {
  const next = data.upcoming.key;
  return h("div", { class: "qdx-grid" }, SIX.map((key) => h("div", { class: `qdx-cell${key === next ? " is-next" : ""}` },
    h("span", { class: "qdx-cell-name" }, data.names[key]),
    timeNode(data, data.times[key], "qdx-cell-time"),
  )));
}

function timesList(data) {
  const next = data.upcoming.key;
  return h("div", { class: "qdx-list" }, SIX.map((key) => h("div", { class: `qdx-row${key === next ? " is-next" : ""}` },
    h("span", { class: "qdx-row-glyph" }, icon(PRAYER_ICON[key], { size: 20, width: 1.7 })),
    h("span", { class: "qdx-row-name" }, data.names[key]),
    timeNode(data, data.times[key], "qdx-row-time"),
  )));
}

function spokenSix(data) {
  return SIX.map((key) => `${data.names[key]} ${data.text(data.times[key])}`).join(", ");
}

function buildHome(data) {
  const medium = h("div", { class: "qdx-widget qdx-medium" },
    h("div", { class: "qdx-widget-head" }, h("span", {}, data.place), h("span", {}, data.dateLabel.replace(/^\w+, /, ""))),
    timesGrid(data),
  );

  const large = h("div", { class: "qdx-widget qdx-large" },
    h("div", { class: "qdx-widget-head" }, h("span", {}, data.place), h("span", {}, data.dateLabel.replace(/^\w+, /, ""))),
    timesList(data),
    h("p", { class: "qdx-widget-foot" }, `${data.names[data.upcoming.key]} ${data.countdown}`),
  );

  const tiles = h("div", { class: "qdx-tiles" }, h("i"), h("i"), h("i"), h("i"));

  const el = h("div", { class: "qdx-screen qdx-home" },
    statusBar(data),
    medium,
    large,
    tiles,
    h("span", { class: "qdx-homebar" }),
  );

  const label = `The Home Screen shows two widgets for ${data.place}. The medium widget lists today's six times and the large widget lists them again with ${data.names[data.upcoming.key]} marked as next. Today's times are ${spokenSix(data)}. Widgets for the Home Screen, Lock Screen and StandBy.`;
  return { el, label };
}

function buildStandBy(data) {
  const { upcoming, names, parts } = data;
  const hasHours = parts.hours > 0;
  const big = hasHours ? `${parts.hours} h` : `${Math.max(1, parts.minutes + (parts.seconds > 0 ? 1 : 0))}`;
  const small = hasHours ? `${parts.minutes} min` : "min";

  const el = h("div", { class: "qdx-screen qdx-standby" },
    h("div", { class: "qdx-sb-main" },
      h("p", { class: "qdx-sb-place" }, data.place),
      h("p", { class: "qdx-sb-name" }, names[upcoming.key]),
      timeNode(data, upcoming.time, "qdx-sb-time"),
      h("p", { class: "qdx-sb-sub" }, data.countdown),
    ),
    h("div", { class: "qdx-sb-gauge" },
      ring({ size: 200, stroke: 12, progress: upcoming.progress, className: "is-big" }),
      h("span", { class: "qdx-sb-count" }, h("span", { class: "qdx-sb-big" }, big), h("span", { class: "qdx-sb-small" }, small)),
    ),
  );

  const label = `StandBy in landscape. The next prayer is shown large: ${names[upcoming.key]} at ${data.text(upcoming.time)}, ${data.spoken}. A ring shows how far through the current window it is. Coming to iPhone.`;
  return { el, label };
}

function nextThree(data) {
  const { upcoming } = data;
  const startIndex = ALERTING.indexOf(upcoming.key);
  const rows = [];

  for (let step = 0; step < 3; step += 1) {
    const position = startIndex + step;
    const wraps = data.upcoming.isTomorrow || position >= ALERTING.length;
    const key = ALERTING[position % ALERTING.length];
    const source = wraps ? data.tomorrow : data.times;
    rows.push({ key, time: step === 0 ? upcoming.time : source[key] });
  }

  return rows;
}

function buildWatch(data) {
  const rows = nextThree(data);
  const list = h("div", { class: "qdx-watch-list" }, rows.map((row, index) => h("div", { class: `qdx-watch-row${index === 0 ? " is-next" : ""}` },
    h("span", { class: "qdx-watch-name" }, data.names[row.key]),
    timeNode(data, row.time, "qdx-watch-time"),
  )));

  const el = h("div", { class: "qdx-watch" },
    h("span", { class: "qdx-watch-crown" }),
    h("div", { class: "qdx-watch-screen" },
      h("div", { class: "qdx-watch-top" }, h("span", { class: "qdx-watch-place" }, data.place), h("span", { class: "qdx-watch-clock" }, data.clock.time)),
      list,
    ),
  );

  const spoken = rows.map((row) => `${data.names[row.key]} at ${data.text(row.time)}`).join(", then ");
  const label = `An Apple Watch face lists the next three prayers: ${spoken}. Coming to Apple Watch.`;
  return { el, label };
}

function buildMac(data) {
  const { upcoming, names } = data;
  const menuText = `${names[upcoming.key]} in ${data.shortCountdown}`;

  const bar = h("div", { class: "qdx-menubar" },
    h("span", { class: "qdx-menu-left" }, h("b", {}, "Qalm"), h("span", {}, "File"), h("span", {}, "Edit"), h("span", {}, "View")),
    h("span", { class: "qdx-menu-right" },
      h("span", { class: "qdx-menu-item is-open" }, icon(PRAYER_ICON[upcoming.key], { size: 15, width: 1.9 }), h("span", {}, menuText)),
      h("span", { class: "qdx-menu-dots" }, h("i"), h("i")),
      h("span", { class: "qdx-menu-clock" }, `${data.weekday} ${data.clock.time}${data.clock.period ? ` ${data.clock.period}` : ""}`),
    ),
  );

  const popover = h("div", { class: "qdx-popover" },
    h("span", { class: "qdx-popover-notch" }),
    h("div", { class: "qdx-pop-head" },
      h("span", { class: "qdx-pop-place" }, data.place),
      h("span", { class: "qdx-pop-date" }, data.dateLabel),
    ),
    h("div", { class: "qdx-pop-next" },
      h("span", { class: "qdx-pop-next-name" }, names[upcoming.key]),
      h("span", { class: "qdx-pop-next-sub" }, data.countdown),
    ),
    timesList(data),
    h("p", { class: "qdx-pop-foot" }, data.methodLabel),
  );

  const el = h("div", { class: "qdx-screen qdx-mac" }, bar, popover);

  const label = `A Mac menu bar reads ${menuText}. Its 320 point popover lists today's six times for ${data.place}: ${spokenSix(data)}. Coming to Mac.`;
  return { el, label };
}
