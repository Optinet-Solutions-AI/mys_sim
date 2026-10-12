"use client";
import { useEffect, useRef, useState } from "react";
import type { BoxTier, CatalogItem } from "@/engine/types";
import { ItemTile } from "../ItemTile";
import { Icon } from "../Icon";
import { money, pctSmart } from "@/lib/format";
import { reelPosition } from "./reelMotion";
import type { SpinInfo } from "./Reel";

function reduced() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A mystery box: it bobs while idle, shakes, shows a sliver of light under the lid, then the lid swings open and the item rises out. */
export function BoxOpen({ winner, spinId, onDone, fast = false, label }: { winner: CatalogItem | null; spinId: number; onDone?: (i: SpinInfo) => void; fast?: boolean; label: string }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [phase, setPhase] = useState<"idle" | "shake" | "tease" | "open" | "done">("idle");
  const [shown, setShown] = useState<CatalogItem | null>(null);
  useEffect(() => {
    if (!spinId) {
      setPhase("idle");
      setShown(null);
      return;
    }
    if (!winner) return;
    setShown(winner);
    if (fast || reduced()) {
      setPhase("done");
      const t = setTimeout(() => onDoneRef.current?.({ staged: null }), 30);
      return () => clearTimeout(t);
    }
    setPhase("shake");
    const t1 = setTimeout(() => setPhase("tease"), 1500);
    const t2 = setTimeout(() => setPhase("open"), 1500 + 700);
    const t3 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.({ staged: null });
    }, 1500 + 700 + 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);
  const open = phase === "open" || phase === "done";
  return (
    <div className="mbox relative mx-auto my-2 h-[272px] w-[240px]">
      {/* the item: behind the front of the box until it rises out */}
      <div className={`mbox-item absolute left-1/2 top-[128px] z-10 flex -translate-x-1/2 flex-col items-center gap-1 ${open ? "out" : ""}`}>
        {shown && (
          <>
            <div className="relative">
              {phase === "open" && <div className="mbox-burst absolute inset-0 rounded-full bg-accent-soft" />}
              <ItemTile item={shown} size={92} />
            </div>
            <div className="w-[220px] text-center">
              <div className="text-[11px] text-ink-3">{shown.brand}</div>
              <div className="line-clamp-2 text-sm font-semibold leading-tight">{shown.name}</div>
              <div className="font-mono text-xs text-ink-2">{money(shown.retail)}</div>
            </div>
          </>
        )}
      </div>
      <div className={`absolute inset-x-0 bottom-0 top-[112px] ${phase === "shake" ? "animate-shake-hard" : phase === "idle" ? "animate-bob" : ""}`}>
        {/* back wall */}
        <div className="absolute left-6 right-6 top-0 z-0 h-[130px] rounded-b-2xl bg-accent-ink opacity-90" />
        {/* light under the lid */}
        <div className={`absolute left-8 right-8 top-[2px] z-20 h-2 rounded-full bg-white blur-[3px] ${phase === "tease" ? "mbox-glow" : "opacity-0"}`} />
        {/* front */}
        <div className="absolute left-6 right-6 top-[14px] z-20 flex h-[120px] items-center justify-center rounded-b-2xl bg-accent shadow-lg">
          <div className="card-pattern absolute inset-0 rounded-b-2xl opacity-20" />
          <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-white/25" />
          <Icon name="ph:question" size={44} className="relative text-white" />
          <div className="absolute inset-x-0 bottom-2 text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-white/90">{label}</div>
        </div>
        {/* lid */}
        <div className={`mbox-lid absolute left-4 right-4 top-0 z-30 h-[26px] rounded-lg bg-accent-ink shadow ${phase === "tease" ? "ajar" : open ? "open" : ""}`}>
          <div className="absolute inset-y-0 left-1/2 w-8 -translate-x-1/2 bg-white/25" />
        </div>
      </div>
    </div>
  );
}

