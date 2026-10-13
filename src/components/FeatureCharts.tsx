"use client";
import { useState } from "react";
import { EXTERNAL, FAMILIES, MECHANICS, SOURCES, adoption, sourceProfile, spread, type FamilyId, type Spread } from "@/lib/featureMatrix";

/* Categorical slots from the reference palette (validated light and dark, adjacent pairs). */
const SLOT_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const SLOT_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300"];
const FAMILY_SLOT: Record<FamilyId, number> = { draw: 0, proof: 1, money: 2, side: 3, retain: 4, price: 5 };
const SPREAD_SLOT: Record<Spread, number> = { same: 0, similar: 1, unique: 2 };
const SPREAD_LABEL: Record<Spread, string> = { same: "Same as others", similar: "Similar", unique: "Unique" };

const BAR = 14;
const GAP = 2;

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="viz-tip" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; slot: number }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: `var(--series-${it.slot + 1})` }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Chart 1: adoption of each mechanic across the seven operators, as a stacked horizontal bar (yes + variant). */
export function AdoptionChart() {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = [...MECHANICS].map((m) => ({ m, a: adoption(m) })).sort((p, q) => q.a.yes + q.a.variant - (p.a.yes + p.a.variant) || q.a.yes - p.a.yes);
  const labelW = 250;
  const plotW = 420;
  const max = EXTERNAL.length;
  const h = rows.length * (BAR + 8) + 24;
  const x = (v: number) => (v / max) * plotW;
  return (
    <div className="viz-root relative overflow-x-auto" onMouseLeave={() => setTip(null)}>
      <svg width={labelW + plotW + 40} height={h} role="img" aria-label="How many operators use each mechanic">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((v) => (
          <g key={v}>
            <line x1={labelW + x(v)} x2={labelW + x(v)} y1={0} y2={h - 20} stroke="var(--grid)" strokeWidth={1} />
            <text x={labelW + x(v)} y={h - 6} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
              {v}
            </text>
          </g>
        ))}
        {rows.map(({ m, a }, i) => {
          const y = i * (BAR + 8);
          const yesW = x(a.yes);
          const varW = x(a.variant);
          const total = a.yes + a.variant;
          const names = a.sources.filter((s) => s.p !== "no" && s.p !== "unknown").map((s) => `${SOURCES.find((q) => q.id === s.id)?.name}${s.p === "variant" ? " (variant)" : ""}`);
          return (
            <g
              key={m.id}
              onMouseMove={(e) => {
                const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                setTip({ x: e.clientX - r.left + 12, y: e.clientY - r.top + 12, node: <><b>{m.name}</b><br />{total} of {max} operators{names.length ? `: ${names.join(", ")}` : ""}</> });
              }}
            >
              <rect x={0} y={y} width={labelW + plotW + 40} height={BAR + 8} fill="transparent" />
              <text x={labelW - 8} y={y + BAR - 3} textAnchor="end" fontSize={11} fill="var(--text-primary)">
                {m.name.length > 38 ? m.name.slice(0, 37) + "…" : m.name}
              </text>
              {a.yes > 0 && <rect x={labelW} y={y} width={Math.max(0, yesW - (a.variant > 0 ? GAP : 0))} height={BAR} rx={a.variant > 0 ? 0 : 4} fill="var(--series-1)" />}
              {a.variant > 0 && <rect x={labelW + yesW + (a.yes > 0 ? 0 : 0)} y={y} width={Math.max(0, varW)} height={BAR} rx={4} fill="var(--series-2)" />}
              <text x={labelW + x(total) + 6} y={y + BAR - 3} fontSize={11} fill="var(--text-secondary)">
                {total}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && <Tip x={tip.x} y={tip.y}>{tip.node}</Tip>}
      <Legend items={[{ label: "Has it as described", slot: 0 }, { label: "Has a close variant", slot: 1 }]} />
    </div>
  );
}

/** Chart 2: per source, how many mechanics it has in each family, as stacked bars. */
export function FamilyChart() {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = SOURCES.map((s) => ({ s, p: sourceProfile(s.id) }));
  const labelW = 130;
  const plotW = 420;
  const max = Math.max(...rows.map((r) => r.p.has.length), 1);
  const h = rows.length * (BAR + 10) + 24;
  const x = (v: number) => (v / max) * plotW;
  return (
    <div className="viz-root relative overflow-x-auto" onMouseLeave={() => setTip(null)}>
      <svg width={labelW + plotW + 40} height={h} role="img" aria-label="Mechanics per source, by family">
        {Array.from({ length: max + 1 }, (_, v) => v).filter((v) => v % 2 === 0).map((v) => (
          <g key={v}>
            <line x1={labelW + x(v)} x2={labelW + x(v)} y1={0} y2={h - 20} stroke="var(--grid)" strokeWidth={1} />
            <text x={labelW + x(v)} y={h - 6} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
              {v}
            </text>
          </g>
        ))}
        {rows.map(({ s, p }, i) => {
          const y = i * (BAR + 10);
          let acc = 0;
          const total = p.has.length;
          return (
            <g key={s.id}>
              <text x={labelW - 8} y={y + BAR - 3} textAnchor="end" fontSize={11} fill="var(--text-primary)">
                {s.name}
              </text>
              {FAMILIES.map((f, fi) => {
                const v = p.byFamily[f.id];
                if (!v) return null;
                const x0 = labelW + x(acc);
                const w = x(v);
                acc += v;
                const last = acc === total;
                return (
                  <rect
                    key={f.id}
                    x={x0}
                    y={y}
                    width={Math.max(0, w - (last ? 0 : GAP))}
                    height={BAR}
                    rx={last ? 4 : 0}
                    fill={`var(--series-${FAMILY_SLOT[f.id] + 1})`}
                    onMouseMove={(e) => {
                      const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      const names = p.has.filter((m) => m.family === f.id).map((m) => m.name);
                      setTip({ x: e.clientX - r.left + 12, y: e.clientY - r.top + 12, node: <><b>{s.name} · {f.name}</b><br />{v}: {names.join("; ")}</> });
                    }}
                  />
                );
              })}
              <text x={labelW + x(total) + 6} y={y + BAR - 3} fontSize={11} fill="var(--text-secondary)">
                {total}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && <Tip x={tip.x} y={tip.y}>{tip.node}</Tip>}
      <Legend items={FAMILIES.map((f) => ({ label: f.name, slot: FAMILY_SLOT[f.id] }))} />
    </div>
  );
}

/** Chart 3: per source, how many of its mechanics are shared, similar or unique. */
export function SpreadChart() {
  const [tip, setTip] = useState<{ x: number; y: number; node: React.ReactNode } | null>(null);
  const rows = SOURCES.map((s) => ({ s, p: sourceProfile(s.id) }));
  const labelW = 130;
  const plotW = 420;
  const max = Math.max(...rows.map((r) => r.p.has.length), 1);
  const h = rows.length * (BAR + 10) + 24;
  const x = (v: number) => (v / max) * plotW;
  const order: Spread[] = ["same", "similar", "unique"];
  return (
    <div className="viz-root relative overflow-x-auto" onMouseLeave={() => setTip(null)}>
      <svg width={labelW + plotW + 40} height={h} role="img" aria-label="Shared, similar and unique mechanics per source">
        {Array.from({ length: max + 1 }, (_, v) => v).filter((v) => v % 2 === 0).map((v) => (
          <g key={v}>
            <line x1={labelW + x(v)} x2={labelW + x(v)} y1={0} y2={h - 20} stroke="var(--grid)" strokeWidth={1} />
            <text x={labelW + x(v)} y={h - 6} textAnchor="middle" fontSize={10} fill="var(--text-secondary)">
              {v}
            </text>
          </g>
        ))}
        {rows.map(({ s, p }, i) => {
          const y = i * (BAR + 10);
          let acc = 0;
          const total = p.has.length;
          return (
            <g key={s.id}>
              <text x={labelW - 8} y={y + BAR - 3} textAnchor="end" fontSize={11} fill="var(--text-primary)">
                {s.name}
              </text>
              {order.map((k) => {
                const v = p[k];
                if (!v) return null;
                const x0 = labelW + x(acc);
                const w = x(v);
                acc += v;
                const last = acc === total;
                return (
                  <rect
                    key={k}
                    x={x0}
                    y={y}
                    width={Math.max(0, w - (last ? 0 : GAP))}
                    height={BAR}
                    rx={last ? 4 : 0}
                    fill={`var(--series-${SPREAD_SLOT[k] + 1})`}
                    onMouseMove={(e) => {
                      const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                      const names = p.has.filter((m) => spread(m) === k).map((m) => m.name);
                      setTip({ x: e.clientX - r.left + 12, y: e.clientY - r.top + 12, node: <><b>{s.name} · {SPREAD_LABEL[k]}</b><br />{v}: {names.join("; ")}</> });
                    }}
                  />
                );
              })}
              <text x={labelW + x(total) + 6} y={y + BAR - 3} fontSize={11} fill="var(--text-secondary)">
                {total}
              </text>
            </g>
          );
        })}
      </svg>
      {tip && <Tip x={tip.x} y={tip.y}>{tip.node}</Tip>}
      <Legend items={order.map((k) => ({ label: SPREAD_LABEL[k], slot: SPREAD_SLOT[k] }))} />
    </div>
  );
}

/** Scoped colour roles for the charts: light and dark values from the reference palette. */
export function VizStyle() {
  const light = SLOT_LIGHT.map((c, i) => `--series-${i + 1}: ${c};`).join(" ");
  const dark = SLOT_DARK.map((c, i) => `--series-${i + 1}: ${c};`).join(" ");
  const css = `
.viz-root { color-scheme: light; --surface-1: var(--color-surface, #fcfcfb); --text-primary: var(--color-ink, #0b0b0b); --text-secondary: var(--color-ink-2, #52514e); --grid: color-mix(in srgb, var(--color-ink, #000) 10%, transparent); ${light} }
@media (prefers-color-scheme: dark) { :root:where(:not([data-theme="light"])) .viz-root { color-scheme: dark; ${dark} } }
:root[data-theme="dark"] .viz-root { color-scheme: dark; ${dark} }
.viz-tip { position: absolute; z-index: 20; pointer-events: none; max-width: 320px; background: var(--tip-bg, var(--color-ink)); color: var(--tip-fg, #fff); border-radius: 8px; padding: 6px 9px; font-size: 11px; line-height: 1.4; box-shadow: 0 6px 20px rgba(0,0,0,.18); }
.viz-tip b { color: inherit; }
`;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
