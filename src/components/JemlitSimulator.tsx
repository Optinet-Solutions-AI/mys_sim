"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { JemlitBox, JemlitConfig, JemlitResult } from "@/engine/types";
import { JEMLIT_FEATURED } from "@/engine/jemlitLive.generated";
import { jemlitMath } from "@/engine/labs/jemlit";
import { JEMLIT_BOX_LIST, JEMLIT_DEFAULT_BOX, jemlitConfigFor, loadJemlitBox } from "@/lib/jemlitPresets";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Field, NumberInput, Stat, Td, Th, Toggle } from "./ui";
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

function ReturnCurve({ r }: { r: JemlitResult }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = r.curve;
  const W = 760;
  const H = 260;
  const L = 46;
  const R = 12;
  const T = 10;
  const B = 28;
  const yMax = Math.max(r.expectedPrice * 1.6, ...pts.slice(Math.floor(pts.length / 10)).map((p) => p.price)) || 1;
  const x = (n: number) => L + (n / r.opens) * (W - L - R);
  const y = (v: number) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const path = (k: "price" | "real") => pts.map((p, i) => `${i ? "L" : "M"}${x(p.n).toFixed(1)},${y(p[k]).toFixed(1)}`).join(" ");
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
          const n = (((e.clientX - b.left) / b.width) * W - L) / (W - L - R) * r.opens;
          let best = 0;
          for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].n - n) < Math.abs(pts[best].n - n)) best = i;
          setHover(pts.length ? best : null);
        }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(f * yMax)} y2={y(f * yMax)} stroke="var(--grid)" strokeWidth={1} />
            <text x={L - 6} y={y(f * yMax) + 3} textAnchor="end" fontSize={10} fill="var(--text-secondary)">
              {pct(f * yMax, 0)}
            </text>
            <text x={x(f * r.opens)} y={H - 8} textAnchor={f === 0 ? "start" : f === 1 ? "end" : "middle"} fontSize={10} fill="var(--text-secondary)">
              {num(Math.round(f * r.opens))}
            </text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={y(r.expectedPrice)} y2={y(r.expectedPrice)} stroke="var(--series-1)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        <line x1={L} x2={W - R} y1={y(r.expectedReal)} y2={y(r.expectedReal)} stroke="var(--series-2)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
        <path d={path("price")} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        <path d={path("real")} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" />
        {h && (
          <g>
            <line x1={x(h.n)} x2={x(h.n)} y1={T} y2={H - B} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
            <circle cx={x(h.n)} cy={y(h.price)} r={4} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
            <circle cx={x(h.n)} cy={y(h.real)} r={4} fill="var(--series-2)" stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {h && (
        <Tip x={60} y={8}>
          <b>After {num(h.n)} opens</b>
          <br />
          at listed {pct(h.price)} · really {pct(h.real)}
        </Tip>
      )}
      <Legend items={[{ label: "RTP at listed prices (running)", slot: 1 }, { label: "RTP really (running)", slot: 2 }, { label: `Table says ${pct(r.expectedPrice)}`, slot: 1, dash: true }, { label: `Table says ${pct(r.expectedReal)}`, slot: 2, dash: true }]} />
    </div>
  );
}

