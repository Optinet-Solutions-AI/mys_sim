/**
 * Jemlit's other games, copied from the rules its own pages and client code state (captured 14 October 2026).
 *
 * Shared primitive (Jemlit calls it rollFraction): HMAC-SHA512/256 keyed by the server seed over "clientSeed-nonce",
 * read as a fraction in [0, 1). The server seed is committed by its SHA-512 hash before play.
 *
 * Mines: mine positions come from a partial Fisher–Yates shuffle driven by rollFraction with nonce = swapStep; the
 * cash-out multiplier after s safe reveals on r tiles with g mines is Π (r−m)/(r−g−m) × (1 − house edge).
 * Crash: multiplier = min(max, max(1.00, (1 − edge) / (1 − roll))) with nonce 0; seeds form a hash chain where the
 * previous seed is SHA-512 of the next published hash. House edge 8% in the page settings.
 * Upgrader: the player picks a chance (1% to 85%, the cap being 1 − fee with fee 15%) and a wager; the prize on offer
 * is worth wager × (1 − fee) ÷ chance; the roll fraction below the chance wins.
 * Battles: every participant opens the same boxes in turn; classic = highest total takes all, crazy = lowest,
 * jackpot = a winner drawn in proportion to totals, final drop = the last round alone decides; solo or teams.
 */
import { sha512Hex } from "../hash";
import { makeRng } from "../rng";
import { JemlitOpener, jemlitBoxOf, jemlitDigest, jemlitMath } from "./jemlit";
import type { JemlitBox, JemlitConfig, JemlitSpin } from "../types";

const SIXTEEN_64 = 2 ** 256;
/** Jemlit's rollFraction: the 64-hex digest as an integer divided by 16^64. */
export function fractionOf(digest: string): number {
  const big = BigInt("0x" + digest.slice(0, 64));
  return Number((big * 10n ** 15n) / BigInt(2) ** 256n) / 1e15;
}
export const rollFraction = (serverSeed: string, clientSeed: string, nonce: number): number => fractionOf(jemlitDigest(serverSeed, clientSeed, nonce));
export const commit = (serverSeed: string): string => sha512Hex(serverSeed);
void SIXTEEN_64;

/* ------------------------------------------------------------------ Mines */

export interface MinesSettings {
  totalTiles: number;
  houseEdge: number;
  minWager: number;
  maxWager: number;
  maxWinnable: number;
}
export const MINES_DEFAULT: MinesSettings = { totalTiles: 25, houseEdge: 0.08, minWager: 1, maxWager: 1000, maxWinnable: 25000 };

/** Jemlit's shuffle, verbatim: positions = [0..n−1]; for swapStep 1..n−1: i = n − swapStep, u = rollFraction(…, swapStep), j = min(floor(u × (i + 1)), i), swap. First minesCount, sorted. */
export function minePositions(serverSeed: string, clientSeed: string, totalTiles: number, minesCount: number): number[] {
  const positions = Array.from({ length: totalTiles }, (_, k) => k);
  for (let swapStep = 1; swapStep < totalTiles; swapStep++) {
    const i = totalTiles - swapStep;
    const u = rollFraction(serverSeed, clientSeed, swapStep);
    const j = Math.min(Math.floor(u * (i + 1)), i);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, minesCount).sort((a, b) => a - b);
}
/** Π (r − m) / (r − g − m) for m < s, times (1 − edge). Jemlit's $e(). */
export function minesMultiplier(totalTiles: number, mines: number, safeReveals: number, houseEdge: number): number {
  if (safeReveals === 0) return 1;
  const safe = totalTiles - mines;
  let p = 1;
  for (let m = 0; m < safeReveals; m++) p *= (totalTiles - m) / (safe - m);
  return p * (1 - houseEdge);
}
/** Chance that s reveals in a row are all safe. */
export function minesSurvival(totalTiles: number, mines: number, safeReveals: number): number {
  const safe = totalTiles - mines;
  let p = 1;
  for (let m = 0; m < safeReveals; m++) p *= (safe - m) / (totalTiles - m);
  return p;
}

