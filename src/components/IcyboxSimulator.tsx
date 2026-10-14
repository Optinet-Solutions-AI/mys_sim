"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { IcyboxBox, IcyboxConfig, IcyboxResult } from "@/engine/types";
import { ICYBOX_BOXES, icyboxBox, icyboxMath } from "@/engine/labs/icybox";
import { ICYBOX_DEFAULT_BOX, icyboxConfigFor } from "@/lib/icyboxPresets";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { money, num, oneIn, pct } from "@/lib/format";
import { Badge, Button, Card, Field, NumberInput, Stat, Td, Th, Toggle } from "./ui";
import { VizStyle } from "./FeatureCharts";
import { IcyboxResults } from "./results/IcyboxResults";

const PRESETS = [10000, 50000, 200000, 500000, 1000000];

function Legend({ items }: { items: { label: string; slot: number; dash?: boolean }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: it.dash ? "transparent" : `var(--series-${it.slot})`, borderTop: it.dash ? `2px dashed var(--series-${it.slot})` : undefined }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

function ReturnCurve({ r }: { r: IcyboxResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = r.curve;
  const W = 760;
  const H = 260;
  const L = 46;
  const R = 12;
  const T = 10;
  const B = 28;
  const yMax = Math.max(r.expectedListed * 1.6, ...pts.slice(Math.floor(pts.length / 10)).map((p) => p.listed)) || 1;
  const x = (n: number) => L + (n / r.opens) * (W - L - R);
  const y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const path = (k: "listed" | "buyback") => pts.map((p, i) => `${i ? "L" : "M"}${x(p.n).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const h = hover != null ? pts[hover] : null;
  return (
    <div className="viz-root relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Return as opens accumulate"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const n = ((px - L) / (W - L - R)) * r.opens;
          let best = 0;
          for (let i = 0; i < pts.length; i++) if (Math.abs(pts[i].n - n) < Math.abs(pts[best].n - n)) best = i;
          setHover(best);
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(f * yMax)} y2={y(f * yMax)} stroke="var(--grid)" strokeWidth={1} />
            <text x={L - 6} y={y(f * yMax) + 4} textAnchor="end" fontSize={11} fill="var(--text-secondary)">
              {Math.round(f * yMax * 100)}%
            </text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(r.expectedListed)} y2={y(r.expectedListed)} stroke="var(--series-1)" strokeWidth={1.5} strokeDasharray="6 4" />
        <line x1={L} x2={W - R} y1={y(r.expectedBuyback)} y2={y(r.expectedBuyback)} stroke="var(--series-2)" strokeWidth={1.5} strokeDasharray="6 4" />
        <path d={path("listed")} fill="none" stroke="var(--series-1)" strokeWidth={2} />
        <path d={path("buyback")} fill="none" stroke="var(--series-2)" strokeWidth={2} />
        {h && (
          <g>
            <line x1={x(h.n)} x2={x(h.n)} y1={T} y2={H - B} stroke="var(--text-secondary)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(h.n)} cy={y(h.listed)} r={4} fill="var(--series-1)" />
            <circle cx={x(h.n)} cy={y(h.buyback)} r={4} fill="var(--series-2)" />
          </g>
        )}
        {[0, 0.5, 1].map((f) => (
          <text key={f} x={x(f * r.opens)} y={H - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize={11} fill="var(--text-secondary)">
            {num(Math.round(f * r.opens))} opens
          </text>
        ))}
      </svg>
      {h && (
        <div className="viz-tip" style={{ left: `${(x(h.n) / W) * 100}%`, top: 8 }}>
          after {num(h.n)} opens: {pct(h.listed)} at listed · {pct(h.buyback)} sold back
        </div>
      )}
      <Legend items={[{ label: "Return at listed values", slot: 1 }, { label: "Return if sold back", slot: 2 }, { label: "What the table says", slot: 1, dash: true }]} />
    </div>
  );
}

function BandBars({ r }: { r: IcyboxResult }) {
  const rows = [...r.byBand].reverse();
  const max = Math.max(...rows.map((b) => Math.max(b.expected, b.actual)), 1);
  return (
    <div className="viz-root space-y-1">
      {rows.map((b) => (
        <div key={b.id} className="grid grid-cols-[7rem_1fr_7rem] items-center gap-2 text-xs">
          <span>{b.label}</span>
          <span className="relative h-5 rounded bg-[var(--grid)]">
            <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${(b.expected / max) * 100}%`, background: "var(--series-3)", opacity: 0.45 }} />
            <span className="absolute inset-y-1 left-0 rounded" style={{ width: `${(b.actual / max) * 100}%`, background: "var(--series-1)" }} />
          </span>
          <span className="text-right font-mono">
            {num(b.actual)} / {num(Math.round(b.expected))}
          </span>
        </div>
      ))}
      <Legend items={[{ label: "Actual", slot: 1 }, { label: "Stated odds × opens", slot: 3 }]} />
    </div>
  );
}

