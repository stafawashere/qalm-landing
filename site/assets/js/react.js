import { spring } from "./spring.js";
import { DURATION, EASE } from "./tokens.js";

const finePointer = matchMedia("(pointer: fine)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export function canReact() {
  return Boolean(window.gsap) && finePointer.matches && !reducedMotion.matches;
}

function relativePoint(event, node) {
  const box = node.getBoundingClientRect();
  return {
    across: (event.clientX - box.left) / box.width - 0.5,
    down: (event.clientY - box.top) / box.height - 0.5,
  };
}

export function setupTilt(root = document) {
  if (!canReact()) return;
  const { gsap } = window;

  for (const node of root.querySelectorAll("[data-tilt]")) {
    const strength = Number(node.dataset.tilt) || 9;
    const settle = { duration: 0.7, ease: "power3.out" };
    const turnAcross = gsap.quickTo(node, "rotationY", settle);
    const turnDown = gsap.quickTo(node, "rotationX", settle);
    const lift = gsap.quickTo(node, "scale", settle);

    gsap.set(node, { transformPerspective: 1000 });

    node.addEventListener("pointermove", (event) => {
      const { across, down } = relativePoint(event, node);
      turnAcross(across * strength * 2);
      turnDown(down * strength * -2);
      lift(1 + strength / 600);
    });

    node.addEventListener("pointerleave", () => {
      turnAcross(0);
      turnDown(0);
      lift(1);
    });
  }
}

export function setupLoupes(root = document) {
  if (!canReact()) return;
  const { gsap } = window;

  for (const lens of root.querySelectorAll("[data-loupe]")) {
    const picture = lens.querySelector("img");
    const glide = { duration: 0.9, ease: "power3.out" };
    const zoom = gsap.quickTo(picture, "scale", glide);
    const panAcross = gsap.quickTo(picture, "xPercent", glide);
    const panDown = gsap.quickTo(picture, "yPercent", glide);

    lens.addEventListener("pointermove", (event) => {
      const { across, down } = relativePoint(event, lens);
      zoom(1.7);
      panAcross(across * -22);
      panDown(down * -22);
    });

    lens.addEventListener("pointerleave", () => {
      zoom(1);
      panAcross(0);
      panDown(0);
    });
  }
}

export function setupMagnetic(root = document) {
  if (!canReact()) return;
  const { gsap } = window;

  for (const node of root.querySelectorAll("[data-magnetic]")) {
    const follow = { duration: 0.5, ease: "power3.out" };
    const moveX = gsap.quickTo(node, "x", follow);
    const moveY = gsap.quickTo(node, "y", follow);
    const settleX = spring((value) => gsap.set(node, { x: value }), { stiffness: 190, damping: 17 });
    const settleY = spring((value) => gsap.set(node, { y: value }), { stiffness: 190, damping: 17 });
    let isFollowing = false;

    node.addEventListener("pointermove", (event) => {
      const { across, down } = relativePoint(event, node);
      isFollowing = true;
      settleX.stop();
      settleY.stop();
      moveX(across * Math.min(node.offsetWidth * 0.18, 18));
      moveY(down * 12);
    });

    node.addEventListener("pointerleave", () => {
      if (!isFollowing) return;
      isFollowing = false;
      const x = gsap.getProperty(node, "x");
      const y = gsap.getProperty(node, "y");
      gsap.killTweensOf(node, "x,y");
      settleX.set(x);
      settleY.set(y);
      settleX.to(0);
      settleY.to(0);
    });

    node.addEventListener("pointerdown", () => gsap.to(node, { scale: 0.96, duration: DURATION.press, ease: EASE.out, overwrite: "auto" }));
    node.addEventListener("pointerup", () => gsap.to(node, { scale: 1, duration: DURATION.slow, ease: EASE.out, overwrite: "auto" }));
  }
}

export function setupLift(selector, root = document) {
  if (!canReact()) return;
  const { gsap } = window;

  for (const node of root.querySelectorAll(selector)) {
    node.addEventListener("pointerenter", () => gsap.to(node, { y: -5, duration: DURATION.base, ease: EASE.out, overwrite: "auto" }));
    node.addEventListener("pointerleave", () => gsap.to(node, { y: 0, duration: DURATION.slow, ease: EASE.out, overwrite: "auto" }));
  }
}

export function setupHeroPointer({ hero, astrolabe, sky, rig }) {
  if (!canReact() || !rig || !hero) return;

  let isVisible = true;
  new IntersectionObserver((entries) => {
    isVisible = entries.some((entry) => entry.isIntersecting);
  }).observe(hero);

  rig.onFrame((x, y) => {
    sky?.setPointer(x + 0.5, y + 0.5);
    if (!isVisible) return;
    astrolabe?.setTilt(x * 1.6, y * 1.6);
  });
}
