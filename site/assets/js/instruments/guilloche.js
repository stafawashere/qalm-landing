// Guilloche routines ported from the ThreeUI "Kinetic Lathe Certificate" by Meng To (MIT, github.com/MengTo/threeui).

export const TAU = Math.PI * 2;

export function circleOutline(cx, cy, radius, samples) {
  const points = new Array(samples);

  for (let index = 0; index < samples; index++) {
    const theta = (index / samples) * TAU;
    points[index] = [cx + Math.cos(theta) * radius, cy + Math.sin(theta) * radius];
  }

  return points;
}

// Resamples a closed outline into evenly spaced points carrying the unit normal.
export function rail(points, sampleCount) {
  const pointCount = points.length;
  const cumulative = new Float64Array(pointCount + 1);

  for (let index = 1; index <= pointCount; index++) {
    const current = points[index % pointCount];
    const previous = points[index - 1];
    cumulative[index] = cumulative[index - 1] + Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  }

  const totalLength = cumulative[pointCount];
  const samples = new Array(sampleCount);
  let segment = 0;

  for (let index = 0; index < sampleCount; index++) {
    const target = (index / sampleCount) * totalLength;

    while (segment < pointCount - 1 && cumulative[segment + 1] < target) segment++;

    const segmentLength = cumulative[segment + 1] - cumulative[segment] || 1;
    const along = (target - cumulative[segment]) / segmentLength;
    const start = points[segment];
    const end = points[(segment + 1) % pointCount];

    samples[index] = [
      start[0] + (end[0] - start[0]) * along,
      start[1] + (end[1] - start[1]) * along,
      (end[1] - start[1]) / segmentLength,
      -(end[0] - start[0]) / segmentLength,
    ];
  }

  return samples;
}