function MoneySplit({ r, cfg }: { r: JemlitResult; cfg: JemlitConfig }) {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = [
    { name: "At listed", items: r.itemValue, credit: r.credits * cfg.creditFace },
    { name: "Really", items: r.itemValueReal, credit: r.credits * cfg.creditReal },
  ].map((x) => ({ ...x, kept: Math.max(0, r.spent - x.items - x.credit) }));
  const W = 760;
  const L = 80;
  const BAR = 22;
  const parts: { key: "items" | "credit" | "kept"; label: string; slot: number }[] = [
    { key: "items", label: "Shipped items", slot: 1 },
    { key: "credit", label: "Credits", slot: 2 },
    { key: "kept", label: "Kept by Jemlit", slot: 3 },
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

function Deviation({ r }: { r: JemlitResult }) {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = [...r.byItem].sort((a, b) => b.chance - a.chance).map((o) => ({ o, dev: o.expected > 0 ? (o.actual - o.expected) / o.expected : 0 }));
  const max = Math.max(0.05, ...rows.map((x) => Math.abs(x.dev)));
  const W = 760;
  const L = 250;
  const BAR = 14;
  const mid = L + (W - L - 60) / 2;
  const half = (W - L - 60) / 2;
  return (
    <div className="viz-root relative" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${rows.length * (BAR + 8) + 6}`} className="w-full" role="img" aria-label="Actual against expected count per item">
        <line x1={mid} x2={mid} y1={0} y2={rows.length * (BAR + 8)} stroke="var(--text-secondary)" strokeWidth={1} opacity={0.5} />
        {rows.map(({ o, dev }, i) => {
          const yy = i * (BAR + 8);
          const w = (Math.abs(dev) / max) * half;
          return (
            <g
              key={o.id}
              onMouseMove={(e) => {
                const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - b.left + 12, y: e.clientY - b.top + 12, node: <><b>{o.label}</b><br />stated {fmtPct(o.chance * 100)} · expected {o.expected.toFixed(1)} · actual {num(o.actual)} ({dev >= 0 ? "+" : ""}{(dev * 100).toFixed(1)}%)</> });
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

export function JemlitSimulator() {
  const [box, setBox] = useState<JemlitBox>(JEMLIT_DEFAULT_BOX);
  const [opens, setOpens] = useState(200000);
  const [proof, setProof] = useState(true);
  const [query, setQuery] = useState("");
  const [lastCfg, setLastCfg] = useState<JemlitConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(0);
  const [saved, setSaved] = useState(false);
  const sim = useRun();
  const r = sim.result && sim.result.kind === "jemlit" ? (sim.result as JemlitResult) : null;
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("box");
    if (q && q !== box.slug) loadJemlitBox(q).then(setBox).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cfg: JemlitConfig = useMemo(() => {
    const c = jemlitConfigFor(box);
    return { ...c, provablyFair: proof, players: [{ id: "guest", name: "Guest", share: 1 }], activePlayerId: "guest", run: { opens, verifySample: 200 } };
  }, [box, opens, proof]);
  const m = useMemo(() => jemlitMath(box, cfg.chances, cfg), [box, cfg]);
  const running = sim.status === "running";
  const start = async () => {
    setSaved(false);
    const snap = JSON.parse(JSON.stringify(cfg)) as JemlitConfig;
    const runSeed = Math.floor(Math.random() * 1e9);
    setLastCfg(snap);
    setLastSeed(runSeed);
    try {
      await sim.run({ lab: "jemlit", config: snap, sizes: { opens }, seed: runSeed });
    } catch {
      /* shown below */
    }
  };
  const name = `Simulator · ${box.name}`;
  const matches = query.trim().length >= 2 ? JEMLIT_BOX_LIST.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()) || b.slug.includes(query.toLowerCase())).slice(0, 12) : [];
  const bigItems = r ? [...r.byItem].filter((o) => o.price >= r.price).sort((a, b) => a.chance - b.chance) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <VizStyle />
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Jemlit · mystery boxes</div>
          <h1 className="text-2xl font-semibold">Simulator</h1>
        </div>
        <Link href="/operators/jemlit" className="btn ml-auto no-underline">
          ← Back to Jemlit
        </Link>
      </header>

      <Card title="Run">
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Box" hint="Featured boxes below; type to search all captured boxes.">
            <input className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm" placeholder="Search all boxes…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
          <Field label="Opens" hint="How many boxes to open. 200,000 takes a few seconds.">
            <NumberInput value={opens} min={1000} max={5000000} step={10000} onChange={(v) => setOpens(Math.max(1000, Math.min(5000000, Math.floor(v))))} />
          </Field>
          <div className="flex items-end">
            <Toggle checked={proof} onChange={setProof} label="With the proof" hint="On: every open uses Jemlit's recipe and a sample is re-checked. Off: plain random, faster." />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {(matches.length ? matches : JEMLIT_FEATURED.map((b) => ({ slug: b.slug, name: b.name, price: b.price }))).map((b) => (
            <button key={b.slug} type="button" className={`chip ${b.slug === box.slug ? "chip-accent" : ""}`} onClick={() => loadJemlitBox(b.slug).then(setBox)}>
              {b.name} · {money(b.price)}
            </button>
          ))}
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
          <Badge>{box.name} · {money(box.price)}</Badge>
          <Badge>the table says: worth the price {oneIn(m.pAtOrAbovePrice)}</Badge>
          <Badge>RTP at listed {pct(m.returnPrice)}</Badge>
          <Badge>in Credits {pct(m.returnCashback)}</Badge>
          <Badge tone="warn">really {pct(m.returnReal)}</Badge>
        </div>
      </Card>

      {r && lastCfg && (
        <>
          <Card
            title={`Report · ${r.boxName} · ${num(r.opens)} opens · run ${lastSeed}`}
            actions={
              <span className="flex gap-2">
                <Button kind="ghost" onClick={() => downloadText(`jemlit-sim-${r.boxSlug}-${lastSeed}.md`, reportMarkdown(buildRun("jemlit", name, lastCfg, { opens: r.opens }, lastSeed, r)), "text/markdown")}>
                  Download report
                </Button>
                <Button kind="ghost" onClick={async () => { await persistRun("jemlit", name, lastCfg, { opens: r.opens }, lastSeed, r); setSaved(true); }}>
                  {saved ? "Saved" : "Save run"}
                </Button>
              </span>
            }
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="RTP at listed prices" value={pct(r.returnPrice)} sub={`table says ${pct(r.expectedPrice)}`} />
              <Stat label="RTP in Credits" value={pct(r.expectedCashback)} sub="if every win is exchanged" />
              <Stat label="RTP really" value={pct(r.returnReal)} sub={`table says ${pct(r.expectedReal)}`} tone="warn" />
              <Stat label="Jemlit kept, really" value={money(r.spent * (1 - r.returnReal))} sub={pct(1 - r.returnReal)} />
              <Stat label="Players paid" value={money(r.spent)} sub={`${num(r.opens)} × ${money(r.price)}`} />
              <Stat label="Worth the price or more" value={num(r.bigWins)} sub={`${oneIn(r.opens ? r.bigWins / r.opens : 0)} · table says ${oneIn(r.pBig)}`} />
              <Stat label="Longest run below the price" value={num(r.longestDry)} sub="opens in a row" />
              <Stat label="Credit-only opens" value={num(r.creditOpens)} sub={`${pct(r.creditOpens / r.opens)} · ${money(r.credits)} in Credits`} />
              <Stat label="Shippable items" value={num(r.items)} sub={`${money(r.itemValue)} listed`} />
              <Stat label="Odds check" value={`p = ${r.chi.pValue.toFixed(3)}`} sub={r.chi.pValue < 0.01 ? "counts stray from the stated odds" : "counts match the stated odds"} tone={r.chi.pValue < 0.01 ? "bad" : "good"} />
              <Stat label="Proofs re-checked" value={`${r.verifier.passed}/${r.verifier.sampled}`} sub={lastCfg.provablyFair ? "sampled opens" : "proof was off"} />
              <Stat label="Time" value={`${(r.elapsedMs / 1000).toFixed(1)} s`} sub={`${num(Math.round(r.opens / Math.max(0.001, r.elapsedMs / 1000)))} opens per second`} />
            </div>
          </Card>
          <Card title="RTP as the opens add up">
            <p className="mb-2 text-xs text-ink-3">The return jumps early and settles on what the table says. A headline item shows as a step up.</p>
            <ReturnCurve r={r} />
          </Card>
          <Card title="Where the money went">
            <p className="mb-2 text-xs text-ink-3">Every dollar paid, split into shipped items, Credits and what Jemlit kept. At listed counts a Credit at {money(lastCfg.creditFace)} and items at listed; really counts a Credit at {money(lastCfg.creditReal)} and items at {pct(lastCfg.itemRealized, 0)} of listed.</p>
            <MoneySplit r={r} cfg={lastCfg} />
          </Card>
          <Card title="Each item: actual against expected">
            <p className="mb-2 text-xs text-ink-3">How far each count landed from its expected count. Rare items swing more: that is chance, not a fault.</p>
            <Deviation r={r} />
          </Card>
          <Card title="Items worth the price or more">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th right>Price</Th>
                  <Th right>Stated</Th>
                  <Th right>Expected wins</Th>
                  <Th right>Actual wins</Th>
                  <Th right>One win per</Th>
                </tr>
              </thead>
              <tbody>
                {bigItems.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <Td>{o.label}</Td>
                    <Td right mono>{money(o.price)}</Td>
                    <Td right mono>{pctSmart(o.chance)}</Td>
                    <Td right mono>{o.expected.toFixed(2)}</Td>
                    <Td right mono>{num(o.actual)}</Td>
                    <Td right mono>{o.actual > 0 ? `${num(Math.round(r.opens / o.actual))} opens` : "none won"}</Td>
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
