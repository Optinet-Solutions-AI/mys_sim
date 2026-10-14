"use client";
import type { JemlitResult } from "@/engine/types";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Card, Stat, Td, Th } from "../ui";

export function JemlitResults({ r }: { r: JemlitResult }) {
  const chiTone = r.chi.pValue < 0.01 ? "bad" : r.chi.pValue < 0.05 ? "warn" : "good";
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="RTP at listed prices" value={pct(r.returnPrice)} sub={`table says ${pct(r.expectedPrice)}`} />
        <Stat label="RTP in Credits (cashback)" value={pct(r.expectedCashback)} sub="what the table pays if everything is exchanged" />
        <Stat label="RTP really" value={pct(r.returnReal)} sub={`table says ${pct(r.expectedReal)}`} tone="warn" />
        <Stat label="Item worth the price or more" value={oneIn(r.opens ? r.bigWins / r.opens : 0)} sub={`table says ${oneIn(r.pBig)} · ${num(r.bigWins)} wins`} />
        <Stat label="Players paid" value={money(r.spent)} sub={`${num(r.opens)} × ${money(r.price)}`} />
        <Stat label="Shippable items won" value={num(r.items)} sub={`${money(r.itemValue)} listed · ${money(r.itemValueReal)} at resale`} />
        <Stat label="Credit-only opens" value={num(r.creditOpens)} sub={`${pct(r.opens ? r.creditOpens / r.opens : 0)} of opens · ${money(r.credits)} in Credits`} />
        <Stat label="Odds check" value={`p = ${r.chi.pValue.toFixed(3)}`} sub={r.chi.pValue < 0.05 ? "counts stray from the stated odds" : "counts match the stated odds"} tone={chiTone} />
      </div>
      <Card title="Each item: stated, expected, actual">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-xs">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th right>Price</Th>
                <Th right>Cashback</Th>
                <Th right>Stated odds</Th>
                <Th right>Expected</Th>
                <Th right>Actual</Th>
                <Th right>Cost per open</Th>
              </tr>
            </thead>
            <tbody>
              {[...r.byItem].sort((a, b) => b.chance - a.chance).map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <Td>
                    <span className="flex items-center gap-2">
                      {o.label}
                      {o.credit && <Badge>credit</Badge>}
                    </span>
                  </Td>
                  <Td right mono>{money(o.price)}</Td>
                  <Td right mono>{money(o.cashback)}</Td>
                  <Td right mono>{pctSmart(o.chance)}</Td>
                  <Td right mono>{o.expected.toFixed(1)}</Td>
                  <Td right mono>{num(o.actual)}</Td>
                  <Td right mono>{money(o.costPerOpen, 2)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {r.perPlayer.length > 1 && (
        <Card title="Per player">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Player</Th>
                <Th right>Opens</Th>
                <Th right>Paid</Th>
                <Th right>Items</Th>
                <Th right>Credits</Th>
                <Th right>RTP at listed</Th>
                <Th right>Their table says</Th>
              </tr>
            </thead>
            <tbody>
              {r.perPlayer.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <Td>{p.name}</Td>
                  <Td right mono>{num(p.opens)}</Td>
                  <Td right mono>{money(p.spent)}</Td>
                  <Td right mono>{num(p.items)}</Td>
                  <Td right mono>{money(p.credits)}</Td>
                  <Td right mono>{pct(p.returnPrice)}</Td>
                  <Td right mono>{pct(p.expectedPrice)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Card title="Proofs">
        <p className="text-sm text-ink-2">
          {r.verifier.passed} of {r.verifier.sampled} sampled opens recomputed from the server seed, the client seed, the nonce and the table.
          {r.verifier.failed > 0 && <> {r.verifier.failed} failed: {Object.entries(r.verifier.reasons).map(([k, v]) => `${k} (${v})`).join(", ")}.</>}
        </p>
      </Card>
    </div>
  );
}