export function drawBand(ctx, railSamples, options) {
  const count = railSamples.length;
  ctx.lineWidth = options.lineWidth;
  ctx.strokeStyle = options.color;
  ctx.beginPath();

  for (let strand = 0; strand < options.strands; strand++) {
    const phase = (options.phase || 0) + (strand / options.strands) * TAU;

    for (let index = 0; index <= count; index++) {
      const sample = railSamples[index % count];
      const along = (index % count) / count;
      const offset = options.amplitude * Math.sin(options.waves * along * TAU + phase);
      const x = sample[0] + sample[2] * offset;
      const y = sample[1] + sample[3] * offset;

      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  }

  ctx.stroke();
}

export function drawRailLine(ctx, railSamples, offset, color, lineWidth) {
  const count = railSamples.length;
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.beginPath();

  for (let index = 0; index <= count; index++) {
    const sample = railSamples[index % count];
    const x = sample[0] + sample[2] * offset;
    const y = sample[1] + sample[3] * offset;

    if (index) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }

  ctx.stroke();
}

// Epitrochoid family: `count` curves, each phase shifted and slightly smaller than the last.
export function drawRosette(ctx, cx, cy, options) {
  const { count, points, lobes, radius, depth } = options;
  const direction = options.direction || 1;
  const shrink = options.shrink === undefined ? 0.06 : options.shrink;

  ctx.lineWidth = options.lineWidth;
  ctx.strokeStyle = options.color;
  ctx.lineJoin = "round";
  ctx.beginPath();

  for (let curve = 0; curve < count; curve++) {
    const fraction = curve / count;
    const phase = (options.phase || 0) + direction * fraction * TAU;
    const curveRadius = radius * (1 - shrink * fraction);

    for (let index = 0; index <= points; index++) {
      const theta = (index / points) * TAU;
      const x = cx + curveRadius * Math.cos(theta) + depth * Math.cos(lobes * theta + phase);
      const y = cy + curveRadius * Math.sin(theta) - depth * Math.sin(lobes * theta + phase);

      if (index) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  }

  ctx.stroke();
}

// Banknote wave field: slowly drifting sine rows used as paper security texture.
export function drawWaveField(ctx, width, height, options = {}) {
  const pitch = options.pitch || 6.2;
  const step = options.step || 7;
  const rows = Math.ceil(height / pitch) + 2;

  ctx.lineWidth = options.lineWidth || 0.5;
  ctx.strokeStyle = options.color || "rgba(21,32,27,0.075)";
  ctx.beginPath();

  for (let row = 0; row < rows; row++) {
    const baseline = row * pitch - 3;
    const phase = row * 0.44;

    for (let x = 0; x <= width; x += step) {
      const y =
        baseline +
        3.3 * Math.sin(x * 0.0139 + phase) +
        1.9 * Math.sin(x * 0.0327 - phase * 1.7) +
        0.9 * Math.sin(x * 0.0715 + phase * 0.6);

      if (x) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
  }

  ctx.stroke();
}

function rgba(rgb, alpha) {
  return `rgba(${rgb},${alpha})`;
}

// Engraved seal: wave band, two interlaced rosettes and a gold pass inside a paper disc.
export function renderSeal(canvas, options = {}) {
  const ink = options.ink || "15,90,69";
  const gold = options.gold || "181,139,42";
  const paper = options.paper || "250,248,243";
  const lobes = options.lobes || 11;
  const innerLobes = options.innerLobes || 19;
  const phase = options.phase || 0;
  const cssSize = options.size || canvas.clientWidth || 240;
  const pixelRatio = Math.min(options.dpr || window.devicePixelRatio || 1, 2);
  const pixels = Math.max(2, Math.round(cssSize * pixelRatio));

  if (canvas.width !== pixels || canvas.height !== pixels) {
    canvas.width = pixels;
    canvas.height = pixels;
  }

  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);

  const center = cssSize / 2;
  const radius = center;
  const isSmall = radius < 130;

  const paperFill = ctx.createRadialGradient(center, center, radius * 0.06, center, center, radius);
  paperFill.addColorStop(0, rgba(paper, 0.96));
  paperFill.addColorStop(0.8, rgba(paper, 0.9));
  paperFill.addColorStop(1, rgba(paper, 0));
  ctx.fillStyle = paperFill;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, TAU);
  ctx.fill();

  const bandRail = rail(circleOutline(center, center, radius * 0.93, 640), isSmall ? 460 : 620);
  const bandAmplitude = radius * 0.036;
  drawBand(ctx, bandRail, {
    amplitude: bandAmplitude,
    waves: (lobes + 1) * 5,
    strands: 7,
    color: rgba(ink, 0.3),
    lineWidth: 0.5,
    phase,
  });
  drawRailLine(ctx, bandRail, -bandAmplitude - 1.8, rgba(ink, 0.34), 0.6);
  drawRailLine(ctx, bandRail, bandAmplitude + 1.8, rgba(ink, 0.28), 0.5);

  drawRosette(ctx, center, center, {
    radius: radius * 0.655,
    depth: radius * 0.215,
    lobes,
    count: isSmall ? 44 : 58,
    points: isSmall ? 340 : 470,
    color: rgba(ink, 0.42),
    lineWidth: 0.5,
    shrink: 0.035,
    phase: 0.2 + phase,
  });
  drawRosette(ctx, center, center, {
    radius: radius * 0.335,
    depth: radius * 0.115,
    lobes: innerLobes,
    count: isSmall ? 34 : 44,
    points: isSmall ? 280 : 380,
    color: rgba(ink, 0.38),
    lineWidth: 0.5,
    direction: -1,
    shrink: 0.05,
    phase: 0.9 - phase,
  });
  drawRosette(ctx, center, center, {
    radius: radius * 0.16,
    depth: radius * 0.05,
    lobes: 8,
    count: isSmall ? 18 : 24,
    points: isSmall ? 200 : 300,
    color: rgba(gold, 0.7),
    lineWidth: 0.5,
    phase: phase * 2,
  });

  ctx.beginPath();
  ctx.arc(center, center, radius * 0.07, 0, TAU);
  ctx.fillStyle = rgba(paper, 0.9);
  ctx.fill();
  ctx.lineWidth = 0.6;
  ctx.strokeStyle = rgba(ink, 0.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(center, center, radius * 0.04, 0, TAU);
  ctx.strokeStyle = rgba(gold, 0.6);
  ctx.lineWidth = 0.5;
  ctx.stroke();
}
