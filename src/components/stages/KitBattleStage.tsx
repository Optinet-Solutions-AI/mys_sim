"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BattlesConfig, CatalogItem, MistyBox, MistyOutcome } from "@/engine/types";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { valueAt } from "@/engine/opener";
import { buildTable } from "@/engine/labs/misty";
import { randomHex } from "@/engine/hash";
import { KIT_BATTLE_MODES, battleCommit, canTransition, resolveBattle, verifyBattle, type BattleResolution, type BattleRound, type BattleSeatSeed, type BattleStatus, type BattleVerifyResult, type KitBattleMode } from "@/engine/labs/battleKit";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { Badge, Card, Info, Td, Th } from "../ui";
import { MiniReel } from "../lab/MiniReel";
import { CountUp } from "../lab/CountUp";

/**
 * The committed-seed battle from the backend kit, played live: one secret per battle hashed before anyone joins,
 * a client seed per seat, every pull a normal open with its nonce fixed by position, the status moving through
 * the same state machine the database will carry. No shared random stream, no rigs, no favoured bots.
 */

type SeatKind = "you" | "player" | "bot";
interface Seat {
  seat: number;
  kind: SeatKind;
  clientSeed: string;
  source: "player" | "server-default" | "bot";
  joined: boolean;
}
interface Ev {
  at: string;
  actor: string;
  event: string;
  from?: BattleStatus;
  to?: BattleStatus;
  data?: string;
}
interface Battle {
  id: string;
  version: number;
  status: BattleStatus;
  serverSeed: string;
  serverHash: string;
  seats: Seat[];
  events: Ev[];
  res: BattleResolution | null;
  startsAt: number | null;
  startedAt: string | null;
  settledAt: string | null;
}
interface Tally {
  battles: number;
  yourWins: number;
  yourSpent: number;
  yourWon: number;
  paidIn: number;
  pot: number;
}
const EMPTY: Tally = { battles: 0, yourWins: 0, yourSpent: 0, yourWon: 0, paidIn: 0, pot: 0 };

const SPIN_MS = 3400;
const STAGGER_MS = 220;
const SETTLE_MS = 1300;
const COIN_MS = 1700;
const JOIN_MS = 420;
const COUNTDOWN_S = 3;

const DISPLAY: Record<BattleStatus, { word: string; tone: "neutral" | "accent" | "good" | "warn" | "bad" }> = {
  open: { word: "Waiting", tone: "neutral" },
  full: { word: "Waiting · starting", tone: "accent" },
  in_progress: { word: "Ongoing", tone: "accent" },
  settling: { word: "Ongoing · settling", tone: "accent" },
  finished: { word: "Settled", tone: "good" },
  cancelled: { word: "Cancelled", tone: "warn" },
  expired: { word: "Expired", tone: "warn" },
};

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const clock = () => new Date().toISOString().slice(11, 23);
const short = (h: string, n = 10) => (h.length > n * 2 + 1 ? `${h.slice(0, n)}…${h.slice(-n)}` : h);
const cents = (c: number) => money(c / 100);

interface Prepared {
  rounds: BattleRound[];
  pools: { item: CatalogItem; weight: number }[][];
  players: number;
  humans: number;
  entryCents: number;
  mode: KitBattleMode;
  error: string | null;
}

/** Each round's box becomes a frozen odds table: percent per item, cumulative bands, a hash. The draw model is read as weighted. */
function prepare(cfg: BattlesConfig): Prepared {
  const mode = cfg.mode as KitBattleMode;
  const coin = mode === "coinflip";
  const players = coin ? 2 : Math.max(2, Math.floor(cfg.players));
  const humans = cfg.bots.enabled ? Math.min(players, Math.max(1, Math.floor(cfg.humansPerBattle))) : players;
  const boxes = coin ? cfg.boxes.slice(0, 1) : cfg.boxes;
  const rounds: BattleRound[] = [];
  const pools: Prepared["pools"] = [];
  boxes.forEach((b, i) => {
    const items = b.items.map((it) => ({ item: CATALOG_BY_ID.get(it.itemId), weight: it.weight })).filter((x): x is { item: CatalogItem; weight: number } => !!x.item && x.weight > 0);
    const total = items.reduce((a, x) => a + x.weight, 0) || 1;
    const outcomes: MistyOutcome[] = items.map(({ item, weight }) => ({ id: item.id, label: item.name, rarity: item.tier, kind: "item", mistees: 0, freeSpins: 0, valueUsd: valueAt(item, b.valueLayer), weight: (weight / total) * 100 }));
    const box: MistyBox = { slug: slugify(b.name) || `box-${i + 1}`, name: b.name, price: b.price, tagline: "", outcomes, bonus: [], fairness: "" };
    rounds.push({ slug: box.slug, table: buildTable(box), priceCents: Math.round(b.price * 100) });
    pools.push(items);
  });
  const entryCents = rounds.reduce((a, r) => a + r.priceCents, 0);
  const error = !boxes.length ? "No boxes in the battle." : rounds.some((r) => r.table.entries.length === 0) ? "A round has no items with odds." : null;
  return { rounds, pools, players, humans, entryCents, mode, error };
}

