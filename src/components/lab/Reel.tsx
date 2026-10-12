"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/engine/types";
import { ItemTile } from "../ItemTile";

export interface ReelPoolEntry {
  item: CatalogItem;
  weight: number;
}

const TILE = 84;
const GAP = 8;
const STEP = TILE + GAP;
const LEN = 56;
const WIN = 48;

/** The strip is decoration, as on real sites: rare items are over-represented and the result was fixed before the spin. */
function buildStrip(pool: ReelPoolEntry[], winner: CatalogItem): CatalogItem[] {
  const w = pool.map((p) => Math.sqrt(Math.max(1, p.weight)));
  const sum = w.reduce((a, b) => a + b, 0);
  const pick = () => {
    let u = Math.random() * sum;
    for (let i = 0; i < pool.length; i++) {
      u -= w[i];
      if (u <= 0) return pool[i].item;
    }
    return pool[pool.length - 1].item;
  };
  const strip = Array.from({ length: LEN }, pick);
  strip[WIN] = winner;
  return strip;
}

export function Reel({ pool, winner, spinId, onDone, fast = false }: { pool: ReelPoolEntry[]; winner: CatalogItem | null; spinId: number; onDone?: () => void; fast?: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [strip, setStrip] = useState<CatalogItem[]>(() => (pool.length ? Array.from({ length: LEN }, (_, i) => pool[i % pool.length].item) : []));
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    if (spinId === 0 || !winner || !pool.length) return;
    setStrip(buildStrip(pool, winner));
    setSpin(spinId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);

  useLayoutEffect(() => {
    if (!spin) return;
    const el = trackRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const width = wrap.clientWidth;
    const jitter = (Math.random() - 0.5) * TILE * 0.6;
    const target = -(WIN * STEP + TILE / 2 - width / 2) + jitter;
    let fired = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (fired) return;
      fired = true;
      if (fallback) clearTimeout(fallback);
      onDoneRef.current?.();
    };
    el.style.transition = "none";
    el.style.transform = "translateX(0px)";
    void el.offsetWidth;
    if (reduce || fast) {
      el.style.transform = `translateX(${target}px)`;
      fallback = setTimeout(done, 60);
      return () => clearTimeout(fallback);
    }
    // a long run-up, a slow brake and a hair of overshoot, like the sites do
    el.style.transition = "transform 4.4s cubic-bezier(0.08, 0.8, 0.15, 1.02)";
    el.style.transform = `translateX(${target}px)`;
    el.addEventListener("transitionend", done, { once: true });
    fallback = setTimeout(done, 5000);
    return () => {
      el.removeEventListener("transitionend", done);
      if (fallback) clearTimeout(fallback);
    };
  }, [spin, fast]);

  return (
    <div ref={wrapRef} className="reel-mask relative h-[112px] overflow-hidden rounded-xl border border-line bg-paper">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-accent" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-accent" />
      <div ref={trackRef} className="absolute left-0 top-0 flex h-full items-center will-change-transform" style={{ gap: GAP }}>
        {strip.map((it, i) => (
          <div key={i} style={{ width: TILE }} className="flex shrink-0 justify-center">
            <ItemTile item={it} size={TILE - 12} />
          </div>
        ))}
      </div>
    </div>
  );
}
