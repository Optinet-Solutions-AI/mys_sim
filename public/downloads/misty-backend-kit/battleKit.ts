/**
 * Battles on the committed-seed engine (kit 1.2). Pure functions, no I/O, deterministic.
 *
 * A battle is N seats opening the same box each round. One server seed is committed (sha256) when the battle is
 * created; every seat fixes its client seed when it joins; nothing about the roll can change after the battle starts.
 * Pull order is round-major, seat-minor, and the nonce of a pull is fixed by its position:
 *   nonce(round, seat) = round × seats + seat + 1          (rounds and seats counted from 0)
 * The one extra roll a mode may need (tie-break, jackpot, coinflip) uses the next nonce after the last pull:
 *   extraNonce = rounds × seats + 1
 * and a client seed made of every seat's client seed joined with "|", so no single seat controls it.
 *
 * Each pull is a normal Misty-style open against the round's table: digest = HMAC-SHA256(key, "") with
 * key = "DRAW-<slug>-<serverSeed>-<clientSeed>-<nonce>", roll = first 13 hex / 2^52, read against the bands.
 * Battles use the main table only: a bonus row pays its credits; free spins are not played in battles.
 * Values are integer cents. Credits count at the configured face (default 100 cents).
 */
import { sha256Hex } from "./hash";
import { lookup, mistyDigest, rollOf, type MistyTable } from "./misty";

export type KitBattleMode = "normal" | "crazy" | "terminal" | "jackpot" | "group" | "break" | "coinflip";

export const KIT_BATTLE_MODES: { id: KitBattleMode; name: string; rule: string }[] = [
  { id: "normal", name: "Normal", rule: "Highest total value over all rounds takes every item." },
  { id: "crazy", name: "Crazy", rule: "Lowest total value takes every item." },
  { id: "terminal", name: "Terminal", rule: "Only the last round counts; its highest pull takes every item." },
  { id: "jackpot", name: "Jackpot", rule: "A winner is drawn with probability proportional to each seat's total." },
  { id: "group", name: "Group", rule: "No winner: the pot is split equally among the seats." },
  { id: "break", name: "Break", rule: "Everyone keeps what they pulled. No pot, no winner." },
  { id: "coinflip", name: "Coinflip", rule: "No boxes. One fair roll picks the winner among the seats; the house takes a disclosed edge from the pot first." },
];

export interface BattleRound {
  /** the box slug, part of the HMAC key */
  slug: string;
  /** the frozen table of that box, as built by buildTable; its hash is pinned on the battle */
  table: MistyTable;
  /** price in cents, the entry per seat for this round */
  priceCents: number;
}
export interface BattleSeatSeed {
  seat: number;
  clientSeed: string;
}
export interface BattleOptions {
  /** cents one credit counts for in totals; default 100 */
  creditFaceCents?: number;
  /** coinflip only: house edge taken from the pot, 0..0.95 */
  coinflipEdge?: number;
}
export interface BattlePullResult {
  round: number;
  seat: number;
  nonce: number;
  key: string;
  digest: string;
  roll: number;
  outcomeId: string;
  label: string;
  kind: "item" | "credit" | "bonus";
  valueCents: number;
  credits: number;
}
export interface BattleExtraRoll {
  nonce: number;
  key: string;
  digest: string;
  roll: number;
  clientSeed: string;
}
export interface BattleResolution {
  serverHash: string;
  seats: number;
  rounds: number;
  mode: KitBattleMode;
  pulls: BattlePullResult[];
  /** value per seat in cents over all rounds */
  totals: number[];
  /** value per seat in cents in the last round */
  lastRound: number[];
  /** sum of every pull in cents (coinflip: entries less the edge) */
  potCents: number;
  /** seats that take the pot; several in group and break; empty never */
  winners: number[];
  /** what each seat takes home, cents */
  sharesCents: number[];
  /** the extra roll, when the mode needed one */
  extra: BattleExtraRoll | null;
  /** seats that tied before the tie-break, if any */
  tiedSeats: number[];
}

