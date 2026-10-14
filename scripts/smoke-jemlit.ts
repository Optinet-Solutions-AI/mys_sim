// Headless check of the Jemlit copy: the published example, every featured box, a long run, a tampered seed.
// Run: npx -y tsx scripts/smoke-jemlit.ts
import { runLab } from "../src/engine";
import { JEMLIT_FEATURED, JEMLIT_SUMMARY } from "../src/engine/jemlitLive.generated";
import { jemlitCommit, jemlitDigest, jemlitMath, jemlitRoll, verifyJemlitSpin } from "../src/engine/labs/jemlit";
import { jemlitConfigFor } from "../src/lib/jemlitPresets";
import type { JemlitResult } from "../src/engine/types";

const pct = (v: number) => (v * 100).toFixed(2) + "%";
const V = { creditFace: 1, creditReal: 0.4, itemRealized: 0.7 };

console.log("=== Jemlit published example ===");
const d = jemlitDigest("server seed", "your client seed", "your nonce" as unknown as number);
console.log(d, d === "38611068f6936027c4657138536fb5bb8f82a6cb2d883f1acb47cb24013f9e93" ? "MATCHES" : "MISMATCH", "roll", jemlitRoll(d).toFixed(4), "(page: 22.0231)", "commit", jemlitCommit("server seed").slice(0, 16) + "…");

console.log("\n=== featured boxes: what the tables say ===");
for (const b of JEMLIT_FEATURED) {
  const m = jemlitMath(b, undefined, V);
  console.log(`${b.slug.padEnd(24)} $${String(b.price).padStart(6)} items ${String(b.items.length).padStart(2)} sum ${(m.total * 100).toFixed(4)}% | worth price+ 1 in ${m.pAtOrAbovePrice > 0 ? Math.round(1 / m.pAtOrAbovePrice) : "∞"} | listed ${pct(m.returnPrice)} credits ${pct(m.returnCashback)} real ${pct(m.returnReal)}`);
}
const n80 = JEMLIT_SUMMARY.filter((b) => b.rtpPrice != null && Math.abs(b.rtpPrice - 0.8) < 0.005).length;
console.log(`all captured: ${JEMLIT_SUMMARY.length} boxes, ${n80} at 80.0% at listed prices`);

console.log("\n=== Apple eBox, 50,000 opens, proofs ===");
const cfg = jemlitConfigFor(JEMLIT_FEATURED.find((b) => b.slug === "apple-ebox")!);
cfg.players = [{ id: "guest", name: "Guest", share: 1 }];
cfg.activePlayerId = "guest";
cfg.run = { opens: 50000, verifySample: 500 };
const t0 = Date.now();
const r = runLab({ lab: "jemlit", config: cfg, sizes: {}, seed: 7 }) as JemlitResult;
console.log(`opens ${r.opens} | RTP listed ${pct(r.returnPrice)} (table ${pct(r.expectedPrice)}) real ${pct(r.returnReal)} (table ${pct(r.expectedReal)}) | worth price+ ${r.bigWins} (1 in ${Math.round(r.opens / Math.max(1, r.bigWins))}, table 1 in ${Math.round(1 / r.pBig)}) | credit opens ${r.creditOpens} | chi p ${r.chi.pValue.toFixed(3)} | verify ${r.verifier.passed}/${r.verifier.sampled} | longest dry ${r.longestDry} | ${Date.now() - t0}ms`);
const s = r.sample[0];
console.log(`first open: hash ${s.serverHash.slice(0, 12)}… nonce ${s.nonce} digest ${s.digest.slice(0, 12)}… roll ${s.roll.toFixed(4)} → ${s.label} (band ${s.lower.toFixed(3)}–${s.upper.toFixed(3)})`);
const tampered = { ...s, serverSeed: s.serverSeed.replace(/^./, s.serverSeed[0] === "a" ? "b" : "a") };
console.log(`tampered seed verifies: ${verifyJemlitSpin(tampered, cfg).ok} (${verifyJemlitSpin(tampered, cfg).reason})`);
console.log(`nonces of the first five opens: ${r.sample.slice(0, 5).map((x) => x.nonce).join(", ")} (same server seed, hash ${r.sample[4].serverHash === s.serverHash ? "unchanged" : "CHANGED"})`);
