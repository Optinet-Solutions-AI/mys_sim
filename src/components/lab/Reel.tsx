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
  /** the top item placed next to the landing tile, when the spin was dressed as a near miss */
  staged: CatalogItem | null;
}
interface Staging {
  item: CatalogItem;
  side: -1 | 1;
}

const TILE = 84;
const GAP = 8;
const STEP = TILE + GAP;
const LEN = 56;
const WIN = 48;
const DURATION = 5200;

/** Sampling weights for the decoration strip. showcase 0 = the real odds; higher flattens them so rare items show up constantly. */
export function stripWeights(pool: ReelPoolEntry[], showcase: number): number[] {
  const e = 1 - Math.min(0.95, Math.max(0, showcase));
  return pool.map((p) => Math.pow(Math.max(1, p.weight), e));
}

export function topItem(pool: ReelPoolEntry[], exclude?: CatalogItem): CatalogItem | null {
  let best: CatalogItem | null = null;
  for (const p of pool) {
    if (exclude && p.item.id === exclude.id) continue;
    if (!best || p.item.realized > best.realized) best = p.item;
  }
  return best;
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

export function decideStaging(pool: ReelPoolEntry[], winner: CatalogItem, loss: boolean, nearMiss?: NearMissSetting): Staging | null {
  if (!nearMiss || !loss || Math.random() >= nearMiss.rate) return null;
  const item = topItem(pool, winner);
  if (!item) return null;
  return { item, side: Math.random() < 0.5 ? -1 : 1 };
}

export function Reel({
  pool,
  winner,
  spinId,
  onDone,
  fast = false,
  loss = false,
  nearMiss,
}: {
  pool: ReelPoolEntry[];
  winner: CatalogItem | null;
  spinId: number;
  onDone?: (info: SpinInfo) => void;
  fast?: boolean;
  loss?: boolean;
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
    const st = decideStaging(pool, winner, loss, nearMiss);
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
    // where the pointer rests inside the landing tile: near the shared edge for a staged near miss, anywhere otherwise
    const within = staging ? staging.side * TILE * 0.36 : (Math.random() - 0.5) * TILE * 0.6;
    const distance = -(center + within - width / 2);
    // a staged "almost" beyond the tile: the pointer crosses onto the top item, then eases back
    const overshoot = staging && staging.side > 0 ? TILE * 0.55 : TILE * (0.08 + Math.random() * 0.1);
    let last = -1;
    const cancel = animateReel({
      el,
      axis: "x",
      distance,
      duration: fast ? 0 : DURATION,
      pull: TILE * 0.5,
      crawl: STEP * 1.7,
      overshoot,
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
    return cancel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin]);

  return (
    <div ref={wrapRef} className="reel-mask relative h-[120px] overflow-hidden rounded-xl border border-line bg-paper">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-accent/80" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[10px] border-x-transparent border-t-accent" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[9px] border-b-[10px] border-x-transparent border-b-accent" />
      <div ref={trackRef} className="absolute left-0 top-0 flex h-full items-center will-change-transform" style={{ gap: GAP }}>
        {strip.map((it, i) => {
          const cls = landed && i === WIN ? "reel-tile-win" : landed && staging && i === WIN + staging.side ? "reel-tile-near" : spin && !landed && i === active ? "reel-tile-active" : "";
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
