// Shared reel choreography: a short pull-back, a fast launch, a long brake, a slow tile-by-tile crawl,
// an optional overshoot and a settle. Driven by requestAnimationFrame so the crawl and ticks are controllable.

export interface ReelMotionOptions {
  el: HTMLElement;
  axis: "x" | "y";
  /** final offset in px along the axis (negative: the strip moves towards the start) */
  distance: number;
  duration: number;
  delay?: number;
  /** anticipation: how far the strip moves backwards before launching (px) */
  pull?: number;
  /** how far past the target the strip travels before settling back (px, along the travel direction) */
  overshoot?: number;
  /** length of the slow final crawl before the target (px) */
  crawl?: number;
  onFrame?: (offset: number) => void;
  onDone?: () => void;
}

const easeOutSine = (k: number) => Math.sin((k * Math.PI) / 2);
const easeOutQuart = (k: number) => 1 - Math.pow(1 - k, 4);
const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOutSine = (k: number) => -(Math.cos(Math.PI * k) - 1) / 2;

// time shares of the four segments
const A = 0.07; // pull-back
const B = 0.6; // launch and brake
const C = 0.23; // crawl
// settle = remainder

export function reelPosition(k: number, D: number, pull: number, crawl: number, overshoot: number): number {
  const sign = D < 0 ? -1 : 1;
  const mag = Math.abs(D);
  const crawlLen = Math.min(crawl, mag * 0.3);
  if (k < A) return -sign * pull * easeOutSine(k / A);
  if (k < A + B) {
    const t = (k - A) / B;
    const from = -sign * pull;
    const to = sign * (mag - crawlLen);
    return from + (to - from) * easeOutQuart(t);
  }
  if (k < A + B + C) {
    const t = (k - A - B) / C;
    const from = sign * (mag - crawlLen);
    const to = sign * (mag + overshoot);
    return from + (to - from) * easeOutCubic(t);
  }
  const t = (k - A - B - C) / (1 - A - B - C);
  const from = sign * (mag + overshoot);
  const to = sign * mag;
  return from + (to - from) * easeInOutSine(Math.min(1, t));
}

export function animateReel(o: ReelMotionOptions): () => void {
  const { el, axis, distance, duration } = o;
  const pull = o.pull ?? 0;
  const overshoot = o.overshoot ?? 0;
  const crawl = o.crawl ?? 0;
  const set = (v: number) => {
    el.style.transition = "none";
    el.style.transform = axis === "x" ? `translateX(${v}px)` : `translateY(${v}px)`;
    o.onFrame?.(v);
  };
  const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let raf = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    set(distance);
    o.onDone?.();
  };
  const start = () => {
    if (reduce || duration <= 0) {
      finish();
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      set(reelPosition(k, distance, pull, crawl, overshoot));
      if (k < 1) raf = requestAnimationFrame(step);
      else finish();
    };
    set(0);
    raf = requestAnimationFrame(step);
  };
  if (o.delay && o.delay > 0) timer = setTimeout(start, o.delay);
  else start();
  return () => {
    if (timer) clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
  };
}

/** Index of the tile under a pointer at `pointer` (px from the strip start) given tile step size. */
export function tileAt(pointer: number, step: number): number {
  return Math.floor(pointer / step);
}
