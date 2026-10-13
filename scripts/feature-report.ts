// Writes the feature comparison as Markdown from the same matrix the /docs/features page uses.
// Run: npx -y tsx scripts/feature-report.ts ../research/07-feature-comparison.md
import { writeFileSync } from "node:fs";
import { EXTERNAL, FAMILIES, MECHANICS, SOURCES, adoption, presence, sourceProfile, spread, type Presence, type Spread } from "../src/lib/featureMatrix";

const out = process.argv[2] ?? "feature-report.md";
const MARK: Record<Presence, string> = { yes: "✓", variant: "~", no: "–", unknown: "?" };
const LABEL: Record<Spread, string> = { same: "Same across operators (three or more have it)", similar: "Similar (two or more, with variants)", unique: "Unique to one operator" };
const ranked = [...MECHANICS].map((m) => ({ m, a: adoption(m) })).sort((p, q) => q.a.yes + q.a.variant - (p.a.yes + p.a.variant) || q.a.yes - p.a.yes);
const by: Record<Spread, typeof ranked> = { same: [], similar: [], unique: [] };
for (const r of ranked) by[spread(r.m)].push(r);
const n = EXTERNAL.length;
const L: string[] = [];
L.push("# Feature and mechanic comparison across sources", "");
L.push("<!-- links: Feature report with charts (simulator)|https://mys-sim.vercel.app/docs/features; Tracker|00-tracker.html -->", "");
L.push(`Version 1.0, 13 October 2026. ${MECHANICS.length} mechanics across ${n} operators, our Glass Box and the adjacent formats, hand-curated from dossiers 1 and 2 and the captures of 12 and 13 October. The same matrix drives the charts at /docs/features in the simulator; this file is generated from it by \`simulator/scripts/feature-report.ts\`.`, "");
L.push("Legend: ✓ has it as described · ~ a close variant · – absent · ? not visible from outside.", "");
L.push("## 1. Summary", "");
L.push(`- ${by.same.length} mechanics are the same across operators, ${by.similar.length} similar, ${by.unique.length} unique.`);
L.push("- Everyone shares the core: a weighted odds table with independent opens, published odds, a sell-back into balance.");
L.push("- The case sites (Jemlit, Cases.gg, Misty) form one family: committed secret, player seed, verifier. Evo Verse, IcyBox, StockX and Courtyard have no proof.");
L.push("- Battles and the upgrader appear on Evo Verse, Jemlit and Cases.gg only.");
L.push("- The unique mechanics are where margin or honesty lives: Misty's credit-only payouts, free spins and frozen table; IcyBox's early retirement; StockX's tiers; Courtyard's price-from-contents; our market value.");
const evo = sourceProfile("evo");
L.push(`- Evo Verse has ${evo.has.length} of ${MECHANICS.length} mechanics: ${evo.same} shared, ${evo.similar} similar, ${evo.unique} unique. Its gap is the proof family.`, "");
L.push("## 2. Most used mechanics", "", `| Mechanic | Family | Has it | Variant | Total of ${n} | Spread |`, "|---|---|---|---|---|---|");
for (const { m, a } of ranked) L.push(`| ${m.name} | ${FAMILIES.find((f) => f.id === m.family)?.name} | ${a.yes} | ${a.variant} | ${a.yes + a.variant} | ${spread(m)} |`);
L.push("");
L.push("## 3. Same, similar, unique", "");
for (const k of ["same", "similar", "unique"] as Spread[]) {
  L.push(`### ${LABEL[k]}`, "");
  for (const { m, a } of by[k]) {
    const who = a.sources.filter((s) => s.p === "yes" || s.p === "variant").map((s) => `${SOURCES.find((q) => q.id === s.id)?.name}${s.p === "variant" ? " (~)" : ""}`).join(", ");
    L.push(`- **${m.name}.** ${m.plain} ${who ? `Found at: ${who}.` : ""}`);
  }
  L.push("");
}
L.push("## 4. The matrix", "", `| Mechanic | ${SOURCES.map((s) => s.name.replace(" (ours)", "")).join(" | ")} |`, `|---|${SOURCES.map(() => "---").join("|")}|`);
for (const f of FAMILIES) {
  L.push(`| **${f.name}** | ${SOURCES.map(() => " ").join(" | ")} |`);
  for (const m of MECHANICS.filter((x) => x.family === f.id)) L.push(`| ${m.name} | ${SOURCES.map((s) => MARK[presence(m, s.id)]).join(" | ")} |`);
}
L.push("");
L.push("## 5. Source by source", "");
for (const s of SOURCES) {
  const p = sourceProfile(s.id);
  const uniques = p.has.filter((m) => spread(m) === "unique" && presence(m, s.id) === "yes").map((m) => m.name);
  const notes = MECHANICS.filter((m) => (m.cells[s.id]?.[1] ?? "") && presence(m, s.id) !== "no").map((m) => `${m.name}: ${m.cells[s.id][1]}`);
  L.push(`### ${s.name}`, "", s.short, "", `- ${p.has.length} mechanics: ${p.same} same, ${p.similar} similar, ${p.unique} unique.`);
  if (uniques.length) L.push(`- Only here: ${uniques.join("; ")}.`);
  if (notes.length) L.push(`- Notes: ${notes.join(" · ")}`);
  L.push("");
}
L.push("## 6. Takeaways for our build", "");
L.push("- Table stakes: weighted table, published odds, sell-back.");
L.push("- Proof is the dividing line: three operators commit a secret, four do not. Per-open commitment with a frozen table (Misty, Glass Box) is the strongest version and costs nothing to run.");
L.push("- Credit-only payouts are Misty's margin engine and unique. Copy the mechanism only with a published rate.");
L.push("- Battles and upgrader are expected on a case site and absent on luxury boxes; Evo Verse already ships both.");
L.push("- Nobody shows an independent market value except our design: the cheapest visible difference.");
L.push("- Price from contents (Courtyard, Glass Box) is rare and honest; price first is the industry habit.");
L.push("");
L.push("## Glossary", "");
L.push("* **Mechanic.** One rule of the product that can be present or absent on its own: a draw model, a proof step, a payout rule, a side game.");
L.push("* **Same.** Three or more operators have the mechanic as described.");
L.push("* **Similar.** Two or more operators have it or a close relative.");
L.push("* **Unique.** Exactly one operator has it.");
L.push("* **Family.** A group of mechanics with the same purpose: draw model, fairness proof, payout and money, side games, retention and marketing, pricing and valuation.");
writeFileSync(out, L.join("\n") + "\n");
console.log("wrote", out, L.length, "lines");