export const battleNonce = (round: number, seat: number, seats: number): number => round * seats + seat + 1;
export const battleExtraNonce = (rounds: number, seats: number): number => rounds * seats + 1;
export const battleCommit = (serverSeedHex: string): string => sha256Hex(serverSeedHex);
export const joinedSeeds = (seeds: BattleSeatSeed[]): string => [...seeds].sort((a, b) => a.seat - b.seat).map((s) => s.clientSeed).join("|");

const apiKind = (o: { kind: string; freeSpins: number }): "item" | "credit" | "bonus" => (o.kind === "item" ? "item" : o.freeSpins > 0 ? "bonus" : "credit");

/** One pull: the seat's open of the round's box. */
export function battlePull(round: BattleRound, roundIndex: number, seat: BattleSeatSeed, seats: number, serverSeed: string, creditFaceCents: number): BattlePullResult {
  const nonce = battleNonce(roundIndex, seat.seat, seats);
  const key = ["DRAW", round.slug, serverSeed, seat.clientSeed, String(nonce)].join("-");
  const digest = mistyDigest(round.slug, serverSeed, seat.clientSeed, nonce);
  const roll = rollOf(digest);
  const e = lookup(round.table, roll);
  const o = e.outcome;
  const kind = apiKind(o);
  const valueCents = kind === "item" ? Math.round((o.valueUsd ?? 0) * 100) : Math.round(o.mistees * creditFaceCents);
  return { round: roundIndex, seat: seat.seat, nonce, key, digest, roll, outcomeId: o.id, label: o.label, kind, valueCents, credits: kind === "item" ? 0 : o.mistees };
}

function extraRoll(label: string, rounds: number, seats: BattleSeatSeed[], serverSeed: string): BattleExtraRoll {
  const nonce = battleExtraNonce(rounds, seats.length);
  const clientSeed = joinedSeeds(seats);
  const slug = `battle-${label}`;
  const key = ["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-");
  const digest = mistyDigest(slug, serverSeed, clientSeed, nonce);
  return { nonce, key, digest, roll: rollOf(digest), clientSeed };
}

/** Resolve a whole battle from its committed inputs. Deterministic: the same inputs always give the same result. */
export function resolveBattle(mode: KitBattleMode, rounds: BattleRound[], seatSeeds: BattleSeatSeed[], serverSeed: string, opts: BattleOptions = {}): BattleResolution {
  const seats = seatSeeds.length;
  if (seats < 2) throw new Error("a battle needs at least two seats");
  const ordered = [...seatSeeds].sort((a, b) => a.seat - b.seat);
  if (ordered.some((s, i) => s.seat !== i)) throw new Error("seats must be numbered 0..n-1 without gaps");
  const face = opts.creditFaceCents ?? 100;
  const serverHash = battleCommit(serverSeed);
  const totals = new Array<number>(seats).fill(0);
  const lastRound = new Array<number>(seats).fill(0);
  const shares = new Array<number>(seats).fill(0);
  const pulls: BattlePullResult[] = [];

  if (mode === "coinflip") {
    const edge = Math.min(0.95, Math.max(0, opts.coinflipEdge ?? 0));
    const entry = rounds.reduce((s, r) => s + r.priceCents, 0);
    const pot = Math.floor(entry * seats * (1 - edge));
    const ex = extraRoll("coinflip", 0, ordered, serverSeed);
    const winner = Math.min(seats - 1, Math.floor(ex.roll * seats));
    shares[winner] = pot;
    return { serverHash, seats, rounds: 0, mode, pulls, totals, lastRound, potCents: pot, winners: [winner], sharesCents: shares, extra: ex, tiedSeats: [] };
  }

  let pot = 0;
  for (let r = 0; r < rounds.length; r++) {
    for (const seat of ordered) {
      const p = battlePull(rounds[r], r, seat, seats, serverSeed, face);
      totals[seat.seat] += p.valueCents;
      lastRound[seat.seat] = p.valueCents;
      pot += p.valueCents;
      pulls.push(p);
    }
  }

  let winners: number[] = [];
  let extra: BattleExtraRoll | null = null;
  let tiedSeats: number[] = [];
  if (mode === "group") {
    const each = Math.floor(pot / seats);
    shares.fill(each);
    shares[0] += pot - each * seats; // the odd cents go to seat 0, stated in the rules
    winners = ordered.map((s) => s.seat);
  } else if (mode === "break") {
    for (let i = 0; i < seats; i++) shares[i] = totals[i];
    winners = ordered.map((s) => s.seat);
  } else if (mode === "jackpot") {
    extra = extraRoll("jackpot", rounds.length, ordered, serverSeed);
    const sum = totals.reduce((a, x) => a + x, 0);
    let winner = seats - 1;
    if (sum === 0) {
      winner = Math.min(seats - 1, Math.floor(extra.roll * seats));
    } else {
      let acc = 0;
      const pos = extra.roll * sum;
      for (let i = 0; i < seats; i++) {
        acc += totals[i];
        if (pos < acc) {
          winner = i;
          break;
        }
      }
    }
    winners = [winner];
    shares[winner] = pot;
  } else {
    const score = mode === "terminal" ? lastRound : totals;
    const best = mode === "crazy" ? Math.min(...score) : Math.max(...score);
    const tied = score.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    let winner = tied[0];
    if (tied.length > 1) {
      tiedSeats = tied;
      extra = extraRoll("tiebreak", rounds.length, ordered, serverSeed);
      winner = tied[Math.min(tied.length - 1, Math.floor(extra.roll * tied.length))];
    }
    winners = [winner];
    shares[winner] = pot;
  }
  return { serverHash, seats, rounds: rounds.length, mode, pulls, totals, lastRound, potCents: pot, winners, sharesCents: shares, extra, tiedSeats };
}

