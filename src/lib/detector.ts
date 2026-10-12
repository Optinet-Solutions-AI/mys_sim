// The detector: what an outsider with the published odds and a sample of proofs could conclude from a run.
import type { MysteryBoxConfig, MysteryBoxResult } from "@/engine/types";
import { detectSampleSize } from "@/engine/metrics";

export interface Finding {
  id: string;
  title: string;
  status: "flag" | "clear" | "info";
  detail: string;
  suggests: string[];
}

export function detect(cfg: MysteryBoxConfig, r: MysteryBoxResult): Finding[] {
  const out: Finding[] = [];
  // 1. proofs
  if (cfg.algo.scheme === "none") {
    out.push({ id: "proof", title: "No commitment published", status: "flag", detail: "There is nothing to verify. Only statistics can say anything about this operator.", suggests: ["Provably fair off"] });
  } else if (r.verifier.failed > 0) {
    out.push({
      id: "proof",
      title: "Proofs do not reproduce the awarded items",
      status: "flag",
      detail: `${r.verifier.failed} of ${r.verifier.sampled} sampled opens fail honest recomputation (${Object.entries(r.verifier.reasons)
        .map(([k, v]) => `${k}: ${v}`)
        .join("; ")}).`,
      suggests: ["Bypass", "Table swap (independent verifier on displayed odds)", "Cheapest-two mode"],
    });
  } else {
    out.push({ id: "proof", title: `All ${r.verifier.sampled} sampled proofs verify`, status: "clear", detail: "The dice roll was fixed before each bet. This says nothing about the table, the values or seed selection.", suggests: [] });
  }
  // 2. odds
  if (r.chi.pValue < 0.001) {
    out.push({
      id: "chi",
      title: "Observed odds do not match stated odds",
      status: "flag",
      detail: `Chi-square ${r.chi.statistic.toFixed(1)} on ${r.chi.df} degrees of freedom, p = ${r.chi.pValue.toExponential(2)}.`,
      suggests: ["Table swap", "Per-account odds", "Cheapest-two mode", "Seed grinding", "Reroll on wins", "Mid-run or dynamic RTP"],
    });
  } else {
    out.push({ id: "chi", title: "Observed odds consistent with stated odds", status: "clear", detail: `p = ${r.chi.pValue.toFixed(3)} over ${r.opens.toLocaleString()} opens. A subtle rig can still hide below this sample size.`, suggests: [] });
  }
  // 3. return
  const layer = cfg.box.valueLayer;
  const gap = r.statedRtp[layer] - r.realizedRtp[layer];
  if (r.rtpSe > 0 && gap > 3 * r.rtpSe) {
    out.push({
      id: "rtp",
      title: "Realized return below stated return",
      status: "flag",
      detail: `Stated ${(r.statedRtp[layer] * 100).toFixed(1)}%, realized ${(r.realizedRtp[layer] * 100).toFixed(1)}% ± ${(r.rtpSe * 100).toFixed(1)}% (1 se). Gap is ${(gap / r.rtpSe).toFixed(1)} standard errors.`,
      suggests: ["Table swap", "Seed grinding", "Reroll on wins", "RTP change"],
    });
  } else {
    out.push({ id: "rtp", title: "Realized return matches stated return within noise", status: "clear", detail: `Realized ${(r.realizedRtp[layer] * 100).toFixed(1)}% ± ${(r.rtpSe * 100).toFixed(1)}% against stated ${(r.statedRtp[layer] * 100).toFixed(1)}%.`, suggests: [] });
  }
  // 4. valuation
  const disp = r.displayedRtp;
  const cash = r.realizedRtp.realized;
  if (disp - cash > 0.1) {
    out.push({
      id: "value",
      title: "Displayed value far above cash value",
      status: "flag",
      detail: `The box shows a return of ${(disp * 100).toFixed(0)}% on displayed values but pays ${(cash * 100).toFixed(0)}% at realized prices.`,
      suggests: ["Valuation inflation", "Retail-basis values", "Credits trap"],
    });
  } else {
    out.push({ id: "value", title: "Displayed value close to cash value", status: "clear", detail: `${(disp * 100).toFixed(0)}% displayed against ${(cash * 100).toFixed(0)}% realized.`, suggests: [] });
  }
  // 5. cohorts
  const tags = Object.entries(r.byTag);
  if (tags.length > 1) {
    const rtps = tags.map(([, v]) => v.rtp);
    const spread = Math.max(...rtps) - Math.min(...rtps);
    if (spread > 0.15) {
      out.push({ id: "tags", title: "Account cohorts have different returns", status: "flag", detail: tags.map(([k, v]) => `${k}: ${(v.rtp * 100).toFixed(0)}% over ${v.opens.toLocaleString()} opens`).join("; "), suggests: ["Per-account odds (streamer or VIP accounts)"] });
    } else {
      out.push({ id: "tags", title: "Account cohorts return alike", status: "clear", detail: tags.map(([k, v]) => `${k}: ${(v.rtp * 100).toFixed(0)}%`).join("; "), suggests: [] });
    }
  }
  // 6. ticket regions
  const exp = r.opens / r.ticketRegions.bins;
  const sd = Math.sqrt(exp);
  const outliers = r.ticketRegions.counts.filter((c) => Math.abs(c - exp) > 4 * sd).length;
  if (outliers > 0) {
    out.push({ id: "regions", title: "Ticket regions are not uniform", status: "flag", detail: `${outliers} of ${r.ticketRegions.bins} regions deviate by more than 4 sd from ${exp.toFixed(0)}.`, suggests: ["Biased mapping (32-bit slice)", "Weak RNG"] });
  } else {
    out.push({ id: "regions", title: "Ticket regions uniform at this sample size", status: "clear", detail: `No region beyond 4 sd. A 2.4% modulo bias needs roughly ${detectSampleSize(0.05, 0.024).toLocaleString()} opens in the affected region to show.`, suggests: [] });
  }
  // 7. operator-side counters (visible only inside the simulator)
  if (r.rerolls > 0 || r.grinds > 0) {
    out.push({
      id: "ops",
      title: "Operator-side activity the public never sees",
      status: "info",
      detail: `${r.rerolls.toLocaleString()} rerolls and ${r.grinds.toLocaleString()} seed grinds happened in this run. Outside the simulator only an immutable, externally anchored log would show them.`,
      suggests: [],
    });
  }
  // 8. detectability of the top item
  const top = [...r.items].sort((a, b) => b.payoutValue - a.payoutValue)[0];
  if (top) {
    out.push({
      id: "power",
      title: `Sample needed to notice the top item paying 30% less often`,
      status: "info",
      detail: `${top.itemId} is stated at ${(top.stated * 100).toFixed(4)}%. Detecting a 30% shortfall at 95% confidence needs about ${detectSampleSize(top.stated, 0.3).toLocaleString()} opens; this run has ${r.opens.toLocaleString()}.`,
      suggests: [],
    });
  }
  // 8b. presentation layer: the near-miss reel
  if (cfg.rigs.nearMiss) {
    out.push({
      id: "nearmiss",
      title: "Near-miss reel active: presentation only",
      status: "info",
      detail: `${(cfg.rigs.nearMiss.rate * 100).toFixed(0)}% of losing opens are shown stopping one tile from a top item, and the strip over-represents rare items (showcase ${cfg.rigs.nearMiss.showcase}). Odds, payouts and proofs are untouched, so nothing in these results can show it; only an audit of the reel against the table can. Regulated RNG games forbid engineered near misses (Nevada since the 1989 Universal decision; UKGC RTS 7 requires the display to reflect the real odds).`,
      suggests: [],
    });
  }
  // 9. selective disclosure
  if (cfg.rigs.selectiveDisclosure) {
    const f = cfg.rigs.selectiveDisclosure.verifyFraction;
    out.push({ id: "disclosure", title: "Selective disclosure", status: "info", detail: `If ${(f * 100).toFixed(0)}% of players verify, a bypass that fails ${((r.verifier.failed / Math.max(1, r.verifier.sampled)) * 100).toFixed(0)}% of proofs would be noticed by about ${Math.round(r.opens * f * (r.verifier.failed / Math.max(1, r.verifier.sampled))).toLocaleString()} opens in a run this size.`, suggests: [] });
  }
  return out;
}
