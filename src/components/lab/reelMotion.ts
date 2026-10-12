// Shared reel motion: one smooth deceleration from launch to stop, driven by requestAnimationFrame so the
// final tiles creep past the pointer. No pull-back and no bounce: the reel simply slows down and stops.

export interface ReelMotionOptions {
  el: HTMLElement;
  axis: "x" | "y";
  /** final offset in px along the axis (negative: the strip moves towards the start) */
  distance: number;
  duration: number;
  delay?: number;
  /** deceleration shape: 2 = brisk stop, 2.4 = the last second creeps over about one tile, 3 = very long tail */
  tail?: number;
  onFrame?: (offset: number) => void;
  onDone?: () => void;
}

export function reelPosition(k: number, D: number, tail = 2.4): number {
  return D * (1 - Math.pow(1 - Math.min(1, Math.max(0, k)), tail));
}

export function animateReel(o: ReelMotionOptions): () => void {
  const { el, axis, distance, duration } = o;
  const tail = o.tail ?? 2.4;
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
      set(reelPosition(k, distance, tail));
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

/** Index of the tile under a pointer at `pointer` (px from the strip start) given the tile step size. */
export function tileAt(pointer: number, step: number): number {
  return Math.floor(pointer / step);
}
