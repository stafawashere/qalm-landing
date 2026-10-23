export const DURATION = {
  press: 0.09,
  fast: 0.18,
  base: 0.32,
  view: 0.44,
  slow: 0.6,
  reveal: 1,
  scene: 1.4,
};

export const EASE = {
  out: "expo.out",
  inOut: "power3.inOut",
  in: "power3.in",
  none: "none",
};

export const SPRING = {
  stiffness: 170,
  damping: 26,
  underdamped: 18,
};

const CSS_EASE = {
  out: "cubic-bezier(0.16, 1, 0.3, 1)",
  inOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  in: "cubic-bezier(0.32, 0, 0.67, 0)",
};

export function publishTokens(root = document.documentElement) {
  for (const [name, seconds] of Object.entries(DURATION)) {
    root.style.setProperty(`--d-${name}`, `${Math.round(seconds * 1000)}ms`);
  }

  for (const [name, curve] of Object.entries(CSS_EASE)) {
    root.style.setProperty(`--e-${name}`, curve);
  }
}

export function isReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}
