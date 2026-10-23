const DPR_CAP = 1;
const DEFAULT_FPS = 30;
const SCALE_STEPS = [1, 0.8, 0.6, 0.45];
const START_SCALE = 0.8;
const START_SCALE_PHONE = 0.6;
const RESIZE_DEBOUNCE_MS = 150;
const SLOW_FRAME_MS = 24;
const FAST_FRAME_MS = 18;
const SAMPLE_FRAMES = 12;
const WARMUP_FRAMES = 36;
const CALM_WINDOWS_TO_RESTORE = 8;
const DEFAULT_GRAIN = 0.03;
const INK_LUMINANCE_THRESHOLD = 0.2;
const INK_HYSTERESIS = 0.025;
const SMOOTHING_RATE = 7;

// Altitude keyed stops, sRGB hex. Derived toward the brand tokens: paper, sage, gold, ink green, night.
const SKY_STOPS = [
  { altitude: -18, top: "#090D0B", horizon: "#121916", glow: "#1F3D32", glowAmount: 0.1 },
  { altitude: -12, top: "#0E1311", horizon: "#1B2B25", glow: "#2F6652", glowAmount: 0.45 },
  { altitude: -6, top: "#16261F", horizon: "#4B6350", glow: "#B8964A", glowAmount: 0.8 },
  { altitude: -1.5, top: "#3A584A", horizon: "#B8BF9A", glow: "#E2BC62", glowAmount: 1 },
  { altitude: 4, top: "#9BB19D", horizon: "#E7DDB4", glow: "#F0CF7A", glowAmount: 0.85 },
  { altitude: 12, top: "#C2D1BE", horizon: "#F4E9CA", glow: "#F3DC98", glowAmount: 0.6 },
  { altitude: 30, top: "#D3DFCE", horizon: "#F7F1E1", glow: "#F6E8BC", glowAmount: 0.42 },
  { altitude: 90, top: "#DAE5D4", horizon: "#FAF8F3", glow: "#F8EFD0", glowAmount: 0.3 },
];

const RAYLEIGH_OPTICAL_DEPTH = [0.041, 0.097, 0.243];

const VERTEX_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SOURCE = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_top;
uniform vec3 u_horizon;
uniform vec3 u_glow;
uniform vec3 u_sunColor;
uniform vec4 u_sun;
uniform vec4 u_misc;
uniform vec2 u_pointer;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

