// Headless check of every preset and lab added for waves 2 to 5. Run: npx -y tsx scripts/smoke2.ts
import { runLab } from "../src/engine";
import { PRESETS, DEFAULT_CREDITS, DEFAULT_UPGRADER, DEFAULT_BATTLES, DEFAULT_RETENTION, SELLBACK_PRESETS, VENDOR_BOX } from "../src/lib/presets";
import type { MysteryBoxResult, CreditsResult, UpgraderResult, SellbackResult, BattlesResult, RetentionResult, BattlesConfig, RetentionConfig } from "../src/engine/types";

const pct = (x: number) => (x * 100).toFixed(1) + "%";
const t0 = Date.now();

console.log("=== mystery box presets (20,000 opens, 100 proofs) ===");
for (const p of PRESETS.mystery) {
  const t = Date.now();
  try {
    const r = runLab({ lab: "mystery-box", config: p.config, sizes: { opens: 20000, verifySample: 100 }, seed: 7 }) as MysteryBoxResult;
    const extras = [r.drops !== undefined ? `drops ${r.drops} retired ${r.retirements}` : "", r.pityApplied ? `pity ${r.pityApplied}` : "", r.secretDraws ? `secret ${r.secretDraws}` : "", r.stoppedEarly ? `STOPPED: ${r.stoppedEarly}` : "", r.lastOneAwards ? `lastOne ${r.lastOneAwards}` : "", r.retirementAwards?.length ? `awards ${r.retirementAwards.length}` : ""].filter(Boolean).join(" ");
    console.log(`${p.id.padEnd(18)} price ${p.config.box.price.toFixed(2).padStart(8)} | stated ${pct(r.statedRtp[p.config.box.valueLayer])} realized ${pct(r.realizedRtp[p.config.box.valueLayer])} (cash ${pct(r.realizedRtp.realized)}) | chi p=${r.chi.pValue.toExponential(1)} | verify ${r.verifier.passed}/${r.verifier.sampled} | ${extras} | ${Date.now() - t}ms`);
  } catch (e) {
    console.log(`${p.id.padEnd(18)} ERROR ${e instanceof Error ? e.message : e}`);
  }
}

console.log("=== credits (Misty two-stage) ===");
{
  const r = runLab({ lab: "credits", config: DEFAULT_CREDITS, sizes: {}, seed: 3 }) as CreditsResult;
  console.log(`opens ${r.opens} spent ${r.spent.toFixed(0)} | nominal ${pct(r.nominalRtp)} end-to-end ${pct(r.endToEndRtp)} | ticket value ${r.prizePerTicket.toFixed(3)} | draws ${r.raffles} prizes ${r.prizesPaidTotal.toFixed(0)} to free ${r.prizesToFree.toFixed(0)} | hold ${pct(r.hold)} | verify ${r.verifier.passed}/${r.verifier.sampled}`);
  const r2 = runLab({ lab: "credits", config: { ...DEFAULT_CREDITS, raffle: { ...DEFAULT_CREDITS.raffle, drawRule: "when-sold-out", freeEntryShare: 0.1, monthlyCap: 60 } }, sizes: {}, seed: 3 }) as CreditsResult;
  console.log(`omaze-style: opens ${r2.opens} cap-blocked ${r2.capBlockedOpens} | nominal ${pct(r2.nominalRtp)} end-to-end ${pct(r2.endToEndRtp)} | draws ${r2.raffles} unsold ${pct(r2.unsoldShareAtDraw)}`);
}

