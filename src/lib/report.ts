// Markdown reports for runs, so results can be pasted into the research documents.
import type { AnyConfig, AnyResult, RunRecord } from "@/engine/types";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { money, pct, pctSmart } from "./format";

export function headlineFor(result: AnyResult): string {
  switch (result.kind) {
    case "mystery-box":
      return `${result.opens.toLocaleString()} opens · realized RTP ${pct(result.realizedRtp.realized)} (stated ${pct(result.statedRtp.realized)}) · chi p=${result.chi.pValue.toExponential(1)} · verify ${result.verifier.passed}/${result.verifier.sampled}`;
    case "sellback":
      return `${result.agents.toLocaleString()} agents · hold ${pct(result.hold)} · sell-back ${pct(result.sellbackRate)} · ruin ${pct(result.ruinFraction)}`;
    case "battles":
      return `${result.battles.toLocaleString()} battles · ${result.mode} · edge ${pct(result.realizedEdge)} · human win ${pct(result.humanWinRate)} (exp ${pct(result.expectedHumanWinRate)})`;
    case "retention":
      return `${result.agents.toLocaleString()} agents × ${result.days} days · D7 ${pct(result.retention.d7, 0)} · D30 ${pct(result.retention.d30, 0)} · bonus ${money(result.bonusCost)}`;
    case "credits":
      return `${result.opens.toLocaleString()} opens · nominal RTP ${pct(result.nominalRtp)} · end-to-end ${pct(result.endToEndRtp)} · ${result.raffles} draws · hold ${pct(result.hold)}`;
    case "upgrader":
      return `${result.attempts.toLocaleString()} ${result.mode} attempts · win ${pct(result.winRate, 2)} (stated ${pct(result.statedChance, 2)}) · edge ${pct(result.realizedEdge)} (stated ${pct(result.statedEdge)}) · ruin ${pct(result.ruinFraction)}`;
  }
}