float valueNoise(vec2 p) {
  vec2 cell = floor(p);
  vec2 local = fract(p);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash12(cell);
  float b = hash12(cell + vec2(1.0, 0.0));
  float c = hash12(cell + vec2(0.0, 1.0));
  float d = hash12(cell + vec2(1.0, 1.0));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float haze(vec2 p) {
  float total = 0.0;
  float weight = 0.5;
  for (int i = 0; i < 4; i++) {
    total += weight * valueNoise(p);
    p = p * 2.03 + vec2(11.7, 3.1);
    weight *= 0.5;
  }
  return total;
}

// One cell hashed star field. Cell units per pixel keep the points about a pixel wide at any render scale.
float starLayer(vec2 p, float cells, float threshold, float seed) {
  vec2 grid = p * cells;
  vec2 id = floor(grid);
  vec2 local = fract(grid) - 0.5;
  float chance = hash12(id + seed);
  if (chance < threshold) return 0.0;

  vec2 offset = (hash22(id + seed + 17.0) - 0.5) * 0.7;
  float dist = length(local - offset);
  float pixelInCells = cells / u_resolution.y;
  float radius = pixelInCells * (0.8 + 1.5 * fract(chance * 37.0));
  float core = 1.0 - smoothstep(0.0, radius, dist);

  float rate = 0.35 + fract(chance * 91.0) * 0.8;
  float twinkle = 0.8 + 0.2 * sin(u_time * rate + chance * 60.0);
  float magnitude = 0.3 + 0.7 * pow(fract(chance * 13.7), 2.0);
  return core * twinkle * magnitude;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  float progress = u_misc.w;

  vec2 skyUv = uv + u_pointer * vec2(0.006, 0.004);
  float horizonY = 0.3 - progress * 0.05;
  float height = skyUv.y - horizonY;

  // Sky gradient above the horizon, soft mist below it
  float climb = clamp(max(height, 0.0) / (1.0 - horizonY), 0.0, 1.0);
  vec3 col = mix(u_horizon, u_top, smoothstep(0.0, 1.0, pow(climb, 0.62)));
  vec3 mist = mix(u_horizon, u_top, 0.16) * 0.965;
  float depth = clamp(-height / horizonY, 0.0, 1.0);
  mist = mix(mist, mist * 0.9, depth);
  col = mix(col, mist, smoothstep(0.0, 0.12, -height));

  // Glow centred on the sun, which may sit below the horizon
  vec2 sunPos = vec2(u_sun.x, horizonY + u_sun.y);
  vec2 delta = vec2((skyUv.x - sunPos.x) * aspect, skyUv.y - sunPos.y);
  float dist = length(delta);
  float glowAmount = u_sun.w;

  float radial = exp(-dist * 2.6) * 0.3 + exp(-dist * 8.0) * 0.4 + exp(-dist * 28.0) * 0.2;
  float bandHeight = exp(-abs(height) * 13.0);
  float bandSpread = exp(-delta.x * delta.x * 1.1);
  float band = bandHeight * bandSpread;
  float glowWeight = clamp((band * 0.7 + radial * 0.55) * glowAmount, 0.0, 0.92);
  col = mix(col, u_glow, glowWeight);

  // Slow haze streaks hugging the horizon
  vec2 hazeUv = vec2(skyUv.x * aspect * 0.8 + u_time * 0.004 + u_pointer.x * 0.02, skyUv.y * 6.0);
  float hazeMask = exp(-pow((height - 0.06) * 5.0, 2.0));
  col *= 1.0 + (haze(hazeUv) - 0.5) * 0.08 * hazeMask;

  // Sun disc, emerging from the mist
  float radius = 0.027;
  float disc = 1.0 - smoothstep(radius * 0.55, radius, dist);
  float corona = exp(-dist * 38.0);
  float emerge = smoothstep(-0.01, 0.02, height);
  vec3 discColor = mix(u_sunColor, vec3(1.0, 0.985, 0.93), 0.45);
  col = mix(col, discColor, disc * u_sun.z * emerge * 0.96);
  col += u_sunColor * corona * u_sun.z * emerge * 0.14;

  // Stars, only in clear sky away from the glow
  float starFade = u_misc.x;
  if (starFade > 0.001) {
    vec2 starUv = vec2(skyUv.x * aspect, skyUv.y) + u_pointer * 0.01;
    vec2 pivot = vec2(aspect * 0.5, -0.2);
    float angle = progress * 0.3;
    vec2 rel = starUv - pivot;
    rel = vec2(rel.x * cos(angle) - rel.y * sin(angle), rel.x * sin(angle) + rel.y * cos(angle));
    starUv = rel + pivot;

    float field = starLayer(starUv, 46.0, 0.935, 0.0) + 0.7 * starLayer(starUv, 88.0, 0.965, 5.0);
    float skyMask = smoothstep(horizonY + 0.02, horizonY + 0.32, skyUv.y);
    float clearSky = 1.0 - clamp(radial * glowAmount * 1.4, 0.0, 0.85);
    vec3 starColor = mix(vec3(0.84, 0.95, 0.9), vec3(1.0, 0.9, 0.68), step(0.5, hash12(floor(starUv * 46.0) + 3.0)));
    col += starColor * field * starFade * skyMask * clearSky;
  }

  // Vignette
  vec2 edge = (uv - 0.5) * vec2(aspect * 0.75, 1.0);
  col *= 1.0 - 0.13 * smoothstep(0.35, 1.05, length(edge));

  // Film grain, one fine noise sample per pixel
  vec2 jitter = vec2(fract(u_time * 7.13), fract(u_time * 3.71)) * 173.0;
  col += (hash12(frag + jitter) - 0.5) * u_misc.y;

  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => channel / 255);
}

