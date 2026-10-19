// Headless checks for the battle module: determinism, verifier, every mode, tie-break, nonce map, state machine.
// Run: npx -y tsx scripts/smoke-battles.ts
import { readFileSync } from "node:fs";
import { buildTable, liveWeights, mistyBox, mistyDigest, rollOf } from "../src/engine/labs/misty";
import { BATTLE_TRANSITIONS, battleNonce, canTransition, resolveBattle, verifyBattle, type BattleRound } from "../src/engine/labs/battleKit";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`);
  if (!ok) fails++;
};
const round = (slug: string): BattleRound => {
  const box = mistyBox(slug);
  return { slug, table: buildTable(box, liveWeights(box)), priceCents: Math.round(box.price * 100) };
};
const rounds = [round("timepiece-suite"), round("handbag-suite"), round("timepiece-suite")];
const seeds = [{ seat: 0, clientSeed: "alice" }, { seat: 1, clientSeed: "bob" }, { seat: 2, clientSeed: "carol" }];
const S = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

// determinism
const a = resolveBattle("normal", rounds, seeds, S);
const b = resolveBattle("normal", rounds, seeds, S);
check("same inputs, same result", JSON.stringify(a) === JSON.stringify(b));
check("seat order does not matter", JSON.stringify(resolveBattle("normal", rounds, [seeds[2], seeds[0], seeds[1]], S)) === JSON.stringify(a));
check("a different server seed changes the result", JSON.stringify(resolveBattle("normal", rounds, seeds, S.replace("00", "ff"))) !== JSON.stringify(a));
check("a different client seed changes only that seat's pulls", resolveBattle("normal", rounds, [{ seat: 0, clientSeed: "alice2" }, seeds[1], seeds[2]], S).pulls.filter((p) => p.seat !== 0).every((p, i) => p.digest === a.pulls.filter((q) => q.seat !== 0)[i].digest));

// nonce map and each pull is a plain open
check("pull order round-major seat-minor with the stated nonces", a.pulls.every((p, i) => p.round === Math.floor(i / 3) && p.seat === i % 3 && p.nonce === battleNonce(p.round, p.seat, 3)));
check("each pull equals a Misty open with that nonce", a.pulls.every((p) => p.digest === mistyDigest(rounds[p.round].slug, S, seeds[p.seat].clientSeed, p.nonce) && p.roll === rollOf(p.digest)));
check("pot equals the sum of pulls and the winner takes it", a.potCents === a.pulls.reduce((s, p) => s + p.valueCents, 0) && a.sharesCents[a.winners[0]] === a.potCents);
check("normal: the winner has the highest total", a.totals[a.winners[0]] === Math.max(...a.totals));

// modes
const crazy = resolveBattle("crazy", rounds, seeds, S);
check("crazy: the winner has the lowest total", crazy.totals[crazy.winners[0]] === Math.min(...crazy.totals));
const term = resolveBattle("terminal", rounds, seeds, S);
check("terminal: the winner has the highest last-round pull", term.lastRound[term.winners[0]] === Math.max(...term.lastRound));
const jack = resolveBattle("jackpot", rounds, seeds, S);
check("jackpot: one winner, an extra roll with the next nonce", jack.winners.length === 1 && jack.extra !== null && jack.extra.nonce === 3 * 3 + 1);
const group = resolveBattle("group", rounds, seeds, S);
check("group: shares sum to the pot, split equally", group.sharesCents.reduce((s, x) => s + x, 0) === group.potCents && Math.max(...group.sharesCents) - Math.min(...group.sharesCents) <= 2);
const brk = resolveBattle("break", rounds, seeds, S);
check("break: everyone keeps their own total", brk.sharesCents.every((s, i) => s === brk.totals[i]));
const flip = resolveBattle("coinflip", [round("timepiece-suite")], seeds.slice(0, 2), S, { coinflipEdge: 0.05 });
check("coinflip: no pulls, pot = entries less the edge, one winner", flip.pulls.length === 0 && flip.potCents === Math.floor(1000 * 2 * 0.95) && flip.winners.length === 1);

// tie-break: a box whose every outcome is worth the same makes every seat tie
const flat = mistyBox("timepiece-suite");
const flatBox = { ...flat, slug: "flat", outcomes: flat.outcomes.map((o) => ({ ...o, kind: "oroos" as const, mistees: 1, freeSpins: 0, valueUsd: null })) };
const flatRound: BattleRound = { slug: "flat", table: buildTable(flatBox, liveWeights(flat)), priceCents: 1000 };
const tie = resolveBattle("normal", [flatRound, flatRound], seeds, S);
check("tie: all seats tied, an extra roll with the next nonce decides, one winner", tie.tiedSeats.length === 3 && tie.extra !== null && tie.extra.nonce === 2 * 3 + 1 && tie.winners.length === 1 && tie.totals.every((t) => t === 200));

// verifier
const v = verifyBattle("normal", rounds, seeds, S, { serverHash: a.serverHash, winners: a.winners, totals: a.totals, pullOutcomeIds: a.pulls.map((p) => p.outcomeId) });
check("verifier passes on the true claims", v.ok && Object.values(v.checks).every((x) => x === true));
const bad = verifyBattle("normal", rounds, seeds, S, { serverHash: a.serverHash, winners: [(a.winners[0] + 1) % 3] });
check("verifier fails a wrong winner", !bad.ok && bad.checks.winners === false && bad.reason === "a different seat wins");

// jackpot proportionality over many seeds
let wins = [0, 0, 0];
let sumShare = [0, 0, 0];
for (let i = 0; i < 3000; i++) {
  const r = resolveBattle("jackpot", [round("timepiece-suite")], seeds, S.slice(0, 60) + i.toString(16).padStart(4, "0"));
  wins[r.winners[0]]++;
  const sum = r.totals.reduce((s, x) => s + x, 0) || 1;
  for (let k = 0; k < 3; k++) sumShare[k] += r.totals[k] / sum;
}
const expected = sumShare.map((x) => x / 3000);
const observed = wins.map((w) => w / 3000);
check("jackpot: win rate tracks share of the pot (within 4 points)", expected.every((e, k) => Math.abs(e - observed[k]) < 0.04), `expected ${expected.map((x) => x.toFixed(3)).join("/")} observed ${observed.map((x) => x.toFixed(3)).join("/")}`);

// state machine
check("state machine: open -> full -> in_progress -> settling -> finished", canTransition("open", "full") && canTransition("full", "in_progress") && canTransition("in_progress", "settling") && canTransition("settling", "finished"));
check("state machine: no way back from finished, no skipping settling", BATTLE_TRANSITIONS.finished.length === 0 && !canTransition("in_progress", "finished") && !canTransition("open", "in_progress"));

// vectors reproduce
const vec = JSON.parse(readFileSync("kit/misty-backend/test-vectors-battles.json", "utf8"));
let vecOk = true;
for (const c of vec.cases) {
  const rs: BattleRound[] = c.rounds.map((r: { slug: string }) => round(r.slug));
  const res = resolveBattle(c.mode, rs, c.seats, vec.serverSeed, { coinflipEdge: c.coinflipEdge ?? undefined });
  if (JSON.stringify(res) !== JSON.stringify(c.result)) vecOk = false;
}
check(`test vectors reproduce (${vec.cases.length} battles)`, vecOk);

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
process.exit(fails ? 1 : 0);
