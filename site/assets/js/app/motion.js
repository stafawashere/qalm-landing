const query = matchMedia("(prefers-reduced-motion: reduce)");

export function isReduced() {
  return query.matches;
}

export function animateFrom(target, from, to) {
  const { gsap } = window;
  const canAnimate = gsap && !isReduced();
  if (!canAnimate) return null;

  gsap.killTweensOf(target);
  return gsap.fromTo(target, from, { ...to, overwrite: "auto" });
}

export function animateTo(target, to) {
  const { gsap } = window;
  const canAnimate = gsap && !isReduced();

  if (!canAnimate) {
    const { onComplete } = to;
    if (onComplete) onComplete();
    return null;
  }

  return gsap.to(target, { ...to, overwrite: "auto" });
}

export function clearMotion(target) {
  const { gsap } = window;
  if (gsap) {
    gsap.killTweensOf(target);
    gsap.set(target, { clearProps: "all" });
  }
}