export interface MinesRound {
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  totalTiles: number;
  mines: number;
  wager: number;
  minePositions: number[];
  revealed: number[];
  status: "playing" | "cashed" | "busted";
  multiplier: number;
  payout: number;
}
export class MinesGame {
  private rng = makeRng("sfc32", "mines");
  constructor(private settings: MinesSettings, seedLabel: string) {
    this.rng = makeRng("sfc32", `mines:${seedLabel}`);
    this.nextSeed = this.rng.hex(32);
  }
  private nextSeed: string;
  get commitment(): string {
    return commit(this.nextSeed);
  }
  start(wager: number, mines: number, clientSeed: string): MinesRound {
    const serverSeed = this.nextSeed;
    this.nextSeed = this.rng.hex(32);
    const n = this.settings.totalTiles;
    return { serverSeed, serverHash: commit(serverSeed), clientSeed, totalTiles: n, mines, wager, minePositions: minePositions(serverSeed, clientSeed, n, mines), revealed: [], status: "playing", multiplier: 1, payout: 0 };
  }
  reveal(r: MinesRound, tile: number): MinesRound {
    if (r.status !== "playing" || r.revealed.includes(tile)) return r;
    if (r.minePositions.includes(tile)) return { ...r, revealed: [...r.revealed, tile], status: "busted", multiplier: 0, payout: 0 };
    const revealed = [...r.revealed, tile];
    const multiplier = minesMultiplier(r.totalTiles, r.mines, revealed.length, this.settings.houseEdge);
    const next = { ...r, revealed, multiplier, payout: Math.min(this.settings.maxWinnable, r.wager * multiplier) };
    if (revealed.length === r.totalTiles - r.mines) return { ...next, status: "cashed" };
    return next;
  }
  cashout(r: MinesRound): MinesRound {
    if (r.status !== "playing" || r.revealed.length === 0) return r;
    return { ...r, status: "cashed" };
  }
}
export function verifyMines(r: MinesRound): { ok: boolean; reason?: string } {
  if (commit(r.serverSeed) !== r.serverHash) return { ok: false, reason: "server seed does not match the hash shown before the round" };
  const mp = minePositions(r.serverSeed, r.clientSeed, r.totalTiles, r.mines);
  if (mp.join(",") !== r.minePositions.join(",")) return { ok: false, reason: "mine positions differ" };
  return { ok: true };
}

/* ------------------------------------------------------------------ Crash */

export interface CrashSettings {
  houseEdge: number;
  maxMultiplier: number;
  maxWinnable: number;
  minWager: number;
  maxWager: number;
}
export const CRASH_DEFAULT: CrashSettings = { houseEdge: 0.08, maxMultiplier: 1000000, maxWinnable: 250000, minWager: 1, maxWager: 10000 };

/** Jemlit's formula, verbatim: min(MAX, max(1.00, (1 − edge) / (1 − roll))) with roll = rollFraction(serverSeed, clientSeed, 0), to 2 decimals. */
export function crashMultiplier(serverSeed: string, clientSeed: string, s: CrashSettings): number {
  const roll = rollFraction(serverSeed, clientSeed, 0);
  const m = Math.min(s.maxMultiplier, Math.max(1, (1 - s.houseEdge) / (1 - roll)));
  return Math.floor(m * 100) / 100;
}
/** Chance the round reaches at least m: (1 − edge) / m for m ≥ 1. */
export const crashProbAtLeast = (m: number, houseEdge: number): number => (m <= 1 ? 1 : Math.min(1, (1 - houseEdge) / m));
/** Jemlit's chain: the previous round's seed is SHA-512 of the next round's published hash. */
export function crashChain(terminalSeed: string, rounds: number): { seed: string; hash: string }[] {
  const out: { seed: string; hash: string }[] = [];
  let seed = terminalSeed;
  for (let i = 0; i < rounds; i++) {
    const hash = sha512Hex(seed);
    out.push({ seed, hash });
    seed = sha512Hex(hash);
  }
  return out;
}
export interface CrashRound {
  index: number;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  multiplier: number;
  wager: number;
  autoCashout: number;
  won: boolean;
  payout: number;
}
export class CrashGame {
  private chain: { seed: string; hash: string }[];
  private i = 0;
  constructor(private settings: CrashSettings, seedLabel: string, rounds = 10000) {
    const rng = makeRng("sfc32", `crash:${seedLabel}`);
    this.chain = crashChain(rng.hex(32), rounds);
  }
  /** The hash of the next round's seed is published before the round (the chain goes backwards). */
  get nextHash(): string {
    return this.chain[this.i]?.hash ?? "";
  }
  play(wager: number, autoCashout: number, clientSeed: string): CrashRound {
    const { seed, hash } = this.chain[this.i++] ?? this.chain[this.chain.length - 1];
    const multiplier = crashMultiplier(seed, clientSeed, this.settings);
    const won = multiplier >= autoCashout;
    const payout = won ? Math.min(this.settings.maxWinnable, wager * autoCashout) : 0;
    return { index: this.i, serverSeed: seed, serverHash: hash, clientSeed, multiplier, wager, autoCashout, won, payout };
  }
}
export function verifyCrash(r: CrashRound, s: CrashSettings): { ok: boolean; reason?: string } {
  if (sha512Hex(r.serverSeed) !== r.serverHash) return { ok: false, reason: "server seed does not match the published hash" };
  if (crashMultiplier(r.serverSeed, r.clientSeed, s) !== r.multiplier) return { ok: false, reason: "multiplier differs" };
  return { ok: true };
}