/** A face-down card that shakes, then flips to reveal the item (IcyBox drops, blind boxes, lucky bags, the Glass Box). */
export function CardFlip({ winner, spinId, onDone, fast = false, label, back }: { winner: CatalogItem | null; spinId: number; onDone?: (i: SpinInfo) => void; fast?: boolean; label: string; back?: React.ReactNode }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [phase, setPhase] = useState<"idle" | "shake" | "flip" | "done">("idle");
  const [shown, setShown] = useState<CatalogItem | null>(null);
  useEffect(() => {
    if (!spinId || !winner) return;
    setShown(winner);
    if (fast || reduced()) {
      setPhase("done");
      const t = setTimeout(() => onDoneRef.current?.({ staged: null }), 30);
      return () => clearTimeout(t);
    }
    setPhase("shake");
    const t1 = setTimeout(() => setPhase("flip"), 1600);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.({ staged: null });
    }, 1600 + 950);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);
  const flipped = phase === "flip" || phase === "done";
  return (
    <div className="flex items-center justify-center py-3" style={{ perspective: 900 }}>
      <div className={`card3d relative h-[232px] w-[176px] ${flipped ? "flipped" : ""} ${phase === "shake" ? "animate-shake" : ""}`}>
        <div className="card-face absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-line bg-accent text-white shadow-lg">
          <div className="card-pattern absolute inset-0 rounded-2xl opacity-25" />
          {back ?? <Icon name="ph:package" size={56} className="text-white" />}
          <div className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">{label}</div>
        </div>
        <div className="card-face card-back absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-lg">
          {shown && (
            <>
              <ItemTile item={shown} size={96} />
              <div className="text-center">
                <div className="text-[11px] text-ink-3">{shown.brand}</div>
                <div className="line-clamp-2 text-sm font-semibold leading-tight">{shown.name}</div>
                <div className="mt-1 font-mono text-xs text-ink-2">{money(shown.retail)}</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** A pack that wobbles and tears open to reveal the card (Courtyard). */
export function PackRip({ winner, spinId, onDone, fast = false, label }: { winner: CatalogItem | null; spinId: number; onDone?: (i: SpinInfo) => void; fast?: boolean; label: string }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [phase, setPhase] = useState<"idle" | "wobble" | "rip" | "done">("idle");
  const [shown, setShown] = useState<CatalogItem | null>(null);
  useEffect(() => {
    if (!spinId || !winner) return;
    setShown(winner);
    if (fast || reduced()) {
      setPhase("done");
      const t = setTimeout(() => onDoneRef.current?.({ staged: null }), 30);
      return () => clearTimeout(t);
    }
    setPhase("wobble");
    const t1 = setTimeout(() => setPhase("rip"), 1300);
    const t2 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.({ staged: null });
    }, 1300 + 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);
  const open = phase === "rip" || phase === "done";
  return (
    <div className="relative mx-auto my-3 h-[232px] w-[200px]">
      {/* the card underneath */}
      <div className={`absolute inset-x-4 bottom-2 top-6 flex flex-col items-center justify-center gap-2 rounded-xl border border-line bg-surface p-3 shadow ${open ? "animate-rise" : "opacity-0"}`}>
        {shown && (
          <>
            <ItemTile item={shown} size={88} />
            <div className="text-center">
              <div className="text-[11px] text-ink-3">{shown.brand}</div>
              <div className="line-clamp-2 text-sm font-semibold leading-tight">{shown.name}</div>
              <div className="mt-1 font-mono text-xs text-ink-2">{money(shown.realized)} FMV</div>
            </div>
          </>
        )}
      </div>
      {/* the pack: top and bottom halves */}
      <div className={`pack-half absolute inset-x-0 top-0 h-1/2 rounded-t-2xl bg-accent ${phase === "wobble" ? "animate-wobble" : ""} ${open ? "pack-top-open" : ""}`}>
        <div className="card-pattern absolute inset-0 rounded-t-2xl opacity-25" />
        <div className="absolute inset-x-0 bottom-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/90">{label}</div>
      </div>
      <div className={`pack-half absolute inset-x-0 bottom-0 h-1/2 rounded-b-2xl bg-accent ${phase === "wobble" ? "animate-wobble" : ""} ${open ? "pack-bottom-open" : ""}`}>
        <div className="card-pattern absolute inset-0 rounded-b-2xl opacity-25" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon name="ph:cube" size={40} className="text-white" />
        </div>
      </div>
      <div className={`pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 border-t border-dashed border-white/70 ${open ? "opacity-0" : ""}`} />
    </div>
  );
}

/** StockX: a cursor runs down the tier ladder and settles on the drawn tier, then the item fades in. */
export function TierLadder({ tiers, winner, winnerTierId, spinId, onDone, fast = false, price }: { tiers: BoxTier[]; winner: CatalogItem | null; winnerTierId?: string; spinId: number; onDone?: (i: SpinInfo) => void; fast?: boolean; price: number }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [cursor, setCursor] = useState(-1);
  const [phase, setPhase] = useState<"idle" | "run" | "done">("idle");
  const [shown, setShown] = useState<CatalogItem | null>(null);
  const raf = useRef(0);
  useEffect(() => {
    if (!spinId || !winner) return;
    const n = Math.max(1, tiers.length);
    const target = Math.max(0, tiers.findIndex((t) => t.id === winnerTierId));
    setShown(null);
    if (fast || reduced()) {
      setCursor(target);
      setShown(winner);
      setPhase("done");
      const t = setTimeout(() => onDoneRef.current?.({ staged: null }), 30);
      return () => clearTimeout(t);
    }
    setPhase("run");
    const laps = 4;
    const D = laps * n + target;
    const dur = 3000;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const pos = reelPosition(k, D, 2.4);
      setCursor(Math.floor(pos) % n);
      if (k < 1) raf.current = requestAnimationFrame(step);
      else {
        setCursor(target);
        setShown(winner);
        setPhase("done");
        setTimeout(() => onDoneRef.current?.({ staged: null }), 500);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);
  return (
    <div className="grid gap-3 md:grid-cols-[1fr_200px]">
      <div className="space-y-1.5">
        {tiers.map((t, i) => (
          <div key={t.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${cursor === i ? (phase === "done" ? "border-accent bg-accent-soft font-semibold animate-glow" : "border-accent bg-accent-soft") : "border-line bg-surface"}`}>
            <span>{t.name}</span>
            <span className="font-mono text-xs text-ink-2">{pctSmart(t.percent / 100)}</span>
          </div>
        ))}
        <div className="text-[11px] text-ink-3">Every item in this box is worth at least {money(price)} before processing fees.</div>
      </div>
      <div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-line bg-surface p-3">
        {shown ? (
          <div className="flex flex-col items-center gap-2 animate-pop">
            <ItemTile item={shown} size={88} />
            <div className="text-center">
              <div className="text-[11px] text-ink-3">{shown.brand}</div>
              <div className="line-clamp-2 text-sm font-semibold leading-tight">{shown.name}</div>
              <div className="mt-1 font-mono text-xs text-ink-2">list {money(shown.retail)}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-ink-3">{phase === "run" ? "selecting tier…" : "your item appears here"}</div>
        )}
      </div>
    </div>
  );
}

/** Misty, kuji, Omaze: a ticket whose foil wipes away to reveal the result. */
export function TicketScratch({ winner, spinId, onDone, fast = false, label, credits }: { winner: CatalogItem | null; spinId: number; onDone?: (i: SpinInfo) => void; fast?: boolean; label: string; credits?: boolean }) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [phase, setPhase] = useState<"idle" | "scratch" | "done">("idle");
  const [shown, setShown] = useState<CatalogItem | null>(null);
  useEffect(() => {
    if (!spinId || !winner) return;
    setShown(winner);
    if (fast || reduced()) {
      setPhase("done");
      const t = setTimeout(() => onDoneRef.current?.({ staged: null }), 30);
      return () => clearTimeout(t);
    }
    setPhase("idle");
    const t0 = setTimeout(() => setPhase("scratch"), 50);
    const t1 = setTimeout(() => {
      setPhase("done");
      onDoneRef.current?.({ staged: null });
    }, 2300);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);
  const isCredit = shown?.category === "credit";
  return (
    <div className="mx-auto my-3 w-full max-w-md">
      <div className="ticket relative overflow-hidden rounded-2xl border border-line bg-surface shadow">
        <div className="flex items-center gap-4 p-4">
          <div className="shrink-0 rounded-xl bg-accent-soft p-3 text-accent-ink">
            <Icon name="ph:ticket" size={36} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-3">{label}</div>
            <div className="relative mt-1 h-16">
              <div className="absolute inset-0 flex items-center gap-3">
                {shown && (
                  <>
                    <ItemTile item={shown} size={48} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{shown.name}</div>
                      <div className="text-xs text-ink-2">{isCredit && credits ? `${Math.round(shown.retail)} entries` : money(shown.retail)}</div>
                    </div>
                  </>
                )}
              </div>
              <div className={`scratch-foil absolute inset-0 rounded-md ${phase === "scratch" ? "scratched" : phase === "done" ? "gone" : ""}`} />
            </div>
          </div>
        </div>
        <div className="border-t border-dashed border-line px-4 py-2 text-[11px] text-ink-3">No. {String(spinId).padStart(6, "0")} · one draw per ticket</div>
      </div>
    </div>
  );
}
