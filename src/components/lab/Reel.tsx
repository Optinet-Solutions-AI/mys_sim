"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/engine/types";
import { ItemTile } from "../ItemTile";
import { animateReel, tileAt } from "./reelMotion";

export interface ReelPoolEntry {
  item: CatalogItem;
  weight: number;
}
export interface NearMissSetting {
  rate: number;
  showcase: number;
}
export interface SpinInfo {
  /** the valuable item placed beside the landing tile, when the spin was dressed as a near miss */
  staged: CatalogItem | null;
}
export interface Staging {
  item: CatalogItem;
  side: -1 | 1;
}

const TILE = 84;
const GAP = 8;
const STEP = TILE + GAP;
const LEN = 56;
const WIN = 48;
const DURATION = 5500;

/** Sampling weights for the decoration strip. showcase 0 = the real odds; higher flattens them so rare items show up constantly. */
export function stripWeights(pool: ReelPoolEntry[], showcase: number): number[] {
  const e = 1 - Math.min(0.95, Math.max(0, showcase));
  return pool.map((p) => Math.pow(Math.max(1, p.weight), e));
}

/** A tempting neighbour for a near miss: a clear win (at least twice the price), medium values as often as grails. */
export function pickTempting(pool: ReelPoolEntry[], winner: CatalogItem, price: number): CatalogItem | null {
  const others = pool.filter((p) => p.item.id !== winner.id);
  const wins = others.filter((p) => p.item.realized >= 2 * price);
  const cands = wins.length ? wins : others;
  if (!cands.length) return null;
  const w = cands.map((p) => Math.log10(Math.max(10, p.item.realized)));
  const sum = w.reduce((a, b) => a + b, 0);
  let u = Math.random() * sum;
  for (let i = 0; i < cands.length; i++) {
    u -= w[i];
    if (u <= 0) return cands[i].item;
  }
  return cands[cands.length - 1].item;
}

export function buildStrip(pool: ReelPoolEntry[], winner: CatalogItem, showcase: number, len: number, win: number, staged: Staging | null): CatalogItem[] {
  const w = stripWeights(pool, showcase);
  const sum = w.reduce((a, b) => a + b, 0);
  const pick = () => {
    let u = Math.random() * sum;
    for (let i = 0; i < pool.length; i++) {
      u -= w[i];
      if (u <= 0) return pool[i].item;
    }
    return pool[pool.length - 1].item;
  };
  const strip = Array.from({ length: len }, pick);
  strip[win] = winner;
  if (staged) strip[win + staged.side] = staged.item;
  return strip;
}

export function decideStaging(pool: ReelPoolEntry[], winner: CatalogItem, loss: boolean, price: number, nearMiss?: NearMissSetting): Staging | null {
  if (!nearMiss || !loss || Math.random() >= nearMiss.rate) return null;
  const item = pickTempting(pool, winner, price);
  if (!item) return null;
  return { item, side: Math.random() < 0.5 ? -1 : 1 };
}

/** Where the pointer rests inside the landing tile, relative to its centre. A staged near miss stops a few pixels from the neighbour's edge. */
export function landingOffset(tile: number, staging: Staging | null): number {
  if (staging) return staging.side * (tile / 2 - tile * (0.1 + Math.random() * 0.14));
  return (Math.random() - 0.5) * tile * 0.7;
}

export function Reel({
  pool,
  winner,
  spinId,
  onDone,
  fast = false,
  loss = false,
  price = 0,
  nearMiss,
}: {
  pool: ReelPoolEntry[];
  winner: CatalogItem | null;
  spinId: number;
  onDone?: (info: SpinInfo) => void;
  fast?: boolean;
  loss?: boolean;
  price?: number;
  nearMiss?: NearMissSetting;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const showcase = nearMiss?.showcase ?? 0;
  // the idle strip is deterministic so the page can prerender; random strips are built only when a spin starts
  const [strip, setStrip] = useState<CatalogItem[]>(() => (pool.length ? Array.from({ length: LEN }, (_, i) => pool[i % pool.length].item) : []));
  const [spin, setSpin] = useState(0);
  const [staging, setStaging] = useState<Staging | null>(null);
  const [active, setActive] = useState(-1);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    if (spinId === 0 || !winner || !pool.length) return;
    const st = decideStaging(pool, winner, loss, price, nearMiss);
    setStaging(st);
    setStrip(buildStrip(pool, winner, showcase, LEN, WIN, st));
    setLanded(false);
    setSpin(spinId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);

  useLayoutEffect(() => {
    if (!spin) return;
    const el = trackRef.current;
    const wrap = wrapRef.current;
    if (!el || !wrap) return;
    const width = wrap.clientWidth;
    const center = WIN * STEP + TILE / 2;
    const distance = -(center + landingOffset(TILE, staging) - width / 2);
    let last = -1;
    return animateReel({
      el,
      axis: "x",
      distance,
      duration: fast ? 0 : DURATION,
      tail: 2.4,
      onFrame: (offset) => {
        const idx = tileAt(width / 2 - offset, STEP);
        if (idx !== last) {
          last = idx;
          setActive(idx);
        }
      },
      onDone: () => {
        setLanded(true);
        onDoneRef.current?.({ staged: staging?.item ?? null });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  return (
    <div ref={wrapRef} className="reel-mask relative h-[120px] overflow-hidden rounded-xl border border-line bg-paper">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-accent/80" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[10px] border-x-transparent border-t-accent" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-b-[10px] border-x-transparent border-b-accent" />
      <div ref={trackRef} className="absolute left-0 top-0 flex h-full items-center will-change-transform" style={{ gap: GAP }}>
        {strip.map((it, i) => {
          const cls = landed && i === WIN ? "reel-tile-win" : spin && !landed && i === active ? "reel-tile-active" : "";
          return (
            <div key={i} style={{ width: TILE }} className={`reel-tile flex shrink-0 justify-center ${cls}`}>
              <ItemTile item={it} size={TILE - 12} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