/* --------------------------------------------------------------- Upgrader */

export interface UpgraderSettings {
  fee: number;
  chanceOptions: number[];
  minChance: number;
}
export const UPGRADER_DEFAULT: UpgraderSettings = { fee: 0.15, chanceOptions: [0.01, 0.1, 0.25, 0.5, 0.75, 0.92], minChance: 0.01 };
/** The highest chance the selector allows: floor((1 − fee) × 100) percent. */
export const upgraderMaxChance = (s: UpgraderSettings): number => Math.floor(Math.round((1 - s.fee) * 100 * 100) / 100) / 100;
/** What a wager buys a shot at, for a chosen chance: wager × (1 − fee) ÷ chance. */
export const upgraderTarget = (wager: number, chance: number, s: UpgraderSettings): number => (chance > 0 ? (wager * (1 - s.fee)) / chance : 0);
export interface UpgraderPlay {
  nonce: number;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  roll: number;
  chance: number;
  wager: number;
  target: number;
  targetLabel: string;
  won: boolean;
}
export class UpgraderGame {
  private rng;
  private serverSeed: string;
  private nonce = 0;
  constructor(seedLabel: string) {
    this.rng = makeRng("sfc32", `upgrader:${seedLabel}`);
    this.serverSeed = this.rng.hex(32);
  }
  get commitment(): string {
    return commit(this.serverSeed);
  }
  play(wager: number, chance: number, clientSeed: string, target: number, targetLabel: string): UpgraderPlay {
    this.nonce++;
    const roll = rollFraction(this.serverSeed, clientSeed, this.nonce);
    return { nonce: this.nonce, serverSeed: this.serverSeed, serverHash: commit(this.serverSeed), clientSeed, roll, chance, wager, target, targetLabel, won: roll < chance };
  }
}

/* ---------------------------------------------------------------- Battles */

export type BattleStyle = "classic" | "crazy" | "jackpot" | "finaldrop";
export interface BattleSetup {
  players: number;
  teams: number; // 1 = solo
  rounds: number;
  style: BattleStyle;
}
export interface BattlePull {
  player: number;
  round: number;
  spin: JemlitSpin;
}
export interface BattleOutcome {
  pulls: BattlePull[];
  totals: number[];
  teamTotals: number[];
  winners: number[]; // player indices (all members of the winning team)
  winningTeam: number;
  pot: number;
  prizePerWinner: number;
  jackpotRoll?: number;
  serverHash: string;
  serverSeed: string;
}