export function IcyboxSimulator() {
  const [box, setBox] = useState<IcyboxBox>(ICYBOX_DEFAULT_BOX);
  const [opens, setOpens] = useState(200000);
  const [drop, setDrop] = useState(false);
  const [copies, setCopies] = useState(1000);
  const [retireAt, setRetireAt] = useState(0.7);
  const [lastCfg, setLastCfg] = useState<IcyboxConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(0);
  const [saved, setSaved] = useState(false);
  const sim = useRun();
  const r = sim.result && sim.result.kind === "icybox" ? (sim.result as IcyboxResult) : null;
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("box");
    if (q) setBox(icyboxBox(q));
  }, []);
  const cfg: IcyboxConfig = useMemo(() => ({ ...icyboxConfigFor(box), drop: { enabled: drop, copies, retireAt: drop ? retireAt : 0 }, run: { opens } }), [box, opens, drop, copies, retireAt]);
  const m = useMemo(() => icyboxMath(box, cfg.chances, cfg), [box, cfg]);
  const running = sim.status === "running";
  const start = async () => {
    setSaved(false);
    const snap = JSON.parse(JSON.stringify(cfg)) as IcyboxConfig;
    const runSeed = Math.floor(Math.random() * 1e9);
    setLastCfg(snap);
    setLastSeed(runSeed);
    try {
      await sim.run({ lab: "icybox", config: snap, sizes: { opens }, seed: runSeed });
    } catch {
      /* shown below */
    }
  };
  const name = `Simulator · IcyBox ${box.name}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <VizStyle />
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">IcyBox · mystery boxes (reconstructed)</div>
          <h1 className="text-2xl font-semibold">Simulator</h1>
        </div>
        <Link href="/operators/icybox" className="btn ml-auto no-underline">
          ← Back to IcyBox
        </Link>
      </header>

      <Card title="Run">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Box" hint="The five tiers. Bands and chances are reconstructed and fitted to an 85% return at listed values.">
            <div className="flex flex-wrap gap-1">
              {ICYBOX_BOXES.map((b) => (
                <button key={b.slug} type="button" className={`chip ${b.slug === box.slug ? "chip-accent" : ""}`} disabled={running} onClick={() => setBox(b)}>
                  {b.name} · {money(b.price)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Opens" hint="How many boxes to open. 200,000 takes a few seconds.">
            <div className="flex flex-wrap items-center gap-1">
              {PRESETS.map((p) => (
                <button key={p} type="button" className={`chip ${opens === p ? "chip-accent" : ""}`} disabled={running} onClick={() => setOpens(p)}>
                  {num(p)}
                </button>
              ))}
              <span className="w-32">
                <NumberInput value={opens} min={1000} step={10000} onChange={(v) => setOpens(Math.max(1000, Math.round(v)))} />
              </span>
            </div>
          </Field>
          <Field label="Limited drop" hint="Finite copies drawn without replacement; the operator may retire the drop before the grail goes out (the terms allow it).">
            <div className="space-y-2">
              <Toggle checked={drop} onChange={setDrop} label="Drop mode" hint={drop ? `${num(copies)} copies; retire at ${pct(retireAt, 0)} sold` : "Plain odds"} />
              {drop && (
                <div className="flex gap-2">
                  <span className="w-28">
                    <NumberInput value={copies} min={10} step={100} onChange={(v) => setCopies(Math.max(10, Math.round(v)))} />
                  </span>
                  <span className="w-24">
                    <NumberInput value={retireAt} min={0} max={1} step={0.05} onChange={(v) => setRetireAt(Math.min(1, Math.max(0, v)))} />
                  </span>
                </div>
              )}
            </div>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={start} disabled={running}>
            {running ? "Running…" : `Open ${num(opens)} boxes`}
          </Button>
          {running && (
            <>
              <span className="text-xs text-ink-3">{pct(sim.progress, 0)}</span>
              <Button kind="ghost" onClick={sim.cancel}>
                Cancel
              </Button>
            </>
          )}
          <span className="ml-auto flex flex-wrap gap-1 text-[11px]">
            <Badge>table: {pct(m.returnListed)} at listed</Badge>
            <Badge>{pct(m.returnBuyback)} if sold back</Badge>
            <Badge>grail {oneIn(m.pGrail)}</Badge>
          </span>
        </div>
        {running && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-line">
            <div className="h-full bg-accent" style={{ width: `${Math.round(sim.progress * 100)}%` }} />
          </div>
        )}
        {sim.error && <div className="mt-2 text-xs text-bad">{sim.error}</div>}
      </Card>

      {r && lastCfg && (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Opened" value={num(r.opens)} sub={`${money(r.spent)} paid`} />
            <Stat label="Longest run below the price" value={num(r.longestDry)} sub="opens in a row" />
            <Stat label="Items worth the price or more" value={oneIn(r.opens ? r.bigWins / r.opens : 0)} sub={`table says ${oneIn(r.pBig)}`} />
          </div>
          <Card title="Return as the opens pile up">
            <ReturnCurve r={r} />
          </Card>
          <Card title="Each band: actual against the stated odds">
            <BandBars r={r} />
          </Card>
          <IcyboxResults r={r} />
          {r.drop && (
            <Card title="The drop and the operator exit">
              <table className="w-full max-w-xl text-xs">
                <tbody>
                  {[
                    ["Copies per drop", num(r.drop.copies)],
                    ["Retire at", r.drop.retireAt > 0 ? pct(r.drop.retireAt, 0) + " sold" : "never"],
                    ["Drops started", num(r.drop.drops)],
                    ["Retired with copies unsold", num(r.drop.retired)],
                    ["Opens per drop", num(Math.round(r.drop.opensPerDrop))],
                    ["Grails that went out and were kept", num(r.drop.grailsShipped)],
                    ["Grails left behind in retired drops", num(r.drop.grailsLeftBehind)],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-line">
                      <Td>{k}</Td>
                      <Td right mono>{v}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-ink-3">The odds shown at the start of a drop are the copies in the drop. If the operator retires it early, the grail copies never ship, and nobody outside can tell whether the grail was still inside.</p>
            </Card>
          )}
          <Card title="Report">
            <div className="flex flex-wrap items-center gap-2">
              <Button kind="ghost" onClick={() => downloadText(`icybox-sim-${r.boxSlug}-${lastSeed}.md`, reportMarkdown(buildRun("icybox", name, lastCfg, { opens: r.opens }, lastSeed, r)), "text/markdown")}>
                Download the report (Markdown)
              </Button>
              <Button
                kind="ghost"
                onClick={async () => {
                  await persistRun("icybox", name, lastCfg, { opens: r.opens }, lastSeed, r);
                  setSaved(true);
                }}
              >
                {saved ? "Saved to run history" : "Save to run history"}
              </Button>
              <span className="text-xs text-ink-3">seed {lastSeed}</span>
            </div>
            <table className="mt-3 w-full max-w-2xl text-xs">
              <thead>
                <tr>
                  <Th>Measure</Th>
                  <Th right>This run</Th>
                  <Th right>The table says</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Return at listed values", pct(r.returnListed), pct(r.expectedListed)],
                  ["Return if everything is sold back", pct(r.returnBuyback), pct(r.expectedBuyback)],
                  ["Return really", pct(r.returnReal), pct(r.expectedReal)],
                  ["Grail", oneIn(r.opens ? r.grails / r.opens : 0), oneIn(r.pGrail)],
                  ["Worth the price or more", oneIn(r.opens ? r.bigWins / r.opens : 0), oneIn(r.pBig)],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-t border-line">
                    <Td>{k}</Td>
                    <Td right mono>{a}</Td>
                    <Td right mono>{b}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
