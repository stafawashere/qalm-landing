const SVG_NS = "http://www.w3.org/2000/svg";

const ICONS = {
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5z",
  chevron: "M9 5l7 7-7 7",
  chevronLeft: "M15 5l-7 7 7 7",
  shield: "M12 3l7 3v5c0 4.5-3 8.3-7 10c-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4",
  speaker: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11",
  speakerOff: "M4 9.5h3.5L12 6v12l-4.5-3.5H4zM16 9.5l5 5M21 9.5l-5 5",
  bell: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0",
  bellOff: "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20a2 2 0 0 0 4 0M4 4l16 16",
  sparkle: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  today: "M3 18h18M6 18a6 6 0 0 1 12 0M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6L17 11M8 21h8",
  book: "M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9.5",
  qibla: "M12 2.5l4.5 10h-9zM12 12.5v9",
  more: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM8 12h.01M12 12h.01M16 12h.01",
  search: "M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4",
  close: "M6 6l12 12M18 6L6 18",
  check: "M7.5 12.5l3 3 6-6.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14",
  bookmark: "M7 3h10v18l-5-4-5 4z",
  clock: "M12 7v5l3 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z",
  flag: "M6 21V4M6 5h11l-2 4 2 4H6",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  fajr: "M12 12V6M9 9l3-3 3 3M4 17h16M8 20.5h8",
  sunrise: "M3 18h18M6 18a6 6 0 0 1 12 0M12 6v2M5.6 9.6l1.4 1.4M18.4 9.6L17 11",
  sun: "M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
  maghrib: "M12 6v6M9 9l3 3 3-3M4 17h16M8 20.5h8",
  isha: "M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5zM17 3v3M15.5 4.5h3",
  share: "M12 3v12M8 7l4-4 4 4M5 13v7h14v-7",
  info: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v5M12 8v.5",
  compass: "M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5z",
  trash: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  gear: "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8",
  moon: "M19 14.5A8 8 0 1 1 9.5 5a6.5 6.5 0 0 0 9.5 9.5z",
  tag: "M3 12V4h8l10 10-8 8zM7.5 8h.01",
  mosque: "M5 21V12h14v9M3 21h18M12 12V9M9 12a3 3 0 0 1 6 0",
  undo: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-3",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z",
};

export function h(tag, props, ...children) {
  const element = document.createElement(tag);
  applyProps(element, props);
  append(element, children);
  return element;
}

function applyProps(element, props) {
  for (const [key, value] of Object.entries(props || {})) {
    const isEmpty = value === undefined || value === null || value === false;
    if (isEmpty) continue;

    const isListener = key.startsWith("on") && typeof value === "function";

    if (key === "class") element.className = value;
    else if (key === "text") element.textContent = value;
    else if (key === "html") element.innerHTML = value;
    else if (key === "style") element.setAttribute("style", value);
    else if (isListener) element.addEventListener(key.slice(2).toLowerCase(), value);
    else element.setAttribute(key, value === true ? "" : value);
  }
}

export function append(element, children) {
  for (const child of children.flat(Infinity)) {
    const isSkipped = child === undefined || child === null || child === false;
    if (isSkipped) continue;

    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export function svg(tag, attrs, ...children) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === undefined || value === null) continue;
    element.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child) element.append(child);
  }
  return element;
}

export function icon(name, { size = 22, width = 1.7, fill = "none", className = "" } = {}) {
  const path = ICONS[name];
  const element = svg("svg", {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill,
    stroke: "currentColor",
    "stroke-width": width,
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
    class: `qi ${className}`.trim(),
  });
  element.append(svg("path", { d: path }));
  return element;
}

export function clear(element) {
  while (element.firstChild) element.firstChild.remove();
  return element;
}

export function button(label, className, onClick, attrs) {
  return h("button", { type: "button", class: `qb ${className}`, onClick, ...attrs }, label);
}

export function switchControl({ label, checked, onChange, id }) {
  const input = h("input", { type: "checkbox", class: "qsw-input", role: "switch", "aria-label": label, id });
  input.checked = Boolean(checked);
  input.addEventListener("change", () => onChange(input.checked));

  const track = h("span", { class: "qsw", "aria-hidden": "true" }, h("span", { class: "qsw-knob" }));
  const wrap = h("label", { class: "qsw-wrap" }, input, track);
  wrap.input = input;
  return wrap;
}

export function segmented({ label, options, value, onChange }) {
  const root = h("div", { class: "qseg", role: "radiogroup", "aria-label": label });
  const buttons = new Map();

  const select = (next, notify) => {
    for (const [key, node] of buttons) {
      const isOn = key === next;
      node.setAttribute("aria-checked", String(isOn));
      node.tabIndex = isOn ? 0 : -1;
      node.classList.toggle("is-on", isOn);
    }
    if (notify) onChange(next);
  };

  options.forEach((option, index) => {
    const node = h("button", { type: "button", class: "qseg-item qpress", role: "radio", "data-value": option.value }, option.label);
    node.addEventListener("click", () => select(option.value, true));
    node.addEventListener("keydown", (event) => {
      const isNext = event.key === "ArrowRight" || event.key === "ArrowDown";
      const isPrev = event.key === "ArrowLeft" || event.key === "ArrowUp";
      if (!isNext && !isPrev) return;

      event.preventDefault();
      const step = isNext ? 1 : -1;
      const target = options[(index + step + options.length) % options.length];
      select(target.value, true);
      buttons.get(target.value).focus();
    });
    buttons.set(option.value, node);
    root.append(node);
  });

  const settle = (next) => {
    select(next, false);
    const hasMatch = buttons.has(next);
    if (!hasMatch) buttons.values().next().value.tabIndex = 0;
  };

  settle(value);
  root.set = settle;
  return root;
}

export function stepper({ label, onDec, onInc }) {
  const dec = h("button", { type: "button", class: "qstep-btn qpress", "aria-label": `Decrease ${label}` }, icon("minus", { size: 18, width: 2 }));
  const inc = h("button", { type: "button", class: "qstep-btn qpress", "aria-label": `Increase ${label}` }, icon("plus", { size: 18, width: 2 }));
  dec.addEventListener("click", onDec);
  inc.addEventListener("click", onInc);

  const root = h("div", { class: "qstep", role: "group", "aria-label": label }, dec, h("span", { class: "qstep-sep", "aria-hidden": "true" }), inc);
  root.dec = dec;
  root.inc = inc;
  return root;
}

export function ripple({ size = 260, className = "" } = {}) {
  const root = svg("svg", { viewBox: "0 0 200 200", width: size, height: size, fill: "none", class: `qripple ${className}`.trim(), "aria-hidden": "true" });
  root.append(
    svg("circle", { cx: 100, cy: 100, r: 40, "stroke-width": 1.2 }),
    svg("circle", { cx: 100, cy: 100, r: 62, "stroke-width": 0.9 }),
    svg("circle", { cx: 100, cy: 100, r: 84, "stroke-width": 0.6 }),
  );
  return root;
}

export function formatTimeParts(parts) {
  const root = h("span", { class: "qtime" }, parts.time);
  if (parts.period) root.append(h("span", { class: "qtime-period" }, parts.period));
  return root;
}
