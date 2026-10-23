import { sunAt } from "./sky.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const LIMB = 100;
const PLATE = 92;

function el(name, attrs = {}, parent) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (parent) parent.appendChild(node);
  return node;
}

function polar(bearing, radius) {
  const rad = (bearing * Math.PI) / 180;
  return [Math.sin(rad) * radius, -Math.cos(rad) * radius];
}

function buildLimb(group) {
  for (let degree = 0; degree < 360; degree += 5) {
    const isMajor = degree % 30 === 0;
    const [x1, y1] = polar(degree, LIMB - (isMajor ? 8 : 4));
    const [x2, y2] = polar(degree, LIMB);
    el("line", { x1, y1, x2, y2, class: isMajor ? "dial-tick dial-tick--major" : "dial-tick" }, group);
  }

  el("circle", { r: LIMB, class: "dial-limb" }, group);

  for (const [letter, bearing] of [["N", 0], ["E", 90], ["S", 180], ["W", 270]]) {
    const [x, y] = polar(bearing, LIMB + 11);
    const label = el("text", { x, y, class: "dial-cardinal", "text-anchor": "middle", "dominant-baseline": "central" }, group);
    label.textContent = letter;
  }
}

export function createDial(svg) {
  svg.setAttribute("viewBox", "-122 -122 244 244");
  const limb = el("g", { class: "dial-limbs" }, svg);
  buildLimb(limb);

  const rings = el("g", { class: "dial-rings" }, svg);
  const ringNoon = el("circle", { class: "dial-ring dial-ring--noon" }, rings);
  const ringStandard = el("circle", { class: "dial-ring dial-ring--asr" }, rings);
  const ringHanafi = el("circle", { class: "dial-ring dial-ring--hanafi" }, rings);
  const path = el("polyline", { class: "dial-path" }, svg);

  const markers = el("g", { class: "dial-markers" }, svg);
  const qibla = el("g", { class: "dial-qibla" }, svg);
  el("path", { d: "M0 -6 L4.5 0 L0 19 L-4.5 0 Z", class: "dial-qibla-needle" }, qibla);

  const shadow = el("line", { x1: 0, y1: 0, class: "dial-shadow" }, svg);
  const tip = el("circle", { r: 3.2, class: "dial-tip" }, svg);
  el("circle", { r: 4.2, class: "dial-gnomon" }, svg);
  const sun = el("circle", { r: 6.5, class: "dial-sun" }, svg);

  let scale = 1;

  function toPoint(bearing, length) {
    return polar(bearing, Math.min(length * scale, PLATE + 2));
  }

  function setDay(day) {
    const { lat, lng } = day.city;
    const noon = day.noonShadow || 0;
    scale = PLATE / Math.max(noon + 2.5, 3.2);

    const hasShadow = noon > 0;
    ringNoon.setAttribute("r", hasShadow ? noon * scale : 0);
    ringStandard.setAttribute("r", hasShadow ? (noon + 1) * scale : 0);
    ringHanafi.setAttribute("r", hasShadow ? (noon + 2) * scale : 0);
    ringStandard.classList.toggle("is-chosen", day.asr === "standard");
    ringHanafi.classList.toggle("is-chosen", day.asr === "hanafi");

    const points = [];
    for (let minutes = 0; minutes <= 1440; minutes += 6) {
      const sample = sunAt(new Date(day.midnight.getTime() + minutes * 60000), lat, lng);
      const isUsable = sample.shadow && sample.shadow * scale < PLATE + 2;
      if (isUsable) points.push(toPoint(sample.shadowBearing, sample.shadow).map((value) => value.toFixed(1)).join(","));
    }
    path.setAttribute("points", points.join(" "));

    markers.replaceChildren();
    const marks = [["dhuhr", day.times.dhuhr], ["asr", day.asrTimes.standard], ["hanafi", day.asrTimes.hanafi]];
    for (const [key, time] of marks) {
      const sample = sunAt(time, lat, lng);
      if (!sample.shadow) continue;
      const [x, y] = toPoint(sample.shadowBearing, sample.shadow);
      el("circle", { cx: x, cy: y, r: 4, class: `dial-mark dial-mark--${key}` }, markers);
    }

    const [qx, qy] = polar(day.qibla, LIMB);
    qibla.setAttribute("transform", `translate(${qx} ${qy}) rotate(${day.qibla})`);
    qibla.querySelector("path").setAttribute("transform", "rotate(180)");
  }

  function setTime(date, day) {
    const sample = sunAt(date, day.city.lat, day.city.lng);
    const [sx, sy] = polar(sample.sunBearing, LIMB);
    sun.setAttribute("cx", sx);
    sun.setAttribute("cy", sy);
    sun.classList.toggle("is-below", sample.altitude <= 0);

    const hasShadow = Boolean(sample.shadow);
    shadow.classList.toggle("is-hidden", !hasShadow);
    tip.classList.toggle("is-hidden", !hasShadow);

    if (hasShadow) {
      const [x, y] = toPoint(sample.shadowBearing, sample.shadow);
      shadow.setAttribute("x2", x);
      shadow.setAttribute("y2", y);
      tip.setAttribute("cx", x);
      tip.setAttribute("cy", y);
    }

    return sample;
  }

  return { setDay, setTime };
}
