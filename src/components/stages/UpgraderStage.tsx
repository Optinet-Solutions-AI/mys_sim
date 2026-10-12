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
import { DealWheel } from "../lab/DealWheel";
import { useSkin } from "../lab/SkinContext";

interface Tally {
  attempts: number;
  wagered: number;
  won: number;
  wins: number;
  bank: number;
}

export function UpgraderStage({ cfg, seed, onSettings, onChange }: { cfg: UpgraderConfig; seed: number; onSettings: (section?: string) => void; onChange: (c: UpgraderConfig) => void }) {
  const skin = useSkin();
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
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [landed, setLanded] = useState<"win" | "lose" | null>(null);
  const [offset, setOffset] = useState(0); // where the win zone starts, in degrees; the player drags it
  const [needle, setNeedle] = useState(0); // the needle keeps its angle between spins
  const needleRef = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [fast, setFast] = useState(false);
  const rafRef = useRef(0);
  useEffect(() => {
    setTally({ attempts: 0, wagered: 0, won: 0, wins: 0, bank: cfg.population.bankroll });
    setLast(null);
    setLastRoll(null);
    setLanded(null);
    setSpinning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const attempt = () => {
    if (!live || !built.box || spinning || tally.bank < built.price) return;
    const o = live.open("player");
    const u = o.rec.ticket / built.box.ticketTotal; // the roll, 0..1
    const win = o.item.id === cfg.targetItemId;
    // the roll is read relative to the win zone, so dragging the zone never changes the odds
    const targetAngle = (offset + u * 360) % 360;
    const finish = () => {
      needleRef.current = targetAngle;
      setNeedle(targetAngle);
      setLast(o);
      setLastRoll(u * 100);
      setLanded(win ? "win" : "lose");
      setTally((t) => ({ attempts: t.attempts + 1, wagered: t.wagered + built.price, won: t.won + (win ? built.targetValue : 0), wins: t.wins + (win ? 1 : 0), bank: t.bank - built.price + (win ? built.targetValue : 0) }));
      setSpinning(false);
    };
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fast || reduce) {
      finish();
      return;
    }
    setSpinning(true);
    setLanded(null);
    setLastRoll(null);
    const start = needleRef.current;
    const delta = (((targetAngle - start) % 360) + 360) % 360;
    const total = 4 * 360 + delta;
    const dur = 3200;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      const a = start + reelPosition(k, total, 2.4);
      setNeedle(((a % 360) + 360) % 360);
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else finish();
    };
    rafRef.current = requestAnimationFrame(step);
  };
  const reset = () => {
    liveRef.current = null;
    setTally({ attempts: 0, wagered: 0, won: 0, wins: 0, bank: cfg.population.bankroll });
    setLast(null);
    setLastRoll(null);
    setLanded(null);
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
  const displayDisagrees = last && lastRoll !== null && (lastRoll / 100 < built.chance) !== (last.item.id === cfg.targetItemId);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px_1fr]">
          <div className="flex items-start gap-3">
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
              <div className="mt-4 space-y-2">
                {upg ? (
                  <label className="block text-xs text-ink-2">
                    Stake ($)
                    <input type="number" className="mt-1 w-32" min={1} step={5} value={cfg.stake} onChange={(e) => onChange({ ...cfg, stake: Math.max(1, Number(e.target.value)) })} disabled={spinning} />
                  </label>
                ) : (
                  <label className="block text-xs text-ink-2">
                    Chance {pct(built.chance, 0)} <span className="text-ink-3">(cap {pct(cfg.maxChance, 0)})</span>
                    <input type="range" className="mt-1 w-full max-w-[220px]" min={0.01} max={cfg.maxChance} step={0.01} value={Math.min(cfg.maxChance, cfg.chance)} onChange={(e) => onChange({ ...cfg, chance: Number(e.target.value) })} disabled={spinning} />
                  </label>
                )}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <div className="text-xs text-ink-3">{upg ? "chance" : "price"}</div>
                    <div className="text-xl font-semibold tabular-nums">{upg ? pct(built.chance, 2) : money(built.price)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-ink-3">fair would be</div>
                    <div className="text-xl font-semibold tabular-nums text-ink-2">{upg ? pct(Math.min(cfg.maxChance, built.price / built.targetValue), 2) : money(built.chance * built.targetValue)}</div>
                  </div>
                  <Info>
                    {upg ? "Chance = stake ÷ item value × (1 − edge), capped." : "Price = chance × item value ÷ (1 − edge)."} The stated edge is {pct(cfg.edge)}. A table swap in Rigs hides a bigger one. Dragging the green zone changes nothing about the odds: the roll is read relative to where the zone sits.
                  </Info>
                </div>
              </div>
            </div>
          </div>

          <DealWheel chance={built.chance} offset={offset} onOffset={setOffset} needle={needle} spinning={spinning} landed={landed} roll={lastRoll} label={upg ? "chance" : "deal"} sub={upg ? `stake ${money(built.price)}` : `price ${money(built.price)}`} />

          <div className="flex flex-col gap-3">
            <button type="button" className="btn btn-primary btn-lg justify-center" onClick={attempt} disabled={spinning || tally.bank < built.price}>
              <Icon name="ph:arrow-up-right" size={18} className="text-white" /> {spinning ? "Spinning…" : upg ? `Upgrade for ${money(built.price)}` : `Take the deal for ${money(built.price)}`}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn" onClick={reset} disabled={spinning}>
                <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset
              </button>
              <label className="flex items-center gap-1 text-xs text-ink-2">
                <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} disabled={spinning} /> skip animation
              </label>
            </div>
            {tally.bank < built.price && <span className="text-xs text-warn">Bankroll gone.</span>}
            {last && !spinning && (
              <div className={`rounded-lg px-3 py-2 text-sm animate-rise ${last.item.id === cfg.targetItemId ? "bg-good-soft text-good" : "bg-paper text-ink-2"}`}>
                {last.item.id === cfg.targetItemId ? (
                  <>
                    <b>Won the {target.name}!</b> The needle stopped at <b>{lastRoll?.toFixed(1)}</b> on the 0 to 100 wheel, inside your win zone of 0 to {(built.chance * 100).toFixed(0)}.
                  </>
                ) : (
                  <>
                    <b>Lost the {money(built.price)} stake.</b> The needle stopped at <b>{lastRoll?.toFixed(1)}</b> on the 0 to 100 wheel, outside your win zone of 0 to {(built.chance * 100).toFixed(0)}.
                  </>
                )}{" "}
                <Info>
                  The roll is a number from 0 to 100 drawn by the engine. You win when it is below your chance ({pct(built.chance, 1)}), wherever you have dragged the green zone, because the needle is read relative to the zone. Ticket {num(last.rec.ticket)} of 100,000,000 is the same number at full precision; it is what the proof checks.
                </Info>
                {displayDisagrees && (
                  <div className="mt-1 flex items-center gap-1 text-xs font-normal text-bad">
                    <Icon name="ph:warning" size={14} /> The needle says one thing and the house says another: a rig is drawing from a hidden table.
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-right text-xs">
              <div>
                <div className="text-ink-3">{skin.terms.balance.toLowerCase()}</div>
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