export function reportMarkdown(run: RunRecord): string {
  const r = run.result;
  const lines: string[] = [
    `# Run report: ${run.name}`,
    "",
    `- Lab: ${run.lab}`,
    `- Created: ${run.createdAt}`,
    `- Seed: ${run.seed}`,
    `- Engine: ${run.engineVersion}`,
    `- Sizes: ${Object.entries(run.sizes)
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
    "",
    "## Headline",
    "",
    headlineFor(r),
    "",
  ];
  const cfg = run.config as AnyConfig & { algo?: { scheme: string; mapping: string; rotation: string }; rigs?: Record<string, unknown>; box?: { name: string; price: number; valueLayer: string; displayLayer: string } };
  if (cfg.algo) lines.push("## Algorithm", "", `- Scheme: ${cfg.algo.scheme}`, `- Mapping: ${cfg.algo.mapping}`, `- Rotation: ${cfg.algo.rotation}`, "");
  if (cfg.rigs) {
    const active = Object.entries(cfg.rigs).filter(([, v]) => v);
    lines.push("## Active rigs", "", active.length ? active.map(([k, v]) => `- ${k}: ${JSON.stringify(v)}`).join("\n") : "- none", "");
  }
  if (cfg.box) lines.push("## Box", "", `- ${cfg.box.name} · price ${money(cfg.box.price)} · value layer ${cfg.box.valueLayer} · display layer ${cfg.box.displayLayer}`, "");

  if (r.kind === "mystery-box") {
    lines.push("## Results", "");
    lines.push(`| Metric | Value |`, `|---|---|`);
    lines.push(`| Opens | ${r.opens.toLocaleString()} |`);
    lines.push(`| Stated RTP (retail / asking / realized) | ${pct(r.statedRtp.retail)} / ${pct(r.statedRtp.asking)} / ${pct(r.statedRtp.realized)} |`);
    lines.push(`| Realized RTP (retail / asking / realized) | ${pct(r.realizedRtp.retail)} / ${pct(r.realizedRtp.asking)} / ${pct(r.realizedRtp.realized)} |`);
    lines.push(`| Standard error of realized RTP | ${pct(r.rtpSe, 2)} |`);
    lines.push(`| Displayed RTP | ${pct(r.displayedRtp)} |`);
    lines.push(`| P(outcome ≥ price) | ${pct(r.pAtLeastPrice, 2)} |`);
    lines.push(`| Chi-square | ${r.chi.statistic.toFixed(2)} (df ${r.chi.df}, p ${r.chi.pValue.toExponential(2)}) |`);
    lines.push(`| Proofs verified | ${r.verifier.passed}/${r.verifier.sampled} |`);
    lines.push(`| Rotations / rerolls / grinds / fallthroughs | ${r.rotations} / ${r.rerolls} / ${r.grinds} / ${r.fallthroughs} |`);
    lines.push("", "## Items", "", `| Item | Stated | Observed | Expected | Value |`, `|---|---|---|---|---|`);
    for (const it of r.items) {
      const c = CATALOG_BY_ID.get(it.itemId);
      lines.push(`| ${c ? c.brand + " " + c.name : it.itemId} | ${pctSmart(it.stated)} | ${it.observed.toLocaleString()} | ${it.expected.toFixed(1)} | ${money(it.payoutValue)} |`);
    }
  } else if (r.kind === "sellback") {
    lines.push("## Results", "", `| Metric | Value |`, `|---|---|`);
    lines.push(`| Agents | ${r.agents.toLocaleString()} |`, `| Deposits | ${money(r.deposits)} |`, `| Wagered | ${money(r.wagered)} |`, `| Credited on sell-back | ${money(r.creditedValue)} |`);
    lines.push(`| Shipped items | ${r.shippedCount.toLocaleString()} (${money(r.shippedValue)} at realized) |`, `| Cash withdrawn | ${money(r.withdrawnCash)} |`, `| Money that left the system | ${money(r.moneyLeftSystem)} |`);
    lines.push(`| Hold of deposits | ${pct(r.hold)} |`, `| GGR | ${money(r.ggr)} |`, `| Sell-back rate | ${pct(r.sellbackRate)} |`, `| Ship rate | ${pct(r.shipRate, 2)} |`, `| Ruined agents | ${r.ruined.toLocaleString()} (${pct(r.ruinFraction)}) |`, `| Extra wager forced by withdraw-through-items | ${money(r.extraWagerForWithdrawal)} |`);
  } else if (r.kind === "battles") {
    lines.push("## Results", "", `| Metric | Value |`, `|---|---|`);
    lines.push(`| Battles | ${r.battles.toLocaleString()} |`, `| Mode | ${r.mode} |`, `| Entry per player | ${money(r.entryPerPlayer)} |`, `| Wager multiplier vs single open | ${r.wagerMultiplier.toFixed(1)}× |`);
    lines.push(`| Total wagered / paid | ${money(r.totalWagered)} / ${money(r.totalPaid)} |`, `| Realized edge | ${pct(r.realizedEdge)} |`, `| Human win rate | ${pct(r.humanWinRate)} (expected ${pct(r.expectedHumanWinRate)}) |`, `| Ties | ${r.ties} |`, `| Largest pot | ${r.topPotMultiple.toFixed(1)}× entry |`);
  } else if (r.kind === "credits") {
    lines.push("## Results", "", `| Metric | Value |`, `|---|---|`);
    lines.push(`| Agents · opens | ${r.agents.toLocaleString()} · ${r.opens.toLocaleString()} |`, `| Spent | ${money(r.spent)} |`, `| Physical paid (display / realized) | ${money(r.physicalPaidDisplay)} / ${money(r.physicalPaidRealized)} |`);
    lines.push(`| Credits issued (face ${money(r.creditFaceValue)}) | ${r.creditsIssued.toLocaleString()} |`, `| Tickets paid / free | ${r.ticketsPaid.toLocaleString()} / ${r.ticketsFree.toLocaleString()} |`, `| Draws · prizes paid | ${r.raffles} · ${money(r.prizesPaidTotal)} (to paid ${money(r.prizesToPaid)}, to free ${money(r.prizesToFree)}) |`);
    lines.push(`| Real value of one ticket | ${money(r.prizePerTicket)} |`, `| Nominal RTP (credits at face) | ${pct(r.nominalRtp)} |`, `| End-to-end RTP (prizes to paid players) | ${pct(r.endToEndRtp)} |`, `| Operator hold | ${pct(r.hold)} |`, `| Unsold share at draw | ${pct(r.unsoldShareAtDraw)} |`, `| Proofs verified | ${r.verifier.passed}/${r.verifier.sampled} |`);
  } else if (r.kind === "upgrader") {
    lines.push("## Results", "", `| Metric | Value |`, `|---|---|`);
    lines.push(`| Mode | ${r.mode} |`, `| Attempts · wins | ${r.attempts.toLocaleString()} · ${r.wins.toLocaleString()} |`, `| Win rate (stated chance) | ${pct(r.winRate, 2)} (${pct(r.statedChance, 2)}) |`, `| Price per attempt · target value | ${money(r.pricePerAttempt)} · ${money(r.targetValue)} |`);
    lines.push(`| Wagered · paid | ${money(r.wagered)} · ${money(r.paid)} |`, `| Realized edge (stated) | ${pct(r.realizedEdge)} (${pct(r.statedEdge)}) |`, `| Agents ruined | ${r.ruined.toLocaleString()} of ${r.agents.toLocaleString()} (${pct(r.ruinFraction)}) |`, `| Reached the target | ${r.reachedTarget.toLocaleString()} |`, `| Proofs verified | ${r.verifier.passed}/${r.verifier.sampled} |`);
  } else if (r.kind === "retention") {
    lines.push("## Results", "", `| Metric | Value |`, `|---|---|`);
    lines.push(`| Agents × days | ${r.agents.toLocaleString()} × ${r.days} |`, `| Retention D1 / D7 / D30 | ${pct(r.retention.d1, 0)} / ${pct(r.retention.d7, 0)} / ${pct(r.retention.d30, 0)} |`, `| Control (no incentives) D1 / D7 / D30 | ${pct(r.controlRetention.d1, 0)} / ${pct(r.controlRetention.d7, 0)} / ${pct(r.controlRetention.d30, 0)} |`);
    lines.push(`| Deposits / wagered | ${money(r.deposits)} / ${money(r.wagered)} |`, `| GGR / bonus cost / NGR | ${money(r.ggr)} / ${money(r.bonusCost)} / ${money(r.ngr)} |`, `| LTV per agent | ${money(r.ltv)} |`, `| Hold after bonuses | ${pct(r.holdAfterBonuses)} |`, `| Incremental wager per bonus dollar | ${r.incrementalWagerPerBonusDollar.toFixed(2)} |`, `| Top-10% wager concentration | ${pct(r.raceWagerConcentrationTop10)} |`);
  }
  lines.push("", `_Generated by the Mystery Box Simulator. Same configuration and seed reproduce this run exactly._`);
  return lines.join("\n");
}
