"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KitBattlesConfig } from "@/engine/types";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { randomHex } from "@/engine/hash";
import { KIT_BATTLE_MODES, battleCommit, canTransition, resolveBattle, verifyBattle, type BattleResolution, type BattleSeatSeed, type BattleStatus, type BattleVerifyResult } from "@/engine/labs/battleKit";
import { entryOf, kitMode, prepareRound } from "@/lib/kitBattles";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { Badge, Card, Info, Td, Th } from "../ui";
import { MiniReel } from "../lab/MiniReel";
import { CountUp } from "../lab/CountUp";

/**
 * The committed-seed battle from the backend kit, played live. One secret per battle hashed before anyone joins,
 * a server-generated seed per seat, every pull a normal open with its nonce fixed by position, and the status moving through
 * the same state machine the database will carry. The admin panel decides what is allowed; the player plays inside it.
 */

type SeatKind = "you" | "player" | "bot";
interface Seat {
  seat: number;
  kind: SeatKind;
  name: string;
  clientSeed: string;
  source: "server" | "bot";
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
  sponsored: boolean;
  seats: Seat[];
  events: Ev[];
  res: BattleResolution | null;
  startsAt: number | null;
  startedAt: string | null;
  settledAt: string | null;
}
/** A seat in a lobby room: a simulated player or a bot, joined or still coming. */
export interface LobbySeat {
  kind: "player" | "bot";
  name: string;
  joined: boolean;
}
/** A room from the lobby that you join: its secret, its creator, its seats, and the seat you take. */
export interface JoinedRoom {
  id: string;
  serverSeed: string;
  creator: string;
  seats: LobbySeat[];
  youSeat: number;
}
/** What the admin panel's battle list and report receive when a battle settles. */
export interface KitBattleRecord {
  id: string;
  mode: string;
  seats: number;
  bots: number;
  sponsored: boolean;
  potCents: number;
  winners: number[];
  winnerName: string;
  playerEntriesCents: number;
  playerPaidCents: number;
  feeCents: number;
  settledAt: string;
  youSpentCents: number;
  youWonCents: number;
  youWon: boolean;
}

const SPIN_MS = 3400;
const STAGGER_MS = 220;
const SETTLE_MS = 1300;
const COIN_MS = 1700;
const JOIN_MS = 420;
/** Simulated players for the lobby and for the seats that fill on their own. */
export const SIM_NAMES = ["Marco_88", "lena.v", "Kai", "JDM_Rex", "Sofia", "Tomasz", "ayumi", "Dre", "Noor", "Felix", "Rina", "Big_Lou", "Hana", "Viktor"];

const DISPLAY: Record<BattleStatus, { word: string; tone: "neutral" | "accent" | "good" | "warn" | "bad" }> = {
  open: { word: "Waiting", tone: "neutral" },
  full: { word: "Waiting · starting", tone: "accent" },
  in_progress: { word: "Ongoing", tone: "accent" },
  settling: { word: "Ongoing · settling", tone: "accent" },
  finished: { word: "Settled", tone: "good" },
  cancelled: { word: "Cancelled", tone: "warn" },
  expired: { word: "Expired", tone: "warn" },
};

const clock = () => new Date().toISOString().slice(11, 23);
const short = (h: string, n = 10) => (h.length > n * 2 + 1 ? `${h.slice(0, n)}…${h.slice(-n)}` : h);
const cents = (c: number) => money(c / 100);

