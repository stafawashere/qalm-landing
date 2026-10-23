import { drawWaveField, drawRosette, TAU } from "./instruments/guilloche.js";

const INKS = {
  light: { field: "rgba(21,32,27,0.05)", band: "rgba(15,90,69,0.28)" },
  night: { field: "rgba(236,239,234,0.045)", band: "rgba(217,180,90,0.34)" },
};

// the dial's viewBox is 244 units across and its cardinal letters sit at radius 111
function discWithin(host) {
  const dial = host.querySelector("svg");
  if (!dial) return null;

  const hostBox = host.getBoundingClientRect();
  const dialBox = dial.getBoundingClientRect();
  return {
    x: dialBox.left - hostBox.left + dialBox.width / 2,
    y: dialBox.top - hostBox.top + dialBox.height / 2,
    radius: (dialBox.width * 120) / 244,
  };
}

function drawPlate(canvas, host) {
  const width = host.clientWidth;
  const height = host.clientHeight;
  if (!width || !height) return;

  const isLargeField = width * height > 1600000;
  const pixelRatio = isLargeField ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const ink = INKS[host.dataset.paper] || INKS.light;
  const disc = host.dataset.disc !== undefined ? discWithin(host) : null;

  if (disc) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(disc.x, disc.y, disc.radius, 0, TAU);
    ctx.fillStyle = getComputedStyle(host).getPropertyValue("--background").trim() || "#FAF8F3";
    ctx.fill();
    ctx.clip();
    drawWaveField(ctx, width, height, { color: ink.field, pitch: 7, lineWidth: 0.5 });
    ctx.restore();

    drawRosette(ctx, disc.x, disc.y, {
      count: 16,
      points: 720,
      lobes: 48,
      radius: disc.radius - 5,
      depth: 4,
      color: ink.band,
      lineWidth: 0.5,
      shrink: 0.03,
      phase: 0,
    });
    return;
  }

  drawWaveField(ctx, width, height, { color: ink.field, pitch: 9, lineWidth: 0.5 });

  const hasRosette = host.dataset.rosette !== undefined;
  if (hasRosette) {
    const radius = Math.min(width, height) * 0.42;
    drawRosette(ctx, width - radius * 0.35, height * 0.5, {
      count: 22,
      points: 520,
      lobes: 13,
      radius,
      depth: radius * 0.12,
      color: ink.band,
      lineWidth: 0.45,
      phase: TAU / 7,
    });
  }
}

export function setupPaper(root = document) {
  const hosts = [...root.querySelectorAll("[data-paper]")];
  const pending = new Set();
  let frame = 0;

  function flush() {
    frame = 0;
    for (const host of pending) drawPlate(host.querySelector(":scope > .plate__paper"), host);
    pending.clear();
  }

  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) pending.add(entry.target);
    if (!frame) frame = requestAnimationFrame(flush);
  });

  for (const host of hosts) {
    const canvas = document.createElement("canvas");
    canvas.className = "plate__paper";
    canvas.setAttribute("aria-hidden", "true");
    host.prepend(canvas);
    observer.observe(host);
  }
}