export interface BattleVerifyClaim {
  serverHash?: string;
  winners?: number[];
  totals?: number[];
  pullOutcomeIds?: string[]; // round-major, seat-minor
}
export interface BattleVerifyResult {
  ok: boolean;
  checks: { serverHash: boolean | null; winners: boolean | null; totals: boolean | null; pulls: boolean | null };
  resolution: BattleResolution;
  reason: string | null;
}
/** Public verifier: recompute from the revealed seed, the seat seeds and the frozen tables; compare each claim. */
export function verifyBattle(mode: KitBattleMode, rounds: BattleRound[], seatSeeds: BattleSeatSeed[], serverSeed: string, claim: BattleVerifyClaim, opts: BattleOptions = {}): BattleVerifyResult {
  const res = resolveBattle(mode, rounds, seatSeeds, serverSeed, opts);
  const checks: BattleVerifyResult["checks"] = { serverHash: null, winners: null, totals: null, pulls: null };
  if (claim.serverHash !== undefined) checks.serverHash = res.serverHash === claim.serverHash;
  if (claim.winners) checks.winners = claim.winners.length === res.winners.length && claim.winners.every((w, i) => w === res.winners[i]);
  if (claim.totals) checks.totals = claim.totals.length === res.totals.length && claim.totals.every((t, i) => t === res.totals[i]);
  if (claim.pullOutcomeIds) checks.pulls = claim.pullOutcomeIds.length === res.pulls.length && claim.pullOutcomeIds.every((id, i) => id === res.pulls[i].outcomeId);
  const failed = (Object.keys(checks) as (keyof typeof checks)[]).filter((k) => checks[k] === false);
  const reasons: Record<string, string> = { serverHash: "seed does not match the hash shown before the battle", winners: "a different seat wins", totals: "seat totals differ", pulls: "a pull lands on a different outcome" };
  return { ok: failed.length === 0, checks, resolution: res, reason: failed.length ? reasons[failed[0]] : null };
}

/** The battle statuses the database carries, and the transitions the server allows. */
export type BattleStatus = "open" | "full" | "in_progress" | "settling" | "finished" | "cancelled" | "expired";
export const BATTLE_TRANSITIONS: Record<BattleStatus, BattleStatus[]> = {
  open: ["full", "cancelled", "expired"],
  full: ["in_progress", "open", "cancelled"],
  in_progress: ["settling"],
  settling: ["finished"],
  finished: [],
  cancelled: [],
  expired: [],
};
export const canTransition = (from: BattleStatus, to: BattleStatus): boolean => BATTLE_TRANSITIONS[from].includes(to);
