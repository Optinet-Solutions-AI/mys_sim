"use client";
import type { MistyResult } from "@/engine/types";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Card, Info, Stat, Td, Th } from "../ui";

export function MistyResults({ r }: { r: MistyResult }) {
  const pItemActual = r.opens > 0 ? r.items / r.opens : 0;
  const chiTone = r.chi.pValue < 0.01 ? "bad" : r.chi.pValue < 0.05 ? "warn" : "good";
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Return at face" value={pct(r.returnFace)} sub={`table says ${pct(r.expectedFace)} · Mistees counted at face, items at listed`} />
        <Stat label="Return in real money" value={pct(r.returnReal)} sub={`table says ${pct(r.expectedReal)} · Mistees at cost, items at resale`} tone={r.returnReal < 0.5 ? "bad" : "warn"} />
        <Stat label="Physical item" value={oneIn(pItemActual)} sub={`table says ${oneIn(r.pItem)} · ${num(r.items)} items in ${num(r.opens)} opens`} />
        <Stat label="Mistees per open" value={(r.opens > 0 ? r.mistees / r.opens : 0).toFixed(2)} sub={`table says ${r.expectedMistees.toFixed(2)} · ${num(r.freeSpins)} free spins`} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Players paid" value={money(r.spent)} sub={`${num(r.opens)} opens at ${money(r.price)}`} />
        <Stat label="Items shipped (listed)" value={money(r.itemValue)} sub={`about ${money(r.itemValueReal)} at resale`} />
        <Stat label="Mistees handed out" value={num(r.mistees)} sub="site credit, only good for more boxes" />
        <Stat label="Odds check" value={`p = ${r.chi.pValue.toFixed(3)}`} sub={r.chi.pValue < 0.05 ? "counts stray from the stated odds" : "counts match the stated odds"} tone={chiTone} />
      </div>

      <Card
        title={
          <span className="flex items-center gap-1">
            Each outcome: stated, expected, actual
            <Info>Expected counts use each player&apos;s own table weighted by how many opens they made, so a player with boosted odds shifts the expectation rather than breaking the check.</Info>
          </span>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Outcome</Th>
                <Th right>Stated odds</Th>
                <Th right>1 in</Th>
                <Th right>Expected</Th>
                <Th right>Actual</Th>
                <Th right>Cost per open</Th>
              </tr>
            </thead>
            <tbody>
              {r.byOutcome.map((o) => (
                <tr key={o.id} className="border-t border-line">
                  <Td>
                    <span className="flex items-center gap-2">
                      {o.label}
                      {o.kind === "item" ? <Badge tone="accent">item</Badge> : o.kind === "bonus" ? <Badge tone="warn">free spins</Badge> : <Badge>Mistees</Badge>}
                    </span>
                  </Td>
                  <Td right mono>{pctSmart(o.percent / 100)}</Td>
                  <Td right mono>{o.percent > 0 ? num(Math.round(100 / o.percent)) : "never"}</Td>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Player</Th>
                  <Th right>Opens</Th>
                  <Th right>Paid</Th>
                  <Th right>Items</Th>
                  <Th right>Item chance set</Th>
                  <Th right>Mistees</Th>
                  <Th right>Return at face</Th>
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
                    <Td right mono>{oneIn(p.itemChance)}</Td>
                    <Td right mono>{num(p.mistees)}</Td>
                    <Td right mono>{pct(p.returnFace)}</Td>
                    <Td right mono>{pct(p.expectedFace)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card title="Proofs">
        <p className="text-sm text-ink-2">
          {r.verifier.passed} of {r.verifier.sampled} sampled opens recomputed from the revealed seed, the client seed, the spin number and the frozen table.
          {r.verifier.failed > 0 && (
            <>
              {" "}
              {r.verifier.failed} failed:{" "}
              {Object.entries(r.verifier.reasons)
                .map(([k, v]) => `${k} (${v})`)
                .join(", ")}
              .
            </>
          )}
        </p>
      </Card>
    </div>
  );
}
