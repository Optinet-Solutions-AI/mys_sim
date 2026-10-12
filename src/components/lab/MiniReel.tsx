"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/engine/types";
import { ItemTile } from "../ItemTile";
import type { ReelPoolEntry } from "./Reel";

const TILE = 44;
const GAP = 6;
const STEP = TILE + GAP;
const LEN = 36;
const WIN = 30;
const VIEW = 104;

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

/** A small vertical reel for one seat in a battle. It starts spinning when mounted and lands on `winner`. */
export function MiniReel({ pool, winner, delay = 0, duration = 2400, onDone }: { pool: ReelPoolEntry[]; winner: CatalogItem; delay?: number; duration?: number; onDone?: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [strip] = useState(() => buildStrip(pool.length ? pool : [{ item: winner, weight: 1 }], winner));

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = -(WIN * STEP + TILE / 2 - VIEW / 2) + (Math.random() - 0.5) * TILE * 0.5;
    let fired = false;
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const done = () => {
      if (fired) return;
      fired = true;
      if (fallback) clearTimeout(fallback);
      onDoneRef.current?.();
    };
    el.style.transition = "none";
    el.style.transform = "translateY(0px)";
    void el.offsetHeight;
    if (reduce) {
      el.style.transform = `translateY(${target}px)`;
      fallback = setTimeout(done, 60 + delay);
      return () => {
        if (fallback) clearTimeout(fallback);
      };
    }
    el.style.transition = `transform ${duration}ms cubic-bezier(0.1, 0.85, 0.15, 1.02) ${delay}ms`;
    el.style.transform = `translateY(${target}px)`;
    el.addEventListener("transitionend", done, { once: true });
    fallback = setTimeout(done, duration + delay + 300);
    return () => {
      el.removeEventListener("transitionend", done);
      if (fallback) clearTimeout(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="reel-mask-y relative w-full overflow-hidden rounded-lg border border-line bg-paper" style={{ height: VIEW }}>
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-[2px] -translate-y-1/2 rounded bg-accent/70" />
      <div ref={trackRef} className="absolute inset-x-0 top-0 flex flex-col items-center will-change-transform" style={{ gap: GAP }}>
        {strip.map((it, i) => (
          <div key={i} style={{ height: TILE }} className="flex items-center">
            <ItemTile item={it} size={TILE - 4} />
          </div>
        ))}
      </div>
    </div>
  );
}
