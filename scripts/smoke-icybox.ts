// Headless check of the IcyBox reconstruction: fitted returns, band sums, the drop pool, the runner.
// Run: npx -y tsx scripts/smoke-icybox.ts
import { DropPool, ICYBOX_BOXES, IcyboxOpener, buildTable, icyboxMath, liveChances, lookupBand, runIcybox } from "../src/engine/labs/icybox";
import { icyboxConfigFor } from "../src/lib/icyboxPresets";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " · " + detail : ""}`);
  if (!ok) fails++;
};

for (const b of ICYBOX_BOXES) {
  const cfg = icyboxConfigFor(b);
  const m = icyboxMath(b, cfg.chances, cfg);
  check(`${b.name}: chances sum to 1 and return at listed = 85%`, Math.abs(m.total - 1) < 1e-9 && Math.abs(m.returnListed - 0.85) < 1e-6, `${(m.total * 100).toFixed(4)}% · ${(m.returnListed * 100).toFixed(3)}% · grail ${(m.pGrail * 100).toFixed(3)}% · sold back ${(m.returnBuyback * 100).toFixed(1)}% · real ${(m.returnReal * 100).toFixed(1)}%`);
  check(`${b.name}: six bands, values rise Common to Legendary, Grail is wide and tops them`, b.bands.length === 6 && b.bands.slice(0, 5).every((band, i) => i === 0 || Math.min(...band.items.map((x) => x.value)) >= Math.min(...b.bands[i - 1].items.map((x) => x.value))) && Math.max(...b.bands[5].items.map((x) => x.value)) >= Math.max(...b.bands[4].items.map((x) => x.value)));
  check(`${b.name}: grail items match the site carousel values`, b.bands[5].items.some((it) => b.showcase.includes(it.value)), b.showcase.join("/"));
}

// bands partition the line
{
  const b = ICYBOX_BOXES[2];
  const t = buildTable(b, liveChances(b));
  const counts: Record<string, number> = {};
  for (let i = 0; i < 100000; i++) {
    const e = lookupBand(t, i / 100000);
    counts[e.band.id] = (counts[e.band.id] ?? 0) + 1;
  }
  const maxDev = Math.max(...t.entries.map((e) => Math.abs((counts[e.band.id] ?? 0) / 100000 - e.chance / t.total)));
  check("lookupBand follows the chances (max deviation < 0.1%)", maxDev < 0.001, `${(maxDev * 100).toFixed(4)}%`);
}

// drop pool: without replacement, retires at the rule, grails left behind are counted
{
  const b = ICYBOX_BOXES[1];
  const pool = new DropPool(b, liveChances(b), 1000, 0.7);
  let n = 0;
  while (!pool.retired && n < 5000) {
    pool.draw(Math.random());
    n++;
  }
  check("drop pool retires at 70% sold", pool.retired && Math.abs(pool.sold / pool.initial - 0.7) < 0.01, `sold ${pool.sold} of ${pool.initial}; grails left ${pool.bandLeft("grail")}`);
  const pool2 = new DropPool(b, liveChances(b), 500, 0);
  let m = 0;
  while (!pool2.retired && m < 5000) {
    pool2.draw(Math.random());
    m++;
  }
  check("drop pool sells out when never retired", pool2.left === 0 && pool2.sold === pool2.initial);
}

// opener in drop mode stops when retired
{
  const cfg = icyboxConfigFor(ICYBOX_BOXES[0], { drop: { enabled: true, copies: 200, retireAt: 0.5 } });
  const op = new IcyboxOpener(cfg, "smoke");
  let k = 0;
  while (op.spin()) k++;
  check("opener stops at the retirement point", op.retired && k === Math.ceil(0.5 * (op.pool?.initial ?? 0)), `${k} opens of ${op.pool?.initial}`);
}

// runner: 100k opens within tolerance; drop mode counts grails left behind
{
  const cfg = icyboxConfigFor(ICYBOX_BOXES[2], { run: { opens: 100000 } });
  const r = runIcybox(cfg, 7);
  check("100k opens: return at listed within 3 points of the table", Math.abs(r.returnListed - r.expectedListed) < 0.03, `${(r.returnListed * 100).toFixed(2)}% vs ${(r.expectedListed * 100).toFixed(2)}%`);
  check("100k opens: chi-square p > 0.001", r.chi.pValue > 0.001, `p = ${r.chi.pValue.toFixed(4)}`);
  check("no proofs", r.verifier.passed === 0 && r.verifier.sampled === 0);
  const d = runIcybox(icyboxConfigFor(ICYBOX_BOXES[2], { run: { opens: 50000 }, drop: { enabled: true, copies: 1000, retireAt: 0.7 } }), 8);
  check("drop mode: several drops, grails left behind counted", !!d.drop && d.drop.drops > 10 && d.drop.grailsLeftBehind > 0, d.drop ? `${d.drop.drops} drops · ${d.drop.retired} retired · ${d.drop.grailsLeftBehind} grails left · ${d.drop.grailsShipped} shipped` : "no drop");
  console.log("ruby 100k:", { returnBuyback: d.returnBuyback.toFixed(3), returnReal: r.returnReal.toFixed(3), soldBack: r.soldBack, kept: r.itemsKept, autoSold: r.autoSold, longestDry: r.longestDry });
}
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILED`);
process.exit(fails ? 1 : 0);
