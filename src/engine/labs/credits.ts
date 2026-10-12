// Misty's two-stage economy: the box pays credits, credits are tickets in a draw with a fixed pool.
import type { CatalogItem, CreditsConfig, CreditsResult, Progress } from "../types";
import { Opener, verifyRecord } from "../opener";
import { sfc32 } from "../rng";
import { priceOf } from "../table";

export function runCredits(cfg: CreditsConfig, seed: number, catalog: Map<string, CatalogItem>, onProgress?: Progress): CreditsResult {
  const t0 = Date.now();
  const rng = sfc32(seed);
  const opener = new Opener(cfg.box, cfg.algo, cfg.rigs, catalog, rng);
  const R = cfg.raffle;
  const A = Math.max(1, Math.floor(cfg.population.agents));
  const K = Math.max(1, Math.floor(cfg.population.opensPerAgent));
  const price = cfg.box.price;
  const prize = catalog.get(R.prizeItemId);
  const prizeValue = prize ? prize.realized : 0;
  const face = Math.max(0.01, R.ticketFace);
  const verifyN = 200;
  const verifier = { sampled: 0, passed: 0, failed: 0, reasons: {} as Record<string, number> };

  let spent = 0, opens = 0, physicalDisplay = 0, physicalRealized = 0, creditsIssued = 0;
  let ticketsPaid = 0, ticketsFree = 0, raffles = 0, prizesTotal = 0, prizesToPaid = 0, prizesToFree = 0, capBlocked = 0;
  let unsoldShareSum = 0;
  // the current raffle
  let rPaid = 0, rFree = 0, freeCarry = 0, paidOpensSinceDraw = 0;
  const agentSpent = new Float64Array(A);
  const total = A * K;
  const step = Math.max(1, Math.floor(total / 100));
  let idx = 0;

  const draw = () => {
    const sold = rPaid + rFree;
    unsoldShareSum += Math.max(0, 1 - sold / R.ticketPool);
    raffles++;
    if (sold > 0 && prizeValue > 0) {
      // winner redrawn among sold tickets when an unsold number comes up (the usual competition rule)
      prizesTotal += prizeValue;
      if (rng.next() * sold < rPaid) prizesToPaid += prizeValue;
      else prizesToFree += prizeValue;
    }
    rPaid = 0;
    rFree = 0;
    paidOpensSinceDraw = 0;
  };

  for (let k = 0; k < K; k++) {
    for (let a = 0; a < A; a++) {
      if (R.monthlyCap > 0 && agentSpent[a] + price > R.monthlyCap) {
        capBlocked++;
        continue;
      }
      agentSpent[a] += price;
      spent += price;
      opens++;
      paidOpensSinceDraw++;
      const rec = opener.open(idx++, "player", (k * A + a) / total);
      const item = catalog.get(rec.itemId)!;
      if (item.category === "credit") {
        const credits = Math.max(0, Math.round(item.retail / face));
        creditsIssued += credits;
        ticketsPaid += credits;
        rPaid += credits;
        freeCarry += credits * R.freeEntryShare;
        const f = Math.floor(freeCarry);
        if (f > 0) {
          freeCarry -= f;
          ticketsFree += f;
          rFree += f;
        }
      } else {
        physicalDisplay += priceOf(item, cfg.box.displayLayer);
        physicalRealized += item.realized;
      }
      if (verifier.sampled < verifyN) {
        const v = verifyRecord(rec, cfg.box, cfg.algo, catalog);
        verifier.sampled++;
        if (v.ok) verifier.passed++;
        else {
          verifier.failed++;
          verifier.reasons[v.reason] = (verifier.reasons[v.reason] ?? 0) + 1;
        }
      }
      if (R.drawRule === "when-sold-out" ? rPaid + rFree >= R.ticketPool : paidOpensSinceDraw >= Math.max(1, R.scheduleEvery)) draw();
      if (onProgress && idx % step === 0) onProgress(idx, total);
    }
  }
  if (R.drawRule === "on-schedule" && paidOpensSinceDraw > 0) draw();

  const allTickets = ticketsPaid + ticketsFree;
  return {
    kind: "credits",
    agents: A,
    opens,
    spent,
    physicalPaidDisplay: physicalDisplay,
    physicalPaidRealized: physicalRealized,
    creditsIssued,
    creditFaceValue: face,
    ticketsPaid,
    ticketsFree,
    raffles,
    prizesPaidTotal: prizesTotal,
    prizesToPaid,
    prizesToFree,
    prizePerTicket: allTickets ? prizesTotal / allTickets : 0,
    nominalRtp: spent ? (physicalDisplay + creditsIssued * face) / spent : 0,
    endToEndRtp: spent ? (physicalRealized + prizesToPaid) / spent : 0,
    hold: spent ? 1 - (physicalRealized + prizesTotal) / spent : 0,
    unsoldShareAtDraw: raffles ? unsoldShareSum / raffles : 0,
    capBlockedOpens: capBlocked,
    verifier,
    elapsedMs: Date.now() - t0,
  };
}