export function KitBattleStage({ cfg, onSettings, onRecord, room, onExit }: { cfg: KitBattlesConfig; onSettings: (section?: string) => void; onRecord?: (r: KitBattleRecord) => void; room?: JoinedRoom | null; onExit?: () => void }) {
  const { settings: s, play } = cfg;
  const mode = kitMode(play.mode);
  const coin = mode === "coinflip";
  const brk = mode === "break";
  const grp = mode === "group";
  const modeDef = KIT_BATTLE_MODES.find((m) => m.id === mode)!;
  const prepared = useMemo(() => play.rounds.map((bi, i) => prepareRound(cfg.boxes[bi], i)), [cfg.boxes, play.rounds]);
  const rounds = useMemo(() => prepared.map((p) => p.round), [prepared]);
  const pools = useMemo(() => prepared.map((p) => p.pool), [prepared]);
  const players = coin ? 2 : play.seats;
  const humans = room ? room.seats.filter((x, i) => i === room.youSeat || x.kind !== "bot").length : s.botsEnabled ? Math.min(players, Math.max(1, play.humans)) : players;
  const { baseCents, feeCents, entryCents } = entryOf(rounds, s.feePercent);
  const sponsored = s.sponsored.enabled;
  const evPerSeat = prepared.reduce((a, p) => a + p.evCents, 0);
  const error = !s.enabled ? "Battles are switched off in the admin panel." : !rounds.length ? "No rounds: pick at least one box." : rounds.some((r) => r.table.entries.length === 0) ? "A round has no items with odds." : null;

  const [battle, setBattle] = useState<Battle | null>(null);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<"idle" | "round" | "settle">("idle");
  const [countdown, setCountdown] = useState(0);
  const [fast, setFast] = useState(false);
  const [you, setYou] = useState(0);
  const [botsAsked, setBotsAsked] = useState(false);
  const [verify, setVerify] = useState<BattleVerifyResult | null>(null);
  const [tamper, setTamper] = useState(false);
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

  // mounted per battle (the lab keys this component by room): create a new room, or take a seat in the one you joined
  useEffect(() => {
    if (room) joinRoom(room);
    else create();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
    const names = s.botNames.length ? s.botNames : ["Bot"];
    const seats: Seat[] = Array.from({ length: players }, (_, p) => {
      const kind: SeatKind = p === 0 ? "you" : p < humans ? "player" : "bot";
      const name = kind === "you" ? "You" : kind === "player" ? SIM_NAMES[(p * 7 + serverSeed.charCodeAt(0)) % SIM_NAMES.length] : names[(p - humans) % names.length];
      const clientSeed = kind === "bot" ? `bot-${randomHex(4)}` : `seat-${p}-${randomHex(4)}`;
      return { seat: p, kind, name, clientSeed, source: kind === "bot" ? "bot" : "server", joined: p === 0 };
    });
    const b: Battle = { id: randomHex(6), version: 0, status: "open", serverSeed, serverHash: battleCommit(serverSeed), sponsored, seats, events: [], res: null, startsAt: null, startedAt: null, settledAt: null };
    b.events.push(
      { at: clock(), actor: "you", event: "created", data: `hash ${short(b.serverHash)}${`; seat 0 held ${cents(entryCents)}`}` },
      { at: clock(), actor: "you", event: "joined", data: "seat 0" },
    );
    setYou(0);
    setBotsAsked(false);
    setBattle(b);
  };

  /** Join: the room already exists with its secret hash; you take the free seat and your entry is held. */
  const joinRoom = (r: JoinedRoom) => {
    const seats: Seat[] = r.seats.map((x, p) =>
      p === r.youSeat
        ? { seat: p, kind: "you", name: "You", clientSeed: `seat-${p}-${randomHex(4)}`, source: "server", joined: true }
        : { seat: p, kind: x.kind, name: x.name, clientSeed: x.kind === "bot" ? `bot-${randomHex(4)}` : `seat-${p}-${randomHex(4)}`, source: x.kind === "bot" ? "bot" : "server", joined: x.joined },
    );
    const b: Battle = { id: r.id, version: 0, status: "open", serverSeed: r.serverSeed, serverHash: battleCommit(r.serverSeed), sponsored: false, seats, events: [], res: null, startsAt: null, startedAt: null, settledAt: null };
    b.events.push({ at: clock(), actor: r.creator, event: "created", data: `hash ${short(b.serverHash)}; seat 0 held ${cents(entryCents)}` });
    seats.forEach((x) => {
      if (x.joined && x.seat !== 0) b.events.push({ at: clock(), actor: x.kind === "you" ? "you" : x.kind === "bot" ? "server" : x.name, event: "joined", data: `seat ${x.seat}${x.kind === "bot" ? ` (${x.name}, bot, no hold)` : ` held ${cents(entryCents)}`}` });
    });
    setYou(r.youSeat);
    setBotsAsked(true);
    setBattle(b);
  };

  /** Seats join one by one: simulated players on their own, bots once the creator asks; the last seat starts the countdown on the "server". */
  useEffect(() => {
    if (!battle || battle.status !== "open") return;
    const next = battle.seats.find((x) => !x.joined && (x.kind !== "bot" || botsAsked));
    if (!next) {
      if (battle.seats.every((x) => x.joined)) {
        const secs = fast ? 0 : s.countdownSeconds;
        transition("full", "server", "full", `countdown ${secs}s`, { startsAt: Date.now() + secs * 1000 });
        setCountdown(secs);
      }
      return;
    }
    const wait = fast ? 80 : next.kind === "bot" ? JOIN_MS : 900 + ((next.seat * 613 + battle.serverSeed.charCodeAt(next.seat)) % 1500);
    const t = setTimeout(() => {
      setBattle((b) =>
        b
          ? {
              ...b,
              seats: b.seats.map((y) => (y.seat === next.seat ? { ...y, joined: true } : y)),
              events: [...b.events, { at: clock(), actor: next.kind === "bot" ? "server" : next.name, event: "joined", data: `seat ${next.seat}${next.kind === "bot" ? ` (${next.name}, bot, no hold)` : ` held ${cents(entryCents)}`}` }],
            }
          : b,
      );
    }, wait);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle?.status, battle?.seats, botsAsked, fast]);

  // the countdown; at zero the server starts the battle and resolves every round from the committed inputs
  useEffect(() => {
    if (!battle || battle.status !== "full") return;
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
    const seatSeeds: BattleSeatSeed[] = battle.seats.map((x) => ({ seat: x.seat, clientSeed: x.clientSeed }));
    const res = resolveBattle(mode, rounds, seatSeeds, battle.serverSeed, { coinflipEdge: s.coinflipEdge, creditFaceCents: s.creditFaceCents });
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

  // settle the round, then the next; after the last: awards and ledger (settling), then finished and the secret
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
          const settledAt = clock();
          transition("finished", "server", "finished", "awards and ledger written", { settledAt });
          appendEvent("server", "revealed", `secret ${short(battle.serverSeed, 8)}`);
          const playerSeats = battle.seats.filter((x) => x.kind !== "bot");
          onRecord?.({
            id: battle.id,
            mode,
            seats: players,
            bots: players - humans,
            sponsored,
            potCents: res.potCents,
            winners: res.winners,
            winnerName: grp ? "everyone (split)" : brk ? "everyone (own pulls)" : battle.seats[res.winners[0]].name + (battle.seats[res.winners[0]].kind === "bot" ? " (bot)" : ""),
            playerEntriesCents: sponsored ? 0 : playerSeats.length * entryCents,
            playerPaidCents: playerSeats.reduce((a, x) => a + res.sharesCents[x.seat], 0),
            feeCents: sponsored ? 0 : playerSeats.length * feeCents,
            settledAt,
            youSpentCents: entryCents,
            youWonCents: res.sharesCents[you],
            youWon: !grp && !brk && res.winners.includes(you),
          });
        }, fast ? 150 : 700);
      },
      fast ? 120 : SETTLE_MS,
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


  const check = () => {
    if (!battle?.res) return;
    const seatSeeds = battle.seats.map((x) => ({ seat: x.seat, clientSeed: x.clientSeed }));
    const seed = tamper ? battle.serverSeed.slice(0, -1) + (battle.serverSeed.endsWith("0") ? "1" : "0") : battle.serverSeed;
    setVerify(verifyBattle(mode, rounds, seatSeeds, seed, { serverHash: battle.serverHash, winners: battle.res.winners, totals: battle.res.totals, pullOutcomeIds: battle.res.pulls.map((p) => p.outcomeId) }, { coinflipEdge: s.coinflipEdge, creditFaceCents: s.creditFaceCents }));
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
        const r = resolveBattle(mode, rounds, seatSeeds, randomHex(32), { coinflipEdge: s.coinflipEdge, creditFaceCents: s.creditFaceCents });
        if (r.winners.includes(0)) wins++;
        pot += r.potCents;
      }
      setFair({ n, wins, paidIn: n * baseCents * players, pot });
    }, 30);
  };

  if (error) {
    return (
      <Card title="No battle to play">
        <p className="text-sm text-ink-2">{error}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings(s.enabled ? "boxes" : "settings")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Open the admin panel
        </button>
      </Card>
    );
  }

  const res = battle?.res ?? null;
  const status = battle?.status ?? null;
  const busy = !!status && status !== "open" && status !== "finished";
  const done = status === "finished" && !!res;
  const runningTotal = (p: number) => {
    if (!res) return 0;
    let t = 0;
    for (let r = 0; r < rounds.length; r++) if (revealed[r * players + p]) t += res.pulls[r * players + p].valueCents;
    return t;
  };
  const seatScore = (p: number) => (mode === "terminal" ? (done || revealed[(rounds.length - 1) * players + p] ? (res?.lastRound[p] ?? 0) : 0) : runningTotal(p));
  const seatWins = (p: number) => done && res.winners.includes(p);

  const winnerLine = () => {
    if (!done || !battle) return null;
    const paidIn = sponsored ? 0 : battle.seats.filter((x) => x.kind !== "bot").length * entryCents;
    const paid = sponsored ? `The house paid every entry (sponsored by ${s.sponsored.sponsor}).` : `Players paid ${cents(paidIn)} in${feeCents ? `, of which ${cents(feeCents * humans)} was the fee` : ""}.`;
    if (grp) return { tone: "accent", title: `Pot ${cents(res.potCents)} split ${players} ways`, sub: `${cents(res.sharesCents[1])} each against an entry of ${cents(entryCents)}. ${paid}` };
    if (brk) return { tone: res.sharesCents[you] >= entryCents ? "good" : "accent", title: "No pot: everyone keeps their own pulls", sub: `You took home ${cents(res.sharesCents[you])} for ${cents(sponsored ? 0 : entryCents)} paid in.` };
    const w = res.winners[0];
    const seat = battle.seats[w];
    const tie = res.tiedSeats.length > 1 ? ` Tie between seats ${res.tiedSeats.join(", ")} broken by the extra roll (nonce ${res.extra?.nonce}).` : "";
    if (seat.kind === "bot") return { tone: "bad", title: `${seat.name} (house bot) wins the pot of ${cents(res.potCents)}`, sub: `The pot returns to the house: no award, no ledger row. ${paid}${tie}` };
    return { tone: w === you ? "good" : "accent", title: w === you ? `You win the pot of ${cents(res.potCents)}` : `${seat.name} wins the pot of ${cents(res.potCents)}`, sub: `${w === you ? "Items become awards (ship or trade in); credit goes to the ledger." : "Their items become awards; their credit goes to their ledger."} ${paid}${coin ? ` The house kept its ${pct(s.coinflipEdge, 0)} edge.` : ""}${tie}` };
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
              <Badge>
                entry {cents(entryCents)} per seat{feeCents ? ` (incl. ${pct(s.feePercent / 100, 0)} fee)` : ""}
              </Badge>
              {sponsored && <Badge tone="warn">Sponsored by {s.sponsored.sponsor}</Badge>}
              {disp && <Badge tone={disp.tone}>{disp.word}</Badge>}
            </div>
          </div>
          <label className="flex items-center gap-1 text-xs text-ink-2" data-tip="Off: every seat spins a reel round by round. On: show the result at once." data-tip-end="">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} disabled={busy} /> fast reveal
          </label>
        </div>

        {!coin && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {prepared.map((p, i) => (
              <span key={i} className={`chip ${busy && i === round && status === "in_progress" ? "chip-accent" : ""}`} title={`table hash ${p.round.table.hash}`}>
                <Icon name="ph:package" size={12} /> Round {i + 1}: {p.box.name.split(" · ")[0]} · {cents(p.round.priceCents)}
              </span>
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
              const label = seat ? (joined ? seat.name : "Empty seat") : p === 0 ? "You" : p < humans ? `Player ${p + 1}` : (s.botNames[(p - humans) % Math.max(1, s.botNames.length)] ?? "Bot");
              return (
                <div key={p} className={`rounded-xl border p-2 transition ${win ? "border-accent bg-accent-soft animate-glow" : lose ? "border-line bg-paper opacity-70" : joined ? "border-line bg-paper" : "border-dashed border-line bg-paper/60"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isBot ? "bg-ink-3/20" : "bg-accent-soft"}`}>
                      <Icon name={isBot ? "ph:robot" : "ph:user"} size={18} className={isBot ? "text-ink-2" : "text-accent-ink"} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{label}</div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-3">{isBot ? "house bot" : seat?.kind === "you" || (!seat && p === 0) ? "you" : "player"}</div>
                    </div>
                    {win && !grp && !brk && <Icon name="ph:crown" size={20} className="ml-auto animate-pop text-warn" />}
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
                    <span className="font-mono text-sm font-semibold tabular-nums">{coin ? cents(baseCents) : <CountUp value={seatScore(p) / 100} format={money} />}</span>
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
          {status === "open" && battle ? (
            <>
              {!room && !botsAsked && battle.seats.some((x) => !x.joined && x.kind === "bot") ? (
                <button type="button" className="btn btn-primary btn-lg" onClick={() => setBotsAsked(true)}>
                  <Icon name="ph:robot" size={18} className="text-white" /> Ask bots to join
                </button>
              ) : (
                <button type="button" className="btn btn-primary btn-lg" disabled>
                  <Icon name="ph:timer" size={18} className="text-white" /> Waiting for players · {battle.seats.filter((x) => x.joined).length} of {players}
                </button>
              )}
              <button type="button" className="btn" onClick={() => onExit?.()}>
                <Icon name="ph:arrow-left" size={16} /> {room ? "Leave (entry refunded)" : "Cancel (entry refunded)"}
              </button>
            </>
          ) : status === "finished" ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => onExit?.()}>
              <Icon name="ph:arrow-left" size={18} className="text-white" /> Back to the lobby
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" disabled>
              <Icon name="ph:play" size={18} className="text-white" /> {status === "full" ? `Starting in ${countdown}…` : "Battle in progress…"}
            </button>
          )}
          {battle && (
            <span className="ml-auto text-xs text-ink-3">
              {room ? `Room opened by ${room.creator}` : "Your room"} · you are seat {you}
            </span>
          )}
        </div>
      </Card>

      {/* analysis, every part folded, as on the Misty page */}
      {battle && (
        <Card title="Analysis">
          <div className="space-y-2">
            <details className="acc">
              <summary>
                The sums: what seats pay in, what the boxes pay back, what the house keeps
                <Info>Every seat opens the same boxes with the same odds, so over many battles each seat takes home what its boxes pay back on average. Bots do not change your expectation; they change who sits across the table.</Info>
              </summary>
              <div className="space-y-2 pt-3 text-sm text-ink-2">
                <div className="tbl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <Th>Round</Th>
                        <Th right>Price</Th>
                        <Th right>Pays back per open</Th>
                        <Th right>Return</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepared.map((p, i) => (
                        <tr key={i} className="border-t border-line">
                          <Td>{coin ? "stake" : `${i + 1}. ${p.box.name.split(" · ")[0]}`}</Td>
                          <Td right mono>{cents(p.round.priceCents)}</Td>
                          <Td right mono>{coin ? "—" : cents(Math.round(p.evCents))}</Td>
                          <Td right mono>{coin ? "—" : pct(p.ret, 1)}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-ink font-semibold">
                        <Td>Entry per seat{feeCents ? ` (boxes ${cents(baseCents)} + fee ${cents(feeCents)})` : ""}</Td>
                        <Td right mono>{cents(entryCents)}</Td>
                        <Td right mono>{coin ? cents(Math.round(baseCents * (1 - s.coinflipEdge))) : cents(Math.round(evPerSeat))}</Td>
                        <Td right mono>{coin ? pct(1 - s.coinflipEdge, 1) : pct(evPerSeat / Math.max(1, entryCents), 1)}</Td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p>
                  {coin
                    ? `Two stakes of ${cents(baseCents)} make ${cents(baseCents * 2)}; the house takes its ${pct(s.coinflipEdge, 0)} first, so the winner gets ${cents(Math.floor(baseCents * 2 * (1 - s.coinflipEdge)))}.`
                    : `${players} seats pay ${cents(entryCents * players)} in. The boxes pay back about ${cents(Math.round(evPerSeat * players))} in items across the table on average, so the house expects to keep about ${cents(Math.round((entryCents - evPerSeat) * players))} per battle${feeCents ? `, of which ${cents(feeCents * players)} is the fee` : ""}. With ${players - humans} bot${players - humans === 1 ? "" : "s"} the house funds ${players - humans} of the seats itself, so against you it expects to keep ${cents(Math.round(entryCents - evPerSeat))} per battle: exactly what a single open of the same boxes keeps.`}
                </p>
              </div>
            </details>

            <details className="acc">
              <summary>
                What the database holds right now
                {disp && <Badge tone={disp.tone}>{battle.status}</Badge>}
                <span className="text-xs font-normal text-ink-3">version {battle.version}</span>
              </summary>
              <div className="grid gap-3 pt-3 md:grid-cols-2">
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
                          ["sponsored", battle.sponsored ? `true · ${s.sponsored.sponsor}` : "false"],
                          ["rounds", rounds.map((r) => `${r.slug} · ${short(r.table.hash, 6)} · ${cents(r.priceCents)}`).join("; ") || "none (coinflip)"],
                          ["entry_cents", String(entryCents)],
                          ["fee_percent", String(s.feePercent)],
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
                  <div className="mb-1 mt-3 text-xs font-semibold text-ink-2">battle_seats · {battle.seats.filter((x) => x.joined).length} rows</div>
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
                      {battle.seats
                        .filter((x) => x.joined)
                        .map((x) => (
                          <tr key={x.seat} className="border-t border-line">
                            <Td mono>{x.seat}</Td>
                            <Td>{x.name}</Td>
                            <Td mono>{x.clientSeed}</Td>
                            <Td>{x.source}</Td>
                            <Td right>{x.kind === "bot" || battle.sponsored ? "—" : cents(entryCents)}</Td>
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
            </details>

            {res && (
              <details className="acc">
                <summary>
                  Every roll
                  <span className="text-xs font-normal text-ink-3">nonce = round × seats + seat + 1</span>
                </summary>
                <div className="pt-3">
                  <p className="mb-2 text-xs text-ink-2">Key = DRAW-&lt;box&gt;-&lt;secret&gt;-&lt;seat seed&gt;-&lt;nonce&gt;; digest = HMAC-SHA256(key, &quot;&quot;); roll = first 13 hex / 2^52; band lookup on the round&apos;s frozen table.</p>
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
                              <Td>{battle.seats[p.seat].name}</Td>
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
                </div>
              </details>
            )}

            {done && (
              <details className="acc" open>
                <summary>
                  Was it fair? The check
                  <Info>Recomputes every roll from the revealed secret, the seat seeds and the frozen tables, and compares the hash, every pull, every total and the winner.</Info>
                </summary>
                <div className="space-y-2 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" className="btn" onClick={check}>
                      <Icon name="ph:seal-check" size={16} /> Check this battle
                    </button>
                    <label className="flex items-center gap-1 text-xs text-ink-2" title="Check with a secret that is one character off, to see the check fail.">
                      <input type="checkbox" checked={tamper} onChange={(e) => { setTamper(e.target.checked); setVerify(null); }} /> tamper with the secret
                    </label>
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
              </details>
            )}

            <details className="acc">
              <summary>
                Fairness over 2,000 battles
                <Info>Fresh secrets and seeds every time, the same seats and rounds. Seat 0 should win about one battle in {players}; the table should return what the boxes&apos; odds say.</Info>
              </summary>
              <div className="space-y-2 pt-3">
                <button type="button" className="btn" onClick={fairness} disabled={fair === "busy"}>
                  <Icon name="ph:flask" size={16} /> {fair === "busy" ? "Checking…" : "Resolve 2,000 battles"}
                </button>
                {fair && fair !== "busy" && (
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
                        {pct(fair.pot / Math.max(1, fair.paidIn), 1)} <span className="font-normal text-ink-3">of {cents(fair.paidIn)} in box prices</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-3">what decides it</div>
                      <div className="text-xs text-ink-2">{coin ? "One fair roll; the house edge is the only margin." : "The boxes' return, set in the admin panel. Every seat plays the same table with the same committed secret."}</div>
                    </div>
                  </div>
                )}
              </div>
            </details>
          </div>
        </Card>
      )}
    </div>
  );
}
