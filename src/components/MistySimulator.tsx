"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MistyConfig, MistyResult } from "@/engine/types";
import { MISTY_BOXES, mistyBox, mistyMath } from "@/engine/labs/misty";
import { mistyConfigFor } from "@/lib/mistyPresets";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Field, NumberInput, Select, Stat, Td, Th, Toggle } from "./ui";
import { VizStyle } from "./FeatureCharts";

const PRESETS = [10000, 50000, 200000, 500000, 1000000];
const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="viz-tip" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}
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

/** Chart 1: the running return as opens accumulate, against what the table says. */
function ReturnCurve({ r }: { r: MistyResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = r.curve ?? [];
  const W = 760;
  const H = 260;
  const L = 46;
  const R = 12;
  const T = 10;
  const B = 28;
  const yMax = Math.max(r.expectedFace * 1.6, ...pts.slice(Math.floor(pts.length / 10)).map((p) => p.face)) || 1;
  const x = (n: number) => L + (n / r.opens) * (W - L - R);
  const y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const path = (k: "face" | "real") => pts.map((p, i) => `${i ? "L" : "M"}${x(p.n).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax);
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
          const b = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - b.left) / b.width) * W;
          const n = ((px - L) / (W - L - R)) * r.opens;
          let best = 0;
          for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].n - n) < Math.abs(pts[best].n - n)) best = i;
          setHover(pts.length ? best : null);
        }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--text-secondary)">
              {pct(t, 0)}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} x={x(f * r.opens)} y={H - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize={10} fill="var(--text-secondary)">
            {num(Math.round(f * r.opens))}
          </text>
        ))}
        <line x1={L} x2={W - R} y1={y(r.expectedFace)} y2={y(r.expectedFace)} stroke="var(--series-1)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        <line x1={L} x2={W - R} y1={y(r.expectedReal)} y2={y(r.expectedReal)} stroke="var(--series-2)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        <path d={path("face")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path("real")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
        {h && (
          <g>
            <line x1={x(h.n)} x2={x(h.n)} y1={T} y2={H - B} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
            <circle cx={x(h.n)} cy={y(h.face)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
            <circle cx={x(h.n)} cy={y(h.real)} r={4} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && (
        <Tip x={Math.min(70, 100) + (x(h.n) / W) * 60 + 0} y={8}>
          <b>After {num(h.n)} opens</b>
          <br />
          on screen {pct(h.face)} · really {pct(h.real)}
        </Tip>
      )}
      <Legend
        items={[
          { label: "Return on screen (running)", slot: 1 },
          { label: "Return really (running)", slot: 2 },
          { label: `Table says ${pct(r.expectedFace)}`, slot: 1, dash: true },
          { label: `Table says ${pct(r.expectedReal)}`, slot: 2, dash: true },
        ]}
      />
    </div>
  );
}

/** Chart 2: where each dollar paid went, on screen and really. */
function MoneySplit({ r, cfg }: { r: MistyResult; cfg: MistyConfig }) {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = [
    { name: "On screen", items: r.itemValue, credit: r.mistees * cfg.misteeFace },
    { name: "Really", items: r.itemValueReal, credit: r.mistees * cfg.misteeReal },
  ].map((x) => ({ ...x, kept: Math.max(0, r.spent - x.items - x.credit) }));
  const W = 760;
  const L = 80;
  const BAR = 22;
  const parts: { key: "items" | "credit" | "kept"; label: string; slot: number }[] = [
    { key: "items", label: "Pieces", slot: 1 },
    { key: "credit", label: "Mistees", slot: 2 },
    { key: "kept", label: "Kept by the operator", slot: 3 },
  ];
  return (
    <div className="viz-root relative" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${rows.length * (BAR + 14) + 4}`} className="w-full" role="img" aria-label="Where the money paid went">
        {rows.map((row, i) => {
          const yy = i * (BAR + 14);
          let acc = 0;
          return (
            <g key={row.name}>
              <text x={L - 8} y={yy + BAR - 6} textAnchor="end" fontSize={12} fill="var(--text-primary)">
                {row.name}
              </text>
              {parts.map((p, pi) => {
                const v = row[p.key];
                const w = (v / r.spent) * (W - L - 8);
                const x0 = L + (acc / r.spent) * (W - L - 8);
                acc += v;
                const last = pi === parts.length - 1;
                return (
                  <g
                    key={p.key}
                    onMouseMove={(e) => {
                      const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      setTip({ x: e.clientX - b.left + 12, y: e.clientY - b.top + 12, node: <><b>{row.name} · {p.label}</b><br />{money(v)} = {pct(v / r.spent)} of {money(r.spent)} paid</> });
                    }}
                  >
                    <rect x={x0} y={yy} width={Math.max(0, w - (last ? 0 : 2))} height={BAR} rx={last ? 4 : 0} fill={`var(--series-${p.slot})`} />
                    {w > 54 && (
                      <text x={x0 + 6} y={yy + BAR - 7} fontSize={11} fill="#fff">
                        {pct(v / r.spent)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {tip && <Tip x={tip.x} y={tip.y}>{tip.node}</Tip>}
      <Legend items={parts.map((p) => ({ label: p.label, slot: p.slot }))} />
    </div>
  );
}

/** Chart 3: per outcome, how far the actual count strayed from the expected count. */
function Deviation({ r }: { r: MistyResult }) {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = [...r.byOutcome].sort((a, b) => b.percent - a.percent).map((o) => ({ o, dev: o.expected > 0 ? (o.actual - o.expected) / o.expected : 0 }));
  const max = Math.max(0.05, ...rows.map((x) => Math.abs(x.dev)));
  const W = 760;
  const L = 250;
  const BAR = 14;
  const mid = L + (W - L - 60) / 2;
  const half = (W - L - 60) / 2;
  return (
    <div className="viz-root relative" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${rows.length * (BAR + 8) + 6}`} className="w-full" role="img" aria-label="Actual against expected count per outcome">
        <line x1={mid} x2={mid} y1={0} y2={rows.length * (BAR + 8)} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
        {rows.map(({ o, dev }, i) => {
          const yy = i * (BAR + 8);
          const w = (Math.abs(dev) / max) * half;
          return (
            <g
              key={o.id}
              onMouseMove={(e) => {
                const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - b.left + 12, y: e.clientY - b.top + 12, node: <><b>{o.label}</b><br />stated {fmtPct(o.percent)} · expected {o.expected.toFixed(1)} · actual {num(o.actual)} ({dev >= 0 ? "+" : ""}{(dev * 100).toFixed(1)}%)</> });
              }}
            >
              <rect x={0} y={yy} width={W} height={BAR + 8} fill="transparent" />
              <text x={L - 8} y={yy + BAR - 3} textAnchor="end" fontSize={11} fill="var(--text-primary)">
                {o.label.length > 38 ? o.label.slice(0, 37) + "…" : o.label}
              </text>
              <rect x={dev >= 0 ? mid : mid - w} y={yy} width={Math.max(1, w)} height={BAR} rx={3} fill={dev >= 0 ? "var(--series-1)" : "var(--series-2)"} />
              <text x={dev >= 0 ? mid + w + 5 : mid - w - 5} y={yy + BAR - 3} textAnchor={dev >= 0 ? "start" : "end"} fontSize={10} fill="var(--text-secondary)">
                {dev >= 0 ? "+" : ""}
                {(dev * 100).toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
      {tip && <Tip x={tip.x} y={tip.y}>{tip.node}</Tip>}
      <Legend items={[{ label: "More than expected", slot: 1 }, { label: "Fewer than expected", slot: 2 }]} />
    </div>
  );
}

export function MistySimulator() {
  const [slug, setSlug] = useState("timepiece-suite");
  const [opens, setOpens] = useState(200000);
  const [seed, setSeed] = useState(13);
  const [proof, setProof] = useState(true);
  const [lastCfg, setLastCfg] = useState<MistyConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const [saved, setSaved] = useState(false);
  const sim = useRun();
  const r = sim.result && sim.result.kind === "misty" ? (sim.result as MistyResult) : null;
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("box");
    if (q && MISTY_BOXES.some((b) => b.slug === q)) setSlug(q);
  }, []);
  const box = mistyBox(slug);
  const cfg: MistyConfig = useMemo(() => {
    const c = mistyConfigFor(slug);
    return { ...c, provablyFair: proof, players: [{ id: "guest", name: "Guest", share: 1 }], activePlayerId: "guest", run: { opens, verifySample: 200 } };
  }, [slug, opens, proof]);
  const m = useMemo(() => mistyMath(box, cfg.weights, cfg.bonus, cfg), [box, cfg]);
  const running = sim.status === "running";
  const start = async () => {
    setSaved(false);
    const snap = JSON.parse(JSON.stringify(cfg)) as MistyConfig;
    const runSeed = Math.floor(Math.random() * 1e9); // a fresh run every time
    setSeed(runSeed);
    setLastCfg(snap);
    setLastSeed(runSeed);
    try {
      await sim.run({ lab: "misty", config: snap, sizes: { opens }, seed: runSeed });
    } catch {
      /* shown below */
    }
  };
  const name = `Simulator · ${box.name}`;
  const pItemActual = r && r.opens ? r.items / r.opens : 0;
  const top = r ? [...r.byOutcome].filter((o) => o.kind === "item").sort((a, b) => a.percent - b.percent) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <VizStyle />
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Misty · mystery boxes</div>
          <h1 className="text-2xl font-semibold">Simulator</h1>
        </div>
        <Link href="/operators/misty" className="btn ml-auto no-underline">
          ← Back to Misty
        </Link>
      </header>

      <Card title="Run">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Box">
            <Select<string> value={slug} onChange={setSlug} options={MISTY_BOXES.filter((b) => b.price > 0).map((b) => ({ value: b.slug, label: `${b.name} · ${money(b.price)}` }))} />
          </Field>
          <Field label="Opens" hint="How many boxes to open. 200,000 takes a few seconds; 1,000,000 about ten times longer.">
            <NumberInput value={opens} min={1000} max={5000000} step={10000} onChange={(v) => setOpens(Math.max(1000, Math.min(5000000, Math.floor(v))))} />
          </Field>
          <div className="flex items-end">
            <Toggle checked={proof} onChange={setProof} label="With the proof" hint="On: every open is made with a committed secret, as on Misty, and a sample is re-checked. Off: plain random, about five times faster." />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((n) => (
            <button key={n} type="button" className={`chip ${opens === n ? "chip-accent" : ""}`} onClick={() => setOpens(n)}>
              {num(n)}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            {running && (
              <>
                <span className="text-xs text-ink-3">{pct(sim.progress, 0)}</span>
                <Button kind="ghost" onClick={sim.cancel}>
                  Cancel
                </Button>
              </>
            )}
            <button type="button" className="btn btn-primary" disabled={running} onClick={start}>
              {running ? "Running…" : `Open ${num(opens)} boxes`}
            </button>
          </span>
        </div>
        {running && (
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-line">
            <div className="h-full bg-accent" style={{ width: `${Math.round(sim.progress * 100)}%` }} />
          </div>
        )}
        {sim.error && <div className="mt-2 text-xs text-bad">{sim.error}</div>}
        <div className="mt-3 flex flex-wrap gap-1 text-[11px]">
          <Badge>the table says: a piece {oneIn(m.pItem)}</Badge>
          <Badge>return on screen {pct(m.returnFace)}</Badge>
          <Badge tone="warn">really {pct(m.returnReal)}</Badge>
          <Badge>
            {m.evMistees.toFixed(2)} Mistees per open
          </Badge>
        </div>
      </Card>

      {r && lastCfg && (
        <>
          <Card
            title={`Report · ${r.boxName} · ${num(r.opens)} opens · run ${lastSeed}`}
            actions={
              <span className="flex gap-2">
                <Button kind="ghost" onClick={() => downloadText(`misty-sim-${r.boxSlug}-${lastSeed}.md`, reportMarkdown(buildRun("misty", name, lastCfg, { opens: r.opens }, lastSeed, r)), "text/markdown")}>
                  Download report
                </Button>
                <Button kind="ghost" onClick={async () => { await persistRun("misty", name, lastCfg, { opens: r.opens }, lastSeed, r); setSaved(true); }}>
                  {saved ? "Saved" : "Save run"}
                </Button>
              </span>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="RTP on screen" value={pct(r.returnFace)} sub={`table says ${pct(r.expectedFace)}`} />
              <Stat label="RTP really" value={pct(r.returnReal)} sub={`table says ${pct(r.expectedReal)}`} tone="warn" />
              <Stat label="Players paid" value={money(r.spent)} sub={`${num(r.opens)} × ${money(r.price)}`} />
              <Stat label="Operator kept, really" value={money(r.spent * (1 - r.returnReal))} sub={pct(1 - r.returnReal)} />
              <Stat label="Pieces won" value={num(r.items)} sub={`${oneIn(pItemActual)} · table says ${oneIn(r.pItem)}`} />
              <Stat label="Pieces, listed value" value={money(r.itemValue)} sub={`about ${money(r.itemValueReal)} at resale`} />
              <Stat label="Mistees handed out" value={num(Math.round(r.mistees))} sub={`${(r.mistees / r.opens).toFixed(2)} per open · table ${r.expectedMistees.toFixed(2)}`} />
              <Stat label="Longest run with no piece" value={num(r.longestDry ?? 0)} sub="opens in a row" />
              <Stat label="Free spins" value={num(r.freeSpins)} sub={pct(r.freeSpins / r.opens)} />
              <Stat label="Odds check" value={`p = ${r.chi.pValue.toFixed(3)}`} sub={r.chi.pValue < 0.01 ? "counts stray from the stated odds" : "counts match the stated odds"} tone={r.chi.pValue < 0.01 ? "bad" : "good"} />
              <Stat label="Proofs re-checked" value={`${r.verifier.passed}/${r.verifier.sampled}`} sub={lastCfg.provablyFair ? "sampled opens" : "proof was off"} />
              <Stat label="Time" value={`${(r.elapsedMs / 1000).toFixed(1)} s`} sub={`${num(Math.round(r.opens / Math.max(0.001, r.elapsedMs / 1000)))} opens per second`} />
            </div>
          </Card>

          <Card title="RTP as the opens add up">
            <p className="mb-2 max-w-[78ch] text-xs text-ink-3">The return jumps around early and settles on what the table says. A big piece shows as a step up.</p>
            <ReturnCurve r={r} />
          </Card>

          <Card title="Where the money went">
            <p className="mb-2 max-w-[78ch] text-xs text-ink-3">Every dollar paid, split into pieces, Mistees and what the operator kept. On screen counts a Mistee at {money(lastCfg.misteeFace)}; really counts it at {money(lastCfg.misteeReal)} and pieces at {pct(lastCfg.itemRealized, 0)} of listed.</p>
            <MoneySplit r={r} cfg={lastCfg} />
          </Card>

          <Card title="Each outcome: actual against expected">
            <p className="mb-2 max-w-[78ch] text-xs text-ink-3">How far each count landed from its expected count, in percent. Rare outcomes swing more: that is chance, not a fault.</p>
            <Deviation r={r} />
            <div className="mt-4 overflow-x-auto">
              <div className="tbl"><table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr>
                    <Th>Outcome</Th>
                    <Th right>Stated odds</Th>
                    <Th right>Actual share</Th>
                    <Th right>Expected</Th>
                    <Th right>Actual</Th>
                    <Th right>Difference</Th>
                  </tr>
                </thead>
                <tbody>
                  {[...r.byOutcome].sort((a, b) => b.percent - a.percent).map((o) => (
                    <tr key={o.id} className="border-t border-line">
                      <Td>{o.label}</Td>
                      <Td right mono>{fmtPct(o.percent)}</Td>
                      <Td right mono>{pctSmart(o.actual / r.opens)}</Td>
                      <Td right mono>{o.expected.toFixed(1)}</Td>
                      <Td right mono>{num(o.actual)}</Td>
                      <Td right mono>{o.expected > 0 ? `${o.actual >= o.expected ? "+" : ""}${(((o.actual - o.expected) / o.expected) * 100).toFixed(1)}%` : "–"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </Card>

          <Card title="The pieces">
            <div className="overflow-x-auto">
              <div className="tbl"><table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr>
                    <Th>Piece</Th>
                    <Th right>Stated</Th>
                    <Th right>Expected wins</Th>
                    <Th right>Actual wins</Th>
                    <Th right>One win per</Th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((o) => (
                    <tr key={o.id} className="border-t border-line">
                      <Td>{o.label}</Td>
                      <Td right mono>{fmtPct(o.percent)}</Td>
                      <Td right mono>{o.expected.toFixed(2)}</Td>
                      <Td right mono>{num(o.actual)}</Td>
                      <Td right mono>{o.actual > 0 ? `${num(Math.round(r.opens / o.actual))} opens` : "none won"}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