/** One battle on one box: participants take turns opening it; the server seed covers the whole battle, nonces count up. */
export function playBattle(cfg: JemlitConfig, setup: BattleSetup, seedLabel: string | number): BattleOutcome {
  const box = jemlitBoxOf(cfg);
  const opener = new JemlitOpener({ ...cfg, players: [{ id: "guest", name: "Guest", share: 1 }], activePlayerId: "guest" }, `battle:${seedLabel}`);
  const pulls: BattlePull[] = [];
  const totals = Array(setup.players).fill(0) as number[];
  const lastRound = Array(setup.players).fill(0) as number[];
  for (let r = 0; r < setup.rounds; r++) {
    for (let p = 0; p < setup.players; p++) {
      const spin = opener.spin("guest");
      pulls.push({ player: p, round: r, spin });
      totals[p] += spin.itemPrice;
      if (r === setup.rounds - 1) lastRound[p] = spin.itemPrice;
    }
  }
  const teamOf = (p: number) => (setup.teams > 1 ? Math.floor(p / (setup.players / setup.teams)) : p);
  const nTeams = setup.teams > 1 ? setup.teams : setup.players;
  const teamTotals = Array(nTeams).fill(0) as number[];
  const teamLast = Array(nTeams).fill(0) as number[];
  for (let p = 0; p < setup.players; p++) {
    teamTotals[teamOf(p)] += totals[p];
    teamLast[teamOf(p)] += lastRound[p];
  }
  let winningTeam = 0;
  let jackpotRoll: number | undefined;
  const score = setup.style === "finaldrop" ? teamLast : teamTotals;
  if (setup.style === "classic" || setup.style === "finaldrop") {
    winningTeam = score.indexOf(Math.max(...score));
  } else if (setup.style === "crazy") {
    winningTeam = score.indexOf(Math.min(...score));
  } else {
    const sum = teamTotals.reduce((a, b) => a + b, 0) || 1;
    const first = pulls[0].spin;
    jackpotRoll = rollFraction(first.serverSeed, first.clientSeed, 100000 + pulls.length);
    let acc = 0;
    winningTeam = nTeams - 1;
    for (let t = 0; t < nTeams; t++) {
      acc += teamTotals[t] / sum;
      if (jackpotRoll < acc) {
        winningTeam = t;
        break;
      }
    }
  }
  const winners = Array.from({ length: setup.players }, (_, p) => p).filter((p) => teamOf(p) === winningTeam);
  const pot = totals.reduce((a, b) => a + b, 0);
  const first = pulls[0].spin;
  return { pulls, totals, teamTotals, winners, winningTeam, pot, prizePerWinner: pot / Math.max(1, winners.length), jackpotRoll, serverHash: first.serverHash, serverSeed: first.serverSeed };
}

export interface BattleMath {
  stakePerPlayer: number;
  pot: number;
  expectedPot: number;
  expectedPerPlayer: number;
  winChance: number;
  returnAtListed: number;
  returnReal: number;
}
export function battleMath(cfg: JemlitConfig, setup: BattleSetup): BattleMath {
  const box = jemlitBoxOf(cfg);
  const m = jemlitMath(box, cfg.chances, cfg);
  const stake = box.price * setup.rounds;
  const pot = stake * setup.players;
  const expectedPot = pot * m.returnPrice;
  const nTeams = setup.teams > 1 ? setup.teams : setup.players;
  return { stakePerPlayer: stake, pot, expectedPot, expectedPerPlayer: expectedPot / setup.players, winChance: 1 / nTeams, returnAtListed: m.returnPrice, returnReal: m.returnReal };
}

/** Quick Monte Carlo: who wins how often and how the pot splits, for the odds table in the analysis. */
export function simulateBattles(cfg: JemlitConfig, setup: BattleSetup, n: number, seedLabel: string | number): { wins: number[]; avgPot: number; avgPrize: number; maxPrize: number; zeroPrize: number } {
  const wins = Array(setup.teams > 1 ? setup.teams : setup.players).fill(0) as number[];
  let potSum = 0;
  let prizeSum = 0;
  let maxPrize = 0;
  let zero = 0;
  for (let i = 0; i < n; i++) {
    const b = playBattle(cfg, setup, `${seedLabel}:${i}`);
    wins[b.winningTeam]++;
    potSum += b.pot;
    prizeSum += b.prizePerWinner;
    if (b.prizePerWinner > maxPrize) maxPrize = b.prizePerWinner;
    if (b.pot === 0) zero++;
  }
  return { wins, avgPot: potSum / n, avgPrize: prizeSum / n, maxPrize, zeroPrize: zero };
}

export const boxFor = (cfg: JemlitConfig): JemlitBox => jemlitBoxOf(cfg);