export function KitBattleStage({ cfg, onSettings }: { cfg: BattlesConfig; onSettings: (section?: string) => void }) {
  const key = useMemo(() => JSON.stringify(cfg), [cfg]);
  const prep = useMemo(() => prepare(cfg), [cfg]);
  const { rounds, pools, players, humans, entryCents, mode } = prep;
  const coin = mode === "coinflip";
  const brk = mode === "break";
  const grp = mode === "group";
  const modeDef = KIT_BATTLE_MODES.find((m) => m.id === mode)!;

  const [mySeed, setMySeed] = useState("my-seed");
  const [battle, setBattle] = useState<Battle | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"idle" | "round" | "settle">("idle");
  const [countdown, setCountdown] = useState(0);
  const [fast, setFast] = useState(false);
  const [tally, setTally] = useState<Tally>(EMPTY);
  const [verify, setVerify] = useState<BattleVerifyResult | null>(null);
  const [tamper, setTamper] = useState(false);
  const [showDb, setShowDb] = useState(false);
  const [showRolls, setShowRolls] = useState(false);
  const [fair, setFair] = useState<{ n: number; wins: number; paidIn: number; pot: number } | "busy" | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  }, []);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  // a new configuration is a new lobby: the old battle is gone, the session tally restarts
  useEffect(() => {
    clearTimers();
    setBattle(null);
    setRevealed([]);
    setRound(0);
    setPhase("idle");
    setCountdown(0);
    setVerify(null);
    setTamper(false);
    setTally(EMPTY);
    setFair(null);
  }, [key]);
  useEffect(() => () => clearTimers(), []);

  /** The only way the status changes: guarded by the allowed transitions, a version bump and an event row, as the server does. */
  const transition = useCallback((to: BattleStatus, actor: string, event: string, data?: string, patch?: Partial<Battle>) => {
    setBattle((b) => {
      if (!b || !canTransition(b.status, to)) return b;
      return { ...b, ...patch, status: to, version: b.version + 1, events: [...b.events, { at: clock(), actor, event, from: b.status, to, data }] };
    });
  }, []);
  const appendEvent = useCallback((actor: string, event: string, data?: string, patch?: Partial<Battle>) => {
    setBattle((b) => (b ? { ...b, ...patch, events: [...b.events, { at: clock(), actor, event, data }] } : b));
  }, []);

  /** Create: the secret is drawn and hashed now; the hash is on the page before any other seat joins. */
  const create = () => {
    const serverSeed = randomHex(32);
    const seats: Seat[] = Array.from({ length: players }, (_, p) => {
      const kind: SeatKind = p === 0 ? "you" : p < humans ? "player" : "bot";
      const clientSeed = kind === "you" ? mySeed.trim() || "grailnoir-default" : kind === "player" ? `player-${p + 1}-${randomHex(3)}` : `bot-${randomHex(4)}`;
      return { seat: p, kind, clientSeed, source: kind === "bot" ? "bot" : kind === "you" && !mySeed.trim() ? "server-default" : "player", joined: p === 0 };
    });
    const b: Battle = { id: randomHex(6), version: 0, status: "open", serverSeed, serverHash: battleCommit(serverSeed), seats, events: [], res: null, startsAt: null, startedAt: null, settledAt: null };
    b.events.push({ at: clock(), actor: "you", event: "created", data: `hash ${short(b.serverHash)}; seat 0 held ${cents(entryCents)}` }, { at: clock(), actor: "you", event: "joined", data: "seat 0" });
    setBattle(b);
    setRevealed([]);
    setRound(0);
    setPhase("idle");
    setVerify(null);
    setTamper(false);
  };

  /** Fill: the other seats join one by one (each with its own seed and hold), the battle goes full, the countdown runs on the "server". */
  const fill = () => {
    if (!battle || battle.status !== "open") return;
    const others = battle.seats.filter((s) => !s.joined);
    const step = fast ? 60 : JOIN_MS;
    others.forEach((s, i) => {
      later(() => {
        setBattle((b) => (b ? { ...b, seats: b.seats.map((x) => (x.seat === s.seat ? { ...x, joined: true } : x)), events: [...b.events, { at: clock(), actor: s.kind === "bot" ? "server" : `player ${s.seat + 1}`, event: "joined", data: `seat ${s.seat}${s.kind === "bot" ? " (bot, no hold)" : ` held ${cents(entryCents)}`}` }] } : b));
      }, step * (i + 1));
    });
    const secs = fast ? 0 : COUNTDOWN_S;
    later(() => {
      transition("full", "server", "full", `countdown ${secs}s`, { startsAt: Date.now() + secs * 1000 });
      setCountdown(secs);
    }, step * (others.length + 1));
  };

  // the countdown: one tick a second; at zero the server starts the battle
  useEffect(() => {
    if (!battle || battle.status !== "full") return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    // start: resolve every round from the committed inputs; nothing after this point can change the result
    const seatSeeds: BattleSeatSeed[] = battle.seats.map((s) => ({ seat: s.seat, clientSeed: s.clientSeed }));
    const res = resolveBattle(mode, rounds, seatSeeds, battle.serverSeed, { coinflipEdge: cfg.coinflipEdge ?? 0 });
    transition("in_progress", "server", "started", `${res.pulls.length} pulls written`, { res, startedAt: clock() });
    const n = rounds.length * players;
    if (coin) {
      setRevealed([]);
      setRound(0);
      setPhase("round");
    } else if (fast) {
      setRevealed(new Array(n).fill(true));
      setRound(rounds.length - 1);
      setPhase("settle");
    } else {
      setRevealed(new Array(n).fill(false));
      setRound(0);
      setPhase("round");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.status, countdown]);

  // a round is over when every seat has landed (or the coin has stopped)
  useEffect(() => {
    if (phase !== "round" || !battle?.res) return;
    if (coin) {
      const t = setTimeout(() => setPhase("settle"), fast ? 100 : COIN_MS);
      return () => clearTimeout(t);
    }
    for (let p = 0; p < players; p++) if (!revealed[round * players + p]) return;
    setPhase("settle");
  }, [revealed, phase, round, battle?.res, players, coin, fast]);

  // settle the round, then the next one, or settle the battle: awards and ledger first, then finished and the secret
  useEffect(() => {
    if (phase !== "settle" || !battle?.res) return;
    const last = coin || round + 1 >= rounds.length;
    const t = setTimeout(
      () => {
        if (!last) {
          setRound((r) => r + 1);
          setPhase("round");
          return;
        }
        setPhase("idle");
        const res = battle.res!;
        transition("settling", "server", "settling", `pot ${cents(res.potCents)}; winners ${res.winners.join(",")}`);
        later(() => {
          transition("finished", "server", "finished", "awards and ledger written", { settledAt: clock() });
          appendEvent("server", "revealed", `secret ${short(battle.serverSeed, 8)}`);
          const youWon = res.sharesCents[0];
          const win = grp || brk ? 0 : res.winners.includes(0) ? 1 : 0;
          const playerEntries = battle.seats.filter((s) => s.kind !== "bot").length * entryCents;
          setTally((t) => ({ battles: t.battles + 1, yourWins: t.yourWins + win, yourSpent: t.yourSpent + entryCents, yourWon: t.yourWon + youWon, paidIn: t.paidIn + playerEntries, pot: t.pot + res.potCents }));
        }, fast ? 150 : 700);
      },
      fast ? 120 : last ? SETTLE_MS : SETTLE_MS,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, round]);

  const markRevealed = useCallback((idx: number) => {
    setRevealed((prev) => {
      if (prev[idx]) return prev;
      const c = prev.slice();
      c[idx] = true;
      return c;
    });
  }, []);

  const reset = () => {
    clearTimers();
    setBattle(null);
    setRevealed([]);
    setRound(0);
    setPhase("idle");
    setCountdown(0);
    setVerify(null);
    setTamper(false);
    setTally(EMPTY);
    setFair(null);
  };

  const check = () => {
    if (!battle?.res) return;
    const seatSeeds = battle.seats.map((s) => ({ seat: s.seat, clientSeed: s.clientSeed }));
    const seed = tamper ? battle.serverSeed.slice(0, -1) + (battle.serverSeed.endsWith("0") ? "1" : "0") : battle.serverSeed;
    setVerify(verifyBattle(mode, rounds, seatSeeds, seed, { serverHash: battle.serverHash, winners: battle.res.winners, totals: battle.res.totals, pullOutcomeIds: battle.res.pulls.map((p) => p.outcomeId) }, { coinflipEdge: cfg.coinflipEdge ?? 0 }));
  };

  /** Many battles with fresh secrets and seeds: does seat 0 win its fair share, and what does the table return? */
  const fairness = () => {
    setFair("busy");
    setTimeout(() => {
      const n = 2000;
      let wins = 0;
      let pot = 0;
      for (let i = 0; i < n; i++) {
        const seatSeeds = Array.from({ length: players }, (_, p) => ({ seat: p, clientSeed: `s${p}-${randomHex(4)}` }));
        const r = resolveBattle(mode, rounds, seatSeeds, randomHex(32), { coinflipEdge: cfg.coinflipEdge ?? 0 });
        if (r.winners.includes(0)) wins++;
        pot += r.potCents;
      }
      setFair({ n, wins, paidIn: n * entryCents * players, pot });
    }, 30);
  };

  if (prep.error) {
    return (
      <Card title="No battle to play">
        <p className="text-sm text-ink-2">{prep.error}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings("boxes")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Add boxes in Settings
        </button>
      </Card>
    );
  }

  const res = battle?.res ?? null;
  const status = battle?.status ?? null;
  const busy = !!status && status !== "open" && status !== "finished";
  const done = status === "finished" && !!res;
  const seatLabel = (s: Seat) => (s.kind === "you" ? "You" : s.kind === "player" ? `Player ${s.seat + 1}` : `Bot ${s.seat - humans + 1}`);
  const runningTotal = (p: number) => {
    if (!res) return 0;
    let s = 0;
    for (let r = 0; r < rounds.length; r++) if (revealed[r * players + p]) s += res.pulls[r * players + p].valueCents;
    return s;
  };
  const seatScore = (p: number) => (mode === "terminal" ? (done || revealed[(rounds.length - 1) * players + p] ? (res?.lastRound[p] ?? 0) : 0) : runningTotal(p));
  const seatWins = (p: number) => done && res.winners.includes(p);

  const winnerLine = () => {
    if (!done || !battle) return null;
    const paidIn = battle.seats.filter((s) => s.kind !== "bot").length * entryCents;
    if (grp) return { tone: "accent", title: `Pot ${cents(res.potCents)} split ${players} ways`, sub: `${cents(res.sharesCents[1])} each against an entry of ${cents(entryCents)}.` };
    if (brk) return { tone: res.sharesCents[0] >= entryCents ? "good" : "accent", title: "No pot: everyone keeps their own pulls", sub: `You took home ${cents(res.sharesCents[0])} for ${cents(entryCents)} paid in.` };
    const w = res.winners[0];
    const seat = battle.seats[w];
    const tie = res.tiedSeats.length > 1 ? ` Tie between seats ${res.tiedSeats.join(", ")} broken by the extra roll (nonce ${res.extra?.nonce}).` : "";
    if (seat.kind === "bot") return { tone: "bad", title: `${seatLabel(seat)} (house bot) wins the pot of ${cents(res.potCents)}`, sub: `The pot returns to the house: no award, no ledger row. Players paid ${cents(paidIn)} in.${tie}` };
    return { tone: w === 0 ? "good" : "accent", title: w === 0 ? `You win the pot of ${cents(res.potCents)}` : `${seatLabel(seat)} wins the pot of ${cents(res.potCents)}`, sub: `${w === 0 ? "Items become awards (ship or trade in); credit goes to the ledger." : "Their items become awards; their credit goes to their ledger."} Players paid ${cents(paidIn)} in.${coin ? ` The house kept its ${pct(cfg.coinflipEdge ?? 0, 0)} edge.` : ""}${tie}` };
  };
  const wl = winnerLine();
  const disp = status ? DISPLAY[status] : null;
  const fairShare = 1 / players;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name={coin ? "fluent:coin" : "fluent:trophy"} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold">{modeDef.name}</span>
              <Info>{modeDef.rule}</Info>
              <Badge tone="accent">
                {players} seats · {humans} human{humans > 1 ? "s" : ""}{players - humans > 0 ? ` vs ${players - humans} bot${players - humans === 1 ? "" : "s"}` : ""}
              </Badge>
              <Badge>entry {cents(entryCents)} per seat</Badge>
              {disp && <Badge tone={disp.tone}>{disp.word}</Badge>}
              <Badge tone="good">kit engine · committed seed</Badge>
            </div>
          </div>
          <label className="flex items-center gap-1 text-xs text-ink-2" data-tip="Off: every seat spins a reel round by round. On: show the result at once." data-tip-end="">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} disabled={busy} /> fast reveal
          </label>
        </div>

        {!coin && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {rounds.map((r, i) => (
              <button key={i} type="button" className={`chip ${busy && i === round && status === "in_progress" ? "chip-accent" : ""}`} onClick={() => onSettings("boxes")} title={`table hash ${r.table.hash}`}>
                <Icon name="ph:package" size={12} /> Round {i + 1}: {cfg.boxes[i]?.name.split(" · ")[0]} · {cents(r.priceCents)}
              </button>
            ))}
            {status === "in_progress" && (
              <span className="ml-auto flex items-center gap-1 text-xs text-accent-ink animate-rise">
                <Icon name="ph:timer" size={14} /> Round {round + 1} of {rounds.length} {phase === "round" ? "opening…" : "settled"}
              </span>
            )}
          </div>
        )}

        {battle && (
          <div className="mt-3 rounded-xl border border-line bg-paper px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 text-ink-2">
                <Icon name="ph:lock-key" size={14} /> Secret hash, shown before anyone joined
              </span>
              <code className="font-mono text-[11px]">{short(battle.serverHash, 12)}</code>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1 text-ink-2">
                <Icon name="ph:key" size={14} /> Secret
              </span>
              {done ? <code className="font-mono text-[11px]">{short(battle.serverSeed, 12)}</code> : <span className="text-ink-3">kept by the server until the battle is settled</span>}
            </div>
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

        {status === "full" && (
          <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent-soft px-4 py-3 text-base font-semibold text-accent-ink animate-pop">
            <Icon name="ph:timer" size={22} /> Every seat is taken. Starting in {countdown}…
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[560px] gap-2" style={{ gridTemplateColumns: `repeat(${players}, minmax(0, 1fr))` }}>
            {Array.from({ length: players }, (_, p) => {
              const seat = battle?.seats[p];
              const isBot = seat ? seat.kind === "bot" : p >= humans;
              const win = seatWins(p);
              const lose = done && !win;
              const joined = !!seat?.joined;
              return (
                <div key={p} className={`rounded-xl border p-2 transition ${win ? "border-accent bg-accent-soft animate-glow" : lose ? "border-line bg-paper opacity-70" : joined ? "border-line bg-paper" : "border-dashed border-line bg-paper/60"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isBot ? "bg-ink-3/20" : "bg-accent-soft"}`}>
                      <Icon name={isBot ? "ph:robot" : "ph:user"} size={18} className={isBot ? "text-ink-2" : "text-accent-ink"} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{seat ? (joined ? seatLabel(seat) : "Empty seat") : p === 0 ? "You" : p < humans ? `Player ${p + 1}` : `Bot ${p - humans + 1}`}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-3">{isBot ? "house bot" : p === 0 ? "you" : "player"}</div>
                    </div>
                    {win && !grp && !brk && <Icon name="ph:crown" size={20} className="ml-auto animate-pop text-warn" />}
                  </div>
                  <div className="mt-1.5 text-[10px] text-ink-3">
                    seed{" "}
                    {p === 0 && (!battle || status === "open") ? (
                      <input value={mySeed} onChange={(e) => setMySeed(e.target.value.slice(0, 64))} onBlur={() => battle && setBattle((b) => (b ? { ...b, seats: b.seats.map((s) => (s.seat === 0 ? { ...s, clientSeed: mySeed.trim() || "grailnoir-default" } : s)) } : b))} className="w-full rounded border border-line bg-surface px-1 py-0.5 font-mono text-[10px]" placeholder="grailnoir-default" title="Your client seed. Fixed when the battle fills." />
                    ) : (
                      <code className="font-mono">{seat && joined ? seat.clientSeed : "—"}</code>
                    )}
                  </div>
                  {coin ? (
                    <div className="mt-2 flex h-24 items-center justify-center rounded-lg border border-line bg-surface">
                      <div className={status === "in_progress" && phase === "round" ? "animate-coin" : ""} style={{ perspective: 400 }}>
                        <Icon name="fluent:coin" size={56} />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {rounds.map((rd, r) => {
                        const idx = r * players + p;
                        const pull = res?.pulls[idx];
                        const item = pull ? CATALOG_BY_ID.get(pull.outcomeId) : undefined;
                        const isRevealed = !!(res && revealed[idx]);
                        const spinning = !!(res && item && !revealed[idx] && phase === "round" && r === round && status === "in_progress");
                        if (spinning) {
                          return (
                            <div key={`${battle!.id}-${r}-${p}`}>
                              <MiniReel pool={pools[r]} winner={item!} delay={p * STAGGER_MS} duration={SPIN_MS} loss={pull!.valueCents < rd.priceCents} price={rd.priceCents / 100} onDone={() => markRevealed(idx)} />
                            </div>
                          );
                        }
                        return (
                          <div key={r} className="flex h-12 items-center gap-2 rounded-lg border border-line bg-surface px-2" title={pull && isRevealed ? `nonce ${pull.nonce} · roll ${pull.roll.toFixed(6)}` : undefined}>
                            {isRevealed && item && pull ? (
                              <>
                                <div className="animate-pop">
                                  <ItemTile item={item} size={36} />
                                </div>
                                <div className="min-w-0 flex-1 animate-rise">
                                  <div className="truncate text-xs">{item.name}</div>
                                  <div className={`font-mono text-xs ${pull.valueCents >= rd.priceCents ? "text-good" : "text-ink-3"}`}>
                                    {cents(pull.valueCents)} <span className="text-ink-3">· n{pull.nonce}</span>
                                  </div>
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
                    <span className="text-[11px] text-ink-3">{coin ? "stake" : mode === "terminal" ? "last round" : "total"}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums">{coin ? cents(entryCents) : <CountUp value={seatScore(p) / 100} format={money} />}</span>
                  </div>
                  {done && (
                    <div className={`mt-1 text-right text-xs animate-rise ${res.sharesCents[p] > 0 ? "font-semibold text-accent-ink" : "text-ink-3"}`}>
                      {res.sharesCents[p] > 0 ? (isBot ? `${cents(res.sharesCents[p])} back to the house` : `${brk ? "keeps" : "takes"} ${cents(res.sharesCents[p])}`) : "takes nothing"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {!battle || status === "finished" ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={create}>
              <Icon name="ph:plus" size={18} className="text-white" /> {battle ? "New battle" : "Create battle"}
            </button>
          ) : status === "open" ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={fill}>
              <Icon name="ph:users-three" size={18} className="text-white" /> {players - humans > 0 ? "Fill the seats (ask bots to join)" : "Fill the seats"}
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" disabled>
              <Icon name="ph:play" size={18} className="text-white" /> {status === "full" ? `Starting in ${countdown}…` : "Battle in progress…"}
            </button>
          )}
          <button type="button" className="btn" onClick={reset} disabled={busy}>
            <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset session
          </button>
          <div className="ml-auto grid grid-cols-4 gap-2 text-right text-xs">
            <div>
              <div className="text-ink-3">battles</div>
              <div className="font-semibold tabular-nums">{num(tally.battles)}</div>
            </div>
            <div>
              <div className="text-ink-3">your wins</div>
              <div className="font-semibold tabular-nums">
                {grp || brk ? "—" : tally.battles ? pct(tally.yourWins / tally.battles, 0) : "—"} {!grp && !brk && <span className="font-normal text-ink-3">(fair {pct(fairShare, 0)})</span>}
              </div>
            </div>
            <div>
              <div className="text-ink-3">you spent</div>
              <div className="font-semibold tabular-nums">{cents(tally.yourSpent)}</div>
            </div>
            <div>
              <div className="text-ink-3">you took home</div>
              <div className={`font-semibold tabular-nums ${tally.yourWon < tally.yourSpent && tally.battles > 4 ? "text-bad" : ""}`}>{cents(tally.yourWon)}</div>
            </div>
          </div>
        </div>

        {done && battle && (
          <div className="mt-4 space-y-2 rounded-xl border border-line bg-paper p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn" onClick={check}>
                <Icon name="ph:seal-check" size={16} /> Check this battle
              </button>
              <label className="flex items-center gap-1 text-xs text-ink-2" title="Check with a secret that is one character off, to see the check fail.">
                <input type="checkbox" checked={tamper} onChange={(e) => { setTamper(e.target.checked); setVerify(null); }} /> tamper with the secret
              </label>
              <span className="text-xs text-ink-3">Recomputes every roll from the secret, the seat seeds and the frozen tables.</span>
            </div>
            {verify && (
              <ul className="space-y-1 text-xs">
                {(
                  [
                    ["serverHash", "The secret matches the hash shown before the battle"],
                    ["pulls", "Every pull lands on the outcome shown"],
                    ["totals", "Every seat total matches"],
                    ["winners", "The same seat wins"],
                  ] as const
                ).map(([k, label]) => (
                  <li key={k} className="flex items-center gap-2">
                    <Icon name={verify.checks[k] ? "ph:check" : "ph:x-circle"} size={14} className={verify.checks[k] ? "text-good" : "text-bad"} />
                    <span className={verify.checks[k] ? "" : "text-bad"}>{label}</span>
                  </li>
                ))}
                <li className="pt-1">
                  <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Checked: this battle is exactly what the committed inputs produce" : `Does not match: ${verify.reason}`}</Badge>
                </li>
              </ul>
            )}
          </div>
        )}
      </Card>

      {battle && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Icon name="ph:table" size={16} /> What the database holds right now
              {disp && <Badge tone={disp.tone}>{battle.status}</Badge>}
              <span className="text-xs font-normal text-ink-3">version {battle.version}</span>
            </span>
          }
          actions={
            <button type="button" className="btn" onClick={() => setShowDb((v) => !v)}>
              {showDb ? "Hide" : "Show"}
            </button>
          }
        >
          {showDb ? (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="tbl min-w-0">
                <div className="mb-1 text-xs font-semibold text-ink-2">battles · one row</div>
                <table className="w-full text-xs">
                  <tbody>
                    {(
                      [
                        ["status", battle.status],
                        ["version", String(battle.version)],
                        ["mode", mode],
                        ["seats", String(players)],
                        ["rounds", rounds.map((r) => `${r.slug} · ${short(r.table.hash, 6)} · ${cents(r.priceCents)}`).join("; ") || "none (coinflip)"],
                        ["entry_cents", String(entryCents)],
                        ["server_hash", short(battle.serverHash, 14)],
                        ["server_seed", done ? short(battle.serverSeed, 14) : "(encrypted; not readable until finished)"],
                        ["winners", res ? res.winners.join(", ") : "null"],
                        ["pot_cents", res && (status === "settling" || done) ? String(res.potCents) : "null"],
                        ["shares_cents", res && (status === "settling" || done) ? res.sharesCents.join(", ") : "null"],
                        ["started_at", battle.startedAt ?? "null"],
                        ["settled_at", battle.settledAt ?? "null"],
                      ] as const
                    ).map(([k, v]) => (
                      <tr key={k} className="border-t border-line align-top">
                        <Td mono>{k}</Td>
                        <Td>{v}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mb-1 mt-3 text-xs font-semibold text-ink-2">battle_seats · {battle.seats.filter((s) => s.joined).length} rows</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <Th>seat</Th>
                      <Th>who</Th>
                      <Th>client_seed</Th>
                      <Th>source</Th>
                      <Th right>hold</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {battle.seats.filter((s) => s.joined).map((s) => (
                      <tr key={s.seat} className="border-t border-line">
                        <Td mono>{s.seat}</Td>
                        <Td>{seatLabel(s)}</Td>
                        <Td mono>{s.clientSeed}</Td>
                        <Td>{s.source}</Td>
                        <Td right>{s.kind === "bot" ? "—" : cents(entryCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tbl min-w-0">
                <div className="mb-1 text-xs font-semibold text-ink-2">battle_events · {battle.events.length} rows</div>
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <Th>at</Th>
                      <Th>actor</Th>
                      <Th>event</Th>
                      <Th>from → to</Th>
                      <Th>data</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {battle.events.map((e, i) => (
                      <tr key={i} className="border-t border-line align-top">
                        <Td mono>{e.at}</Td>
                        <Td>{e.actor}</Td>
                        <Td>{e.event}</Td>
                        <Td mono>{e.from ? `${e.from} → ${e.to}` : ""}</Td>
                        <Td>{e.data ?? ""}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-xs text-ink-2">The battle row (status, version, hash, result), the seats and the event log, as the server writes them at every step.</p>
          )}
        </Card>
      )}

      {res && (status === "in_progress" || status === "settling" || done) && (
        <Card
          title={
            <span className="flex items-center gap-2">
              <Icon name="ph:dice-five" size={16} /> Every roll
              <span className="text-xs font-normal text-ink-3">nonce = round × seats + seat + 1</span>
            </span>
          }
          actions={
            <button type="button" className="btn" onClick={() => setShowRolls((v) => !v)}>
              {showRolls ? "Hide" : "Show"}
            </button>
          }
        >
          {showRolls ? (
            <div className="tbl">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <Th>round</Th>
                    <Th>seat</Th>
                    <Th right>nonce</Th>
                    <Th>digest</Th>
                    <Th right>roll</Th>
                    <Th>outcome</Th>
                    <Th right>value</Th>
                  </tr>
                </thead>
                <tbody>
                  {res.pulls.map((p, i) => {
                    const shown = done || revealed[i];
                    return (
                      <tr key={i} className="border-t border-line">
                        <Td mono>{p.round + 1}</Td>
                        <Td>{battle ? seatLabel(battle.seats[p.seat]) : p.seat}</Td>
                        <Td right mono>{p.nonce}</Td>
                        <Td mono>{shown ? short(p.digest, 8) : "…"}</Td>
                        <Td right mono>{shown ? p.roll.toFixed(6) : "…"}</Td>
                        <Td>{shown ? p.label : "not revealed yet"}</Td>
                        <Td right mono>{shown ? cents(p.valueCents) : "…"}</Td>
                      </tr>
                    );
                  })}
                  {res.extra && (
                    <tr className="border-t border-line bg-accent-soft/40">
                      <Td mono>extra</Td>
                      <Td>{coin ? "coinflip" : res.tiedSeats.length > 1 ? "tie-break" : "jackpot"}</Td>
                      <Td right mono>{res.extra.nonce}</Td>
                      <Td mono>{done ? short(res.extra.digest, 8) : "…"}</Td>
                      <Td right mono>{done ? res.extra.roll.toFixed(6) : "…"}</Td>
                      <Td>seed = every client seed joined by |</Td>
                      <Td right mono>{done ? `seat ${res.winners[0]}` : "…"}</Td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-ink-2">Key = DRAW-&lt;box&gt;-&lt;secret&gt;-&lt;seat seed&gt;-&lt;nonce&gt;; digest = HMAC-SHA256(key, &quot;&quot;); roll = first 13 hex / 2^52; band lookup on the round&apos;s frozen table.</p>
          )}
        </Card>
      )}

      <Card
        title={
          <span className="flex items-center gap-2">
            <Icon name="ph:scales" size={16} /> Fairness check
          </span>
        }
        actions={
          <button type="button" className="btn" onClick={fairness} disabled={fair === "busy"}>
            <Icon name="ph:flask" size={16} /> {fair === "busy" ? "Checking…" : "Resolve 2,000 battles"}
          </button>
        }
      >
        {fair && fair !== "busy" ? (
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <div className="text-xs text-ink-3">seat 0 wins</div>
              <div className="font-semibold tabular-nums">
                {grp || brk ? "—" : pct(fair.wins / fair.n, 1)} <span className="font-normal text-ink-3">{grp || brk ? "no single winner in this mode" : `fair ${pct(fairShare, 1)}`}</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-3">table returned</div>
              <div className="font-semibold tabular-nums">
                {pct(fair.pot / fair.paidIn, 1)} <span className="font-normal text-ink-3">of {cents(fair.paidIn)} paid in</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-ink-3">what decides it</div>
              <div className="text-xs text-ink-2">{coin ? "One fair roll; the house edge is the only margin." : "The boxes' return, set in the admin panel. Every seat plays the same table with the same committed secret."}</div>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-2">Fresh secrets and seeds every time, {players} seats, the same rounds. Seat 0 should win about one battle in {players}; the table should return what the boxes&apos; odds say.</p>
        )}
      </Card>
    </div>
  );
}