function srgbToLinear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel) {
  const clamped = Math.min(Math.max(channel, 0), 1);
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
}

function rgbToOklab(rgb) {
  const [red, green, blue] = rgb.map(srgbToLinear);
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);

  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ];
}

function oklabToRgb(lab) {
  const [lightness, a, b] = lab;
  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ].map(linearToSrgb);
}

function mixLab(from, to, amount) {
  return from.map((value, index) => value + (to[index] - value) * amount);
}

function relativeLuminance(rgb) {
  const [red, green, blue] = rgb.map(srgbToLinear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

const PREPARED_STOPS = SKY_STOPS.map((stop) => ({
  altitude: stop.altitude,
  top: rgbToOklab(hexToRgb(stop.top)),
  horizon: rgbToOklab(hexToRgb(stop.horizon)),
  glow: rgbToOklab(hexToRgb(stop.glow)),
  glowAmount: stop.glowAmount,
}));

function clamp(value, low, high) {
  return Math.min(Math.max(value, low), high);
}

function smoothstep(edgeLow, edgeHigh, value) {
  const amount = clamp((value - edgeLow) / (edgeHigh - edgeLow), 0, 1);
  return amount * amount * (3 - 2 * amount);
}

export function skyColorsAt(altitudeDeg) {
  const lowest = PREPARED_STOPS[0];
  const highest = PREPARED_STOPS[PREPARED_STOPS.length - 1];
  const altitude = clamp(altitudeDeg, lowest.altitude, highest.altitude);

  let upperIndex = PREPARED_STOPS.findIndex((stop) => stop.altitude >= altitude);
  if (upperIndex <= 0) upperIndex = 1;

  const lower = PREPARED_STOPS[upperIndex - 1];
  const upper = PREPARED_STOPS[upperIndex];
  const span = upper.altitude - lower.altitude;
  const amount = smoothstep(0, 1, (altitude - lower.altitude) / span);

  const top = oklabToRgb(mixLab(lower.top, upper.top, amount));
  const horizon = oklabToRgb(mixLab(lower.horizon, upper.horizon, amount));
  const glow = oklabToRgb(mixLab(lower.glow, upper.glow, amount));
  const glowAmount = lower.glowAmount + (upper.glowAmount - lower.glowAmount) * amount;
  const stars = clamp((-6 - altitudeDeg) / 7, 0, 1);

  return { top, horizon, glow, glowAmount, stars };
}

function textBackdropLuminance(colors) {
  const weightedTop = colors.top.map((channel, index) => channel * 0.7 + colors.horizon[index] * 0.3);
  return relativeLuminance(weightedTop);
}

function sunColorAt(altitudeDeg) {
  const altitude = Math.max(altitudeDeg, 0.3);
  const radians = (altitude * Math.PI) / 180;
  const airMass = 1 / (Math.sin(radians) + 0.50572 * (altitude + 6.07995) ** -1.6364);
  const transmittance = RAYLEIGH_OPTICAL_DEPTH.map((depth) => Math.exp(-depth * airMass * 0.25));
  const brightest = Math.max(...transmittance);
  const warm = transmittance.map((value) => value / brightest);
  const base = [1, 0.96, 0.82];

  return base.map((channel, index) => clamp(channel * warm[index], 0, 1));
}

function sunScreenPosition(altitudeDeg, azimuthDeg) {
  const sideways = clamp(azimuthDeg / 100, -1.2, 1.2);
  const x = 0.5 + 0.5 * sideways * 0.86;

  const isAboveHorizon = altitudeDeg >= 0;
  const aboveHorizonOffset = 0.62 * (Math.min(altitudeDeg, 80) / 80) ** 0.8;
  const belowHorizonOffset = altitudeDeg * 0.012;
  const y = isAboveHorizon ? aboveHorizonOffset : belowHorizonOffset;

  return { x, y };
}

function toCssColor(rgb) {
  const [red, green, blue] = rgb.map((channel) => Math.round(clamp(channel, 0, 1) * 255));
  return `rgb(${red}, ${green}, ${blue})`;
}

function flatColorFor(altitudeDeg) {
  const colors = skyColorsAt(altitudeDeg);
  const mid = colors.top.map((channel, index) => (channel + colors.horizon[index]) / 2);
  return toCssColor(mid);
}

export function createSky(canvas, opts = {}) {
  const phoneQuery = window.matchMedia("(max-width: 768px)");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const definedOptions = Object.fromEntries(Object.entries(opts).filter(([, value]) => value !== undefined));
  const settings = {
    renderScale: phoneQuery.matches ? START_SCALE_PHONE : START_SCALE,
    maxFps: DEFAULT_FPS,
    grain: DEFAULT_GRAIN,
    parallax: 1,
    onInkChange: null,
    ...definedOptions,
  };

  const target = { altitude: 20, azimuth: 0, progress: 0, pointerX: 0, pointerY: 0 };
  const current = { ...target };

  let gl = null;
  let program = null;
  let buffer = null;
  let locations = {};
  let animationFrame = 0;
  let lastFrameTime = 0;
  let sizeDirty = true;
  let needsRender = true;
  let isOnScreen = true;
  let isContextLost = false;
  let isFallback = false;
  let isDestroyed = false;
  let isProgramReady = false;
  let wantsSnap = false;
  const pace = { level: 0, gapSum: 0, gapCount: 0, calm: 0, lastAt: 0, seen: 0, hasRestored: false, canRestore: true };
  pace.level = SCALE_STEPS.reduce((best, step, index) => (Math.abs(step - settings.renderScale) < Math.abs(SCALE_STEPS[best] - settings.renderScale) ? index : best), 0);
  const cssSize = { width: Math.max(1, canvas.clientWidth), height: Math.max(1, canvas.clientHeight) };
  let resizeTimer = 0;
  let ink = "ink";
  const startTime = performance.now();

  const frameInterval = 1000 / settings.maxFps;
  const isReducedMotion = () => reducedMotionQuery.matches;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    return shader;
  }

  function finishBuild() {
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!linked) throw new Error(gl.getProgramInfoLog(program));

    gl.useProgram(program);

    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const names = ["u_resolution", "u_time", "u_top", "u_horizon", "u_glow", "u_sunColor", "u_sun", "u_misc", "u_pointer"];
    locations = Object.fromEntries(names.map((name) => [name, gl.getUniformLocation(program, name)]));
    sizeDirty = true;
    isProgramReady = true;
  }

  function awaitLink(parallel) {
    const isDone = gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR);
    if (isDone) {
      try {
        finishBuild();
        needsRender = true;
        if (wantsSnap) snapAndRender();
        refreshRunState();
        if (!shouldLoop()) requestRender();
      } catch {
        gl = null;
        enterFallback();
      }
      return;
    }

    if (!isDestroyed && !isContextLost) setTimeout(() => awaitLink(parallel), 16);
  }

  function build() {
    isProgramReady = false;
    program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SOURCE));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SOURCE));
    gl.linkProgram(program);

    const parallel = gl.getExtension("KHR_parallel_shader_compile");
    if (parallel) {
      awaitLink(parallel);
      return;
    }

    finishBuild();
  }

  function enterFallback() {
    isFallback = true;
    canvas.parentElement?.classList.add("no-webgl");
    canvas.style.display = "none";
    applyFallbackFill();
  }

  function applyFallbackFill() {
    const parent = canvas.parentElement;
    if (!parent) return;
    parent.style.backgroundColor = flatColorFor(target.altitude);
  }

  function applySize() {
    const pixelRatio = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    const scale = pixelRatio * settings.renderScale;
    const width = Math.max(1, Math.round(cssSize.width * scale));
    const height = Math.max(1, Math.round(cssSize.height * scale));

    const hasChanged = canvas.width !== width || canvas.height !== height;
    sizeDirty = false;
    if (hasChanged) {
      canvas.width = width;
      canvas.height = height;
    }

    gl.viewport(0, 0, width, height);
  }

  function updateInk() {
    const luminance = textBackdropLuminance(skyColorsAt(target.altitude));
    const wasInk = ink === "ink";
    const margin = wasInk ? -INK_HYSTERESIS : INK_HYSTERESIS;
    const nextInk = luminance > INK_LUMINANCE_THRESHOLD + margin ? "ink" : "paper";

    if (nextInk === ink) return;

    ink = nextInk;
    settings.onInkChange?.(ink);
  }

  function ease(deltaSeconds) {
    const blend = 1 - Math.exp(-SMOOTHING_RATE * deltaSeconds);
    const keys = ["altitude", "azimuth", "progress", "pointerX", "pointerY"];
    let isSettled = true;

    keys.forEach((key) => {
      const gap = target[key] - current[key];
      const isClose = Math.abs(gap) < 0.0005;

      if (isClose) {
        current[key] = target[key];
        return;
      }

      current[key] += gap * blend;
      isSettled = false;
    });

    return isSettled;
  }

  function render(nowMs) {
    if (!isProgramReady) return;
    if (sizeDirty) applySize();

    const colors = skyColorsAt(current.altitude);
    const sunPosition = sunScreenPosition(current.altitude, current.azimuth);
    const discStrength = smoothstep(-0.8, 0.6, current.altitude);
    const sunColor = sunColorAt(current.altitude);
    const seconds = isReducedMotion() ? 0 : (nowMs - startTime) / 1000;
    const parallax = isReducedMotion() ? 0 : settings.parallax;

    gl.uniform2f(locations.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(locations.u_time, seconds);
    gl.uniform3fv(locations.u_top, colors.top);
    gl.uniform3fv(locations.u_horizon, colors.horizon);
    gl.uniform3fv(locations.u_glow, colors.glow);
    gl.uniform3fv(locations.u_sunColor, sunColor);
    gl.uniform4f(locations.u_sun, sunPosition.x, sunPosition.y, discStrength, colors.glowAmount);
    gl.uniform4f(locations.u_misc, colors.stars, settings.grain, 0, current.progress);
    gl.uniform2f(locations.u_pointer, current.pointerX * parallax, current.pointerY * parallax);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    needsRender = false;
  }

  function canDraw() {
    const hasContext = !isFallback && !isContextLost && !isDestroyed && isProgramReady;
    const isVisible = isOnScreen && !document.hidden;
    return hasContext && isVisible;
  }

  function shouldLoop() {
    return canDraw() && !isReducedMotion();
  }

  function setPaceLevel(level) {
    pace.level = level;
    settings.renderScale = SCALE_STEPS[level];
    sizeDirty = true;
    needsRender = true;
  }

  function adaptRenderScale(now) {
    const gap = now - pace.lastAt;
    pace.lastAt = now;
    pace.seen += 1;

    const isUsable = gap > 4 && gap < 120 && pace.seen > WARMUP_FRAMES;
    if (!isUsable) return;

    pace.gapSum += gap;
    pace.gapCount += 1;
    if (pace.gapCount < SAMPLE_FRAMES) return;

    const average = pace.gapSum / pace.gapCount;
    pace.gapSum = 0;
    pace.gapCount = 0;

    const isSlow = average > SLOW_FRAME_MS;
    const isFast = average < FAST_FRAME_MS;
    const canStepDown = pace.level < SCALE_STEPS.length - 1;

    if (isSlow && canStepDown) {
      if (pace.hasRestored) pace.canRestore = false;
      pace.calm = 0;
      setPaceLevel(pace.level + 1);
      return;
    }

    pace.calm = isFast ? pace.calm + 1 : 0;
    const shouldRestore = pace.calm >= CALM_WINDOWS_TO_RESTORE && pace.level > 0 && pace.canRestore;
    if (!shouldRestore) return;

    pace.calm = 0;
    pace.hasRestored = true;
    setPaceLevel(pace.level - 1);
  }

  function frame(now) {
    animationFrame = 0;
    if (!shouldLoop()) return;

    animationFrame = requestAnimationFrame(frame);
    adaptRenderScale(now);

    const elapsed = now - lastFrameTime;
    const isTooSoon = elapsed < frameInterval - 2;
    if (isTooSoon) return;

    lastFrameTime = now;
    ease(Math.min(elapsed, 100) / 1000);
    render(now);
  }

  function startLoop() {
    const isRunning = animationFrame !== 0;
    if (isRunning || !shouldLoop()) return;

    lastFrameTime = 0;
    pace.lastAt = 0;
    animationFrame = requestAnimationFrame(frame);
  }

  function stopLoop() {
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
  }

  function snapAndRender() {
    Object.assign(current, target);
    render(performance.now());
  }

  function requestRender() {
    needsRender = true;
    if (!canDraw()) return;

    if (isReducedMotion()) {
      snapAndRender();
      return;
    }

    startLoop();
  }

  function refreshRunState() {
    if (shouldLoop()) {
      startLoop();
      return;
    }

    stopLoop();

    const shouldPaintStill = canDraw() && isReducedMotion() && needsRender;
    if (shouldPaintStill) snapAndRender();
  }

  function onContextLost(event) {
    event.preventDefault();
    isContextLost = true;
    stopLoop();
  }

  function onContextRestored() {
    isContextLost = false;
    build();
    needsRender = true;
    refreshRunState();
    if (!shouldLoop()) requestRender();
  }

  function onResizeObserved(entries) {
    const box = entries[entries.length - 1]?.contentRect;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const width = Math.max(1, Math.round(box ? box.width : canvas.clientWidth));
      const height = Math.max(1, Math.round(box ? box.height : canvas.clientHeight));
      const isSame = width === Math.round(cssSize.width) && height === Math.round(cssSize.height);
      if (isSame) return;

      cssSize.width = width;
      cssSize.height = height;
      sizeDirty = true;
      if (isReducedMotion()) requestRender();
    }, RESIZE_DEBOUNCE_MS);
  }

  function onMotionPreferenceChange() {
    needsRender = true;
    refreshRunState();
  }

  function onVisibilityChange() {
    refreshRunState();
  }

  try {
    gl = canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) throw new Error("WebGL unavailable");
    build();
  } catch (error) {
    gl = null;
    enterFallback();
  }

  const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(onResizeObserved);
  const intersectionObserver = typeof IntersectionObserver === "undefined"
    ? null
    : new IntersectionObserver((entries) => {
      isOnScreen = entries[entries.length - 1].isIntersecting;
      refreshRunState();
    });

  resizeObserver?.observe(canvas);
  intersectionObserver?.observe(canvas);
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);
  document.addEventListener("visibilitychange", onVisibilityChange);
  reducedMotionQuery.addEventListener?.("change", onMotionPreferenceChange);

  updateInk();
  requestRender();

  return {
    snap() {
      wantsSnap = true;
      if (gl && !isFallback && isProgramReady) snapAndRender();
    },

    setSun(altitudeDeg, azimuthDeg) {
      target.altitude = altitudeDeg;
      target.azimuth = azimuthDeg;
      updateInk();

      if (isFallback) {
        applyFallbackFill();
        return;
      }

      requestRender();
    },

    setProgress(progress) {
      target.progress = clamp(progress, 0, 1);
      requestRender();
    },

    setPointer(x, y) {
      target.pointerX = clamp(x, 0, 1) * 2 - 1;
      target.pointerY = clamp(y, 0, 1) * 2 - 1;
      if (!isReducedMotion()) requestRender();
    },

    resize() {
      cssSize.width = Math.max(1, canvas.clientWidth);
      cssSize.height = Math.max(1, canvas.clientHeight);
      sizeDirty = true;
      requestRender();
    },

    inkOnSky() {
      return ink;
    },

    flatColor() {
      return flatColorFor(target.altitude);
    },

    destroy() {
      isDestroyed = true;
      clearTimeout(resizeTimer);
      stopLoop();
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      reducedMotionQuery.removeEventListener?.("change", onMotionPreferenceChange);

      if (gl && !isContextLost) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
      }
    },
  };
}
