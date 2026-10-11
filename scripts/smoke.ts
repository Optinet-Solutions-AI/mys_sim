// Engine smoke test: run with `npx tsx scripts/smoke.ts`
import { runLab, CATALOG, CATALOG_BY_ID } from "../src/engine";
import { SCHEMES } from "../src/engine/schemes";
import { solveWeights } from "../src/engine/table";
import type { AlgoConfig, BoxDef, MysteryBoxConfig, SellbackConfig, BattlesConfig, RetentionConfig } from "../src/engine/types";

const T = 100_000_000;
const items = CATALOG.filter((c) => ["w-montvale-sovereign-40", "w-tissotti-prx", "s-aireau-dunk-low", "be-chanelle-rouge", "f-keychain", "f-credit-3", "f-credit-1", "f-sticker-logo"].includes(c.id));
const solved = solveWeights(items, T, 25, 0.9, "realized");
console.log("solver: rtp", solved.achievedRtp.toFixed(4), "beta", solved.beta.toFixed(3), "clamped", solved.clamped);
console.log(solved.weights.map((w) => `${w.itemId}:${(w.weight / T * 100).toFixed(4)}%`).join("  "));
const box: BoxDef = { name: "Smoke box", price: 25, ticketTotal: T, items: solved.weights, valueLayer: "realized", displayLayer: "retail" };
const algo: AlgoConfig = { scheme: "jemlit", mapping: "native", rng: "sfc32", rotation: "on-retire", rotateEvery: 1000, clientSeedMode: "site-default" };

// Jemlit example hash from their page
const d = SCHEMES.jemlit.digest({ serverSeed: "server seed", clientSeed: "your client seed", nonce: "your nonce" as unknown as number, opening: 1 });
console.log("jemlit example matches:", d === "38611068f6936027c4657138536fb5bb8f82a6cb2d883f1acb47cb24013f9e93");

function mb(label: string, cfg: MysteryBoxConfig, opens: number) {
  const t = Date.now();
  const r = runLab({ lab: "mystery-box", config: cfg, sizes: { opens, verifySample: 200 }, seed: 42 });
  if (r.kind !== "mystery-box") throw new Error();
  console.log(
    `${label}: ${opens} opens in ${Date.now() - t}ms | realized RTP ${r.realizedRtp.realized.toFixed(4)} (stated ${r.statedRtp.realized.toFixed(4)}) | chi p=${r.chi.pValue.toExponential(2)} | verify ${r.verifier.passed}/${r.verifier.sampled} | rerolls ${r.rerolls} grinds ${r.grinds} rot ${r.rotations}`,
  );
  return r;
}
mb("honest jemlit", { box, algo, rigs: {}, accounts: { tags: [{ tag: "player", share: 1 }] } }, 200_000);
mb("glassbox per-open", { box, algo: { ...algo, scheme: "glassbox", rotation: "per-open" }, rigs: {}, accounts: { tags: [] } }, 100_000);
mb("table swap 0.7", { box, algo, rigs: { tableSwap: { hiddenRtp: 0.7 } }, accounts: { tags: [] } }, 200_000);
mb("bypass 0.6", { box, algo, rigs: { bypass: { hiddenRtp: 0.6 } }, accounts: { tags: [] } }, 50_000);
mb("grind client seed x5 >=3x", { box, algo, rigs: { serverChosenClientSeed: { attempts: 5, thresholdMultiple: 3 } }, accounts: { tags: [] } }, 50_000);
mb("commit after client x5 >=3x", { box, algo, rigs: { commitAfterClient: { attempts: 5, thresholdMultiple: 3 } }, accounts: { tags: [] } }, 50_000);
mb("reroll wins >=5x", { box, algo, rigs: { rotationOnWins: { thresholdMultiple: 5, maxRerolls: 3 } }, accounts: { tags: [] } }, 50_000);
mb("per-account streamer 1.6", { box, algo, rigs: { perAccount: { tag: "streamer", rtp: 1.6 } }, accounts: { tags: [{ tag: "player", share: 0.9 }, { tag: "streamer", share: 0.1 }] } }, 100_000);
const packs = mb("packs int32-mod", { box, algo: { ...algo, scheme: "packs", mapping: "int32-mod", rotation: "per-open" }, rigs: {}, accounts: { tags: [] } }, 300_000);
const last = packs.ticketRegions.counts.slice(-3).reduce((a, b) => a + b, 0) / 3;
const first = packs.ticketRegions.counts.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
console.log("packs bias map: first-3-bins avg", first.toFixed(0), "last-3-bins avg", last.toFixed(0));
mb("float-cumulative", { box, algo: { ...algo, mapping: "float-cumulative" }, rigs: {}, accounts: { tags: [] } }, 50_000);
mb("no commitment lcg", { box, algo: { ...algo, scheme: "none", rng: "lcg" }, rigs: {}, accounts: { tags: [] } }, 50_000);

