"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { BattlesConfig } from "@/engine/types";
import { BATTLE_MODES, playBattle, prepareBattle, type BattleOutcome, type BattleTable } from "@/engine/labs/battles";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { sfc32, type Rng } from "@/engine/rng";
import { seatName } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { Badge, Card } from "../ui";

interface Session {
  key: string;
  rng: Rng;
  table: BattleTable | null;
  counter: { idx: number };
  error: string | null;
}
interface Tally {
  battles: number;
  humanWins: number;
  humanSpent: number;
  humanWon: number;
  pot: number;
}
const EMPTY: Tally = { battles: 0, humanWins: 0, humanSpent: 0, humanWon: 0, pot: 0 };

export function BattlesStage({ cfg, seed, onSettings }: { cfg: BattlesConfig; seed: number; onSettings: (section?: string) => void }) {
  const key = useMemo(() => JSON.stringify([cfg, seed]), [cfg, seed]);
  const sRef = useRef<Session | null>(null);
  if (!sRef.current || sRef.current.key !== key) {
    const rng = sfc32(`battle:${seed}`);
    try {
      sRef.current = { key, rng, table: cfg.boxes.length ? prepareBattle(cfg, CATALOG_BY_ID, rng) : null, counter: { idx: 0 }, error: cfg.boxes.length ? null : "No boxes in the battle." };
    } catch (e) {
      sRef.current = { key, rng, table: null, counter: { idx: 0 }, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const session = sRef.current;
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<"idle" | "revealing" | "done">("idle");
  const [fast, setFast] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY);

  useEffect(() => {
    setOutcome(null);
    setRevealed(0);
    setPhase("idle");
    setTally(EMPTY);
  }, [key]);

  // reveal pulls one by one
  useEffect(() => {
    if (phase !== "revealing" || !outcome) return;
    if (revealed >= outcome.pulls.length) {
      setPhase("done");
      return;
    }
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ms = fast || reduce ? 20 : 240;
    const t = setTimeout(() => setRevealed((r) => r + 1), ms);
    return () => clearTimeout(t);
  }, [phase, revealed, outcome, fast]);

  useEffect(() => {
    if (phase !== "done" || !outcome || !session.table) return;
    const { humans, entry } = session.table;
    const humanWon = outcome.share.slice(0, humans).reduce((a, b) => a + b, 0);
    const humanWin = cfg.mode === "group" ? humans / session.table.players : outcome.winner >= 0 && outcome.winner < humans ? 1 : 0;
    setTally((t) => ({ battles: t.battles + 1, humanWins: t.humanWins + humanWin, humanSpent: t.humanSpent + entry * humans, humanWon: t.humanWon + humanWon, pot: t.pot + outcome.pot }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    if (!session.table || phase === "revealing") return;
    const o = playBattle(session.table, cfg, session.rng, session.counter, 0);
    setOutcome(o);
    setRevealed(0);
    setPhase("revealing");
  };
  const reset = () => {
    sRef.current = null;
    setOutcome(null);
    setRevealed(0);
    setPhase("idle");
    setTally(EMPTY);
  };

  if (!session.table) {
    return (
      <Card title="No battle to play">
        <p className="text-sm text-ink-2">{session.error}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings("boxes")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Add boxes in Settings
        </button>
      </Card>
    );
  }

  const { players, humans, entry } = session.table;
  const mode = BATTLE_MODES.find((m) => m.id === cfg.mode)!;
  const rounds = cfg.boxes.length;
  const pullAt = (r: number, p: number) => (outcome ? outcome.pulls[r * players + p] : undefined);
  const isRevealed = (r: number, p: number) => r * players + p < revealed;
  const runningTotal = (p: number) => {
    if (!outcome) return 0;
    let s = 0;
    for (let r = 0; r < rounds; r++) if (isRevealed(r, p)) s += outcome.pulls[r * players + p].rec.payout;
    return s;
  };
  const done = phase === "done" && outcome;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="fluent:trophy" size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{mode.name} battle</span>
              <Badge tone="accent">
                {players} players · {humans} human{humans > 1 ? "s" : ""} vs {players - humans} bot{players - humans === 1 ? "" : "s"}
              </Badge>
              <Badge>
                entry {money(entry)} per player · pot of entries {money(entry * players)}
              </Badge>
            </div>
            <div className="text-xs text-ink-2">{mode.rule}</div>
          </div>
          <label className="flex items-center gap-1 text-xs text-ink-2">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> fast reveal
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cfg.boxes.map((b, i) => (
            <button key={i} type="button" className="chip" onClick={() => onSettings("boxes")}>
              <Icon name="ph:package" size={12} /> Round {i + 1}: {b.name.split(" · ")[0]} · {money(b.price)}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[560px] gap-2" style={{ gridTemplateColumns: `repeat(${players}, minmax(0, 1fr))` }}>
            {Array.from({ length: players }, (_, p) => {
              const isBot = p >= humans;
              const win = done && (outcome.winner === p || cfg.mode === "group");
              const lose = done && !win;
              return (
                <div key={p} className={`rounded-xl border p-2 transition ${win ? "border-accent bg-accent-soft animate-glow" : lose ? "border-line bg-paper opacity-70" : "border-line bg-paper"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isBot ? "bg-ink-3/20" : "bg-accent-soft"}`}>
                      <Icon name={isBot ? "ph:robot" : "ph:user"} size={18} className={isBot ? "text-ink-2" : "text-accent-ink"} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{seatName(p, humans)}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-3">{isBot ? "house bot" : "human"}</div>
                    </div>
                    {win && cfg.mode !== "group" && <Icon name="ph:crown" size={20} className="ml-auto text-warn" />}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {Array.from({ length: rounds }, (_, r) => {
                      const pull = pullAt(r, p);
                      const show = pull && isRevealed(r, p);
                      const item = show ? CATALOG_BY_ID.get(pull.rec.itemId) : undefined;
                      return (
                        <div key={r} className="flex h-12 items-center gap-2 rounded-lg border border-line bg-surface px-2">
                          {show && item ? (
                            <>
                              <div className="animate-pop">
                                <ItemTile item={item} size={36} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-xs">{item.name}</div>
                                <div className={`font-mono text-xs ${pull.rec.payout >= cfg.boxes[r].price ? "text-good" : "text-ink-3"}`}>{money(pull.rec.payout)}</div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-line text-ink-3">?</div>
                              <span className="text-[11px] text-ink-3">round {r + 1}</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-1.5">
                    <span className="text-[11px] text-ink-3">{cfg.mode === "terminal" ? "last round" : "total"}</span>
                    <span className="font-mono text-sm font-semibold">{money(cfg.mode === "terminal" && done ? outcome.lastRound[p] : runningTotal(p))}</span>
                  </div>
                  {done && (
                    <div className={`mt-1 text-right text-xs ${outcome.share[p] > 0 ? "font-semibold text-accent-ink" : "text-ink-3"}`}>
                      {outcome.share[p] > 0 ? `takes ${money(outcome.share[p])}` : "takes nothing"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={phase === "revealing"}>
            <Icon name="ph:play" size={18} className="text-white" /> {phase === "revealing" ? "Opening…" : outcome ? "Next battle" : "Start battle"}
          </button>
          <button type="button" className="btn" onClick={reset} disabled={phase === "revealing"}>
            <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset session
          </button>
          {done && (
            <span className="text-sm">
              {cfg.mode === "group" ? (
                <>
                  Pot {money(outcome.pot)} split {players} ways: {money(outcome.pot / players)} each against an entry of {money(entry)}.
                </>
              ) : (
                <>
                  <b>{seatName(outcome.winner, humans)}</b> takes the pot of {money(outcome.pot)} {outcome.tied ? "(tie broken at random)" : ""} · players paid {money(entry * players)} in, the house kept {money(entry * players - outcome.pot)}.
                </>
              )}
            </span>
          )}
          <div className="ml-auto grid grid-cols-4 gap-2 text-right text-xs">
            <div>
              <div className="text-ink-3">battles</div>
              <div className="font-semibold tabular-nums">{num(tally.battles)}</div>
            </div>
            <div>
              <div className="text-ink-3">human wins</div>
              <div className="font-semibold tabular-nums">
                {tally.battles ? pct(tally.humanWins / tally.battles, 0) : "—"} <span className="font-normal text-ink-3">(fair {pct(humans / players, 0)})</span>
              </div>
            </div>
            <div>
              <div className="text-ink-3">humans spent</div>
              <div className="font-semibold tabular-nums">{money(tally.humanSpent)}</div>
            </div>
            <div>
              <div className="text-ink-3">humans took home</div>
              <div className={`font-semibold tabular-nums ${tally.humanWon < tally.humanSpent && tally.battles > 4 ? "text-bad" : ""}`}>{money(tally.humanWon)}</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
