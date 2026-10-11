import type { BattlesConfig, BattlesResult, CatalogItem, Progress } from "../types";
import { Opener } from "../opener";
import { sfc32 } from "../rng";
import { linearHistogram } from "../metrics";
import { resolveTable, retargetBox } from "../table";

export const BATTLE_MODES: { id: BattlesConfig["mode"]; name: string; rule: string }[] = [
  { id: "normal", name: "Normal", rule: "Highest total value over all rounds takes every item." },
  { id: "crazy", name: "Crazy", rule: "Lowest total value takes every item." },
  { id: "group", name: "Group", rule: "No winner: the pot is split equally among all players." },
  { id: "terminal", name: "Terminal", rule: "Only the last round counts; its highest pull takes every item." },
  { id: "jackpot", name: "Jackpot", rule: "A winner is drawn with probability proportional to each player's total." },
];

export function runBattles(cfg: BattlesConfig, battles: number, seed: number, catalog: Map<string, CatalogItem>, onProgress?: Progress): BattlesResult {
  const t0 = Date.now();
  const rng = sfc32(seed);
  const N = Math.max(1, Math.floor(battles));
  const players = Math.max(2, Math.floor(cfg.players));
  const humans = cfg.bots.enabled ? Math.min(players, Math.max(1, Math.floor(cfg.humansPerBattle))) : players;
  const openers = cfg.boxes.map((b, i) => new Opener(b, cfg.algo, cfg.rigs, catalog, rng, "box" + i));
  const botTables = cfg.rigs.favouredBots
    ? cfg.boxes.map((b) => resolveTable(retargetBox(b, cfg.rigs.favouredBots!.botRtp, catalog), b.ticketTotal, catalog))
    : undefined;
  const entry = cfg.boxes.reduce((a, b) => a + b.price, 0);
  const avgSingle = entry / Math.max(1, cfg.boxes.length);
  let totalWagered = 0, totalPaid = 0, humanWins = 0, botWins = 0, ties = 0, topPot = 0;
  const multiples: number[] = [];
  let idx = 0;
  const step = Math.max(1, Math.floor(N / 100));

  for (let b = 0; b < N; b++) {
    const totals = new Array(players).fill(0);
    const lastRound = new Array(players).fill(0);
    let pot = 0;
    for (let r = 0; r < cfg.boxes.length; r++) {
      for (let p = 0; p < players; p++) {
        const isBot = p >= humans;
        const rec = openers[r].open(idx++, isBot ? "bot" : "human", b / N, isBot && botTables ? botTables[r] : undefined);
        totals[p] += rec.payout;
        lastRound[p] = rec.payout;
        pot += rec.payout;
      }
    }
    totalWagered += entry * players;
    totalPaid += pot;
    if (pot / entry > topPot) topPot = pot / entry;
    multiples.push(pot / (entry * players));
    let winner = -1;
    const score = cfg.mode === "terminal" ? lastRound : totals;
    if (cfg.mode === "group") {
      // everyone receives pot/players; count as a human "win" share for rates
      humanWins += humans / players;
      botWins += (players - humans) / players;
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
      const tied = score.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
      if (tied.length > 1) ties++;
      winner = tied[rng.int(tied.length)];
    }
    if (winner >= 0) {
      if (winner < humans) humanWins++;
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
    expectedHumanWinRate: humans / players,
    ties,
    payoutMultipleHistogram: linearHistogram(multiples, "pot ÷ total entry", 20, 0, 3),
    topPotMultiple: topPot,
    elapsedMs: Date.now() - t0,
  };
}