console.log("=== upgrader / deals ===");
{
  const r = runLab({ lab: "upgrader", config: DEFAULT_UPGRADER, sizes: {}, seed: 9 }) as UpgraderResult;
  console.log(`upgrader: attempts ${r.attempts} win ${pct(r.winRate)} (stated ${pct(r.statedChance)}) edge ${pct(r.realizedEdge)} (stated ${pct(r.statedEdge)}) ruin ${pct(r.ruinFraction)} reached ${r.reachedTarget} verify ${r.verifier.passed}/${r.verifier.sampled}`);
  const d = runLab({ lab: "upgrader", config: { ...DEFAULT_UPGRADER, mode: "deals", chance: 0.5, valueLayer: "retail" }, sizes: {}, seed: 9 }) as UpgraderResult;
  console.log(`deals 50%: price ${d.pricePerAttempt.toFixed(2)} for ${d.targetValue} | win ${pct(d.winRate)} edge ${pct(d.realizedEdge)} ruin ${pct(d.ruinFraction)}`);
  const h = runLab({ lab: "upgrader", config: { ...DEFAULT_UPGRADER, rigs: { tableSwap: { hiddenRtp: 0.7 } } }, sizes: {}, seed: 9 }) as UpgraderResult;
  console.log(`hidden edge: win ${pct(h.winRate)} (stated ${pct(h.statedChance)}) edge ${pct(h.realizedEdge)} verify ${h.verifier.passed}/${h.verifier.sampled}`);
}

console.log("=== sell-back presets ===");
for (const [k, cfg] of Object.entries(SELLBACK_PRESETS)) {
  try {
    const r = runLab({ lab: "sellback", config: { ...cfg, population: { ...cfg.population, agents: 600 } }, sizes: {}, seed: 2 }) as SellbackResult;
    const extras = [r.autoActions !== undefined ? `auto ${r.autoActions}` : "", r.keepFeesPaid !== undefined ? `fees ${r.keepFeesPaid.toFixed(0)}` : "", r.expiredCredit !== undefined ? `expired ${r.expiredCredit.toFixed(0)}` : "", r.floorTopUps !== undefined ? `floor ${r.floorTopUps.toFixed(0)}` : "", r.vaultLocked !== undefined ? `vault ${r.vaultLocked.toFixed(0)}` : "", r.creatorPaid !== undefined ? `creator ${r.creatorPaid.toFixed(0)}` : ""].filter(Boolean).join(" ");
    console.log(`${k.padEnd(10)} hold ${pct(r.hold)} | sellback ${pct(r.sellbackRate)} ship ${pct(r.shipRate)} | ruin ${pct(r.ruinFraction)} | left ${r.moneyLeftSystem.toFixed(0)} | ${extras}`);
  } catch (e) {
    console.log(`${k.padEnd(10)} ERROR ${e instanceof Error ? e.message : e}`);
  }
}

console.log("=== battles: new modes ===");
for (const mode of ["coinflip", "break"] as const) {
  const cfg: BattlesConfig = { ...DEFAULT_BATTLES, mode, boxes: mode === "coinflip" ? [VENDOR_BOX] : DEFAULT_BATTLES.boxes, players: mode === "coinflip" ? 2 : 4 };
  const r = runLab({ lab: "battles", config: cfg, sizes: { battles: 3000 }, seed: 4 }) as BattlesResult;
  console.log(`${mode.padEnd(9)} edge ${pct(r.realizedEdge)} | human win ${pct(r.humanWinRate)} (exp ${pct(r.expectedHumanWinRate)}) | wager x${r.wagerMultiplier.toFixed(1)}`);
}

console.log("=== retention options ===");
{
  const cfg: RetentionConfig = { ...DEFAULT_RETENTION, agents: 800, missions: { enabled: true, wagerTarget: 100, reward: 5 }, freeEntry: { enabled: true, share: 0.1 }, spendCap: { enabled: true, perDay: 15 } };
  const r = runLab({ lab: "retention", config: cfg, sizes: {}, seed: 5 }) as RetentionResult;
  console.log(`d7 ${pct(r.retention.d7)} (control ${pct(r.controlRetention.d7)}) | bonus ${r.bonusCost.toFixed(0)} missions ${r.missionCost?.toFixed(0)} free ${r.freeEntryCost?.toFixed(0)} cap-blocked ${r.capBlockedDeposits?.toFixed(0)} | hold after bonuses ${pct(r.holdAfterBonuses)}`);
}
console.log(`all done in ${Date.now() - t0} ms`);
