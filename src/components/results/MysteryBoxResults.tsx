"use client";
import type { MysteryBoxConfig, MysteryBoxResult } from "@/engine/types";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { money, num, pct, pctSmart, sci } from "@/lib/format";
import { detect } from "@/lib/detector";
import { Card, Stat, Th, Td, Badge, Help } from "../ui";
import { PairedBars, HistogramChart, RegionBars } from "../charts";
import { ItemTile } from "../ItemTile";

export function MysteryBoxResults({ cfg, r }: { cfg: MysteryBoxConfig; r: MysteryBoxResult }) {
  const layer = cfg.box.valueLayer;
  const gapSe = r.rtpSe > 0 ? (r.statedRtp[layer] - r.realizedRtp[layer]) / r.rtpSe : 0;
  const findings = detect(cfg, r);
  const rows = r.items.map((it) => {
    const c = CATALOG_BY_ID.get(it.itemId);
    return { label: c ? `${c.brand} ${c.name}` : it.itemId, a: it.stated, b: r.opens ? it.observed / r.opens : 0 };
  });
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`Realized RTP (${layer})`} value={pct(r.realizedRtp[layer])} sub={`± ${pct(r.rtpSe, 2)} se · stated ${pct(r.statedRtp[layer])}`} tone={gapSe > 3 ? "bad" : undefined} />
        <Stat label="Displayed RTP" value={pct(r.displayedRtp)} sub={`cash RTP ${pct(r.realizedRtp.realized)}`} tone={r.displayedRtp - r.realizedRtp.realized > 0.1 ? "warn" : undefined} />
        <Stat label="Odds test (chi-square p)" value={sci(r.chi.pValue)} sub={`statistic ${r.chi.statistic.toFixed(1)}, df ${r.chi.df}`} tone={r.chi.pValue < 0.001 ? "bad" : "good"} />
        <Stat label="Proofs verified" value={cfg.algo.scheme === "none" ? "n/a" : `${r.verifier.passed}/${r.verifier.sampled}`} sub={r.verifier.failed ? `${r.verifier.failed} failed` : "sampled from the run"} tone={cfg.algo.scheme === "none" ? "warn" : r.verifier.failed ? "bad" : "good"} />
        <Stat label="P(outcome ≥ price)" value={pct(r.pAtLeastPrice, 2)} />
        <Stat label="Opens" value={num(r.opens)} sub={`${(r.elapsedMs / 1000).toFixed(1)} s`} />
        <Stat label="Rotations · rerolls · grinds" value={`${num(r.rotations)} · ${num(r.rerolls)} · ${num(r.grinds)}`} sub="operator-side counters" />
        <Stat label="Float fallthroughs" value={num(r.fallthroughs)} sub="rolls that fell off a rounded table" />
        {r.drops !== undefined && <Stat label="Drops completed · retired" value={`${num(r.drops)} · ${num(r.retirements ?? 0)}`} sub={r.retirementAwards?.length ? `${r.retirementAwards.length} top items awarded at retirement` : r.lastOneAwards ? `${r.lastOneAwards} Last One prizes` : "finite pool"} tone={r.retirements && !r.retirementAwards?.length ? "bad" : undefined} />}
        {r.pityApplied !== undefined && <Stat label="Pity applied" value={num(r.pityApplied)} sub="opens drawn from the pity subset" />}
        {r.secretDraws !== undefined && <Stat label="Secret draws" value={num(r.secretDraws)} sub="items not on the stated table" tone="bad" />}
        {r.ledgerRoot && <Stat label={r.publicLog ? "Public ledger root" : "Ledger root (private)"} value={<span className="font-mono text-sm">{r.ledgerRoot.slice(0, 16)}…</span>} sub="Merkle root over the sampled records" tone={r.publicLog ? "good" : undefined} />}
      </div>
      {r.stoppedEarly && <div className="rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{r.stoppedEarly}.</div>}

      <Card title="Detector: what an outsider could conclude">
        <ul className="space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="flex gap-3 rounded-lg border border-line bg-paper px-3 py-2">
              <Badge tone={f.status === "flag" ? "bad" : f.status === "clear" ? "good" : "neutral"}>{f.status === "flag" ? "flag" : f.status === "clear" ? "clear" : "info"}</Badge>
              <div className="min-w-0 text-sm">
                <div className="font-medium">{f.title}</div>
                <div className="text-xs text-ink-2">{f.detail}</div>
                {f.suggests.length > 0 && <div className="mt-1 text-[11px] text-ink-3">Consistent with: {f.suggests.join(", ")}</div>}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Stated vs observed odds">
          <PairedBars rows={rows} />
          <Help>Outline bar: stated. Solid bar: observed. Hover a row for exact values.</Help>
        </Card>
        <Card title="Payout distribution (value layer)">
          <HistogramChart h={r.payoutHistogram} logX />
          <Help>Log scale: each step is ten times the last.</Help>
        </Card>
      </div>

      <Card title="Ticket-region uniformity (bias map)">
        <RegionBars counts={r.ticketRegions.counts} expected={r.opens / r.ticketRegions.bins} />
        <Help>Each bar is a slice of the ticket space. A biased mapping shows as a band of regions outside the expected range; the 32-bit modulo mapping makes the last 5% of tickets rarer.</Help>
      </Card>

      <Card title="Items">
        <div className="overflow-x-auto">
          <div className="tbl"><table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th right>Stated</Th>
                <Th right>Observed</Th>
                <Th right>Expected</Th>
                <Th right>Deviation</Th>
                <Th right>Pays</Th>
                <Th right>Shown as</Th>
              </tr>
            </thead>
            <tbody>
              {r.items.map((it) => {
                const c = CATALOG_BY_ID.get(it.itemId);
                const dev = it.expected > 0 ? (it.observed - it.expected) / Math.sqrt(it.expected) : 0;
                return (
                  <tr key={it.itemId}>
                    <Td>
                      <span className="flex items-center gap-2">
                        {c && <ItemTile item={c} size={22} />}
                        <span>{c ? `${c.brand} ${c.name}` : it.itemId}</span>
                      </span>
                    </Td>
                    <Td right mono>{pctSmart(it.stated)}</Td>
                    <Td right mono>{num(it.observed)}</Td>
                    <Td right mono>{it.expected.toFixed(1)}</Td>
                    <Td right mono>
                      <span className={Math.abs(dev) > 3 ? "text-bad" : ""}>{dev.toFixed(1)} sd</span>
                    </Td>
                    <Td right mono>{money(it.payoutValue)}</Td>
                    <Td right mono>{money(it.displayValue)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        </div>
      </Card>

      {Object.keys(r.byTag).length > 1 && (
        <Card title="By account tag">
          <div className="tbl"><table className="text-xs">
            <thead>
              <tr>
                <Th>Tag</Th>
                <Th right>Opens</Th>
                <Th right>Realized RTP</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(r.byTag).map(([k, v]) => (
                <tr key={k}>
                  <Td>{k}</Td>
                  <Td right mono>{num(v.opens)}</Td>
                  <Td right mono>{pct(v.rtp)}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      )}

      <Card title="Sample of opens (first 60) with proof fields">
        <div className="overflow-x-auto">
          <div className="tbl"><table className="w-full text-[11px]">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Tag</Th>
                <Th>Item</Th>
                <Th right>Payout</Th>
                <Th right>Ticket</Th>
                <Th>Server hash</Th>
                <Th>Client seed</Th>
                <Th right>Nonce</Th>
                <Th>Verified</Th>
              </tr>
            </thead>
            <tbody>
              {r.sample.map((s) => (
                <tr key={s.idx}>
                  <Td mono>{s.idx + 1}</Td>
                  <Td>{s.tag}</Td>
                  <Td>{CATALOG_BY_ID.get(s.itemId)?.name ?? s.itemId}</Td>
                  <Td right mono>{money(s.payout)}</Td>
                  <Td right mono>{num(s.ticket)}</Td>
                  <Td mono>{s.serverHash ? s.serverHash.slice(0, 12) + "…" : "—"}</Td>
                  <Td mono>{s.clientSeed.slice(0, 10)}…</Td>
                  <Td right mono>{s.nonce}</Td>
                  <Td>{s.verified === undefined ? "—" : s.verified ? <Badge tone="good">ok</Badge> : <Badge tone="bad">{s.verifyReason}</Badge>}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      </Card>
    </div>
  );
}
