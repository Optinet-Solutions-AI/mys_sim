"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { UpgraderConfig } from "@/engine/types";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { upgraderBox } from "@/engine/labs/upgrader";
import { LiveOpener, type LiveOpen } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile, TierBadge } from "../ItemTile";
import { Badge, Card, Info } from "../ui";
import { reelPosition } from "../lab/reelMotion";
import { CountUp } from "../lab/CountUp";

interface Tally {
  attempts: number;
  wagered: number;
  won: number;
  wins: number;
  bank: number;
}

export function UpgraderStage({ cfg, seed, onSettings, onChange }: { cfg: UpgraderConfig; seed: number; onSettings: (section?: string) => void; onChange: (c: UpgraderConfig) => void }) {
  const built = useMemo(() => {
    try {
      return { ...upgraderBox(cfg, CATALOG_BY_ID), error: null as string | null };
    } catch (e) {
      return { box: null, chance: 0, price: 0, targetValue: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }, [cfg]);
  const key = useMemo(() => JSON.stringify([cfg, seed]), [cfg, seed]);
  const liveRef = useRef<{ key: string; live: LiveOpener | null } | null>(null);
  if (built.box && (!liveRef.current || liveRef.current.key !== key)) {
    try {
      liveRef.current = { key, live: new LiveOpener(built.box, cfg.algo, cfg.rigs, `upgrader:${seed}`, "upgrader") };
    } catch {
      liveRef.current = { key, live: null };
    }
  }
  const live = liveRef.current?.live ?? null;
  const target = CATALOG_BY_ID.get(cfg.targetItemId);
  const [tally, setTally] = useState<Tally>({ attempts: 0, wagered: 0, won: 0, wins: 0, bank: cfg.population.bankroll });
  const [last, setLast] = useState<LiveOpen | null>(null);
  const [marker, setMarker] = useState(0); // 0..1 position on the bar
  const [spinning, setSpinning] = useState(false);
  const [fast, setFast] = useState(false);
  const rafRef = useRef(0);
  useEffect(() => {
    setTally({ attempts: 0, wagered: 0, won: 0, wins: 0, bank: cfg.population.bankroll });
    setLast(null);
    setMarker(0);
    setSpinning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const attempt = () => {
    if (!live || !built.box || spinning || tally.bank < built.price) return;
    const o = live.open("player");
    const u = o.rec.ticket / built.box.ticketTotal; // where the marker lands on the bar
    const win = o.item.id === cfg.targetItemId;
    const finish = () => {
      setMarker(u);
      setLast(o);
      setTally((t) => ({ attempts: t.attempts + 1, wagered: t.wagered + built.price, won: t.won + (win ? built.targetValue : 0), wins: t.wins + (win ? 1 : 0), bank: t.bank - built.price + (win ? built.targetValue : 0) }));
      setSpinning(false);
    };
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fast || reduce) {
      finish();
      return;
    }
    setSpinning(true);
    const laps = 3;
    const D = laps + u;
    const dur = 2600;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const pos = reelPosition(k, D, 2.4);
      setMarker(pos % 1);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else finish();
    };
    rafRef.current = requestAnimationFrame(step);
  };
  const reset = () => {
    liveRef.current = null;
    setTally({ attempts: 0, wagered: 0, won: 0, wins: 0, bank: cfg.population.bankroll });
    setLast(null);
    setMarker(0);
  };

  if (!built.box || !target) {
    return (
      <Card title="No target item">
        <p className="text-sm text-ink-2">{built.error ?? "Pick a target item in Settings."}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings("terms")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Settings
        </button>
      </Card>
    );
  }
  const upg = cfg.mode === "upgrader";
  const sessionEdge = tally.wagered ? 1 - tally.won / tally.wagered : 0;

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-3">
            <ItemTile item={target} size={88} />
            <div>
              <div className="text-xs text-ink-3">{target.brand}</div>
              <div className="text-lg font-semibold leading-tight">{target.name}</div>
              <div className="mt-1 flex items-center gap-2">
                <TierBadge tier={target.tier} />
                <span className="text-xs text-ink-2">worth {money(built.targetValue)} at {cfg.valueLayer}</span>
              </div>
              <button type="button" className="chip mt-2" onClick={() => onSettings("terms")}>
                change target
              </button>
            </div>
          </div>
          <div>
            <div className="flex flex-wrap items-end gap-3">
              {upg ? (
                <label className="text-xs text-ink-2">
                  Stake ($)
                  <input type="number" className="mt-1 w-28" min={1} step={5} value={cfg.stake} onChange={(e) => onChange({ ...cfg, stake: Math.max(1, Number(e.target.value)) })} />
                </label>
              ) : (
                <label className="text-xs text-ink-2">
                  Chance {pct(built.chance, 0)} (cap {pct(cfg.maxChance, 0)})
                  <input type="range" className="mt-1 w-56" min={0.01} max={cfg.maxChance} step={0.01} value={Math.min(cfg.maxChance, cfg.chance)} onChange={(e) => onChange({ ...cfg, chance: Number(e.target.value) })} />
                </label>
              )}
              <div className="text-sm">
                <div className="text-xs text-ink-3">{upg ? "chance" : "price"}</div>
                <div className="text-xl font-semibold tabular-nums">{upg ? pct(built.chance, 2) : money(built.price)}</div>
              </div>
              <div className="text-sm">
                <div className="text-xs text-ink-3">fair would be</div>
                <div className="text-xl font-semibold tabular-nums text-ink-2">{upg ? pct(Math.min(cfg.maxChance, built.price / built.targetValue), 2) : money(built.chance * built.targetValue)}</div>
              </div>
              <Info>
                {upg ? "Chance = stake ÷ item value × (1 − edge), capped." : "Price = chance × item value ÷ (1 − edge)."} The stated edge is {pct(cfg.edge)}. A table swap in Rigs hides a bigger one.
              </Info>
              <label className="ml-auto flex items-center gap-1 text-xs text-ink-2">
                <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} disabled={spinning} /> skip animation
              </label>
            </div>
            <div className="relative mt-4 h-10 w-full overflow-hidden rounded-xl border border-line bg-paper">
              <div className="absolute inset-y-0 left-0 bg-good-soft" style={{ width: `${built.chance * 100}%` }} />
              <div className="absolute inset-y-0 left-0 flex items-center pl-2 text-[11px] font-semibold text-good">win {pct(built.chance, 1)}</div>
              <div className="absolute inset-y-0 right-0 flex items-center pr-2 text-[11px] text-ink-3">lose</div>
              <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${marker * 100}% - 1px)` }} />
              <div className="absolute -top-0.5 h-0 w-0 border-x-[7px] border-t-[8px] border-x-transparent border-t-ink" style={{ left: `calc(${marker * 100}% - 7px)` }} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-primary btn-lg" onClick={attempt} disabled={spinning || tally.bank < built.price}>
                <Icon name="ph:arrow-up-right" size={18} className="text-white" /> {spinning ? "Rolling…" : upg ? `Upgrade for ${money(built.price)}` : `Take the deal for ${money(built.price)}`}
              </button>
              <button type="button" className="btn" onClick={reset} disabled={spinning}>
                <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset
              </button>
              {tally.bank < built.price && <span className="text-xs text-warn">Bankroll gone.</span>}
              {last && !spinning && (
                <span className={`text-sm animate-rise ${last.item.id === cfg.targetItemId ? "font-semibold text-good" : "text-ink-2"}`}>
                  {last.item.id === cfg.targetItemId ? `Won the ${target.name}!` : "Lost the stake."} ticket {num(last.rec.ticket)} {last.verified === null ? "" : last.verified ? "· proof ok" : "· proof fails"}
                </span>
              )}
              <div className="ml-auto grid grid-cols-4 gap-2 text-right text-xs">
                <div>
                  <div className="text-ink-3">bankroll</div>
                  <div className="font-semibold tabular-nums">
                    <CountUp value={tally.bank} format={money} />
                  </div>
                </div>
                <div>
                  <div className="text-ink-3">attempts · wins</div>
                  <div className="font-semibold tabular-nums">
                    {num(tally.attempts)} · {num(tally.wins)}
                  </div>
                </div>
                <div>
                  <div className="text-ink-3">wagered</div>
                  <div className="font-semibold tabular-nums">{money(tally.wagered)}</div>
                </div>
                <div>
                  <div className="text-ink-3">session edge</div>
                  <div className={`font-semibold tabular-nums ${tally.attempts > 10 && sessionEdge > cfg.edge + 0.2 ? "text-bad" : ""}`}>{tally.attempts ? pct(sessionEdge) : "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {last && cfg.algo.scheme !== "none" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-ink-3">
            <Badge tone={last.verified ? "good" : "bad"}>{last.verified ? "proof ok" : "proof fails"}</Badge>
            <span className="font-mono">hash {last.rec.serverHash.slice(0, 12)}… · client {last.rec.clientSeed.slice(0, 8)}… · nonce {last.rec.nonce} · ticket {num(last.rec.ticket)} of {num(built.box.ticketTotal)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
