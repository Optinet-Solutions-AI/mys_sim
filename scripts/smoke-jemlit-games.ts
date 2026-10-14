// Headless check of the Jemlit games engine (Packs, Battles, Upgrader, Mines, Crash).
// Run: npx -y tsx scripts/smoke-jemlit-games.ts
import { JEMLIT_PACKS } from "../src/engine/jemlitLive.generated";
import { jemlitBoxOf, jemlitMath } from "../src/engine/labs/jemlit";
import {
  CRASH_DEFAULT,
  CrashGame,
  MINES_DEFAULT,
  MinesGame,
  UPGRADER_DEFAULT,
  UpgraderGame,
  battleMath,
  crashMultiplier,
  crashProbAtLeast,
  minePositions,
  minesMultiplier,
  minesSurvival,
  playBattle,
  simulateBattles,
  upgraderMaxChance,
  upgraderTarget,
  verifyCrash,
  verifyMines,
} from "../src/engine/labs/jemlitGames";
import { DEFAULT_JEMLIT, jemlitConfigFor } from "../src/lib/jemlitPresets";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`);
  if (!ok) fails++;
};
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

// Packs: 15 boxes, chances sum to 1, RTP 80% at listed
check("packs captured", JEMLIT_PACKS.length === 15, `${JEMLIT_PACKS.length}`);
for (const p of JEMLIT_PACKS.slice(0, 3)) {
  const sum = p.items.reduce((s, i) => s + i.chance, 0);
  const m = jemlitMath(p, undefined, jemlitConfigFor(p));
  check(`pack ${p.slug} chances sum to 1 and return at listed ≈ 80%`, near(sum, 1, 1e-6) && Math.abs(m.returnPrice - 0.8) < 0.01, `${sum.toFixed(6)} · ${(m.returnPrice * 100).toFixed(2)}%`);
}

// Mines: chance × multiplier = 1 − edge for every depth; verify recomputes; layouts uniform-ish
for (const mines of [1, 3, 10]) for (const k of [1, 3, 8]) if (k <= 25 - mines) check(`mines ${mines} depth ${k}: survival × multiplier = 1 − edge`, near(minesSurvival(25, mines, k) * minesMultiplier(25, mines, k, MINES_DEFAULT.houseEdge), 1 - MINES_DEFAULT.houseEdge, 1e-9));
{
  const g = new MinesGame(MINES_DEFAULT, "smoke");
  let r = g.start(10, 3, "seed-a");
  const safe = Array.from({ length: 25 }, (_, i) => i).filter((i) => !r.minePositions.includes(i));
  r = g.reveal(r, safe[0]);
  r = g.reveal(r, safe[1]);
  r = g.cashout(r);
  check("mines round: two safe tiles then cash out", r.status === "cashed" && near(r.multiplier, minesMultiplier(25, 3, 2, MINES_DEFAULT.houseEdge), 1e-9), `×${r.multiplier.toFixed(4)} payout ${r.payout.toFixed(2)}`);
  check("mines verify", verifyMines(r).ok);
  const bust = g.start(10, 24, "seed-b");
  const only = Array.from({ length: 25 }, (_, i) => i).find((i) => !bust.minePositions.includes(i))!;
  const hit = g.reveal(bust, bust.minePositions[0]);
  check("mines round: hitting a mine busts", hit.status === "busted" && hit.payout === 0, `safe tile was ${only}`);
  const counts = new Array(25).fill(0);
  const N = 20000;
  for (let i = 0; i < N; i++) for (const t of minePositions(`s${i}`, "c", 25, 3)) counts[t]++;
  const exp = (N * 3) / 25;
  const maxDev = Math.max(...counts.map((c) => Math.abs(c - exp) / exp));
  check("mine placement is even across tiles (max deviation < 6%)", maxDev < 0.06, `${(maxDev * 100).toFixed(2)}%`);
}

// Crash: chance of reaching m = (1 − edge)/m; multiplier never below 1; verify recomputes; Monte Carlo RTP
{
  for (const m of [1.5, 2, 10]) check(`crash P(≥${m}) = (1 − edge)/${m}`, near(crashProbAtLeast(m, CRASH_DEFAULT.houseEdge), (1 - CRASH_DEFAULT.houseEdge) / m, 1e-12));
  const g = new CrashGame(CRASH_DEFAULT, "smoke");
  const r = g.play(10, 2, "seed-c");
  check("crash round ≥ 1.00 and payout consistent", r.multiplier >= 1 && (r.won ? near(r.payout, 20, 1e-9) : r.payout === 0), `×${r.multiplier.toFixed(2)} won=${r.won}`);
  check("crash verify", verifyCrash(r, CRASH_DEFAULT).ok);
  let paid = 0;
  let won = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) {
    const m = crashMultiplier(`srv${i}`, "cli", CRASH_DEFAULT);
    paid += 1;
    if (m >= 2) won += 2;
  }
  check("crash 200k rounds at ×2 return ≈ 92%", Math.abs(won / paid - 0.92) < 0.01, `${((won / paid) * 100).toFixed(2)}%`);
}

// Upgrader: chance × target = wager × (1 − fee); cap 85%; Monte Carlo 85%
{
  check("upgrader cap = 85%", near(upgraderMaxChance(UPGRADER_DEFAULT), 0.85, 1e-12));
  for (const c of [0.01, 0.25, 0.85]) check(`upgrader ${c}: chance × target = wager × (1 − fee)`, near(c * upgraderTarget(10, c, UPGRADER_DEFAULT), 8.5, 1e-9));
  const g = new UpgraderGame("smoke");
  let paid = 0;
  let won = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) {
    const p = g.play(10, 0.25, "cli", upgraderTarget(10, 0.25, UPGRADER_DEFAULT), "target");
    paid += 10;
    if (p.won) won += p.target;
  }
  check("upgrader 100k plays at 25% return ≈ 85%", Math.abs(won / paid - 0.85) < 0.01, `${((won / paid) * 100).toFixed(2)}%`);
}

// Battles: pot = players × rounds × price; winner's prize = pot; 400-battle wins near even; expected return = box return
{
  const cfg = DEFAULT_JEMLIT;
  const setup = { players: 2, teams: 1, rounds: 3, style: "classic" as const };
  const o = playBattle(cfg, setup, "smoke");
  const bm = battleMath(cfg, setup);
  const boxReturn = jemlitMath(jemlitBoxOf(cfg), cfg.chances, cfg).returnPrice;
  check("battle: pulls = players × rounds", o.pulls.length === 6);
  check("battle: pot = sum of pulls at listed", near(o.pot, o.pulls.reduce((s, p) => s + p.spin.itemPrice, 0), 1e-6));
  check("battle: stake per player = rounds × price", near(bm.stakePerPlayer, 3 * 8.47, 1e-6), `${bm.stakePerPlayer}`);
  check("battle: expected return equals the box return at listed", near(bm.returnAtListed, boxReturn, 1e-9), `${(bm.returnAtListed * 100).toFixed(2)}%`);
  const mc = simulateBattles(cfg, setup, 400, "mc");
  check("battle: 400 battles, each seat wins 40 to 60%", mc.wins.every((w) => w / 400 > 0.4 && w / 400 < 0.6), mc.wins.join("/"));
  const jp = playBattle(cfg, { ...setup, style: "jackpot" }, "jp");
  check("battle jackpot: a jackpot roll exists", jp.jackpotRoll !== undefined && jp.jackpotRoll >= 0 && jp.jackpotRoll < 1);
  const cz = playBattle(cfg, { ...setup, style: "crazy" }, "cz");
  check("battle crazy: lowest total wins", cz.winners.every((w) => cz.totals[w] === Math.min(...cz.totals)));
}

console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
