"use client";
import type { CreditsResult, UpgraderResult } from "@/engine/types";
import { money, num, pct } from "@/lib/format";
import { Card, Info, Stat } from "../ui";

export function CreditsResults({ r }: { r: CreditsResult }) {
  const gap = r.nominalRtp - r.endToEndRtp;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Nominal RTP (credits at face)" value={pct(r.nominalRtp)} sub="what the box page implies" tone={r.nominalRtp > 1 ? "warn" : undefined} />
        <Stat label="End-to-end RTP" value={pct(r.endToEndRtp)} sub="physical at realized + draw prizes to paid players" tone={gap > 0.3 ? "bad" : undefined} />
        <Stat label="Real value of one credit" value={money(r.prizePerTicket)} sub={`face ${money(r.creditFaceValue)}`} />
        <Stat label="Operator hold" value={pct(r.hold)} sub={`spent ${money(r.spent)}`} />
        <Stat label="Opens" value={num(r.opens)} sub={`${num(r.agents)} agents${r.capBlockedOpens ? ` · ${num(r.capBlockedOpens)} blocked by the cap` : ""}`} />
        <Stat label="Credits issued" value={num(r.creditsIssued)} sub={`${num(r.ticketsFree)} free tickets added`} />
        <Stat label="Draws · prizes" value={`${num(r.raffles)} · ${money(r.prizesPaidTotal)}`} sub={`to paid ${money(r.prizesToPaid)} · to free ${money(r.prizesToFree)}`} />
        <Stat label="Unsold share at draw" value={pct(r.unsoldShareAtDraw)} sub="tickets left in the pool when drawn" />
      </div>
      <Card
        title={
          <>
            Where the edge hides
            <Info>The published numbers are all true: the box pays credits worth their face as entries. The trick is the valuation: a credit is a ticket whose expected value is the prize divided by the pool, which depends on sell-through. The gap between the two RTPs is the credits layer.</Info>
          </>
        }
      >
        <div className="grid gap-2 text-sm md:grid-cols-3">
          <div className="rounded-lg border border-line bg-paper p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">Stage 1 · the box</div>
            <div>
              Physical items: {money(r.physicalPaidRealized)} at realized ({money(r.physicalPaidDisplay)} as displayed)
            </div>
            <div>Credits: {num(r.creditsIssued)} worth {money(r.creditsIssued * r.creditFaceValue)} at face</div>
          </div>
          <div className="rounded-lg border border-line bg-paper p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">Stage 2 · the draw</div>
            <div>
              {num(r.ticketsPaid)} paid tickets and {num(r.ticketsFree)} free ones across {num(r.raffles)} draws
            </div>
            <div>Prizes {money(r.prizesPaidTotal)}, of which {money(r.prizesToFree)} went to free entrants</div>
          </div>
          <div className="rounded-lg border border-line bg-paper p-3">
            <div className="text-[11px] uppercase tracking-wide text-ink-3">The gap</div>
            <div className="text-xl font-semibold tabular-nums">{pct(gap)}</div>
            <div className="text-xs text-ink-3">nominal minus end-to-end return</div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function UpgraderResults({ r }: { r: UpgraderResult }) {
  const chanceGap = r.statedChance - r.winRate;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Win rate" value={pct(r.winRate, 2)} sub={`stated ${pct(r.statedChance, 2)}`} tone={chanceGap > 0.1 * r.statedChance ? "bad" : "good"} />
        <Stat label="Realized edge" value={pct(r.realizedEdge)} sub={`stated ${pct(r.statedEdge)}`} tone={r.realizedEdge > r.statedEdge + 0.05 ? "bad" : undefined} />
        <Stat label="Ruined" value={pct(r.ruinFraction)} sub={r.medianAttemptsToRuin !== null ? `median ${r.medianAttemptsToRuin} attempts` : "none"} tone={r.ruinFraction > 0.5 ? "bad" : undefined} />
        <Stat label="Reached the target" value={num(r.reachedTarget)} sub={`of ${num(r.agents)} agents`} />
        <Stat label="Attempts" value={num(r.attempts)} sub={`${money(r.pricePerAttempt)} each for a ${money(r.targetValue)} item`} />
        <Stat label="Wagered · paid" value={`${money(r.wagered)} · ${money(r.paid)}`} />
        <Stat label="Proofs verified" value={`${r.verifier.passed}/${r.verifier.sampled}`} tone={r.verifier.failed ? "bad" : "good"} />
        <Stat label="Mode" value={r.mode === "upgrader" ? "Upgrader" : "Deals"} sub={r.mode === "upgrader" ? "stake for a chance at the item" : "choose the chance, pay the price"} />
      </div>
    </div>
  );
}
