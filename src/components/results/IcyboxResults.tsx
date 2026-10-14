"use client";
import type { IcyboxResult } from "@/engine/types";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Card, Stat, Td, Th } from "../ui";

export function IcyboxResults({ r }: { r: IcyboxResult }) {
  const chiTone = r.drop ? "neutral" : r.chi.pValue < 0.01 ? "bad" : r.chi.pValue < 0.05 ? "warn" : "good";
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="RTP at listed values" value={pct(r.returnListed)} sub={`table says ${pct(r.expectedListed)}`} />
        <Stat label="RTP if everything is sold back" value={pct(r.returnBuyback)} sub={`table says ${pct(r.expectedBuyback)}`} />
        <Stat label="RTP really" value={pct(r.returnReal)} sub={`kept at resale minus fees, the rest sold back · table ${pct(r.expectedReal)}`} tone="warn" />
        <Stat label="Grail" value={oneIn(r.opens ? r.grails / r.opens : 0)} sub={`table says ${oneIn(r.pGrail)} · ${num(r.grails)} grails`} />
        <Stat label="Players paid" value={money(r.spent)} sub={`${num(r.opens)} × ${money(r.price)}`} />
        <Stat label="Sold back" value={num(r.soldBack)} sub={`${money(r.buybackPaid)} paid out · ${num(r.autoSold)} by expiry`} />
        <Stat label="Kept and shipped" value={num(r.itemsKept)} sub={`${money(r.keptValue)} listed · ${money(r.keptReal)} at resale · fees ${money(r.feesPaid)}`} />
        <Stat label={r.drop ? "Drops" : "Odds check"} value={r.drop ? num(r.drop.drops) : `p = ${r.chi.pValue.toFixed(3)}`} sub={r.drop ? `${num(r.drop.retired)} retired early · ${num(r.drop.grailsLeftBehind)} grails never shipped · ${num(r.drop.grailsShipped)} grails kept` : r.chi.pValue < 0.05 ? "counts stray from the stated odds" : "counts match the stated odds"} tone={chiTone as "good" | "warn" | "bad" | undefined} />
      </div>
      <Card title="Each band: stated, expected, actual">
        <div className="tbl"><table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Band</Th>
              <Th right>Stated odds</Th>
              <Th right>Expected</Th>
              <Th right>Actual</Th>
              <Th right>Average value</Th>
              <Th right>Cost per open</Th>
            </tr>
          </thead>
          <tbody>
            {[...r.byBand].reverse().map((b) => (
              <tr key={b.id} className="border-t border-line">
                <Td>{b.label}</Td>
                <Td right mono>{pctSmart(b.chance)}</Td>
                <Td right mono>{b.expected.toFixed(1)}</Td>
                <Td right mono>{num(b.actual)}</Td>
                <Td right mono>{money(b.meanValue)}</Td>
                <Td right mono>{money(b.costPerOpen, 2)}</Td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
      <Card title="Proofs">
        <p className="text-sm text-ink-2">None. IcyBox publishes no secret, hash or seed, so no open can be recomputed. {num(r.opens)} opens, 0 checkable.</p>
      </Card>
    </div>
  );
}
