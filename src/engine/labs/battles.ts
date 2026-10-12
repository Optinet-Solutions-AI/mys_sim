import type { BattlesConfig, BattlesResult, CatalogItem, OpenRecord, Progress } from "../types";
import { Opener } from "../opener";
import { sfc32, type Rng } from "../rng";
import { linearHistogram } from "../metrics";
import { resolveTable, retargetBox, type ResolvedTable } from "../table";

export const BATTLE_MODES: { id: BattlesConfig["mode"]; name: string; rule: string }[] = [
  { id: "normal", name: "Normal", rule: "Highest total value over all rounds takes every item." },
  { id: "crazy", name: "Crazy", rule: "Lowest total value takes every item." },
  { id: "group", name: "Group", rule: "No winner: the pot is split equally among all players." },
  { id: "terminal", name: "Terminal", rule: "Only the last round counts; its highest pull takes every item." },
  { id: "jackpot", name: "Jackpot", rule: "A winner is drawn with probability proportional to each player's total." },
  { id: "coinflip", name: "Coinflip (Cases.gg)", rule: "Two seats at equal odds; the house takes its edge from the pot before the winner is paid. No boxes are opened." },
  { id: "break", name: "Break / group open", rule: "Everyone keeps what they pull. No pot and no winner: a sealed break or a Glass Box group open." },
];

/** Everything a battle needs that stays fixed across battles: openers, bot tables, seat counts, entry. */
export interface BattleTable {
  openers: Opener[];
  botTables?: ResolvedTable[];
  players: number;
  humans: number;
  entry: number;
}

export interface BattlePull {
  round: number;
  player: number;
  isBot: boolean;
  rec: OpenRecord;
}

export interface BattleOutcome {
  pulls: BattlePull[]; // round-major, seat-minor, in the order they were drawn
  totals: number[];
  lastRound: number[];
  pot: number;
  winner: number; // -1 for group and break modes
  tied: boolean;
  share: number[]; // what each seat takes home
}

export function prepareBattle(cfg: BattlesConfig, catalog: Map<string, CatalogItem>, rng: Rng): BattleTable {
  const players = cfg.mode === "coinflip" ? 2 : Math.max(2, Math.floor(cfg.players));
  const humans = cfg.bots.enabled ? Math.min(players, Math.max(1, Math.floor(cfg.humansPerBattle))) : players;
  const openers = cfg.boxes.map((b, i) => new Opener(b, cfg.algo, cfg.rigs, catalog, rng, "box" + i));
  const botTables = cfg.rigs.favouredBots
    ? cfg.boxes.map((b) => resolveTable(retargetBox(b, cfg.rigs.favouredBots!.botRtp, catalog), b.ticketTotal, catalog))
    : undefined;
  const entry = cfg.boxes.reduce((a, b) => a + b.price, 0);
  return { openers, botTables, players, humans, entry };
}

/** Plays one battle. The same function serves the live arena and the statistics run. */
export function playBattle(t: BattleTable, cfg: BattlesConfig, rng: Rng, counter: { idx: number }, progress: number): BattleOutcome {
  const { players, humans, entry } = t;
  const totals = new Array<number>(players).fill(0);
  const lastRound = new Array<number>(players).fill(0);
  const pulls: BattlePull[] = [];
  const share = new Array<number>(players).fill(0);
  if (cfg.mode === "coinflip") {
    // no boxes: the pot is the entries less the house edge, and a fair coin picks the seat
    const edge = Math.min(0.95, Math.max(0, cfg.coinflipEdge ?? 0));
    const pot = entry * players * (1 - edge);
    const winner = rng.int(players);
    share[winner] = pot;
    return { pulls, totals, lastRound, pot, winner, tied: false, share };
  }
  let pot = 0;
  for (let r = 0; r < cfg.boxes.length; r++) {
    for (let p = 0; p < players; p++) {
      const isBot = p >= humans;
      const rec = t.openers[r].open(counter.idx++, isBot ? "bot" : "human", progress, isBot && t.botTables ? t.botTables[r] : undefined);
      totals[p] += rec.payout;
      lastRound[p] = rec.payout;
      pot += rec.payout;
      pulls.push({ round: r, player: p, isBot, rec });
    }
  }
  let winner = -1;
  let tied = false;
  const score = cfg.mode === "terminal" ? lastRound : totals;
  if (cfg.mode === "group") {
    share.fill(pot / players);
  } else if (cfg.mode === "break") {
    for (let p = 0; p < players; p++) share[p] = totals[p];
  } else if (cfg.mode === "jackpot") {
    const sum = score.reduce((a, x) => a + x, 0);
    let u = rng.next() * (sum || 1);
    winner = players - 1;
    for (let p = 0; p < players; p++) {
      u -= score[p] || (sum ? 0 : 1 / players);
      if (u <= 0) {
        winner = p;
        break;
      }
    }
  } else {
    const best = cfg.mode === "crazy" ? Math.min(...score) : Math.max(...score);
    const tiedSeats = score.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    if (tiedSeats.length > 1) tied = true;
    winner = tiedSeats[rng.int(tiedSeats.length)];
  }
  if (winner >= 0) share[winner] = pot;
  return { pulls, totals, lastRound, pot, winner, tied, share };
}

export function runBattles(cfg: BattlesConfig, battles: number, seed: number, catalog: Map<string, CatalogItem>, onProgress?: Progress): BattlesResult {
  const t0 = Date.now();
  const rng = sfc32(seed);
  const N = Math.max(1, Math.floor(battles));
  const t = prepareBattle(cfg, catalog, rng);
  const { players, humans, entry } = t;
  const avgSingle = entry / Math.max(1, cfg.boxes.length);
  let totalWagered = 0, totalPaid = 0, humanWins = 0, botWins = 0, ties = 0, topPot = 0;
  const multiples: number[] = [];
  const counter = { idx: 0 };
  const step = Math.max(1, Math.floor(N / 100));

  for (let b = 0; b < N; b++) {
    const o = playBattle(t, cfg, rng, counter, b / N);
    totalWagered += entry * players;
    totalPaid += o.pot;
    if (o.pot / entry > topPot) topPot = o.pot / entry;
    multiples.push(o.pot / (entry * players));
    if (cfg.mode === "group") {
      humanWins += humans / players;
      botWins += (players - humans) / players;
    } else if (cfg.mode === "break") {
      // a "win" in a break is taking home at least the entry
      let h = 0, bt = 0;
      for (let p = 0; p < players; p++) if (o.share[p] >= entry) (p < humans ? h++ : bt++);
      humanWins += h / humans;
      botWins += players > humans ? bt / (players - humans) : 0;
    } else {
      if (o.tied) ties++;
      if (o.winner < humans) humanWins++;
      else botWins++;
    }
    if (b % step === 0 && onProgress) onProgress(b, N);
  }

  return {
    kind: "battles",
    battles: N,
    mode: cfg.mode,
    entryPerPlayer: entry,
    avgWagerPerBattle: entry * players,
    avgSingleOpenPrice: avgSingle,
    wagerMultiplier: entry / avgSingle,
    totalWagered,
    totalPaid,
    realizedEdge: totalWagered ? 1 - totalPaid / totalWagered : 0,
    humanWins,
    botWins,
    humanWinRate: N ? humanWins / N : 0,
    expectedHumanWinRate: cfg.mode === "break" ? 0 : humans / players,
    ties,
    payoutMultipleHistogram: linearHistogram(multiples, "pot ÷ total entry", 20, 0, 3),
    topPotMultiple: topPot,
    elapsedMs: Date.now() - t0,
  };
}