const sb: SellbackConfig = {
  box, algo: { ...algo, scheme: "none" }, rigs: {},
  sellback: { mode: "vendor", haircut: 0 },
  withdrawal: { mode: "through-items", minWithdraw: 100 },
  population: { agents: 2000, depositMean: 100, depositSpread: 0.8, sessions: 20, opensPerSession: 10, sellBelowMultiple: 4, shipAboveMultiple: 4, rebetFraction: 0.5, maxDeposits: 3, cashOutTargetMultiple: 3 },
};
let t = Date.now();
const s = runLab({ lab: "sellback", config: sb, sizes: {}, seed: 7 });
if (s.kind === "sellback") console.log(`sellback vendor: ${Date.now() - t}ms | hold ${(s.hold * 100).toFixed(1)}% | sellback rate ${(s.sellbackRate * 100).toFixed(1)}% | ship rate ${(s.shipRate * 100).toFixed(2)}% | ruin ${(s.ruinFraction * 100).toFixed(1)}% | withdrawn ${s.withdrawnCash.toFixed(0)} | extra wager for withdrawal ${s.extraWagerForWithdrawal.toFixed(0)}`);
const sb2 = { ...sb, sellback: { mode: "cash", layer: "realized", haircut: 0.05 } as const, withdrawal: { mode: "cash", minWithdraw: 0 } as const };
const s2 = runLab({ lab: "sellback", config: sb2, sizes: {}, seed: 7 });
if (s2.kind === "sellback") console.log(`sellback cash: hold ${(s2.hold * 100).toFixed(1)}% | ruin ${(s2.ruinFraction * 100).toFixed(1)}% | money left ${s2.moneyLeftSystem.toFixed(0)}`);

const bt: BattlesConfig = { boxes: [box, box, box], algo: { ...algo, scheme: "none" }, rigs: {}, mode: "normal", players: 4, humansPerBattle: 1, bots: { enabled: true } };
t = Date.now();
for (const mode of ["normal", "crazy", "group", "terminal", "jackpot"] as const) {
  const b = runLab({ lab: "battles", config: { ...bt, mode }, sizes: { battles: 3000 }, seed: 3 });
  if (b.kind === "battles") console.log(`battles ${mode}: edge ${(b.realizedEdge * 100).toFixed(1)}% | human win ${(b.humanWinRate * 100).toFixed(1)}% (exp ${(b.expectedHumanWinRate * 100).toFixed(1)}%) | wager x${b.wagerMultiplier.toFixed(1)}`);
}
const bf = runLab({ lab: "battles", config: { ...bt, rigs: { favouredBots: { botRtp: 1.4 } } }, sizes: { battles: 3000 }, seed: 3 });
if (bf.kind === "battles") console.log(`battles favoured bots: human win ${(bf.humanWinRate * 100).toFixed(1)}% (exp ${(bf.expectedHumanWinRate * 100).toFixed(1)}%)`);
console.log("battles took", Date.now() - t, "ms");

const rt: RetentionConfig = {
  box, algo: { ...algo, scheme: "none" }, rigs: {}, days: 30, agents: 2000,
  dailyBox: { enabled: true, expiry: "24h", tierValues: [1, 2, 4, 8] },
  race: { enabled: true, cadenceDays: 7, prizes: [200, 100, 50] },
  affiliate: { enabled: true, referredShare: 0.2, freeBoxes: 3, commission: 0.05 },
  visitor: { baseVisit: 0.3, incentiveLift: 0.2, raceLift: 0.2, churnHazard: 0.05, depositPerVisit: 20, opensPerVisit: 3 },
};
t = Date.now();
const r = runLab({ lab: "retention", config: rt, sizes: {}, seed: 11 });
if (r.kind === "retention") console.log(`retention: ${Date.now() - t}ms | d1 ${(r.retention.d1 * 100).toFixed(0)}% d7 ${(r.retention.d7 * 100).toFixed(0)}% d30 ${(r.retention.d30 * 100).toFixed(0)}% (control d30 ${(r.controlRetention.d30 * 100).toFixed(0)}%) | bonus ${r.bonusCost.toFixed(0)} | incremental wager ${r.incrementalWager.toFixed(0)} | LTV ${r.ltv.toFixed(1)} | hold after bonuses ${(r.holdAfterBonuses * 100).toFixed(1)}%`);
console.log("catalog items:", CATALOG.length, "map", CATALOG_BY_ID.size);
