// Generates kit/misty-backend/test-vectors-battles.json: deterministic battles an implementation must reproduce.
// Run: npx -y tsx scripts/battle-vectors.ts
import { writeFileSync } from "node:fs";
import { buildTable, liveWeights, mistyBox } from "../src/engine/labs/misty";
import { battleCommit, battleExtraNonce, battleNonce, resolveBattle, type BattleRound, type KitBattleMode } from "../src/engine/labs/battleKit";

const serverSeed = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const seeds = [
  { seat: 0, clientSeed: "alice" },
  { seat: 1, clientSeed: "bob" },
  { seat: 2, clientSeed: "carol" },
  { seat: 3, clientSeed: "dave" },
];
const round = (slug: string): BattleRound => {
  const box = mistyBox(slug);
  return { slug, table: buildTable(box, liveWeights(box)), priceCents: Math.round(box.price * 100) };
};
const rounds3 = [round("timepiece-suite"), round("handbag-suite"), round("timepiece-suite")];
const rounds1 = [round("timepiece-suite")];

const cases: { name: string; mode: KitBattleMode; rounds: BattleRound[]; seats: typeof seeds; opts?: { coinflipEdge?: number } }[] = [
  { name: "normal, 2 seats, 3 rounds", mode: "normal", rounds: rounds3, seats: seeds.slice(0, 2) },
  { name: "crazy, 3 seats, 3 rounds", mode: "crazy", rounds: rounds3, seats: seeds.slice(0, 3) },
  { name: "terminal, 4 seats, 1 round", mode: "terminal", rounds: rounds1, seats: seeds },
  { name: "jackpot, 4 seats, 3 rounds", mode: "jackpot", rounds: rounds3, seats: seeds },
  { name: "group, 3 seats, 1 round", mode: "group", rounds: rounds1, seats: seeds.slice(0, 3) },
  { name: "break, 2 seats, 3 rounds", mode: "break", rounds: rounds3, seats: seeds.slice(0, 2) },
  { name: "coinflip, 2 seats, edge 5%", mode: "coinflip", rounds: rounds1, seats: seeds.slice(0, 2), opts: { coinflipEdge: 0.05 } },
];

const out = {
  kit: "misty-backend 1.2, battles",
  generated: new Date().toISOString().slice(0, 10),
  recipe: {
    serverHash: "sha256(serverSeedHex), shown when the battle is created",
    pullNonce: "round × seats + seat + 1 (round and seat from 0); pull order round-major, seat-minor",
    pullKey: "DRAW-<box slug>-<serverSeed>-<seat clientSeed>-<nonce>; digest = HMAC-SHA256(key, ''); roll = first 13 hex / 2^52; band lookup on the round's frozen table",
    extraNonce: "rounds × seats + 1",
    extraKey: "DRAW-battle-<tiebreak|jackpot|coinflip>-<serverSeed>-<all seat clientSeeds joined by |, seat order>-<extraNonce>",
    tieBreak: "winner = tied[floor(roll × tied.length)] among the tied seats in seat order",
    jackpot: "position = roll × sum(totals); first seat whose cumulative total exceeds it; uniform when every total is 0",
    coinflip: "winner = floor(roll × seats); pot = entries × seats × (1 − edge)",
    values: "item = valueUsd × 100 cents; credit or bonus row = credits × 100 cents (creditFaceCents); free spins are not played in battles",
    group: "pot ÷ seats, odd cents to seat 0",
    break: "each seat keeps its own total",
  },
  serverSeed,
  serverHash: battleCommit(serverSeed),
  tables: Object.fromEntries(["timepiece-suite", "handbag-suite"].map((slug) => {
    const r = round(slug);
    return [slug, { tableHash: r.table.hash, priceCents: r.priceCents, entries: r.table.entries.map((e) => ({ id: e.outcome.id, label: e.outcome.label, percent: e.percent })) }];
  })),
  cases: cases.map((c) => {
    const res = resolveBattle(c.mode, c.rounds, c.seats, serverSeed, c.opts);
    return {
      name: c.name,
      mode: c.mode,
      rounds: c.rounds.map((r) => ({ slug: r.slug, tableHash: r.table.hash, priceCents: r.priceCents })),
      seats: c.seats,
      coinflipEdge: c.opts?.coinflipEdge ?? null,
      nonces: c.mode === "coinflip" ? [] : c.rounds.map((_, r) => c.seats.map((s) => battleNonce(r, s.seat, c.seats.length))),
      extraNonce: battleExtraNonce(c.mode === "coinflip" ? 0 : c.rounds.length, c.seats.length),
      result: res,
    };
  }),
};
writeFileSync("kit/misty-backend/test-vectors-battles.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote kit/misty-backend/test-vectors-battles.json", out.cases.map((c) => `${c.name}: winners ${c.result.winners.join(",")} pot ${c.result.potCents}`));
