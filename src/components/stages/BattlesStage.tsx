"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattlesConfig } from "@/engine/types";
import { BATTLE_MODES, playBattle, prepareBattle, type BattleOutcome, type BattleTable } from "@/engine/labs/battles";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { sfc32, type Rng } from "@/engine/rng";
import { seatName } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { Badge, Card, Info } from "../ui";
import { MiniReel } from "../lab/MiniReel";
import { CountUp } from "../lab/CountUp";
import { useSkin } from "../lab/SkinContext";

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

// pacing with "fast reveal" off: every seat's reel decelerates for SPIN_MS, seats start STAGGER_MS apart,
// then values and totals settle for SETTLE_MS before the next round; the winner is announced after FINAL_MS.
const SPIN_MS = 3400;
const STAGGER_MS = 220;
const SETTLE_MS = 1300;
const FINAL_MS = 1100;
const COIN_MS = 1700;

type Phase = "idle" | "round" | "settle" | "done";

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
  const pools = useMemo(() => (session.table ? session.table.openers.map((o) => o.displayed.items.map((r) => ({ item: r.item, weight: r.weight }))) : []), [session.table]);
  const coin = cfg.mode === "coinflip";
  const brk = cfg.mode === "break";
  const skin = useSkin();

  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [battleNo, setBattleNo] = useState(0);
  const [fast, setFast] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY);

  useEffect(() => {
    setOutcome(null);
    setRevealed([]);
    setRound(0);
    setPhase("idle");
    setTally(EMPTY);
  }, [key]);

  const players = session.table?.players ?? 0;
  const humans = session.table?.humans ?? 0;
  const rounds = coin ? 0 : cfg.boxes.length;

  // a round is over when every seat has landed (or the coin has stopped)
  useEffect(() => {
    if (phase !== "round" || !outcome || !players) return;
    if (coin) {
      const t = setTimeout(() => setPhase("settle"), fast ? 100 : COIN_MS);
      return () => clearTimeout(t);
    }
    for (let p = 0; p < players; p++) if (!revealed[round * players + p]) return;
    setPhase("settle");
  }, [revealed, phase, round, outcome, players, coin, fast]);

  // settle, then next round or the announcement
  useEffect(() => {
    if (phase !== "settle" || !outcome) return;
    const last = coin || round + 1 >= rounds;
    const t = setTimeout(
      () => {
        if (last) setPhase("done");
        else {
          setRound((r) => r + 1);
          setPhase("round");
        }
      },
      fast ? 120 : last ? FINAL_MS : SETTLE_MS,
    );
    return () => clearTimeout(t);
  }, [phase, round, rounds, outcome, fast, coin]);

  // book the battle once it is over
  useEffect(() => {
    if (phase !== "done" || !outcome || !session.table) return;
    const { entry } = session.table;
    const humanWon = outcome.share.slice(0, humans).reduce((a, b) => a + b, 0);
    let humanWin: number;
    if (cfg.mode === "group") humanWin = humans / players;
    else if (brk) humanWin = outcome.share.slice(0, humans).filter((s) => s >= entry).length / humans;
    else humanWin = outcome.winner >= 0 && outcome.winner < humans ? 1 : 0;
    setTally((t) => ({ battles: t.battles + 1, humanWins: t.humanWins + humanWin, humanSpent: t.humanSpent + entry * humans, humanWon: t.humanWon + humanWon, pot: t.pot + outcome.pot }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const markRevealed = useCallback((idx: number) => {
    setRevealed((prev) => {
      if (prev[idx]) return prev;
      const c = prev.slice();
      c[idx] = true;
      return c;
    });
  }, []);

  const busy = phase === "round" || phase === "settle";
  const start = () => {
    if (!session.table || busy) return;
    const o = playBattle(session.table, cfg, session.rng, session.counter, 0);
    const n = rounds * session.table.players;
    setOutcome(o);
    setBattleNo((b) => b + 1);
    if (coin) {
      setRevealed([]);
      setRound(0);
      setPhase("round");
    } else if (fast) {
      setRevealed(new Array(n).fill(true));
      setRound(rounds - 1);
      setPhase("settle");
    } else {
      setRevealed(new Array(n).fill(false));
      setRound(0);
      setPhase("round");
    }
  };
  const reset = () => {
    sRef.current = null;
    setOutcome(null);
    setRevealed([]);
    setRound(0);
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

  const { entry } = session.table;
  const mode = BATTLE_MODES.find((m) => m.id === cfg.mode)!;
  const done = phase === "done" && outcome;
  const activeBox = cfg.boxes[Math.min(round, Math.max(0, cfg.boxes.length - 1))];
  const runningTotal = (p: number) => {
    if (!outcome) return 0;
    let s = 0;
    for (let r = 0; r < rounds; r++) if (revealed[r * players + p]) s += outcome.pulls[r * players + p].rec.payout;
    return s;
  };
  const seatScore = (p: number) => (cfg.mode === "terminal" ? (done ? outcome.lastRound[p] : revealed[(rounds - 1) * players + p] && outcome ? outcome.lastRound[p] : 0) : runningTotal(p));
  const seatWins = (p: number) => !!done && (cfg.mode === "group" ? true : brk ? outcome.share[p] >= entry : outcome.winner === p);

  const winnerLine = () => {
    if (!done) return null;
    const paidIn = entry * players;
    if (cfg.mode === "group") return { tone: "accent", title: `Pot ${money(outcome.pot)} split ${players} ways`, sub: `${money(outcome.pot / players)} each against an entry of ${money(entry)}. The house kept ${money(paidIn - outcome.pot)}.` };
    if (brk) {
      const humanWon = outcome.share.slice(0, humans).reduce((a, b) => a + b, 0);
      return { tone: humanWon >= entry * humans ? "good" : "accent", title: "No pot: everyone keeps their own pulls", sub: `Humans took home ${money(humanWon)} for ${money(entry * humans)} paid in; the table as a whole returned ${money(outcome.pot)} of ${money(paidIn)}.` };
    }
    const w = outcome.winner;
    const name = seatName(w, humans);
    const human = w < humans;
    return {
      tone: human ? "good" : "bad",
      title: human ? (w === 0 ? `You win the pot of ${money(outcome.pot)}` : `${name} wins the pot of ${money(outcome.pot)}`) : `${name} (house bot) takes the pot of ${money(outcome.pot)}`,
      sub: `Players paid ${money(paidIn)} in; the house kept ${money(paidIn - outcome.pot)}${coin ? ` (its ${pct(cfg.coinflipEdge ?? 0, 0)} edge)` : ""}.${outcome.tied ? " Tie broken at random." : ""}`,
    };
  };
  const wl = winnerLine();

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name={coin ? "fluent:coin" : "fluent:trophy"} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{mode.name}</span>
              <Info>{mode.rule}</Info>
              <Badge tone="accent">
                {players} players · {humans} human{humans > 1 ? "s" : ""} vs {players - humans} bot{players - humans === 1 ? "" : "s"}
              </Badge>
              <Badge>
                entry {money(entry)} per player · pot of entries {money(entry * players)}
              </Badge>
            </div>
          </div>
          <label className="flex items-center gap-1 text-xs text-ink-2" data-tip="Off: every seat spins a reel round by round. On: show the result at once." data-tip-end="">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} disabled={busy} /> fast reveal
          </label>
        </div>
        {!coin && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {cfg.boxes.map((b, i) => (
              <button key={i} type="button" className={`chip ${busy && i === round ? "chip-accent" : ""}`} onClick={() => onSettings("boxes")}>
                <Icon name="ph:package" size={12} /> Round {i + 1}: {b.name.split(" · ")[0]} · {money(b.price)}
              </button>
            ))}
            {busy && activeBox && (
              <span className="ml-auto flex items-center gap-1 text-xs text-accent-ink animate-rise">
                <Icon name="ph:timer" size={14} /> Round {round + 1} of {rounds}: {activeBox.name.split(" · ")[0]} {phase === "round" ? "opening…" : "settled"}
              </span>
            )}
          </div>
        )}

        {wl && (
          <div className={`mt-3 animate-pop rounded-xl border px-4 py-3 text-center ${wl.tone === "good" ? "border-good/40 bg-good-soft" : wl.tone === "bad" ? "border-bad/40 bg-bad-soft" : "border-accent/40 bg-accent-soft"}`}>
            <div className="flex items-center justify-center gap-2 text-base font-semibold">
              <Icon name={wl.tone === "good" ? "ph:confetti" : wl.tone === "bad" ? "ph:robot" : "ph:users"} size={22} className={wl.tone === "good" ? "text-good" : wl.tone === "bad" ? "text-bad" : "text-accent-ink"} />
              {wl.title}
            </div>
            <div className="text-xs text-ink-2">{wl.sub}</div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[560px] gap-2" style={{ gridTemplateColumns: `repeat(${players}, minmax(0, 1fr))` }}>
            {Array.from({ length: players }, (_, p) => {
              const isBot = p >= humans;
              const win = seatWins(p);
              const lose = !!done && !win;
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
                    {win && cfg.mode !== "group" && !brk && <Icon name="ph:crown" size={20} className="ml-auto animate-pop text-warn" />}
                  </div>
                  {coin ? (
                    <div className="mt-2 flex h-24 items-center justify-center rounded-lg border border-line bg-surface">
                      <div className={phase === "round" ? "animate-coin" : ""} style={{ perspective: 400 }}>
                        <Icon name="fluent:coin" size={56} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {Array.from({ length: rounds }, (_, r) => {
                        const idx = r * players + p;
                        const pull = outcome?.pulls[idx];
                        const item = pull ? CATALOG_BY_ID.get(pull.rec.itemId) : undefined;
                        const isRevealed = !!(outcome && revealed[idx]);
                        const spinning = !!(outcome && item && !revealed[idx] && phase === "round" && r === round);
                        if (spinning) {
                          return (
                            <div key={`${battleNo}-${r}-${p}`}>
                              <MiniReel pool={pools[r]} winner={item!} delay={p * STAGGER_MS} duration={SPIN_MS} loss={pull!.rec.payout < cfg.boxes[r].price} price={cfg.boxes[r].price} nearMiss={cfg.rigs.nearMiss} onDone={() => markRevealed(idx)} />
                            </div>
                          );
                        }
                        return (
                          <div key={r} className="flex h-12 items-center gap-2 rounded-lg border border-line bg-surface px-2">
                            {isRevealed && item && pull ? (
                              <>
                                <div className="animate-pop">
                                  <ItemTile item={item} size={36} />
                                </div>
                                <div className="min-w-0 flex-1 animate-rise">
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
                  )}
                  <div className="mt-2 flex items-baseline justify-between border-t border-line pt-1.5">
                    <span className="text-[11px] text-ink-3">{coin ? "stake" : cfg.mode === "terminal" ? "last round" : "total"}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{coin ? money(entry) : <CountUp value={seatScore(p)} format={money} />}</span>
                  </div>
                  {done && (
                    <div className={`mt-1 text-right text-xs animate-rise ${outcome.share[p] > 0 ? "font-semibold text-accent-ink" : "text-ink-3"}`}>
                      {outcome.share[p] > 0 ? `${brk ? "keeps" : "takes"} ${money(outcome.share[p])}` : "takes nothing"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={busy}>
            <Icon name="ph:play" size={18} className="text-white" /> {busy ? (coin ? "Flipping…" : "Battle in progress…") : outcome ? (coin ? "Flip again" : "Next battle") : coin ? "Flip" : skin.terms.startBattle}
          </button>
          <button type="button" className="btn" onClick={reset} disabled={busy}>
            <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset session
          </button>
          <div className="ml-auto grid grid-cols-4 gap-2 text-right text-xs">
            <div>
              <div className="text-ink-3">{coin ? "flips" : "battles"}</div>
              <div className="font-semibold tabular-nums">{num(tally.battles)}</div>
            </div>
            <div>
              <div className="text-ink-3">{brk ? "humans ≥ entry" : "human wins"}</div>
              <div className="font-semibold tabular-nums">
                {tally.battles ? pct(tally.humanWins / tally.battles, 0) : "—"} {!brk && <span className="font-normal text-ink-3">(fair {pct(humans / players, 0)})</span>}
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
