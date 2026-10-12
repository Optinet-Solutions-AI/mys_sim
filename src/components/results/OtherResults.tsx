"use client";
import type { BattlesResult, RetentionResult, SellbackResult } from "@/engine/types";
import { money, num, pct } from "@/lib/format";
import { Card, Stat, Help } from "../ui";
import { HistogramChart, Lines } from "../charts";

export function SellbackResults({ r }: { r: SellbackResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hold of deposits" value={pct(r.hold)} sub="deposits minus money that left" />
        <Stat label="Sell-back rate" value={pct(r.sellbackRate)} sub={`ship rate ${pct(r.shipRate, 2)}`} />
        <Stat label="Ruined agents" value={pct(r.ruinFraction)} sub={r.medianSessionsToRuin !== null ? `median ${r.medianSessionsToRuin + 1} sessions` : "none"} tone={r.ruinFraction > 0.5 ? "bad" : undefined} />
        <Stat label="GGR" value={money(r.ggr)} sub={`wagered ${money(r.wagered)}`} />
        <Stat label="Deposits" value={money(r.deposits)} sub={`${num(r.agents)} agents`} />
        <Stat label="Credited on sell-back" value={money(r.creditedValue)} />
        <Stat label="Left the system" value={money(r.moneyLeftSystem)} sub={`cash ${money(r.withdrawnCash)} · goods ${money(r.shippedValue)}`} />
        <Stat label="Extra wager forced by withdraw-through-items" value={money(r.extraWagerForWithdrawal)} tone={r.extraWagerForWithdrawal > 0 ? "warn" : undefined} />
        {r.autoActions !== undefined && <Stat label="Decisions missed (auto action)" value={num(r.autoActions)} sub="items sold or shipped by the window rule" tone={r.autoActions > 0 ? "warn" : undefined} />}
        {r.keepFeesPaid !== undefined && <Stat label="Keep fees paid by players" value={money(r.keepFeesPaid)} sub="tax, shipping, insurance" />}
        {r.expiredCredit !== undefined && <Stat label="Credit expired (breakage)" value={money(r.expiredCredit)} tone={r.expiredCredit > 0 ? "warn" : undefined} />}
        {r.floorTopUps !== undefined && <Stat label="Guarantee floor top-ups" value={money(r.floorTopUps)} sub="paid above the buyback rule" />}
        {r.vaultLocked !== undefined && <Stat label="Locked in the vault" value={money(r.vaultLocked)} sub="out of play until cash-out" />}
        {r.creatorPaid !== undefined && <Stat label="Paid to box creators" value={money(r.creatorPaid)} />}
      </div>
      <Card title="Bankroll over sessions (10th, 50th, 90th percentile of agents)">
        <Lines
          series={[
            { name: "p90", points: r.bankrollCurve.map((p) => p.p90) },
            { name: "median", points: r.bankrollCurve.map((p) => p.p50) },
            { name: "p10", points: r.bankrollCurve.map((p) => p.p10), dashed: true },
          ]}
          xLabel="session"
        />
        <Help>Balances after each session. In the vendor economy items are credited back and re-bet, so balances drift to zero and deposits repeat until the budget runs out.</Help>
      </Card>
      <Card title="Final balance percentiles">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="p10" value={money(r.balancePercentiles.p10)} />
          <Stat label="median" value={money(r.balancePercentiles.p50)} />
          <Stat label="p90" value={money(r.balancePercentiles.p90)} />
        </div>
      </Card>
    </div>
  );
}

export function BattlesResults({ r }: { r: BattlesResult }) {
  const gap = r.humanWinRate - r.expectedHumanWinRate;
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Wager multiplier" value={`${r.wagerMultiplier.toFixed(1)}×`} sub={`${money(r.entryPerPlayer)} per player vs ${money(r.avgSingleOpenPrice)} single open`} />
        <Stat label="Realized house edge" value={pct(r.realizedEdge)} sub={`paid ${money(r.totalPaid)} of ${money(r.totalWagered)}`} />
        <Stat label="Human win rate" value={pct(r.humanWinRate)} sub={`expected ${pct(r.expectedHumanWinRate)} with equal odds`} tone={gap < -0.03 ? "bad" : gap > 0.03 ? "good" : undefined} />
        <Stat label="Battles" value={num(r.battles)} sub={`mode ${r.mode} · ${r.ties} ties`} />
      </div>
      <Card title="Pot as a multiple of total entry">
        <HistogramChart h={r.payoutMultipleHistogram} />
        <Help>Below 1.0 the players as a group lost to the house on that battle; the largest pot was {r.topPotMultiple.toFixed(1)}× one entry.</Help>
      </Card>
    </div>
  );
}

export function RetentionResults({ r }: { r: RetentionResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Retention D1 / D7 / D30" value={`${pct(r.retention.d1, 0)} / ${pct(r.retention.d7, 0)} / ${pct(r.retention.d30, 0)}`} sub={`control ${pct(r.controlRetention.d1, 0)} / ${pct(r.controlRetention.d7, 0)} / ${pct(r.controlRetention.d30, 0)}`} />
        <Stat label="Bonus cost" value={money(r.bonusCost)} sub={`${r.incrementalWagerPerBonusDollar.toFixed(2)} extra wager per bonus $`} />
        <Stat label="Hold after bonuses" value={pct(r.holdAfterBonuses)} sub={`LTV ${money(r.ltv)} per agent`} tone={r.holdAfterBonuses < 0 ? "bad" : undefined} />
        <Stat label="NGR" value={money(r.ngr)} sub={`GGR ${money(r.ggr)} · deposits ${money(r.deposits)}`} />
        {r.missionCost !== undefined && <Stat label="Missions paid" value={money(r.missionCost)} sub="rewards for daily wager targets" />}
        {r.freeEntryCost !== undefined && <Stat label="Free-route cost" value={money(r.freeEntryCost)} sub="items given to free entrants at equal odds" />}
        {r.capBlockedDeposits !== undefined && <Stat label="Deposits blocked by the spend cap" value={money(r.capBlockedDeposits)} tone="good" />}
      </div>
      <Card title="Daily active agents">
        <Lines series={[{ name: "active agents", points: r.dau }]} xLabel={`day (of ${r.days})`} />
        <Help>Top-10% wager concentration: {pct(r.raceWagerConcentrationTop10)}. Visitor behaviour is a labelled assumption; see Docs.</Help>
      </Card>
    </div>
  );
}
