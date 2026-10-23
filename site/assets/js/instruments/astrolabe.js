const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const OBLIQUITY = 23.4393;
const PLATE_EDGE_DECLINATION = 32;
const PLATE_RATIO = 0.745;
const SIDEREAL_SECONDS_PER_DEGREE = 86164.0905 / 360;
const FONT_STACK = '"Literata", "Iowan Old Style", Palatino, Georgia, serif';

const TONES = {
  deep: [58, 42, 8],
  shadow: [122, 92, 18],
  mid: [181, 139, 42],
  light: [217, 180, 90],
  highlight: [244, 228, 166],
  ink: [21, 32, 27],
  night: [14, 19, 17],
  copper: [150, 88, 34],
  moon: [168, 188, 224],
  sun: [255, 234, 176],
};

const STARS = [
  { name: "Vega", ra: 279.2347, dec: 38.7837 },
  { name: "Arcturus", ra: 213.9153, dec: 19.1824 },
  { name: "Sirius", ra: 101.2872, dec: -16.7161 },
  { name: "Rigel", ra: 78.6345, dec: -8.2016 },
  { name: "Aldebaran", ra: 68.98, dec: 16.5093 },
  { name: "Altair", ra: 297.6958, dec: 8.8683 },
  { name: "Deneb", ra: 310.3579, dec: 45.2803 },
  { name: "Capella", ra: 79.1723, dec: 45.998 },
  { name: "Regulus", ra: 152.0929, dec: 11.9672 },
  { name: "Spica", ra: 201.2983, dec: -11.1613 },
  { name: "Antares", ra: 247.3519, dec: -26.432 },
  { name: "Betelgeuse", ra: 88.7929, dec: 7.4071 },
];

const SIGN_NAMES = ["ARI", "TAU", "GEM", "CNC", "LEO", "VIR", "LIB", "SCO", "SGR", "CAP", "AQR", "PSC"];

const PRAYER_LABELS = {
  fajr: "FAJR",
  dhuhr: "DHUHR",
  asr: "ASR",
  maghrib: "MAGHRIB",
  isha: "ISHA",
};

const PRAYER_TITLES = {
  fajr: "Fajr",
  sunrise: "Sunrise",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
};

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function mod360(value) {
  return ((value % 360) + 360) % 360;
}

function normalize180(value) {
  const wrapped = mod360(value);
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

function mulberry32(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function rgb(tone, alpha = 1) {
  return `rgba(${Math.round(tone[0])},${Math.round(tone[1])},${Math.round(tone[2])},${alpha})`;
}

function mixTone(from, to, amount) {
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount,
  ];
}

export function julianDate(date) {
  return date.getTime() / 86400000 + 2440587.5;
}

export function siderealAngle(date, longitude) {
  const daysSinceEpoch = julianDate(date) - 2451545.0;
  const greenwich = 280.46061837 + 360.98564736629 * daysSinceEpoch;
  return mod360(greenwich + longitude);
}

// Low precision solar position, good to about 0.01 degrees for the current century.
export function sunPosition(date) {
  const daysSinceEpoch = julianDate(date) - 2451545.0;
  const meanLongitude = mod360(280.46 + 0.9856474 * daysSinceEpoch);
  const meanAnomaly = mod360(357.528 + 0.9856003 * daysSinceEpoch) * DEG;
  const lambda = mod360(meanLongitude + 1.915 * Math.sin(meanAnomaly) + 0.02 * Math.sin(2 * meanAnomaly));
  const obliquity = (OBLIQUITY - 0.0000004 * daysSinceEpoch) * DEG;
  const lambdaRadians = lambda * DEG;
  const rightAscension = mod360(Math.atan2(Math.cos(obliquity) * Math.sin(lambdaRadians), Math.cos(lambdaRadians)) / DEG);
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(lambdaRadians)) / DEG;

  return { lambda, ra: rightAscension, dec: declination };
}

export function sunAltitude(date, lat, lng) {
  const sun = sunPosition(date);
  const hourAngle = (siderealAngle(date, lng) - sun.ra) * DEG;
  const phi = lat * DEG;
  const declination = sun.dec * DEG;
  const sine = Math.sin(phi) * Math.sin(declination) + Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle);
  return Math.asin(clamp(sine, -1, 1)) / DEG;
}

function createProjection(lat, plateRadius) {
  const hemisphere = lat >= 0 ? 1 : -1;
  const phi = Math.max(Math.abs(lat), 0.01);
  const equatorRadius = plateRadius / Math.tan(((90 + PLATE_EDGE_DECLINATION) / 2) * DEG);

  // Stereographic projection from the far celestial pole: r = R * tan((90 - dec) / 2).
  function radiusFor(northDeclination) {
    return equatorRadius * Math.tan(((90 - northDeclination) / 2) * DEG);
  }

  function northPoint(hourAngle, northDeclination) {
    const radius = radiusFor(northDeclination);
    const bearing = hourAngle * DEG;
    return { x: radius * Math.sin(bearing), y: -radius * Math.cos(bearing), radius };
  }

  function toPlate(hourAngle, declination) {
    const radius = radiusFor(hemisphere * declination);
    const bearing = hemisphere * hourAngle * DEG;
    return { x: radius * Math.sin(bearing), y: -radius * Math.cos(bearing), radius };
  }

  // Altitude circle: meets the meridian at distance `up` above and `down` below the pole.
  function almucantar(altitude) {
    const up = equatorRadius / Math.tan(((phi + altitude) * DEG) / 2);
    const down = equatorRadius * Math.tan(((phi - altitude) * DEG) / 2);
    const radius = Math.abs((up + down) / 2);
    const isLine = !Number.isFinite(up) || radius > plateRadius * 40;
    return { centerY: (down - up) / 2, radius, isLine, lineY: down };
  }

  function horizonCoordinates(azimuth, altitude) {
    const az = azimuth * DEG;
    const alt = altitude * DEG;
    const p = phi * DEG;
    const sineDeclination = Math.sin(p) * Math.sin(alt) - Math.cos(p) * Math.cos(alt) * Math.cos(az);
    const hourAngle = Math.atan2(
      Math.cos(alt) * Math.sin(az),
      Math.sin(alt) * Math.cos(p) + Math.cos(alt) * Math.sin(p) * Math.cos(az),
    );

    return { hourAngle: hourAngle / DEG, declination: Math.asin(clamp(sineDeclination, -1, 1)) / DEG };
  }

  function semiDiurnalArc(declination) {
    const cosine = -Math.tan(phi * DEG) * Math.tan(declination * DEG);
    return Math.acos(clamp(cosine, -1, 1)) / DEG;
  }

  function eclipticPoint(lambda) {
    const lambdaRadians = lambda * DEG;
    const obliquity = OBLIQUITY * DEG;
    const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(lambdaRadians), Math.cos(lambdaRadians)) / DEG;
    const declination = Math.asin(Math.sin(obliquity) * Math.sin(lambdaRadians)) / DEG;
    return toPlate(-rightAscension, declination);
  }

  const solsticeA = toPlate(-90, OBLIQUITY);
  const solsticeB = toPlate(-270, -OBLIQUITY);
  const ecliptic = {
    x: (solsticeA.x + solsticeB.x) / 2,
    y: (solsticeA.y + solsticeB.y) / 2,
    radius: Math.hypot(solsticeA.x - solsticeB.x, solsticeA.y - solsticeB.y) / 2,
  };

  return {
    lat,
    phi,
    hemisphere,
    plateRadius,
    equatorRadius,
    radiusFor,
    northPoint,
    toPlate,
    almucantar,
    horizonCoordinates,
    semiDiurnalArc,
    eclipticPoint,
    ecliptic,
    cancerRadius: radiusFor(OBLIQUITY),
    capricornRadius: radiusFor(-OBLIQUITY),
  };
}

function computeLayout(size) {
  const radius = size * 0.41;

  return {
    size,
    width: size,
    height: Math.ceil(size * 1.1),
    radius,
    centerX: size / 2,
    centerY: size * 0.635,
    plateRadius: radius * PLATE_RATIO,
    alidadeRadius: radius * 0.94,
    lineUnit: Math.max(0.55, radius / 330),
  };
}

function createSurface(width, height, pixelRatio, originX = 0, originY = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * pixelRatio));
  canvas.height = Math.max(1, Math.round(height * pixelRatio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, originX * pixelRatio, originY * pixelRatio);

  return { canvas, ctx, width, height, pixelRatio, originX, originY };
}

function lightVector(azimuth, elevation) {
  const azimuthRadians = azimuth * DEG;

  return {
    x: Math.sin(azimuthRadians),
    y: -Math.cos(azimuthRadians),
    elevation: clamp(elevation, 14, 85) * DEG,
  };
}

let grainTile = null;

function getGrainTile() {
  if (grainTile) return grainTile;

  const tile = document.createElement("canvas");
  tile.width = 192;
  tile.height = 192;
  const tileContext = tile.getContext("2d");
  const image = tileContext.createImageData(192, 192);
  const random = mulberry32(90210);

  for (let index = 0; index < image.data.length; index += 4) {
    const value = 128 + (random() + random() + random() - 1.5) * 96;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 255;
  }

  tileContext.putImageData(image, 0, 0);
  grainTile = tile;
  return tile;
}

