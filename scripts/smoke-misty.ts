// Headless check of the Misty copy: every live box, the proof, and a per-player table.
// Run: npx -y tsx scripts/smoke-misty.ts
import { runLab } from "../src/engine";
import { MISTY_BOXES, mistyMath, scaleItemOdds, verifyMistySpin } from "../src/engine/labs/misty";
import { mistyConfigFor } from "../src/lib/mistyPresets";
import type { MistyResult } from "../src/engine/types";

const pct = (v: number) => (v * 100).toFixed(1) + "%";

console.log("=== Misty live boxes: what the tables say ===");
for (const b of MISTY_BOXES) {
  const m = mistyMath(b, undefined, b.bonus, { misteeFace: 1, misteeReal: 0.37, itemRealized: 0.7 });
  console.log(
    `${b.slug.padEnd(16)} $${String(b.price).padStart(3)} outcomes ${String(b.outcomes.length).padStart(2)} sum ${m.total.toFixed(3).padStart(8)} | piece ${m.pItem > 0 ? "1 in " + Math.round(1 / m.pItem) : "never"} | items $${m.evItems.toFixed(2)} + ${m.evMistees.toFixed(2)} Mistees | face ${pct(m.returnFace)} real ${pct(m.returnReal)}`,
  );
}

console.log("\n=== Timepiece Suite, 50,000 opens, proofs ===");
const cfg = mistyConfigFor("timepiece-suite");
cfg.run = { opens: 50000, verifySample: 500 };
const t0 = Date.now();
const r = runLab({ lab: "misty", config: cfg, sizes: {}, seed: 7 }) as MistyResult;
console.log(`opens ${r.opens} | return face ${pct(r.returnFace)} (table ${pct(r.expectedFace)}) real ${pct(r.returnReal)} (table ${pct(r.expectedReal)}) | items ${r.items} (1 in ${Math.round(r.opens / Math.max(1, r.items))}) | mistees/open ${(r.mistees / r.opens).toFixed(2)} (table ${r.expectedMistees.toFixed(2)}) | chi p ${r.chi.pValue.toFixed(3)} | verify ${r.verifier.passed}/${r.verifier.sampled} | ${Date.now() - t0}ms`);
const s = r.sample[0];
console.log(`first open: hash ${s.serverHash.slice(0, 12)}… seed ${s.serverSeed.slice(0, 12)}… digest ${s.digest.slice(0, 12)}… roll ${(s.roll * 100).toFixed(4)} → ${s.label} (${s.totalMistees} Mistees)`);
const tampered = { ...s, serverSeed: s.serverSeed.replace(/^./, s.serverSeed[0] === "a" ? "b" : "a") };
console.log(`tampered seed verifies: ${verifyMistySpin(tampered, cfg).ok} (${verifyMistySpin(tampered, cfg).reason})`);

console.log("\n=== Per player: VIP with pieces x5, guest with box odds ===");
const box = MISTY_BOXES.find((b) => b.slug === "timepiece-suite")!;
const cfg2 = mistyConfigFor("timepiece-suite");
cfg2.players = [
  { id: "guest", name: "Guest", share: 0.9 },
  { id: "vip", name: "VIP x5", share: 0.1, weights: scaleItemOdds(box, cfg2.weights, 5) },
];
cfg2.run = { opens: 100000, verifySample: 300 };
const r2 = runLab({ lab: "misty", config: cfg2, sizes: {}, seed: 11 }) as MistyResult;
for (const p of r2.perPlayer) console.log(`${p.name.padEnd(8)} opens ${String(p.opens).padStart(6)} items ${String(p.items).padStart(4)} (table 1 in ${Math.round(1 / p.itemChance)}) mistees ${p.mistees} | return face ${pct(p.returnFace)} (table ${pct(p.expectedFace)})`);
console.log(`chi p ${r2.chi.pValue.toFixed(3)} (expected counts blend both tables) | verify ${r2.verifier.passed}/${r2.verifier.sampled}`);

console.log("\n=== Proof off ===");
const cfg3 = mistyConfigFor("vanity");
cfg3.provablyFair = false;
cfg3.run = { opens: 20000, verifySample: 100 };
const r3 = runLab({ lab: "misty", config: cfg3, sizes: {}, seed: 3 }) as MistyResult;
console.log(`vanity opens ${r3.opens} | return face ${pct(r3.returnFace)} (table ${pct(r3.expectedFace)}) | verify ${r3.verifier.passed}/${r3.verifier.sampled} ${JSON.stringify(r3.verifier.reasons)}`);
