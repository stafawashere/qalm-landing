import { h, svg, icon } from "./dom.js";
import { isReduced } from "./motion.js";
import { spring } from "../spring.js";

const SIZE = 330;
const CENTRE = SIZE / 2;
const LOCK_IN = 3;
const LOCK_OUT = 6;
const CARDINALS = { 0: "N", 90: "E", 180: "S", 270: "W" };

function wrap360(value) {
  return ((value % 360) + 360) % 360;
}

function signedDelta(qibla, heading) {
  return ((wrap360(qibla - heading) + 540) % 360) - 180;
}

export function createQiblaView(ctx) {
  const refs = {};
  const labels = [];
  let heading = ctx.state.heading;
  let isAligned = false;
  let motionHandler = null;
  let motionTimer = null;
  let qibla = 0;
  let needleAngle = 0;
  let needleIdle = 0;
  let hasSwung = false;
  const needleSpring = spring((angle) => {
    needleAngle = angle;
    paint(false);
  }, { from: 0, stiffness: 55, damping: 9.5, precision: 0.01 });

  refs.readout = h("h3", { class: "qq-readout" });
  refs.distance = h("p", { class: "qq-distance" });
  refs.hint = h("div", { class: "qq-hint", "aria-hidden": "true" });
  refs.live = h("p", { class: "qsr", "aria-live": "polite", "aria-atomic": "true" });

  const dial = buildDial();

  refs.range = h("input", { type: "range", class: "qq-range", min: "0", max: "359", step: "1", "aria-label": "Phone heading in degrees", value: String(Math.round(heading)) });
  refs.range.addEventListener("input", () => setHeading(Number(refs.range.value)));
  refs.headingValue = h("output", { class: "qq-heading-value" });
  refs.motion = h("button", { type: "button", class: "qq-motion qpress", "aria-pressed": "false", onClick: toggleMotion }, icon("compass", { size: 18, width: 1.8 }), h("span", {}, "Use motion"));

  const controls = h("div", { class: "qq-controls" },
    h("label", { class: "qq-heading" }, h("span", { class: "qq-heading-label" }, "Heading"), refs.range, refs.headingValue),
    refs.motion,
  );

  const mapButton = h("button", { type: "button", class: "qv-roundbtn qpress", "aria-label": "Show the map", onClick: () => ctx.toast("The map view comes with the app.") }, icon("map", { size: 22, width: 1.8 }));

  const scroll = h("div", { class: "qv-scroll qq-scroll", "data-lenis-prevent": "", tabindex: "-1" },
    ctx.pageTitle("Qibla", mapButton),
    refs.readout,
    refs.distance,
    refs.live,
    refs.hint,
    dial.wrap,
    h("p", { class: "qq-help" }, "Hold your iPhone flat and level."),
    controls,
    h("div", { class: "qq-chip" }, h("span", { class: "qq-chip-dot" }), "Compass accuracy: good"),
    h("p", { class: "qq-footer" }, "Uses your location and compass. Nothing leaves your iPhone."),
  );
  const el = h("section", { class: "qv qv-qibla", "aria-label": "Qibla" }, scroll);

  function buildDial() {
    const root = svg("svg", { viewBox: `0 0 ${SIZE} ${SIZE}`, width: SIZE, height: SIZE, class: "qq-dial", role: "slider", tabindex: "0", "aria-label": "Phone heading. Drag or use arrow keys to turn", "aria-valuemin": "0", "aria-valuemax": "359" });
    refs.dial = root;
    refs.ring = svg("circle", { cx: CENTRE, cy: CENTRE, r: 161, fill: "none", class: "qq-ring", "stroke-width": 4 });
    const face = svg("circle", { cx: CENTRE, cy: CENTRE, r: 159, class: "qq-face" });

    refs.rot = svg("g", { class: "qq-rot" });
    const ticks = svg("g", {});
    for (let step = 0; step < 72; step += 1) {
      const angle = step * 5;
      const isNorth = angle === 0;
      const isMajor = angle % 30 === 0;
      const length = isNorth ? 20 : isMajor ? 15 : 7;
      const tick = svg("line", {
        x1: CENTRE, y1: CENTRE - 154, x2: CENTRE, y2: CENTRE - 154 + length,
        transform: `rotate(${angle} ${CENTRE} ${CENTRE})`,
        class: `qq-tick${isMajor ? " is-major" : ""}${isNorth ? " is-north" : ""}`,
        "stroke-width": isMajor ? 3.2 : 1.5,
        "stroke-linecap": "round",
      });
      ticks.append(tick);
    }
    refs.rot.append(ticks);

    for (let angle = 0; angle < 360; angle += 30) {
      const isCardinal = angle in CARDINALS;
      const radius = isCardinal ? 120 : 122;
      const radians = (angle * Math.PI) / 180;
      const x = CENTRE + radius * Math.sin(radians);
      const y = CENTRE - radius * Math.cos(radians);
      const text = svg("text", {
        x, y, "text-anchor": "middle", "dominant-baseline": "central",
        class: `qq-label${isCardinal ? " is-cardinal" : ""}${angle === 0 ? " is-north" : ""}`,
      });
      text.textContent = isCardinal ? CARDINALS[angle] : String(angle);
      labels.push({ text, x, y });
      refs.rot.append(text);
    }

    refs.needle = svg("g", { class: "qq-needle" },
      svg("line", { x1: CENTRE, y1: CENTRE, x2: CENTRE, y2: CENTRE - 122, class: "qq-needle-line", "stroke-width": 3.5, "stroke-linecap": "round" }),
      svg("g", { transform: `translate(${CENTRE} ${CENTRE - 134})` },
        svg("rect", { x: -13, y: -13, width: 26, height: 26, rx: 3.5, class: "qq-kaaba" }),
        svg("rect", { x: -13, y: -6, width: 26, height: 4, class: "qq-kaaba-band" }),
      ),
    );
    refs.rot.append(refs.needle);

    const hub = svg("circle", { cx: CENTRE, cy: CENTRE, r: 11, class: "qq-hub" });
    const hubRing = svg("circle", { cx: CENTRE, cy: CENTRE, r: 11, fill: "none", class: "qq-hub-ring", "stroke-width": 3 });
    root.append(face, refs.ring, refs.rot, hubRing, hub);

    const marker = svg("svg", { viewBox: "0 0 26 18", width: 26, height: 18, class: "qq-marker", "aria-hidden": "true" }, svg("path", { d: "M2 2h22L13 16z" }));
    refs.marker = marker;
    const wrap = h("div", { class: "qq-dialwrap" }, marker, root);

    let dragStart = null;
    const angleOf = (event) => {
      const rect = root.getBoundingClientRect();
      const dx = event.clientX - (rect.left + rect.width / 2);
      const dy = event.clientY - (rect.top + rect.height / 2);
      return (Math.atan2(dx, -dy) * 180) / Math.PI;
    };
    root.addEventListener("pointerdown", (event) => {
      dragStart = { angle: angleOf(event), heading };
      root.setPointerCapture(event.pointerId);
      root.classList.add("is-drag");
    });
    root.addEventListener("pointermove", (event) => {
      if (!dragStart) return;
      setHeading(dragStart.heading - (angleOf(event) - dragStart.angle));
    });
    const release = () => {
      dragStart = null;
      root.classList.remove("is-drag");
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? 10 : 1;
      const delta = { ArrowRight: step, ArrowUp: step, ArrowLeft: -step, ArrowDown: -step }[event.key];
      if (delta === undefined && event.key !== "Home" && event.key !== "End") return;

      event.preventDefault();
      if (event.key === "Home") setHeading(0);
      else if (event.key === "End") setHeading(359);
      else setHeading(heading + delta);
    });

    return { wrap, root };
  }

  function evaluate(delta) {
    const magnitude = Math.abs(delta);
    const wasAligned = isAligned;
    if (!isAligned && magnitude <= LOCK_IN) isAligned = true;
    else if (isAligned && magnitude > LOCK_OUT) isAligned = false;
    return wasAligned !== isAligned;
  }

  function paint(announce) {
    const delta = signedDelta(qibla, heading);
    const changed = evaluate(delta);
    const magnitude = Math.round(Math.abs(delta));

    refs.rot.setAttribute("transform", `rotate(${-heading} ${CENTRE} ${CENTRE})`);
    for (const label of labels) label.text.setAttribute("transform", `rotate(${heading} ${label.x} ${label.y})`);
    refs.needle.setAttribute("transform", `rotate(${needleAngle + needleIdle} ${CENTRE} ${CENTRE})`);

    refs.dial.setAttribute("aria-valuenow", String(Math.round(heading)));
    refs.dial.setAttribute("aria-valuetext", `${Math.round(heading)} degrees. ${isAligned ? "Aligned with the Qibla" : `Turn ${delta > 0 ? "right" : "left"} ${magnitude} degrees`}`);
    refs.range.value = String(Math.round(heading));
    refs.headingValue.textContent = `${Math.round(heading)}°`;

    refs.hint.replaceChildren();
    if (isAligned) refs.hint.append(icon("check", { size: 20, width: 2.4 }), document.createTextNode("Aligned"));
    else refs.hint.append(document.createTextNode(`Turn ${delta > 0 ? "right" : "left"} ${magnitude} degrees`));

    el.classList.toggle("is-aligned", isAligned);

    if (changed) {
      if (isAligned) pulse();
      if (announce) refs.live.textContent = isAligned ? "Aligned with the Qibla." : `Not aligned. Turn ${delta > 0 ? "right" : "left"} ${magnitude} degrees.`;
    }
  }

  const dialSpring = spring((value) => {
    refs.dial.style.scale = value === 1 ? "" : value.toFixed(4);
  }, { from: 1, stiffness: 320, damping: 13 });

  function pulse() {
    if (isReduced()) return;
    dialSpring.kick(0.45);
  }

  function setHeading(value) {
    heading = wrap360(value);
    ctx.state.heading = heading;
    paint(true);
  }

  function swing() {
    const isFirstShow = !hasSwung;
    hasSwung = true;

    if (isReduced() || !isFirstShow) {
      needleSpring.set(qibla);
      return;
    }

    needleSpring.set(qibla - 70);
    needleSpring.to(qibla);
  }

  function toggleMotion() {
    if (motionHandler) {
      stopMotion();
      return;
    }
    startMotion();
  }

  async function startMotion() {
    const Orientation = window.DeviceOrientationEvent;
    if (!Orientation) {
      ctx.toast("This browser has no compass sensor. Use the slider.");
      return;
    }

    if (typeof Orientation.requestPermission === "function") {
      const answer = await Orientation.requestPermission().catch(() => "denied");
      if (answer !== "granted") {
        ctx.toast("Motion access was not allowed. Use the slider.");
        return;
      }
    }

    let gotReading = false;
    motionHandler = (event) => {
      const compass = event.webkitCompassHeading;
      const hasAlpha = event.absolute && typeof event.alpha === "number";
      const reading = typeof compass === "number" ? compass : hasAlpha ? 360 - event.alpha : null;
      if (reading === null) return;

      gotReading = true;
      setHeading(reading);
    };
    window.addEventListener("deviceorientationabsolute", motionHandler, true);
    window.addEventListener("deviceorientation", motionHandler, true);
    refs.motion.setAttribute("aria-pressed", "true");
    refs.motion.querySelector("span").textContent = "Stop motion";

    motionTimer = setTimeout(() => {
      if (gotReading) return;
      stopMotion();
      ctx.toast("No compass data from this device. Use the slider.");
    }, 1800);
  }

  function stopMotion() {
    clearTimeout(motionTimer);
    window.removeEventListener("deviceorientationabsolute", motionHandler, true);
    window.removeEventListener("deviceorientation", motionHandler, true);
    motionHandler = null;
    refs.motion.setAttribute("aria-pressed", "false");
    refs.motion.querySelector("span").textContent = "Use motion";
  }

  function update() {
    const auto = ctx.auto();
    const next = auto.qibla;
    const changed = Math.round(next) !== Math.round(qibla);
    qibla = next;
    refs.readout.textContent = `Qibla is ${Math.round(qibla)} degrees from north`;
    refs.distance.textContent = `${auto.kaaba.value} ${auto.kaaba.unit} to the Kaaba`;
    if (changed || needleAngle === 0) needleAngle = qibla;
    heading = ctx.state.heading;
    paint(false);
  }

  function ambient(seconds, amount) {
    const wander = Math.sin(seconds * 1.7) * 1.3 + Math.sin(seconds * 2.9 + 1.1) * 0.6 + Math.sin(seconds * 0.8 + 2.4) * 0.9;
    needleIdle = wander * amount;
    refs.needle.setAttribute("transform", `rotate(${needleAngle + needleIdle} ${CENTRE} ${CENTRE})`);
  }

  return { el, update, onShow: swing, ambient, destroy: () => { needleSpring.stop(); dialSpring.stop(); stopMotion(); } };
}