function paintBrassField(surface, options) {
  const { ctx, width, height, pixelRatio, originX, originY } = surface;
  const random = mulberry32(options.seed);
  const reach = Math.hypot(width, height) / 2;
  const unit = options.unit;

  ctx.save();
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.fillStyle = rgb(options.base);
  ctx.fillRect(0, 0, width, height);

  for (let cloud = 0; cloud < 26; cloud++) {
    const x = random() * width;
    const y = random() * height;
    const radius = (0.16 + random() * 0.36) * Math.max(width, height);
    const tone = random() > 0.48 ? TONES.light : TONES.shadow;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgb(tone, 0.08 + random() * 0.14));
    gradient.addColorStop(1, rgb(tone, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  // Lathe-turned concentric marks, the way a hand-finished brass face catches light.
  for (let mark = 0; mark < 420; mark++) {
    const radius = random() * reach;
    const isBright = random() > 0.46;
    const tone = isBright ? TONES.highlight : TONES.deep;
    ctx.strokeStyle = rgb(tone, isBright ? 0.025 + random() * 0.07 : 0.03 + random() * 0.07);
    ctx.lineWidth = (0.3 + random() * 0.7) * Math.max(0.7, unit);
    ctx.beginPath();
    ctx.arc(originX, originY, radius, 0, TAU);
    ctx.stroke();
  }

  for (let scratch = 0; scratch < 70; scratch++) {
    const radius = random() * reach;
    const start = random() * TAU;
    const length = (0.02 + random() * 0.12) * TAU;
    ctx.strokeStyle = rgb(random() > 0.5 ? TONES.highlight : TONES.deep, 0.05 + random() * 0.1);
    ctx.lineWidth = 0.3 * Math.max(0.7, unit);
    ctx.beginPath();
    ctx.arc(originX, originY, radius, start, start + length);
    ctx.stroke();
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = ctx.createPattern(getGrainTile(), "repeat");
  ctx.fillRect(0, 0, surface.canvas.width, surface.canvas.height);
  ctx.globalAlpha = 1;

  ctx.globalCompositeOperation = "multiply";
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  for (let blotch = 0; blotch < 90; blotch++) {
    const x = random() * width;
    const y = random() * height;
    const radius = (2 + random() * 16) * Math.max(0.7, unit);
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const tone = random() > 0.3 ? [120, 108, 60] : [104, 120, 84];
    gradient.addColorStop(0, rgb(tone, 0.08 + random() * 0.12));
    gradient.addColorStop(1, rgb(tone, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  ctx.restore();
}

function clipToMask(surface, mask) {
  const { ctx } = surface;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask.canvas, 0, 0);
  ctx.restore();
}

function bevelStrip(surface, mask, scratch, shiftX, shiftY, color, alpha) {
  const scratchContext = scratch.ctx;
  const pixelRatio = surface.pixelRatio;

  scratchContext.save();
  scratchContext.setTransform(1, 0, 0, 1, 0, 0);
  scratchContext.globalCompositeOperation = "source-over";
  scratchContext.clearRect(0, 0, scratch.canvas.width, scratch.canvas.height);
  scratchContext.drawImage(mask.canvas, 0, 0);
  scratchContext.globalCompositeOperation = "destination-out";
  scratchContext.drawImage(mask.canvas, shiftX * pixelRatio, shiftY * pixelRatio);
  scratchContext.globalCompositeOperation = "source-in";
  scratchContext.fillStyle = color;
  scratchContext.fillRect(0, 0, scratch.canvas.width, scratch.canvas.height);
  scratchContext.restore();

  surface.ctx.save();
  surface.ctx.setTransform(1, 0, 0, 1, 0, 0);
  surface.ctx.globalAlpha = alpha;
  surface.ctx.drawImage(scratch.canvas, 0, 0);
  surface.ctx.restore();
}

function applyBevel(surface, mask, light, unit, strength = 1) {
  const scratch = createSurface(surface.width, surface.height, surface.pixelRatio);
  const narrow = 1.0 * Math.max(0.8, unit);
  const wide = 2.8 * Math.max(0.8, unit);
  const lightColor = rgb(TONES.highlight, 1);
  const shadeColor = rgb(TONES.deep, 1);

  bevelStrip(surface, mask, scratch, -light.x * wide, -light.y * wide, lightColor, 0.3 * strength);
  bevelStrip(surface, mask, scratch, -light.x * narrow, -light.y * narrow, lightColor, 0.75 * strength);
  bevelStrip(surface, mask, scratch, light.x * wide, light.y * wide, shadeColor, 0.42 * strength);
  bevelStrip(surface, mask, scratch, light.x * narrow, light.y * narrow, shadeColor, 0.5 * strength);
}

function applyFloorShade(ctx, drawPath) {
  ctx.save();
  ctx.beginPath();
  drawPath(ctx);
  ctx.fillStyle = rgb(TONES.deep, 0.34);
  ctx.fill();
  ctx.restore();
}

function createEngraver(ctx, light, unit) {
  const lightX = light.x;
  const lightY = light.y;

  // The wall facing the light lies in shadow, the far wall catches it.
  function stroke(buildPath, options = {}) {
    const width = (options.width ?? 1) * unit;
    const depth = options.depth ?? 1;
    const lip = width * 0.6 + 0.3;

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (options.dash) ctx.setLineDash(options.dash.map((value) => value * unit));

    ctx.translate(-lightX * lip, -lightY * lip);
    ctx.strokeStyle = rgb(TONES.highlight, 0.6 * depth);
    ctx.lineWidth = width;
    ctx.beginPath();
    buildPath(ctx);
    ctx.stroke();
    ctx.translate(lightX * lip, lightY * lip);

    ctx.translate(lightX * 0.2, lightY * 0.2);
    ctx.strokeStyle = rgb([52, 36, 6], 0.5 * depth);
    ctx.lineWidth = width * 1.15;
    ctx.beginPath();
    buildPath(ctx);
    ctx.stroke();
    ctx.translate(-lightX * 0.2, -lightY * 0.2);

    ctx.strokeStyle = rgb(mixTone(TONES.ink, TONES.deep, 0.25), 0.82 * depth);
    ctx.lineWidth = width * 0.5;
    ctx.beginPath();
    buildPath(ctx);
    ctx.stroke();
    ctx.restore();
  }

  function text(content, x, y, options = {}) {
    const size = options.size;
    const depth = options.depth ?? 1;
    const lip = 0.55 + size * 0.03;

    ctx.save();
    ctx.font = `${options.weight || 500} ${size}px ${FONT_STACK}`;
    ctx.textAlign = options.align || "center";
    ctx.textBaseline = "middle";
    if ("letterSpacing" in ctx) ctx.letterSpacing = options.spacing || "0px";

    const passes = [
      { dx: -lightX * lip, dy: -lightY * lip, color: rgb(TONES.highlight, 0.55 * depth) },
      { dx: lightX * 0.18, dy: lightY * 0.18, color: rgb([52, 36, 6], 0.4 * depth) },
      { dx: 0, dy: 0, color: rgb(mixTone(TONES.ink, TONES.deep, 0.2), 0.88 * depth) },
    ];

    for (const pass of passes) {
      ctx.save();
      ctx.translate(x + pass.dx, y + pass.dy);
      ctx.rotate(options.rotation || 0);
      ctx.fillStyle = pass.color;
      ctx.fillText(content, 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  return { ctx, stroke, text };
}

function polar(bearingDegrees, radius) {
  const bearing = bearingDegrees * DEG;
  return { x: radius * Math.sin(bearing), y: -radius * Math.cos(bearing) };
}

function uprightRotation(bearingDegrees) {
  const wrapped = mod360(bearingDegrees);
  const isLowerHalf = wrapped > 90 && wrapped < 270;
  return wrapped * DEG + (isLowerHalf ? Math.PI : 0);
}

function circlePath(ctx, radius, centerX = 0, centerY = 0) {
  ctx.moveTo(centerX + radius, centerY);
  ctx.arc(centerX, centerY, radius, 0, TAU);
}

function tracePolygon(ctx, points) {
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point[0], point[1]);
    else ctx.lineTo(point[0], point[1]);
  });
  ctx.closePath();
}

function traceStar(ctx, centerX, centerY, outer, inner, points) {
  for (let index = 0; index < points * 2; index++) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (index / (points * 2)) * TAU - Math.PI / 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

const THRONE_START = [0.3, 0.94];
const THRONE_SEGMENTS = [
  { c1: [0.34, 0.95], c2: [0.36, 0.995], p: [0.33, 1.04] },
  { c1: [0.31, 1.07], c2: [0.265, 1.065], p: [0.245, 1.105] },
  { c1: [0.225, 1.165], c2: [0.125, 1.165], p: [0.1, 1.235] },
  { c1: [0.09, 1.265], c2: [0.085, 1.275], p: [0.07, 1.3] },
];

function traceThrone(ctx, radius, scale = 1, pivotY = 0) {
  const place = (point) => [point[0] * radius * scale, -(pivotY + (point[1] - pivotY) * scale) * radius];
  const mirror = (point) => [-point[0], point[1]];

  const start = place(THRONE_START);
  ctx.moveTo(start[0], start[1]);

  for (const segment of THRONE_SEGMENTS) {
    const c1 = place(segment.c1);
    const c2 = place(segment.c2);
    const end = place(segment.p);
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
  }

  const lastPoint = THRONE_SEGMENTS[THRONE_SEGMENTS.length - 1].p;
  const crown = place(mirror(lastPoint));
  ctx.lineTo(crown[0], crown[1]);

  for (let index = THRONE_SEGMENTS.length - 1; index >= 0; index--) {
    const segment = THRONE_SEGMENTS[index];
    const previous = index === 0 ? THRONE_START : THRONE_SEGMENTS[index - 1].p;
    const c1 = place(mirror(segment.c2));
    const c2 = place(mirror(segment.c1));
    const end = place(mirror(previous));
    ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
  }

  ctx.closePath();
}

function traceThronePiercing(ctx, radius) {
  const R = radius;

  traceStar(ctx, 0, -1.115 * R, 0.068 * R, 0.036 * R, 8);

  for (const side of [-1, 1]) {
    circlePath(ctx, 0.026 * R, side * 0.168 * R, -1.062 * R);
    const diamondX = side * 0.088 * R;
    const diamondY = -1.19 * R;
    const half = 0.03 * R;
    ctx.moveTo(diamondX, diamondY - half * 1.3);
    ctx.lineTo(diamondX + half * 0.7, diamondY);
    ctx.lineTo(diamondX, diamondY + half * 1.3);
    ctx.lineTo(diamondX - half * 0.7, diamondY);
    ctx.closePath();
  }

  circlePath(ctx, 0.03 * R, 0, -1.3 * R);
}

function drawMaterMask(surface, layout) {
  const { ctx } = surface;
  const R = layout.radius;

  ctx.save();
  ctx.fillStyle = "#fff";

  ctx.beginPath();
  circlePath(ctx, R);
  ctx.fill();

  ctx.beginPath();
  traceThrone(ctx, R);
  ctx.fill();

  ctx.beginPath();
  circlePath(ctx, 0.075 * R, 0, -1.3 * R);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  traceThronePiercing(ctx, R);
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";
  ctx.beginPath();
  circlePath(ctx, 0.083 * R, 0, -1.373 * R);
  circlePath(ctx, 0.063 * R, 0, -1.373 * R);
  ctx.fill("evenodd");

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  circlePath(ctx, 0.0215 * R, 0, -1.3 * R);
  ctx.fill();
  ctx.restore();
}

function drawThroneEngraving(engraver, layout) {
  const R = layout.radius;

  engraver.stroke((ctx) => traceThrone(ctx, R, 0.9, 1.12), { width: 0.8, depth: 0.8 });
  engraver.stroke((ctx) => circlePath(ctx, 0.05 * R, 0, -1.3 * R), { width: 0.8, depth: 0.8 });
  engraver.stroke((ctx) => traceStar(ctx, 0, -1.115 * R, 0.092 * R, 0.062 * R, 8), { width: 0.7, depth: 0.7 });
  engraver.stroke(
    (ctx) => {
      ctx.moveTo(-0.2 * R, -0.985 * R);
      ctx.lineTo(0.2 * R, -0.985 * R);
    },
    { width: 0.7, depth: 0.7 },
  );
}

function drawLimbEngraving(engraver, layout, hemisphere) {
  const R = layout.radius;
  const degreeBaseline = 0.972 * R;
  const hourOuter = 0.905 * R;
  const hourInner = 0.83 * R;

  engraver.stroke((ctx) => circlePath(ctx, degreeBaseline), { width: 1.1 });
  engraver.stroke((ctx) => circlePath(ctx, hourOuter), { width: 1.1 });
  engraver.stroke((ctx) => circlePath(ctx, hourInner), { width: 1.2 });
  engraver.stroke((ctx) => circlePath(ctx, 0.985 * R), { width: 0.6, depth: 0.55 });

  const tickLengths = { minor: 0.01 * R, medium: 0.019 * R, major: 0.03 * R };

  for (const [kind, width] of [["minor", 0.55], ["medium", 0.75], ["major", 0.95]]) {
    engraver.stroke(
      (ctx) => {
        for (let degree = 0; degree < 360; degree++) {
          const isMajor = degree % 10 === 0;
          const isMedium = !isMajor && degree % 5 === 0;
          const matches = kind === "major" ? isMajor : kind === "medium" ? isMedium : !isMajor && !isMedium;
          if (!matches) continue;
          const outer = polar(degree, degreeBaseline);
          const inner = polar(degree, degreeBaseline - tickLengths[kind]);
          ctx.moveTo(outer.x, outer.y);
          ctx.lineTo(inner.x, inner.y);
        }
      },
      { width },
    );
  }

  for (let degree = 0; degree < 360; degree += 30) {
    const position = polar(degree, 0.922 * R);
    engraver.text(String(degree), position.x, position.y, {
      size: 0.03 * R,
      rotation: uprightRotation(degree),
      weight: 500,
    });
  }

  engraver.stroke(
    (ctx) => {
      for (let hour = 0; hour < 24; hour++) {
        const bearing = hemisphere * hour * 15;
        const outer = polar(bearing, hourOuter);
        const inner = polar(bearing, hourInner);
        ctx.moveTo(outer.x, outer.y);
        ctx.lineTo(inner.x, inner.y);
      }
    },
    { width: 1 },
  );

  engraver.stroke(
    (ctx) => {
      for (let quarter = 0; quarter < 96; quarter++) {
        if (quarter % 4 === 0) continue;
        const bearing = hemisphere * quarter * 3.75;
        const isHalf = quarter % 2 === 0;
        const outer = polar(bearing, hourInner + (isHalf ? 0.02 : 0.012) * R);
        const inner = polar(bearing, hourInner);
        ctx.moveTo(outer.x, outer.y);
        ctx.lineTo(inner.x, inner.y);
      }
    },
    { width: 0.55 },
  );

  for (let hour = 0; hour < 24; hour++) {
    const bearing = hemisphere * (hour * 15 + 7.5);
    const position = polar(bearing, 0.8685 * R);
    const label = hour % 12 === 0 ? 12 : hour % 12;
    engraver.text(String(label), position.x, position.y, {
      size: 0.05 * R,
      rotation: uprightRotation(bearing),
      weight: 500,
    });
  }

  const noon = polar(0, 0.86 * R);
  engraver.stroke(
    (ctx) => {
      ctx.moveTo(noon.x, noon.y - 0.012 * R);
      ctx.lineTo(noon.x + 0.01 * R, noon.y);
      ctx.lineTo(noon.x, noon.y + 0.012 * R);
      ctx.lineTo(noon.x - 0.01 * R, noon.y);
      ctx.closePath();
    },
    { width: 0.6, depth: 0.0 },
  );
}

function drawDishEdge(ctx, layout, light) {
  const R = layout.radius;
  const dishRadius = 0.78 * R;
  const unit = layout.lineUnit;

  ctx.save();
  ctx.beginPath();
  circlePath(ctx, dishRadius);
  ctx.clip();

  ctx.lineWidth = 3.4 * unit;
  ctx.strokeStyle = rgb(TONES.deep, 0.6);
  ctx.save();
  ctx.translate(-light.x * 2.6 * unit, -light.y * 2.6 * unit);
  ctx.beginPath();
  circlePath(ctx, dishRadius);
  ctx.stroke();
  ctx.restore();

  ctx.lineWidth = 2.2 * unit;
  ctx.strokeStyle = rgb(TONES.highlight, 0.5);
  ctx.save();
  ctx.translate(light.x * 2.2 * unit, light.y * 2.2 * unit);
  ctx.beginPath();
  circlePath(ctx, dishRadius);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function renderMater(layout, light, hemisphere, pixelRatio) {
  const width = layout.width;
  const height = layout.height;
  const R = layout.radius;
  const unit = layout.lineUnit;
  const surface = createSurface(width, height, pixelRatio, layout.centerX, layout.centerY);
  const mask = createSurface(width, height, pixelRatio, layout.centerX, layout.centerY);

  drawMaterMask(mask, layout);

  paintBrassField(surface, { seed: 1207, base: mixTone(TONES.mid, TONES.shadow, 0.12), unit });
  clipToMask(surface, mask);

  const { ctx } = surface;

  ctx.save();
  ctx.shadowColor = "rgba(10,6,0,0.7)";
  ctx.shadowBlur = 7 * unit * pixelRatio;
  ctx.shadowOffsetX = -light.x * 3 * unit * pixelRatio;
  ctx.shadowOffsetY = -light.y * 3 * unit * pixelRatio;
  applyFloorShade(ctx, (path) => circlePath(path, 0.78 * R));
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  circlePath(ctx, 0.78 * R);
  ctx.clip();
  ctx.fillStyle = rgb(TONES.deep, 0.14);
  ctx.fillRect(-R, -R, R * 2, R * 2);
  ctx.restore();

  applyBevel(surface, mask, light, unit);
  drawDishEdge(ctx, layout, light);

  const engraver = createEngraver(ctx, light, unit);
  drawLimbEngraving(engraver, layout, hemisphere);
  drawThroneEngraving(engraver, layout);

  return { surface, mask };
}

function drawPlateMask(surface, layout) {
  const { ctx } = surface;
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  circlePath(ctx, layout.plateRadius);
  ctx.fill();
  ctx.restore();
}

function drawPlateEngraving(engraver, layout, projection) {
  const { ctx } = engraver;
  const Rp = layout.plateRadius;
  const R_eq = projection.equatorRadius;
  const phi = projection.phi;

  ctx.save();
  ctx.beginPath();
  circlePath(ctx, Rp - 1.2);
  ctx.clip();

  const circleAt = (radius, centerY = 0) => (path) => circlePath(path, radius, 0, centerY);
  const almucantarPath = (altitude) => (path) => {
    const circle = projection.almucantar(altitude);

    if (circle.isLine) {
      path.moveTo(-Rp * 1.2, circle.lineY);
      path.lineTo(Rp * 1.2, circle.lineY);
    } else {
      circlePath(path, circle.radius, 0, circle.centerY);
    }
  };

  const azimuthStep = 10;
  engraver.stroke(
    (path) => {
      for (let azimuth = azimuthStep; azimuth < 180; azimuth += azimuthStep) {
        for (const side of [-1, 1]) {
          let isDrawing = false;

          for (let altitude = 89.5; altitude >= -0.01; altitude -= 3.1) {
            const coordinates = projection.horizonCoordinates(side * azimuth, Math.max(altitude, 0));
            const point = projection.northPoint(coordinates.hourAngle, coordinates.declination);
            const isUsable = Number.isFinite(point.x) && point.radius < Rp * 3;

            if (!isUsable) {
              isDrawing = false;
              continue;
            }

            if (isDrawing) path.lineTo(point.x, point.y);
            else path.moveTo(point.x, point.y);
            isDrawing = true;
          }
        }
      }
    },
    { width: 0.5, depth: 0.5 },
  );

  engraver.stroke(
    (path) => {
      for (let altitude = 6; altitude < 90; altitude += 6) {
        if (altitude % 30 === 0) continue;
        almucantarPath(altitude)(path);
      }
    },
    { width: 0.55, depth: 0.75 },
  );

  engraver.stroke(
    (path) => {
      for (const altitude of [30, 60]) almucantarPath(altitude)(path);
    },
    { width: 0.8, depth: 0.95 },
  );

  engraver.stroke(
    (path) => {
      for (const altitude of [-6, -12, -18]) almucantarPath(altitude)(path);
    },
    { width: 0.55, depth: 0.7, dash: [1.4, 2.6] },
  );

  engraver.stroke(
    (path) => {
      for (let hourLine = 1; hourLine < 12; hourLine++) {
        let isDrawing = false;

        for (let declination = -OBLIQUITY; declination <= OBLIQUITY + 0.01; declination += 2.2) {
          const arc = projection.semiDiurnalArc(declination);
          const hourAngle = arc * (hourLine / 6 - 1) + 180;
          const point = projection.northPoint(hourAngle, -declination);

          if (isDrawing) path.lineTo(point.x, point.y);
          else path.moveTo(point.x, point.y);
          isDrawing = true;
        }
      }
    },
    { width: 0.6, depth: 0.85 },
  );

  engraver.stroke(almucantarPath(0), { width: 1.7 });
  engraver.stroke((path) => {
    path.moveTo(0, -Rp);
    path.lineTo(0, Rp);
  }, { width: 1.1 });
  engraver.stroke((path) => {
    path.moveTo(-Rp, 0);
    path.lineTo(Rp, 0);
  }, { width: 0.9 });

  engraver.stroke(circleAt(R_eq), { width: 1.4 });
  engraver.stroke(circleAt(projection.cancerRadius), { width: 1.2 });
  engraver.stroke(circleAt(projection.capricornRadius), { width: 1.2 });

  for (const [radius, offset] of [[R_eq, 1.9], [projection.cancerRadius, 1.9], [projection.capricornRadius, 1.9]]) {
    engraver.stroke(circleAt(radius + offset * layout.lineUnit), { width: 0.4, depth: 0.5 });
  }

  const zenith = projection.almucantar(89.99);
  engraver.stroke(
    (path) => {
      circlePath(path, 0.012 * Rp, 0, zenith.centerY);
    },
    { width: 0.8 },
  );

  ctx.restore();

  const labelSize = 0.034 * Rp;
  const labelOptions = { size: labelSize, weight: 500, spacing: `${labelSize * 0.12}px` };
  const southWard = projection.hemisphere > 0;
  const outerName = southWard ? "CAPRICORN" : "CANCER";
  const innerName = southWard ? "CANCER" : "CAPRICORN";
  const circleLabels = [
    ["EQUATOR", R_eq],
    [innerName, projection.cancerRadius],
    [outerName, projection.capricornRadius],
  ];

  for (const [label, radius] of circleLabels) {
    engraver.text(label, radius - labelSize * 0.9, labelSize * 0.1, { ...labelOptions, rotation: -Math.PI / 2, depth: 0.85 });
  }

  const horizon = projection.almucantar(0);
  if (!horizon.isLine && horizon.radius < Rp * 6) {
    const labelY = horizon.centerY + (horizon.centerY > 0 ? -horizon.radius : horizon.radius);
    if (Math.abs(labelY) < Rp * 0.95) {
      engraver.text("HORIZON", 0, labelY + labelSize * (labelY > 0 ? -1.2 : 1.2), { ...labelOptions, depth: 0.9 });
    }
  }

  for (const altitude of [30, 60]) {
    const circle = projection.almucantar(altitude);
    const topY = circle.centerY - circle.radius;
    if (Math.abs(topY) < Rp * 0.95) {
      engraver.text(String(altitude), labelSize * 0.9, topY - labelSize * 0.6, { ...labelOptions, size: labelSize * 0.9 });
    }
  }

  const hourLabelRadius = projection.capricornRadius + (Rp - projection.capricornRadius) * 0.5;
  for (let hourLine = 1; hourLine < 12; hourLine++) {
    const arc = projection.semiDiurnalArc(OBLIQUITY);
    const hourAngle = arc * (hourLine / 6 - 1) + 180;
    const anchor = projection.northPoint(hourAngle, -OBLIQUITY);
    const direction = Math.atan2(anchor.x, -anchor.y) / DEG;
    const position = polar(direction, Math.max(hourLabelRadius, anchor.radius + labelSize));

    if (position.y < Rp * 0.1) continue;

    engraver.text(String(hourLine), position.x, position.y, {
      size: labelSize * 0.95,
      rotation: uprightRotation(direction),
      weight: 500,
      depth: 0.85,
    });
  }

  void phi;
}

function renderPlate(layout, projection, light, pixelRatio) {
  const side = Math.ceil(layout.plateRadius * 2 + 8);
  const unit = layout.lineUnit;
  const surface = createSurface(side, side, pixelRatio, side / 2, side / 2);
  const mask = createSurface(side, side, pixelRatio, side / 2, side / 2);

  drawPlateMask(mask, layout);
  paintBrassField(surface, { seed: 4411, base: mixTone(TONES.mid, TONES.light, 0.22), unit });
  clipToMask(surface, mask);
  applyBevel(surface, mask, light, unit, 1);

  const engraver = createEngraver(surface.ctx, light, unit);
  drawPlateEngraving(engraver, layout, projection);

  return { surface, mask, side };
}

function circleAndLine(projection, layout) {
  const Rp = layout.plateRadius;
  const ring = projection.capricornRadius;
  return { ringRadius: ring, ringWidth: 0.05 * Rp, bandWidth: 0.075 * Rp };
}

function starGeometry(projection, layout) {
  const Rp = layout.plateRadius;
  const { ringRadius } = circleAndLine(projection, layout);
  const ecliptic = projection.ecliptic;
  const stars = [];

  for (const star of STARS) {
    const tip = projection.toPlate(-star.ra, star.dec);
    const isInsideEdge = tip.radius < Rp * 0.965 && Number.isFinite(tip.radius);
    if (!isInsideEdge) continue;

    const toEcliptic = { x: tip.x - ecliptic.x, y: tip.y - ecliptic.y };
    const eclipticDistance = Math.hypot(toEcliptic.x, toEcliptic.y) || 1;
    const eclipticBase = {
      x: ecliptic.x + (toEcliptic.x / eclipticDistance) * ecliptic.radius,
      y: ecliptic.y + (toEcliptic.y / eclipticDistance) * ecliptic.radius,
    };
    const outerBase = {
      x: (tip.x / (tip.radius || 1)) * ringRadius,
      y: (tip.y / (tip.radius || 1)) * ringRadius,
    };

    const eclipticGap = Math.hypot(tip.x - eclipticBase.x, tip.y - eclipticBase.y);
    const outerGap = Math.hypot(tip.x - outerBase.x, tip.y - outerBase.y);
    const base = eclipticGap < outerGap ? eclipticBase : outerBase;

    stars.push({ name: star.name, tip, base });
  }

  return stars;
}

function traceFlame(ctx, base, tip, width, bendDirection) {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const length = Math.hypot(dx, dy) || 1;
  const dirX = dx / length;
  const dirY = dy / length;
  const normalX = -dirY * bendDirection;
  const normalY = dirX * bendDirection;
  const bend = Math.min(length * 0.14, width * 0.9);
  const at = (along, across) => [
    base.x + dirX * length * along + normalX * (across + bend * Math.sin(along * Math.PI)),
    base.y + dirY * length * along + normalY * (across + bend * Math.sin(along * Math.PI)),
  ];

  const start = at(0, width / 2);
  const c1 = at(0.4, width * 0.62);
  const c2 = at(0.78, width * 0.16);
  const end = at(1, 0);
  const c3 = at(0.72, -width * 0.3);
  const c4 = at(0.3, -width * 0.62);
  const back = at(0, -width / 2);

  ctx.moveTo(start[0], start[1]);
  ctx.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], end[0], end[1]);
  ctx.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], back[0], back[1]);
  ctx.closePath();

  return { dirX, dirY, length };
}

function drawReteMask(surface, layout, projection, stars) {
  const { ctx } = surface;
  const Rp = layout.plateRadius;
  const { ringRadius, ringWidth, bandWidth } = circleAndLine(projection, layout);
  const ecliptic = projection.ecliptic;

  ctx.save();
  ctx.strokeStyle = "#fff";
  ctx.fillStyle = "#fff";
  ctx.lineCap = "butt";

  ctx.lineWidth = ringWidth;
  ctx.beginPath();
  circlePath(ctx, ringRadius);
  ctx.stroke();

  ctx.lineWidth = bandWidth;
  ctx.beginPath();
  circlePath(ctx, ecliptic.radius, ecliptic.x, ecliptic.y);
  ctx.stroke();

  ctx.lineWidth = 0.032 * Rp;
  ctx.beginPath();
  ctx.moveTo(-ringRadius, 0);
  ctx.lineTo(ringRadius, 0);
  ctx.moveTo(0, -ringRadius);
  ctx.lineTo(0, ringRadius);
  ctx.stroke();

  ctx.beginPath();
  circlePath(ctx, 0.092 * Rp);
  ctx.fill();

  for (const thorn of thornList(layout)) {
    ctx.beginPath();
    ctx.moveTo(thorn.x - thorn.half, thorn.baseY);
    ctx.lineTo(thorn.x, thorn.baseY + thorn.height);
    ctx.lineTo(thorn.x + thorn.half, thorn.baseY);
    ctx.closePath();
    ctx.fill();
  }

  for (const pin of pinList(layout, projection)) {
    ctx.beginPath();
    circlePath(ctx, pin.radius, pin.x, pin.y);
    ctx.fill();
  }

  for (const star of stars) {
    ctx.beginPath();
    traceFlame(ctx, star.base, star.tip, 0.04 * Rp, star.bend);
    ctx.fill();
  }

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  circlePath(ctx, 0.034 * Rp);
  ctx.fill();
  ctx.restore();
}

function thornList(layout) {
  const Rp = layout.plateRadius;
  const thorns = [];
  const positions = [0.135, 0.19, 0.245, 0.31];

  positions.forEach((position, index) => {
    const height = Rp * (0.07 - index * 0.011);
    for (const side of [-1, 1]) {
      for (const direction of [-1, 1]) {
        thorns.push({
          x: side * position * Rp,
          baseY: direction * 0.014 * Rp,
          height: direction * height,
          half: 0.014 * Rp,
        });
      }
    }
  });

  return thorns;
}

function pinList(layout, projection) {
  const Rp = layout.plateRadius;
  const ring = projection.capricornRadius;
  const radius = 0.034 * Rp;

  return [
    { x: -ring * 0.62, y: 0, radius },
    { x: ring * 0.62, y: 0, radius },
    { x: 0, y: ring * 0.62, radius },
    { x: 0, y: -ring * 0.62, radius },
  ];
}

function drawReteEngraving(engraver, layout, projection, stars) {
  const { ctx } = engraver;
  const Rp = layout.plateRadius;
  const { ringRadius, ringWidth, bandWidth } = circleAndLine(projection, layout);
  const ecliptic = projection.ecliptic;

  engraver.stroke((path) => circlePath(path, ringRadius + ringWidth * 0.32), { width: 0.6, depth: 0.7 });
  engraver.stroke((path) => circlePath(path, ringRadius - ringWidth * 0.32), { width: 0.6, depth: 0.7 });
  engraver.stroke((path) => circlePath(path, ecliptic.radius + bandWidth / 2 - 1.1, ecliptic.x, ecliptic.y), { width: 0.8 });
  engraver.stroke((path) => circlePath(path, ecliptic.radius - bandWidth / 2 + 1.1, ecliptic.x, ecliptic.y), { width: 0.8 });

  const outwardAt = (point) => {
    const dx = point.x - ecliptic.x;
    const dy = point.y - ecliptic.y;
    const length = Math.hypot(dx, dy) || 1;
    return { x: dx / length, y: dy / length };
  };

  engraver.stroke(
    (path) => {
      for (let degree = 0; degree < 360; degree++) {
        const isSign = degree % 30 === 0;
        const isMedium = degree % 5 === 0;
        const point = projection.eclipticPoint(degree);
        const normal = outwardAt(point);
        const outer = bandWidth / 2 - 1.1;
        const inner = isSign ? -outer : isMedium ? outer - bandWidth * 0.3 : outer - bandWidth * 0.17;
        path.moveTo(point.x + normal.x * outer, point.y + normal.y * outer);
        path.lineTo(point.x + normal.x * inner, point.y + normal.y * inner);
      }
    },
    { width: 0.5, depth: 0.85 },
  );

  const signSize = 0.03 * Rp;
  SIGN_NAMES.forEach((name, index) => {
    const point = projection.eclipticPoint(index * 30 + 15);
    const normal = outwardAt(point);
    const offset = -bandWidth * 0.1;
    const x = point.x + normal.x * offset;
    const y = point.y + normal.y * offset;
    const tangent = Math.atan2(normal.y, normal.x) + Math.PI / 2;
    const isFlipped = Math.cos(tangent) < 0 && false;

    engraver.text(name, x, y, {
      size: signSize,
      rotation: isFlipped ? tangent + Math.PI : tangent,
      spacing: `${signSize * 0.1}px`,
      weight: 500,
    });
  });

  engraver.stroke(
    (path) => {
      path.moveTo(-ringRadius, 0);
      path.lineTo(ringRadius, 0);
      path.moveTo(0, -ringRadius);
      path.lineTo(0, ringRadius);
    },
    { width: 0.5, depth: 0.55 },
  );

  engraver.stroke((path) => circlePath(path, 0.07 * Rp), { width: 0.7, depth: 0.85 });
  engraver.stroke((path) => circlePath(path, 0.046 * Rp), { width: 0.6, depth: 0.7 });

  engraver.stroke(
    (path) => {
      for (const star of stars) {
        path.moveTo(star.tip.x + 0.011 * Rp, star.tip.y);
        path.arc(star.tip.x, star.tip.y, 0.011 * Rp, 0, TAU);
      }
    },
    { width: 0.6, depth: 0.9 },
  );

  engraver.stroke(
    (path) => {
      for (const star of stars) {
        const dx = star.tip.x - star.base.x;
        const dy = star.tip.y - star.base.y;
        const length = Math.hypot(dx, dy) || 1;
        path.moveTo(star.base.x + (dx / length) * length * 0.18, star.base.y + (dy / length) * length * 0.18);
        path.lineTo(star.tip.x - (dx / length) * 0.022 * Rp, star.tip.y - (dy / length) * 0.022 * Rp);
      }
    },
    { width: 0.5, depth: 0.55 },
  );

  const nameSize = 0.027 * Rp;
  for (const star of stars) {
    const dx = star.tip.x - star.base.x;
    const dy = star.tip.y - star.base.y;
    const length = Math.hypot(dx, dy) || 1;
    const middle = { x: star.base.x + dx * 0.5, y: star.base.y + dy * 0.5 };
    const normal = { x: -dy / length, y: dx / length };
    const angle = Math.atan2(dy, dx);
    const needsFlip = Math.cos(angle) < 0;
    const side = star.bend * -1;
    const labelX = middle.x + normal.x * side * nameSize * 1.55;
    const labelY = middle.y + normal.y * side * nameSize * 1.55;

    engraver.text(star.name.toUpperCase(), labelX, labelY, {
      size: nameSize,
      rotation: needsFlip ? angle + Math.PI : angle,
      spacing: `${nameSize * 0.08}px`,
      weight: 500,
      depth: 0.9,
    });
  }

  void ctx;
}

function paintPins(ctx, layout, projection, light) {
  for (const pin of pinList(layout, projection)) {
    const gradient = ctx.createRadialGradient(
      pin.x - light.x * pin.radius * 0.45,
      pin.y - light.y * pin.radius * 0.45,
      pin.radius * 0.05,
      pin.x,
      pin.y,
      pin.radius,
    );
    gradient.addColorStop(0, rgb([238, 196, 140], 1));
    gradient.addColorStop(0.35, rgb(TONES.copper, 1));
    gradient.addColorStop(1, rgb([64, 34, 10], 1));

    ctx.save();
    ctx.shadowColor = "rgba(10,6,0,0.55)";
    ctx.shadowBlur = pin.radius * 0.5;
    ctx.shadowOffsetX = -light.x * pin.radius * 0.18;
    ctx.shadowOffsetY = -light.y * pin.radius * 0.18;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    circlePath(ctx, pin.radius, pin.x, pin.y);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = rgb([40, 22, 6], 0.7);
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    circlePath(ctx, pin.radius * 0.98, pin.x, pin.y);
    ctx.stroke();
    ctx.restore();
  }
}

function prepareStars(projection, layout) {
  const stars = starGeometry(projection, layout);
  const ecliptic = projection.ecliptic;

  for (const star of stars) {
    const crossing = (star.tip.x - star.base.x) * (star.base.y - ecliptic.y) - (star.tip.y - star.base.y) * (star.base.x - ecliptic.x);
    star.bend = crossing >= 0 ? 1 : -1;
  }

  return stars;
}

function renderRete(layout, projection, light, pixelRatio) {
  const side = Math.ceil(layout.plateRadius * 2 + 8);
  const unit = layout.lineUnit;
  const surface = createSurface(side, side, pixelRatio, side / 2, side / 2);
  const mask = createSurface(side, side, pixelRatio, side / 2, side / 2);
  const stars = prepareStars(projection, layout);

  drawReteMask(mask, layout, projection, stars);
  paintBrassField(surface, { seed: 7301, base: mixTone(TONES.mid, TONES.light, 0.3), unit });
  clipToMask(surface, mask);
  applyBevel(surface, mask, light, unit, 1.15);

  paintPins(surface.ctx, layout, projection, light);

  const engraver = createEngraver(surface.ctx, light, unit);
  drawReteEngraving(engraver, layout, projection, stars);

  return { surface, mask, side };
}

function drawAlidadeMask(surface, layout) {
  const { ctx } = surface;
  const R = layout.radius;

  ctx.save();
  ctx.fillStyle = "#fff";

  ctx.beginPath();
  tracePolygon(ctx, [
    [-0.036 * R, -0.05 * R],
    [-0.024 * R, -0.72 * R],
    [-0.0105 * R, -0.885 * R],
    [0, -0.915 * R],
    [0.0105 * R, -0.885 * R],
    [0.024 * R, -0.72 * R],
    [0.036 * R, -0.05 * R],
  ]);
  ctx.fill();

  ctx.beginPath();
  tracePolygon(ctx, [
    [-0.034 * R, 0.04 * R],
    [-0.024 * R, 0.37 * R],
    [0.024 * R, 0.37 * R],
    [0.034 * R, 0.04 * R],
  ]);
  ctx.fill();

  ctx.beginPath();
  circlePath(ctx, 0.056 * R, 0, 0.43 * R);
  ctx.fill();

  ctx.beginPath();
  circlePath(ctx, 0.066 * R);
  ctx.fill();

  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  circlePath(ctx, 0.022 * R, 0, 0.43 * R);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -0.2 * R);
  ctx.quadraticCurveTo(0.0105 * R, -0.4 * R, 0, -0.62 * R);
  ctx.quadraticCurveTo(-0.0105 * R, -0.4 * R, 0, -0.2 * R);
  ctx.fill();
  ctx.restore();
}

function renderAlidade(layout, light, pixelRatio) {
  const side = Math.ceil(layout.alidadeRadius * 2 + 8);
  const unit = layout.lineUnit;
  const R = layout.radius;
  const surface = createSurface(side, side, pixelRatio, side / 2, side / 2);
  const mask = createSurface(side, side, pixelRatio, side / 2, side / 2);

  drawAlidadeMask(mask, layout);
  paintBrassField(surface, { seed: 3319, base: mixTone(TONES.mid, TONES.light, 0.4), unit });
  clipToMask(surface, mask);
  applyBevel(surface, mask, light, unit, 1.3);

  const { ctx } = surface;
  const engraver = createEngraver(ctx, light, unit);

  engraver.stroke(
    (path) => {
      path.moveTo(0, -0.14 * R);
      path.lineTo(0, -0.2 * R);
      path.moveTo(0, -0.62 * R);
      path.lineTo(0, -0.865 * R);
    },
    { width: 0.6, depth: 0.7 },
  );

  engraver.stroke(
    (path) => {
      for (let tick = 0; tick < 24; tick++) {
        const y = -(0.66 + tick * 0.0085) * R;
        const halfWidth = 0.0215 * R - (tick * 0.0085 * R) * 0.025;
        path.moveTo(-halfWidth, y);
        path.lineTo(-halfWidth + (tick % 4 === 0 ? 0.013 : 0.007) * R, y);
      }
    },
    { width: 0.45, depth: 0.7 },
  );

  engraver.stroke((path) => circlePath(path, 0.048 * R), { width: 0.7, depth: 0.8 });
  engraver.stroke((path) => circlePath(path, 0.033 * R), { width: 0.5, depth: 0.7 });
  engraver.stroke((path) => circlePath(path, 0.039 * R, 0, 0.43 * R), { width: 0.6, depth: 0.8 });

  paintPinCap(ctx, R, light);

  return { surface, mask, side };
}

function paintPinCap(ctx, R, light) {
  const radius = 0.03 * R;
  const gradient = ctx.createRadialGradient(
    -light.x * radius * 0.4,
    -light.y * radius * 0.4,
    radius * 0.05,
    0,
    0,
    radius,
  );
  gradient.addColorStop(0, rgb([116, 96, 66], 1));
  gradient.addColorStop(0.5, rgb([56, 44, 24], 1));
  gradient.addColorStop(1, rgb([20, 15, 6], 1));

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 2.5;
  ctx.shadowOffsetX = -light.x * 1.4;
  ctx.shadowOffsetY = -light.y * 1.4;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  circlePath(ctx, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgb([8, 6, 2], 0.9);
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(-radius * 0.7, radius * 0.1);
  ctx.lineTo(radius * 0.7, -radius * 0.1);
  ctx.stroke();
  ctx.restore();
}

function renderSunMarker(layout, light, pixelRatio) {
  const R = layout.radius;
  const side = Math.ceil(R * 0.2);
  const surface = createSurface(side, side, pixelRatio, side / 2, side / 2);
  const { ctx } = surface;
  const bodyRadius = 0.026 * R;
  const rayLength = 0.075 * R;

  ctx.save();
  ctx.shadowColor = "rgba(10,6,0,0.55)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = -light.x * 1.6;
  ctx.shadowOffsetY = -light.y * 1.6;

  for (let ray = 0; ray < 16; ray++) {
    const isLong = ray % 2 === 0;
    const angle = (ray / 16) * TAU;
    const length = isLong ? rayLength : rayLength * 0.66;
    const half = 0.0075 * R;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = rgb(mixTone(TONES.light, TONES.highlight, 0.45), 1);
    ctx.beginPath();
    ctx.moveTo(-half, -bodyRadius * 0.8);
    ctx.lineTo(0, -length);
    ctx.lineTo(half, -bodyRadius * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const gradient = ctx.createRadialGradient(
    -light.x * bodyRadius * 0.4,
    -light.y * bodyRadius * 0.4,
    bodyRadius * 0.1,
    0,
    0,
    bodyRadius * 1.1,
  );
  gradient.addColorStop(0, rgb([255, 244, 200], 1));
  gradient.addColorStop(0.55, rgb(TONES.light, 1));
  gradient.addColorStop(1, rgb(TONES.shadow, 1));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  circlePath(ctx, bodyRadius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = rgb(TONES.ink, 0.75);
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  circlePath(ctx, bodyRadius);
  ctx.stroke();
  ctx.beginPath();
  circlePath(ctx, bodyRadius * 0.45);
  ctx.stroke();
  ctx.restore();

  return { surface, side };
}

function renderPrayerMarks(layout, light, hemisphere, marks, pixelRatio) {
  const surface = createSurface(layout.width, layout.height, pixelRatio, layout.centerX, layout.centerY);
  const R = layout.radius;
  const engraver = createEngraver(surface.ctx, light, layout.lineUnit);

  for (const mark of marks) {
    const outerRadius = 0.83 * R;

    if (mark.isMinor) {
      engraver.stroke(
        (path) => {
          const from = polar(mark.bearing, outerRadius);
          const to = polar(mark.bearing, outerRadius - 0.022 * R);
          path.moveTo(from.x, from.y);
          path.lineTo(to.x, to.y);
        },
        { width: 0.9, depth: 0.9 },
      );
      continue;
    }

    engraver.stroke(
      (path) => {
        const apex = polar(mark.bearing, outerRadius - 0.03 * R);
        const left = polar(mark.bearing - 1.5, outerRadius);
        const right = polar(mark.bearing + 1.5, outerRadius);
        path.moveTo(left.x, left.y);
        path.lineTo(apex.x, apex.y);
        path.lineTo(right.x, right.y);
      },
      { width: 1, depth: 1 },
    );

    const labelPosition = polar(mark.bearing, 0.7975 * R);
    const labelSize = 0.027 * R;
    const rotation = uprightRotation(mark.bearing);

    engraver.stroke(
      (path) => {
        const spread = 0.8;
        const from = polar(mark.bearing, outerRadius - 0.03 * R);
        const to = polar(mark.bearing, outerRadius - 0.036 * R);
        path.moveTo(from.x, from.y);
        path.lineTo(to.x, to.y);
        void spread;
      },
      { width: 0.5, depth: 0 },
    );

    engraver.text(mark.label, labelPosition.x, labelPosition.y, {
      size: labelSize,
      rotation,
      spacing: `${labelSize * 0.1}px`,
      weight: 600,
      depth: 1,
    });
  }

  void hemisphere;
  return surface;
}

function paintSheen(sheen, maskCanvas, rotation, center, radius, light) {
  const { ctx, width, height } = sheen;
  const azimuthRadians = light.azimuth * DEG;
  const elevationRadians = clamp(light.elevation, 6, 88) * DEG;
  const dirX = Math.sin(azimuthRadians);
  const dirY = -Math.cos(azimuthRadians);
  const daylight = clamp((light.elevation + 6) / 26, 0.2, 1);
  const warmth = clamp(light.elevation / 16, 0, 1);
  const tint = mixTone(TONES.moon, TONES.sun, warmth);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);

  const shade = ctx.createLinearGradient(
    center.x + dirX * radius,
    center.y + dirY * radius,
    center.x - dirX * radius,
    center.y - dirY * radius,
  );
  shade.addColorStop(0, rgb(tint, 0.12 * daylight));
  shade.addColorStop(0.5, rgb(tint, 0));
  shade.addColorStop(1, rgb(TONES.deep, 0.26 + 0.14 * (1 - daylight)));
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);

  const reach = radius * 0.62 * Math.cos(elevationRadians);
  const hotspotX = center.x + dirX * reach;
  const hotspotY = center.y + dirY * reach;
  const hotspot = ctx.createRadialGradient(hotspotX, hotspotY, 0, hotspotX, hotspotY, radius * 0.95);
  hotspot.addColorStop(0, rgb(tint, 0.3 * daylight));
  hotspot.addColorStop(0.45, rgb(tint, 0.1 * daylight));
  hotspot.addColorStop(1, rgb(tint, 0));
  ctx.fillStyle = hotspot;
  ctx.fillRect(0, 0, width, height);

  if (ctx.createConicGradient) {
    const lightAngle = Math.atan2(dirY, dirX);
    const cone = ctx.createConicGradient(lightAngle - Math.PI, center.x, center.y);
    const broad = 0.11 * daylight;
    const core = 0.2 * daylight;
    const opposite = 0.07 * daylight;

    cone.addColorStop(0, rgb(tint, opposite));
    cone.addColorStop(0.035, rgb(tint, opposite * 0.45));
    cone.addColorStop(0.09, rgb(tint, 0));
    cone.addColorStop(0.4, rgb(tint, 0));
    cone.addColorStop(0.465, rgb(tint, broad * 0.5));
    cone.addColorStop(0.492, rgb([255, 250, 226], core));
    cone.addColorStop(0.5, rgb([255, 252, 236], core * 1.15));
    cone.addColorStop(0.508, rgb([255, 250, 226], core));
    cone.addColorStop(0.535, rgb(tint, broad * 0.5));
    cone.addColorStop(0.6, rgb(tint, 0));
    cone.addColorStop(0.91, rgb(tint, 0));
    cone.addColorStop(0.965, rgb(tint, opposite * 0.45));
    cone.addColorStop(1, rgb(tint, opposite));
    ctx.fillStyle = cone;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "destination-in";
  ctx.save();
  ctx.translate(center.x, center.y);
  ctx.rotate(rotation * DEG);
  ctx.drawImage(maskCanvas, -center.x, -center.y, width, height);
  ctx.restore();
  ctx.globalCompositeOperation = "source-over";
}

function downscaleMask(mask, width, height) {
  const copy = createSurface(width, height, 1);
  copy.ctx.drawImage(mask.canvas, 0, 0, width, height);
  return copy;
}

function readRotation(node, fallback) {
  const gsapRef = window.gsap;
  if (gsapRef) return Number(gsapRef.getProperty(node, "rotation")) || 0;
  return fallback;
}

function writeRotation(node, degrees) {
  const gsapRef = window.gsap;

  if (gsapRef) {
    gsapRef.set(node, { rotation: degrees });
    return;
  }

  node.style.transform = `rotate(${degrees}deg)`;
}

function absoluteBox(node, left, top, width, height) {
  node.style.position = "absolute";
  node.style.left = `${left}px`;
  node.style.top = `${top}px`;
  node.style.width = `${width}px`;
  node.style.height = `${height}px`;
}

function mountCanvas(parent, canvas, key, width, height) {
  canvas.style.position = "absolute";
  canvas.style.left = "0";
  canvas.style.top = "0";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = { base: "0", marks: "1", sun: "1", sheen: "3" }[key] || "0";
  canvas.dataset.canvasKey = key;

  const existing = parent.querySelector(`canvas[data-canvas-key="${key}"]`);
  if (existing) parent.replaceChild(canvas, existing);
  else parent.appendChild(canvas);
}

function makePrayerList(prayers) {
  if (!prayers) return [];

  return ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"]
    .filter((key) => prayers[key] instanceof Date && !Number.isNaN(prayers[key].getTime()))
    .map((key) => ({ key, name: PRAYER_TITLES[key], date: prayers[key] }))
    .sort((first, second) => first.date.getTime() - second.date.getTime());
}

export function createAstrolabe(container, options = {}) {
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const measuredWidth = container.clientWidth;
  const initialSize = options.size || (measuredWidth > 0 ? measuredWidth : 640);

  const state = {
    lat: options.lat ?? 40.7128,
    lng: options.lng ?? -74.006,
    size: initialSize,
    layout: null,
    projection: null,
    hemisphere: 1,
    date: new Date(),
    sun: null,
    light: { azimuth: options.lightAzimuth ?? 315, elevation: options.lightElevation ?? 46 },
    bakedLight: null,
    prayers: null,
    prayerList: [],
    tilt: { targetX: 0, targetY: 0, x: 0, y: 0 },
    pointer: { targetX: 0, targetY: 0, x: 0, y: 0 },
    isVisible: true,
    isPageVisible: !document.hidden,
    isReduced: reducedQuery.matches,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    angles: { rete: 0, alidade: 0 },
    isAlidadeFree: false,
    sunLambda: null,
    sheenDirty: true,
    frameHandle: 0,
    recacheTimer: 0,
    isDestroyed: false,
    followPointer: options.followPointer !== false,
    idleLight: options.idleLight !== false,
    clock: 0,
    lastTick: 0,
    layerSurfaces: {},
    sheenSurfaces: {},
    sheenMasks: {},
    timings: { first: 0, full: 0 },
    hasDisplayFont: false,
  };

  const root = document.createElement("div");
  root.className = "qalm-astrolabe";
  root.style.position = "relative";
  root.style.userSelect = "none";
  root.style.webkitUserSelect = "none";
  root.style.touchAction = "none";
  root.setAttribute("role", "img");
  root.setAttribute("aria-label", options.label || "Brass astrolabe set to the sky over your city");

  const stage = document.createElement("div");
  stage.className = "qalm-astrolabe-stage";
  stage.style.position = "absolute";
  stage.style.left = "0";
  stage.style.top = "0";
  stage.style.width = "100%";
  stage.style.height = "100%";
  stage.style.transformStyle = "preserve-3d";
  root.appendChild(stage);

  function makeDepth(name) {
    const depth = document.createElement("div");
    depth.className = `qalm-astrolabe-depth qalm-astrolabe-depth-${name}`;
    depth.style.position = "absolute";
    depth.style.left = "0";
    depth.style.top = "0";
    depth.style.width = "100%";
    depth.style.height = "100%";
    depth.style.pointerEvents = "none";
    stage.appendChild(depth);
    return depth;
  }

  const depthNodes = {
    mater: makeDepth("mater"),
    plate: makeDepth("plate"),
    rete: makeDepth("rete"),
    alidade: makeDepth("alidade"),
  };

  const layers = {
    mater: document.createElement("div"),
    plate: document.createElement("div"),
    rete: document.createElement("div"),
    alidade: document.createElement("div"),
  };

  for (const [name, node] of Object.entries(layers)) {
    node.className = `qalm-astrolabe-layer qalm-astrolabe-${name}`;
    node.style.position = "absolute";
    node.style.willChange = "transform";
    node.style.pointerEvents = "none";
    depthNodes[name].appendChild(node);
  }

  const sunMarkerNode = document.createElement("div");
  sunMarkerNode.className = "qalm-astrolabe-sun";
  sunMarkerNode.style.position = "absolute";
  sunMarkerNode.style.pointerEvents = "none";
  sunMarkerNode.style.zIndex = "2";
  layers.rete.appendChild(sunMarkerNode);

  const staticSheen = document.createElement("div");
  staticSheen.style.position = "absolute";
  staticSheen.style.left = "0";
  staticSheen.style.top = "0";
  staticSheen.style.pointerEvents = "none";
  depthNodes.plate.appendChild(staticSheen);

  container.appendChild(root);

  function applyBoxes() {
    const { layout } = state;
    const plateSide = Math.ceil(layout.plateRadius * 2 + 8);
    const alidadeSide = Math.ceil(layout.alidadeRadius * 2 + 8);
    const centerLeft = (side) => layout.centerX - side / 2;
    const centerTop = (side) => layout.centerY - side / 2;

    root.style.width = `${layout.width}px`;
    root.style.height = `${layout.height}px`;
    root.style.perspective = `${layout.size * 4}px`;
    root.style.perspectiveOrigin = `${layout.centerX}px ${layout.centerY}px`;

    absoluteBox(layers.mater, 0, 0, layout.width, layout.height);
    absoluteBox(layers.plate, centerLeft(plateSide), centerTop(plateSide), plateSide, plateSide);
    absoluteBox(layers.rete, centerLeft(plateSide), centerTop(plateSide), plateSide, plateSide);
    absoluteBox(layers.alidade, centerLeft(alidadeSide), centerTop(alidadeSide), alidadeSide, alidadeSide);
    absoluteBox(staticSheen, 0, 0, layout.width, layout.height);

    const depthStep = layout.size * 0.012;
    depthNodes.mater.style.transform = "translateZ(0px)";
    depthNodes.plate.style.transform = `translateZ(${depthStep}px)`;
    depthNodes.rete.style.transform = `translateZ(${depthStep * 2}px)`;
    depthNodes.alidade.style.transform = `translateZ(${depthStep * 3}px)`;

    layers.rete.style.transformOrigin = "50% 50%";
    layers.alidade.style.transformOrigin = "50% 50%";
  }

  function applyShadows() {
    const { layout } = state;
    const elevation = clamp(state.light.elevation, 8, 85) * DEG;
    const length = clamp(1 / Math.tan(elevation), 0.45, 2.4);
    const azimuth = state.light.azimuth * DEG;
    const away = { x: -Math.sin(azimuth), y: Math.cos(azimuth) };
    const strength = clamp((state.light.elevation + 8) / 30, 0.25, 1);
    const castBy = (distance, blur, alpha) => {
      const dx = (away.x * distance * length).toFixed(2);
      const dy = (away.y * distance * length).toFixed(2);
      return `drop-shadow(${dx}px ${dy}px ${blur.toFixed(2)}px rgba(12,8,2,${(alpha * strength).toFixed(3)}))`; // taste-skill-ignore: layers of one brass object casting on each other
    };

    depthNodes.mater.style.filter = castBy(layout.size * 0.016, layout.size * 0.022, 0.5);
    depthNodes.rete.style.filter = castBy(layout.size * 0.006, layout.size * 0.0065, 0.55);
    depthNodes.alidade.style.filter = castBy(layout.size * 0.011, layout.size * 0.011, 0.5);
  }

  function effectiveLight() {
    const driftAzimuth = state.idleLight && !state.isReduced ? Math.sin(state.clock * 0.00042) * 7 : 0;
    const driftElevation = state.idleLight && !state.isReduced ? Math.cos(state.clock * 0.00031) * 3 : 0;

    return {
      azimuth: state.light.azimuth + driftAzimuth + state.pointer.x * 24 + state.tilt.x * 12,
      elevation: clamp(state.light.elevation + driftElevation - state.pointer.y * 9 - state.tilt.y * 6, -12, 88),
    };
  }

  function updateSheens() {
    if (!state.sheenMasks.static) return;

    const { layout } = state;
    const light = effectiveLight();
    const plateSide = Math.ceil(layout.plateRadius * 2 + 8);
    const alidadeSide = Math.ceil(layout.alidadeRadius * 2 + 8);

    paintSheen(
      state.sheenSurfaces.static,
      state.sheenMasks.static.canvas,
      0,
      { x: layout.centerX, y: layout.centerY },
      layout.radius,
      light,
    );

    paintSheen(
      state.sheenSurfaces.rete,
      state.sheenMasks.rete.canvas,
      readRotation(layers.rete, state.angles.rete),
      { x: plateSide / 2, y: plateSide / 2 },
      layout.plateRadius,
      light,
    );

    paintSheen(
      state.sheenSurfaces.alidade,
      state.sheenMasks.alidade.canvas,
      readRotation(layers.alidade, state.angles.alidade),
      { x: alidadeSide / 2, y: alidadeSide / 2 },
      layout.radius * 0.9,
      light,
    );
  }

  function renderMarks() {
    const { layout, light } = state;
    const bakedLight = lightVector(state.bakedLight.azimuth, state.bakedLight.elevation);
    void light;

    const marks = [];

    for (const entry of state.prayerList) {
      const sun = sunPosition(entry.date);
      const hourAngle = normalize180(siderealAngle(entry.date, state.lng) - sun.ra);
      const bearing = state.hemisphere * hourAngle;

      if (entry.key === "sunrise") marks.push({ bearing, isMinor: true });
      else marks.push({ bearing, label: PRAYER_LABELS[entry.key] });
    }

    const surface = renderPrayerMarks(layout, bakedLight, state.hemisphere, marks, state.surfaceRatio);
    mountCanvas(layers.mater, surface.canvas, "marks", layout.width, layout.height);
  }

  function buildSheenSurfaces() {
    const { layout } = state;
    const plateSide = Math.ceil(layout.plateRadius * 2 + 8);
    const alidadeSide = Math.ceil(layout.alidadeRadius * 2 + 8);

    state.sheenSurfaces.static = createSurface(layout.width, layout.height, 1);
    state.sheenSurfaces.rete = createSurface(plateSide, plateSide, 1);
    state.sheenSurfaces.alidade = createSurface(alidadeSide, alidadeSide, 1);

    mountCanvas(staticSheen, state.sheenSurfaces.static.canvas, "sheen", layout.width, layout.height);
    mountCanvas(depthNodes.rete, state.sheenSurfaces.rete.canvas, "sheen", plateSide, plateSide);
    mountCanvas(depthNodes.alidade, state.sheenSurfaces.alidade.canvas, "sheen", alidadeSide, alidadeSide);
    state.sheenSurfaces.rete.canvas.style.left = `${layout.centerX - plateSide / 2}px`;
    state.sheenSurfaces.rete.canvas.style.top = `${layout.centerY - plateSide / 2}px`;
    state.sheenSurfaces.alidade.canvas.style.left = `${layout.centerX - alidadeSide / 2}px`;
    state.sheenSurfaces.alidade.canvas.style.top = `${layout.centerY - alidadeSide / 2}px`;
  }

  function placeSunMarker() {
    const { layout, projection } = state;
    const markerSide = Math.ceil(layout.radius * 0.2);
    const plateSide = Math.ceil(layout.plateRadius * 2 + 8);
    const rightAscension = state.sun.ra;
    const point = projection.toPlate(-rightAscension, state.sun.dec);

    sunMarkerNode.style.left = `${plateSide / 2 + point.x - markerSide / 2}px`;
    sunMarkerNode.style.top = `${plateSide / 2 + point.y - markerSide / 2}px`;
    sunMarkerNode.style.width = `${markerSide}px`;
    sunMarkerNode.style.height = `${markerSide}px`;
  }

  function buildSunMarker(pixelRatio) {
    const { layout } = state;
    const marker = renderSunMarker(layout, lightVector(state.bakedLight.azimuth, state.bakedLight.elevation), pixelRatio);
    mountCanvas(sunMarkerNode, marker.surface.canvas, "sun", marker.side, marker.side);
  }

  function renderEverything(pixelRatio) {
    const started = performance.now();
    const { layout, projection, hemisphere } = state;
    const light = lightVector(state.light.azimuth, state.light.elevation);
    state.bakedLight = { azimuth: state.light.azimuth, elevation: state.light.elevation };
    state.surfaceRatio = pixelRatio;

    const mater = renderMater(layout, light, hemisphere, pixelRatio);
    mountCanvas(layers.mater, mater.surface.canvas, "base", layout.width, layout.height);

    const plate = renderPlate(layout, projection, light, pixelRatio);
    mountCanvas(layers.plate, plate.surface.canvas, "base", plate.side, plate.side);

    const rete = renderRete(layout, projection, light, pixelRatio);
    mountCanvas(layers.rete, rete.surface.canvas, "base", rete.side, rete.side);

    const alidade = renderAlidade(layout, light, pixelRatio);
    mountCanvas(layers.alidade, alidade.surface.canvas, "base", alidade.side, alidade.side);

    state.sheenMasks.static = downscaleMask(mater.mask, layout.width, layout.height);
    state.sheenMasks.rete = downscaleMask(rete.mask, rete.side, rete.side);
    state.sheenMasks.alidade = downscaleMask(alidade.mask, alidade.side, alidade.side);

    buildSunMarker(pixelRatio);
    placeSunMarker();
    renderMarks();
    updateSheens();

    return performance.now() - started;
  }

  function renderPlateAndRete(pixelRatio) {
    const { layout, projection } = state;
    const light = lightVector(state.light.azimuth, state.light.elevation);
    state.surfaceRatio = pixelRatio;

    const plate = renderPlate(layout, projection, light, pixelRatio);
    mountCanvas(layers.plate, plate.surface.canvas, "base", plate.side, plate.side);

    const rete = renderRete(layout, projection, light, pixelRatio);
    mountCanvas(layers.rete, rete.surface.canvas, "base", rete.side, rete.side);
    state.sheenMasks.rete = downscaleMask(rete.mask, rete.side, rete.side);
  }

  function scheduleFrame() {
    if (state.frameHandle || state.isDestroyed) return;
    state.frameHandle = requestAnimationFrame(tick);
  }

  function isAnimating() {
    const tiltMoving = Math.abs(state.tilt.targetX - state.tilt.x) + Math.abs(state.tilt.targetY - state.tilt.y) > 0.001;
    const pointerMoving = Math.abs(state.pointer.targetX - state.pointer.x) + Math.abs(state.pointer.targetY - state.pointer.y) > 0.001;
    const drifting = state.idleLight && !state.isReduced;
    return tiltMoving || pointerMoving || drifting;
  }

  function tick(now) {
    state.frameHandle = 0;
    if (state.isDestroyed) return;

    const canRun = state.isVisible && state.isPageVisible;
    if (!canRun) return;

    const delta = state.lastTick ? now - state.lastTick : 16;
    state.lastTick = now;

    const isDrifting = state.idleLight && !state.isReduced;
    if (isDrifting) {
      state.clock += delta;
      state.sheenDirty = true;
    }

    const ease = 1 - Math.pow(0.001, delta / 1000);
    state.tilt.x += (state.tilt.targetX - state.tilt.x) * ease;
    state.tilt.y += (state.tilt.targetY - state.tilt.y) * ease;
    state.pointer.x += (state.pointer.targetX - state.pointer.x) * ease;
    state.pointer.y += (state.pointer.targetY - state.pointer.y) * ease;

    const tiltChanged = Math.abs(state.tilt.targetX - state.tilt.x) + Math.abs(state.tilt.targetY - state.tilt.y) > 0.0005;
    stage.style.transform = state.isReduced
      ? ""
      : `rotateX(${(-state.tilt.y * 8).toFixed(3)}deg) rotateY(${(state.tilt.x * 8).toFixed(3)}deg)`;

    if (tiltChanged || isAnimating()) state.sheenDirty = true;

    const hasRotationChange =
      readRotation(layers.rete, state.angles.rete) !== state.lastReteAngle ||
      readRotation(layers.alidade, state.angles.alidade) !== state.lastAlidadeAngle;

    if (state.sheenDirty || hasRotationChange) {
      state.lastReteAngle = readRotation(layers.rete, state.angles.rete);
      state.lastAlidadeAngle = readRotation(layers.alidade, state.angles.alidade);
      updateSheens();
      state.sheenDirty = false;
    }

    if (isAnimating()) {
      const frameGap = isDrifting && !tiltChanged ? 2 : 1;
      if (frameGap === 2) {
        state.frameHandle = requestAnimationFrame(() => {
          state.frameHandle = 0;
          scheduleFrame();
        });
      } else {
        scheduleFrame();
      }
    }
  }

  function requestSheen() {
    state.sheenDirty = true;
    scheduleFrame();
  }

  function scheduleRecache() {
    clearTimeout(state.recacheTimer);
    state.recacheTimer = setTimeout(() => {
      if (state.isDestroyed) return;
      const azimuthShift = Math.abs(normalize180(state.light.azimuth - state.bakedLight.azimuth));
      const elevationShift = Math.abs(state.light.elevation - state.bakedLight.elevation);
      if (azimuthShift < 9 && elevationShift < 12) return;

      renderEverything(state.surfaceRatio);
      applyBoxes();
      state.angles.rete = readRotation(layers.rete, state.angles.rete);
    }, 380);
  }

  function setTime(input) {
    const date = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(date.getTime())) return;

    state.date = date;
    state.sun = sunPosition(date);

    const sidereal = siderealAngle(date, state.lng);
    const unwrap = (target, previous) => target + 360 * Math.round((previous - target) / 360);

    const reteTarget = unwrap(state.hemisphere * sidereal, state.angles.rete);
    state.angles.rete = reteTarget;
    writeRotation(layers.rete, reteTarget);

    const hourAngle = normalize180(sidereal - state.sun.ra);
    if (!state.isAlidadeFree) {
      const alidadeTarget = unwrap(state.hemisphere * hourAngle, state.angles.alidade);
      state.angles.alidade = alidadeTarget;
      writeRotation(layers.alidade, alidadeTarget);
    }

    const lambdaChanged = state.sunLambda === null || Math.abs(state.sunLambda - state.sun.lambda) > 0.02;
    if (lambdaChanged) {
      state.sunLambda = state.sun.lambda;
      placeSunMarker();
    }

    requestSheen();
  }

  function setPrayers(prayers) {
    state.prayers = prayers;
    state.prayerList = makePrayerList(prayers);
    if (state.bakedLight) renderMarks();
  }

  function setLocation(lat, lng) {
    const previousHemisphere = state.hemisphere;
    state.lat = lat;
    state.lng = lng;
    state.projection = createProjection(lat, state.layout.plateRadius);
    state.hemisphere = state.projection.hemisphere;

    const hemisphereChanged = previousHemisphere !== state.hemisphere;
    renderPlateAndRete(state.surfaceRatio);
    if (hemisphereChanged) renderEverything(state.surfaceRatio);
    else renderMarks();

    state.sunLambda = null;
    setTime(state.date);
    requestSheen();
  }

  function setLight(azimuth, elevation) {
    state.light = { azimuth: mod360(azimuth), elevation: clamp(elevation, -20, 90) };
    applyShadows();
    requestSheen();
    scheduleRecache();
  }

  function setTilt(x, y) {
    if (state.isReduced) return;
    state.tilt.targetX = clamp(x, -1, 1);
    state.tilt.targetY = clamp(y, -1, 1);
    scheduleFrame();
  }

  function alidadeAngle() {
    return readRotation(layers.alidade, state.angles.alidade);
  }

  function setAlidadeFree(isFree) {
    state.isAlidadeFree = Boolean(isFree);
    if (!isFree) setTime(state.date);
  }

  function resize(size) {
    state.size = size;
    state.layout = computeLayout(size);
    state.projection = createProjection(state.lat, state.layout.plateRadius);
    state.hemisphere = state.projection.hemisphere;
    applyBoxes();
    buildSheenSurfaces();
    renderEverything(state.surfaceRatio || 1);
    applyShadows();
    state.sunLambda = null;
    setTime(state.date);
  }

  function onPointerMove(event) {
    if (!state.followPointer || state.isReduced) return;
    if (event.pointerType && event.pointerType !== "mouse") return;
    if (!state.isVisible) return;

    const bounds = root.getBoundingClientRect();
    const centerX = bounds.left + (state.layout.centerX / state.layout.width) * bounds.width;
    const centerY = bounds.top + (state.layout.centerY / state.layout.height) * bounds.height;
    const span = Math.max(window.innerWidth, 400) * 0.5;

    state.pointer.targetX = clamp((event.clientX - centerX) / span, -1, 1);
    state.pointer.targetY = clamp((event.clientY - centerY) / span, -1, 1);
    scheduleFrame();
  }

  function onVisibilityChange() {
    state.isPageVisible = !document.hidden;
    state.lastTick = 0;
    if (state.isPageVisible) requestSheen();
  }

  function onReducedChange() {
    state.isReduced = reducedQuery.matches;
    if (state.isReduced) {
      stage.style.transform = "";
      state.tilt.targetX = 0;
      state.tilt.targetY = 0;
      state.tilt.x = 0;
      state.tilt.y = 0;
      state.pointer.targetX = 0;
      state.pointer.targetY = 0;
      state.pointer.x = 0;
      state.pointer.y = 0;
    }
    requestSheen();
  }

  const intersection = new IntersectionObserver((entries) => {
    const entry = entries[entries.length - 1];
    state.isVisible = entry.isIntersecting;
    state.lastTick = 0;
    if (state.isVisible) requestSheen();
  });
  intersection.observe(root);

  let resizeObserver = null;
  if (!options.size && "ResizeObserver" in window) {
    let pending = 0;
    resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth;
      if (!width || Math.abs(width - state.size) < 4) return;
      clearTimeout(pending);
      pending = setTimeout(() => resize(width), 120);
    });
    resizeObserver.observe(container);
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  reducedQuery.addEventListener?.("change", onReducedChange);

  state.layout = computeLayout(state.size);
  state.projection = createProjection(state.lat, state.layout.plateRadius);
  state.hemisphere = state.projection.hemisphere;
  state.sun = sunPosition(state.date);

  applyBoxes();
  buildSheenSurfaces();

  const wantsProgressive = state.pixelRatio > 1 && options.progressive !== false;
  const firstRatio = wantsProgressive ? 1 : state.pixelRatio;
  const firstStart = performance.now();
  renderEverything(firstRatio);
  applyShadows();
  setTime(state.date);
  state.timings.first = performance.now() - firstStart;
  state.timings.full = state.timings.first;

  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  function finishUpgrade() {
    if (state.isDestroyed) return;
    const upgradeStart = performance.now();
    renderEverything(state.pixelRatio);
    setTime(state.date);
    state.timings.full = state.timings.first + (performance.now() - upgradeStart);
    resolveReady(state.timings);
  }

  if (wantsProgressive) {
    setTimeout(finishUpgrade, 90);
  } else {
    resolveReady(state.timings);
  }

  if (document.fonts && document.fonts.load) {
    document.fonts
      .load('500 12px "Literata"')
      .then((faces) => {
        if (state.isDestroyed || !faces.length) return;
        renderEverything(state.surfaceRatio);
        setTime(state.date);
      })
      .catch(() => {});
  }

  if (!state.isReduced) scheduleFrame();

  function geometry() {
    const { projection, layout } = state;
    return {
      plateRadius: layout.plateRadius,
      horizon: () => projection.almucantar(0),
      almucantar: (altitude) => projection.almucantar(altitude),
      projection,
      sunScreen() {
        const point = projection.toPlate(-state.sun.ra, state.sun.dec);
        const angle = state.angles.rete * DEG;
        return {
          x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
          y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
        };
      },
      starScreen(name) {
        const star = STARS.find((entry) => entry.name === name);
        const point = projection.toPlate(-star.ra, star.dec);
        const angle = state.angles.rete * DEG;
        return {
          x: point.x * Math.cos(angle) - point.y * Math.sin(angle),
          y: point.x * Math.sin(angle) + point.y * Math.cos(angle),
        };
      },
    };
  }

  function destroy() {
    state.isDestroyed = true;
    cancelAnimationFrame(state.frameHandle);
    clearTimeout(state.recacheTimer);
    intersection.disconnect();
    if (resizeObserver) resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("pointermove", onPointerMove);
    reducedQuery.removeEventListener?.("change", onReducedChange);
    root.remove();
  }

  return {
    element: root,
    layers,
    ready,
    timings: state.timings,
    setTime,
    setPrayers,
    setLocation,
    setLight,
    setTilt,
    setAlidadeFree,
    resize,
    alidadeAngle,
    destroy,
    getTime: () => new Date(state.date.getTime()),
    getLocation: () => ({ lat: state.lat, lng: state.lng }),
    getHemisphere: () => state.hemisphere,
    getPrayerList: () => state.prayerList.slice(),
    getSun: () => ({ ...state.sun, hourAngle: normalize180(siderealAngle(state.date, state.lng) - state.sun.ra) }),
    getCenter: () => ({ x: state.layout.centerX, y: state.layout.centerY, radius: state.layout.radius }),
    geometry: geometry(),
  };
}

function formatClock(date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function currentPeriodName(prayerList, date) {
  let name = prayerList.length ? prayerList[prayerList.length - 1].name : "";

  for (const entry of prayerList) {
    if (entry.date.getTime() <= date.getTime()) name = entry.name;
  }

  return name;
}

const SVG_NS = "http://www.w3.org/2000/svg";
const SNAP_DEGREES = 3;
const KEY_STEP_MINUTES = 10;

function fillHitRing(svg, centerX, centerY, radius) {
  const width = centerX * 2;
  const height = Math.ceil(width * 1.1);
  const outer = radius * 1.1;
  const inner = radius * 0.22;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("focusable", "false");
  Object.assign(svg.style, { inset: "auto", left: "0", top: "0", width: `${width}px`, height: `${height}px`, overflow: "visible" });

  let ring = svg.querySelector("[data-hit]");
  if (!ring) {
    ring = document.createElementNS(SVG_NS, "circle");
    ring.setAttribute("data-hit", "");
    ring.setAttribute("fill", "none");
    ring.setAttribute("stroke", "transparent");
    ring.style.pointerEvents = "stroke";
    ring.style.cursor = "grab";
    svg.append(ring);
  }

  ring.setAttribute("cx", String(centerX));
  ring.setAttribute("cy", String(centerY));
  ring.setAttribute("r", String((outer + inner) / 2));
  ring.setAttribute("stroke-width", String(outer - inner));
}

function buildHitRing(centerX, centerY, radius) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "astro-hit");
  svg.setAttribute("aria-hidden", "true");
  Object.assign(svg.style, { position: "absolute", pointerEvents: "none", zIndex: "6" });
  fillHitRing(svg, centerX, centerY, radius);
  return svg;
}

export function makeDraggable(instrument, options = {}) {
  const gsapRef = window.gsap;
  const DraggableRef = window.Draggable;
  const InertiaRef = window.InertiaPlugin;
  const { x: centerX, y: centerY, radius } = instrument.getCenter();
  const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const root = instrument.element;
  const canDrag = options.drag !== false;
  const snapMinutes = (SNAP_DEGREES * SIDEREAL_SECONDS_PER_DEGREE) / 60;

  const minutesOfDay = options.minutesOf || ((date) => date.getHours() * 60 + date.getMinutes());
  const formatTime = options.format || formatClock;

  const ownsSlider = !options.slider;
  const slider = options.slider || document.createElement("div");
  if (ownsSlider) {
    slider.className = "qalm-astrolabe-slider";
    Object.assign(slider.style, {
      position: "absolute",
      left: `${centerX - radius}px`,
      top: `${centerY - radius}px`,
      width: `${radius * 2}px`,
      height: `${radius * 2}px`,
      borderRadius: "50%",
      pointerEvents: "none",
      outline: "none",
      zIndex: "5",
    });
    root.appendChild(slider);
  }

  slider.tabIndex = 0;
  slider.setAttribute("role", "slider");
  if (!slider.hasAttribute("aria-label")) slider.setAttribute("aria-label", options.label || "Time of day");
  slider.setAttribute("aria-valuemin", "0");
  slider.setAttribute("aria-valuemax", "1439");

  const ownsHit = !options.hit;
  const hit = options.hit || buildHitRing(centerX, centerY, radius);
  if (ownsHit && canDrag) root.appendChild(hit);
  if (!ownsHit) fillHitRing(hit, centerX, centerY, radius);
  if (!ownsSlider) slider.style.pointerEvents = "none";

  const proxy = document.createElement("div");
  Object.assign(proxy.style, {
    position: "absolute",
    left: `${centerX - radius}px`,
    top: `${centerY - radius}px`,
    width: `${radius * 2}px`,
    height: `${radius * 2}px`,
    pointerEvents: "none",
    visibility: "hidden",
  });
  root.appendChild(proxy);

  function syncAria() {
    const date = instrument.getTime();
    const period = currentPeriodName(instrument.getPrayerList(), date);
    const clock = formatTime(date);
    slider.setAttribute("aria-valuenow", String(minutesOfDay(date)));
    slider.setAttribute("aria-valuetext", period ? `${period}, ${clock}` : clock);
  }

  function emit(date) {
    if (options.onTime) options.onTime(new Date(date.getTime()));
    else instrument.setTime(date);
    syncAria();
  }

  function stopCoast() {
    if (gsapRef) gsapRef.killTweensOf(proxy);
    options.onPress?.();
  }

  function prayerTargets() {
    return instrument
      .getPrayerList()
      .filter((entry) => entry.key !== "sunrise")
      .map((entry) => entry.date.getTime());
  }

  function shiftToPrayer(direction) {
    const now = instrument.getTime().getTime();
    const targets = prayerTargets().sort((first, second) => first - second);
    const next = direction > 0 ? targets.find((time) => time > now + 30000) : [...targets].reverse().find((time) => time < now - 30000);
    if (next !== undefined) emit(new Date(next));
  }

  function jumpTo(key) {
    const entry = instrument.getPrayerList().find((item) => item.key === key);
    if (entry) emit(new Date(entry.date.getTime()));
  }

  function onKeyDown(event) {
    const step = KEY_STEP_MINUTES * 60000;
    const now = instrument.getTime().getTime();
    let handled = true;

    stopCoast();

    switch (event.key) {
      case "ArrowRight":
      case "ArrowUp":
        emit(new Date(now + step));
        break;
      case "ArrowLeft":
      case "ArrowDown":
        emit(new Date(now - step));
        break;
      case "PageUp":
        shiftToPrayer(1);
        break;
      case "PageDown":
        shiftToPrayer(-1);
        break;
      case "Home":
        jumpTo("sunrise");
        break;
      case "End":
        jumpTo("maghrib");
        break;
      default:
        handled = false;
    }

    if (handled) event.preventDefault();
  }

  function onFocus() {
    const showsRing = ownsSlider && slider.matches(":focus-visible");
    if (showsRing) slider.style.boxShadow = "0 0 0 3px rgba(217,180,90,0.95), 0 0 0 5px rgba(14,19,17,0.9)";
  }

  function onBlur() {
    if (ownsSlider) slider.style.boxShadow = "none";
  }

  slider.addEventListener("keydown", onKeyDown);
  slider.addEventListener("focus", onFocus);
  slider.addEventListener("blur", onBlur);
  syncAria();

  let draggable = null;
  let fallbackCleanup = null;
  const drag = { startTime: 0, startRotation: 0 };

  function rotationToTime(rotation) {
    const hemisphere = instrument.getHemisphere();
    const seconds = hemisphere * (rotation - drag.startRotation) * SIDEREAL_SECONDS_PER_DEGREE;
    return drag.startTime + seconds * 1000;
  }

  function timeToRotation(time) {
    const hemisphere = instrument.getHemisphere();
    return drag.startRotation + (hemisphere * (time - drag.startTime)) / 1000 / SIDEREAL_SECONDS_PER_DEGREE;
  }

  function snapRotation(rotation) {
    const time = rotationToTime(rotation);
    let best = null;
    let bestGap = snapMinutes * 60000;

    for (const target of prayerTargets()) {
      const gap = Math.abs(target - time);
      if (gap < bestGap) {
        bestGap = gap;
        best = target;
      }
    }

    return best === null ? rotation : timeToRotation(best);
  }

  function updateFromProxy() {
    const rotation = gsapRef.getProperty(proxy, "rotation");
    emit(new Date(rotationToTime(rotation)));
  }

  function beginDrag() {
    stopCoast();
    drag.startTime = instrument.getTime().getTime();
    drag.startRotation = gsapRef ? gsapRef.getProperty(proxy, "rotation") : 0;
    slider.focus({ preventScroll: true });
  }

  function mountGsapDrag() {
    gsapRef.registerPlugin(DraggableRef);
    if (InertiaRef) gsapRef.registerPlugin(InertiaRef);

    const canCoast = Boolean(InertiaRef) && !reducedQuery.matches;
    draggable = DraggableRef.create(proxy, {
      type: "rotation",
      trigger: hit,
      inertia: canCoast,
      zIndexBoost: false,
      cursor: "grab",
      activeCursor: "grabbing",
      snap: { rotation: snapRotation },
      liveSnap: { rotation: snapRotation },
      onPress: beginDrag,
      onDrag: updateFromProxy,
      onThrowUpdate: updateFromProxy,
    });
  }

  function mountPointerDrag() {
    const pointer = { isDown: false, lastAngle: 0 };
    const angleOf = (event) => {
      const bounds = proxy.getBoundingClientRect();
      return Math.atan2(event.clientY - (bounds.top + bounds.height / 2), event.clientX - (bounds.left + bounds.width / 2)) / DEG;
    };

    const onDown = (event) => {
      pointer.isDown = true;
      pointer.lastAngle = angleOf(event);
      hit.setPointerCapture?.(event.pointerId);
      beginDrag();
    };
    const onMove = (event) => {
      if (!pointer.isDown) return;
      const angle = angleOf(event);
      const delta = normalize180(angle - pointer.lastAngle);
      pointer.lastAngle = angle;
      const hemisphere = instrument.getHemisphere();
      emit(new Date(instrument.getTime().getTime() + hemisphere * delta * SIDEREAL_SECONDS_PER_DEGREE * 1000));
    };
    const onUp = () => {
      pointer.isDown = false;
    };

    hit.style.cursor = "grab";
    hit.addEventListener("pointerdown", onDown);
    hit.addEventListener("pointermove", onMove);
    hit.addEventListener("pointerup", onUp);
    hit.addEventListener("pointercancel", onUp);

    fallbackCleanup = () => {
      hit.removeEventListener("pointerdown", onDown);
      hit.removeEventListener("pointermove", onMove);
      hit.removeEventListener("pointerup", onUp);
      hit.removeEventListener("pointercancel", onUp);
    };
  }

  function mountDrag() {
    draggable?.kill();
    draggable = null;
    fallbackCleanup?.();
    fallbackCleanup = null;
    if (!canDrag) return;

    if (gsapRef && DraggableRef) mountGsapDrag();
    else mountPointerDrag();
  }

  mountDrag();
  reducedQuery.addEventListener?.("change", mountDrag);

  return {
    slider,
    hit,
    sync: syncAria,
    destroy() {
      draggable?.kill();
      fallbackCleanup?.();
      reducedQuery.removeEventListener?.("change", mountDrag);
      slider.removeEventListener("keydown", onKeyDown);
      slider.removeEventListener("focus", onFocus);
      slider.removeEventListener("blur", onBlur);
      if (ownsSlider) slider.remove();
      if (ownsHit) hit.remove();
      proxy.remove();
    },
  };
}
