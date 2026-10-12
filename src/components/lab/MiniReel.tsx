"use client";
import { useLayoutEffect, useRef, useState } from "react";
import type { CatalogItem } from "@/engine/types";
import { ItemTile } from "../ItemTile";
import { animateReel, tileAt } from "./reelMotion";
import { buildStrip, decideStaging, type NearMissSetting, type ReelPoolEntry, type SpinInfo } from "./Reel";

const TILE = 44;
const GAP = 6;
const STEP = TILE + GAP;
const LEN = 36;
const WIN = 30;
const VIEW = 104;

/** A small vertical reel for one seat in a battle. It starts when mounted and lands on `winner`. */
export function MiniReel({
  pool,
  winner,
  delay = 0,
  duration = 3000,
  loss = false,
  nearMiss,
  onDone,
}: {
  pool: ReelPoolEntry[];
  winner: CatalogItem;
  delay?: number;
  duration?: number;
  loss?: boolean;
  nearMiss?: NearMissSetting;
  onDone?: (info: SpinInfo) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [staging] = useState(() => decideStaging(pool, winner, loss, nearMiss));
  const [strip] = useState(() => buildStrip(pool.length ? pool : [{ item: winner, weight: 1 }], winner, nearMiss?.showcase ?? 0, LEN, WIN, staging));
  const [active, setActive] = useState(-1);
  const [landed, setLanded] = useState(false);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const center = WIN * STEP + TILE / 2;
    const within = staging ? staging.side * TILE * 0.34 : (Math.random() - 0.5) * TILE * 0.5;
    const distance = -(center + within - VIEW / 2);
    const overshoot = staging && staging.side > 0 ? TILE * 0.5 : TILE * (0.06 + Math.random() * 0.1);
    let last = -1;
    return animateReel({
      el,
      axis: "y",
      distance,
      duration,
      delay,
      pull: TILE * 0.4,
      crawl: STEP * 1.6,
      overshoot,
      onFrame: (offset) => {
        const idx = tileAt(VIEW / 2 - offset, STEP);
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
  }, []);

  return (
    <div className="reel-mask-y relative w-full overflow-hidden rounded-lg border border-line bg-paper" style={{ height: VIEW }}>
      <div className="pointer-events-none absolute inset-x-1 top-1/2 z-10 h-[2px] -translate-y-1/2 rounded bg-accent/70" />
      <div ref={trackRef} className="absolute inset-x-0 top-0 flex flex-col items-center will-change-transform" style={{ gap: GAP }}>
        {strip.map((it, i) => {
          const cls = landed && i === WIN ? "reel-tile-win" : landed && staging && i === WIN + staging.side ? "reel-tile-near" : !landed && i === active ? "reel-tile-active" : "";
          return (
            <div key={i} style={{ height: TILE }} className={`reel-tile flex items-center ${cls}`}>
              <ItemTile item={it} size={TILE - 4} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
