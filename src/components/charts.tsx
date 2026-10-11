// Small dependency-free SVG charts. One scale per chart, theme tokens for text, labels kept inside the box.
import type { Histogram } from "@/engine/types";

const AX = "var(--color-ink-3)";
const INK = "var(--color-ink)";
const GRID = "var(--color-line)";
const ACC = "var(--color-accent)";
const ACC2 = "var(--color-accent-soft)";

export function fmtShort(v: number): string {
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(v >= 1e4 ? 0 : 1) + "k";
  if (Math.abs(v) >= 100) return v.toFixed(0);
  if (Math.abs(v) >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

/** Horizontal bars: stated vs observed per item. */
export function PairedBars({
  rows,
  maxLabel = 26,
}: {
  rows: { label: string; a: number; b: number; hint?: string }[];
  maxLabel?: number;
}) {
  const W = 640, rowH = 22, pad = { l: 190, r: 70, t: 8, b: 8 };
  const H = pad.t + pad.b + rows.length * rowH;
  const max = Math.max(1e-9, ...rows.flatMap((r) => [r.a, r.b]));
  const x = (v: number) => pad.l + (v / max) * (W - pad.l - pad.r);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Stated versus observed probability per item">
      {rows.map((r, i) => {
        const y = pad.t + i * rowH;
        return (
          <g key={r.label + i}>
            <title>{`${r.label}: stated ${(r.a * 100).toFixed(3)}%, observed ${(r.b * 100).toFixed(3)}%`}</title>
            <text x={pad.l - 8} y={y + 14} textAnchor="end" fontSize="11" fill={INK}>
              {r.label.length > maxLabel ? r.label.slice(0, maxLabel - 1) + "…" : r.label}
            </text>
            <rect x={pad.l} y={y + 3} width={Math.max(0, x(r.a) - pad.l)} height={7} rx={2} fill={ACC2} stroke={ACC} strokeWidth={0.8} />
            <rect x={pad.l} y={y + 11} width={Math.max(0, x(r.b) - pad.l)} height={7} rx={2} fill={ACC} />
            <text x={x(Math.max(r.a, r.b)) + 6} y={y + 15} fontSize="10" fill={AX} fontFamily="var(--font-mono)">
              {(r.b * 100).toFixed(r.b < 0.001 ? 4 : 2)}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HistogramChart({ h, logX = false, height = 160 }: { h: Histogram; logX?: boolean; height?: number }) {
  const W = 640, pad = { l: 40, r: 10, t: 10, b: 28 };
  const H = height;
  const n = h.counts.length;
  const max = Math.max(1, ...h.counts);
  const bw = (W - pad.l - pad.r) / n;
  const y = (c: number) => pad.t + (1 - c / max) * (H - pad.t - pad.b);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={h.label}>
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={GRID} />
      {h.counts.map((c, i) => (
        <g key={i}>
          <title>{`${fmtShort(h.edges[i])} to ${fmtShort(h.edges[i + 1])}: ${c.toLocaleString()}`}</title>
          <rect x={pad.l + i * bw + 1} y={y(c)} width={Math.max(1, bw - 2)} height={H - pad.b - y(c)} rx={2} fill={ACC} />
        </g>
      ))}
      {h.edges.map((e, i) =>
        i % Math.ceil(n / 7) === 0 || i === n ? (
          <text key={i} x={pad.l + i * bw} y={H - 10} fontSize="10" textAnchor="middle" fill={AX}>
            {logX ? "$" + fmtShort(e) : fmtShort(e)}
          </text>
        ) : null,
      )}
      <text x={pad.l - 6} y={pad.t + 10} fontSize="10" textAnchor="end" fill={AX}>
        {fmtShort(max)}
      </text>
    </svg>
  );
}

/** Line chart with up to three series; shared y scale. */
export function Lines({
  series,
  height = 180,
  yLabel,
  xLabel,
}: {
  series: { name: string; points: number[]; dashed?: boolean }[];
  height?: number;
  yLabel?: string;
  xLabel?: string;
}) {
  const W = 640, pad = { l: 48, r: 12, t: 12, b: 26 };
  const H = height;
  const n = Math.max(2, ...series.map((s) => s.points.length));
  const max = Math.max(1e-9, ...series.flatMap((s) => s.points));
  const x = (i: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const colors = [ACC, "var(--color-ink-2)", "var(--color-tier-legendary)"];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel ?? "line chart"}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad.l} x2={W - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={GRID} />
          <text x={pad.l - 6} y={y(max * f) + 4} fontSize="10" textAnchor="end" fill={AX}>
            {fmtShort(max * f)}
          </text>
        </g>
      ))}
      {series.map((s, k) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={colors[k % colors.length]}
          strokeWidth={2}
          strokeDasharray={s.dashed ? "4 3" : undefined}
          points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
        >
          <title>{s.name}</title>
        </polyline>
      ))}
      <text x={W - pad.r} y={H - 8} fontSize="10" textAnchor="end" fill={AX}>
        {xLabel}
      </text>
      <g>
        {series.map((s, k) => (
          <text key={s.name} x={pad.l + k * 150} y={H - 8} fontSize="10" fill={colors[k % colors.length]}>
            ■ {s.name}
          </text>
        ))}
      </g>
    </svg>
  );
}

/** Bias map: counts per ticket region with the expected band. */
export function RegionBars({ counts, expected }: { counts: number[]; expected: number }) {
  const W = 640, pad = { l: 40, r: 10, t: 10, b: 24 }, H = 150;
  const n = counts.length;
  const max = Math.max(expected * 1.2, ...counts);
  const bw = (W - pad.l - pad.r) / n;
  const y = (c: number) => pad.t + (1 - c / max) * (H - pad.t - pad.b);
  const sd = Math.sqrt(expected);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Opens per ticket region">
      <rect x={pad.l} y={y(expected + 2 * sd)} width={W - pad.l - pad.r} height={Math.max(1, y(expected - 2 * sd) - y(expected + 2 * sd))} fill={ACC2} />
      <line x1={pad.l} x2={W - pad.r} y1={y(expected)} y2={y(expected)} stroke={AX} strokeDasharray="4 3" />
      {counts.map((c, i) => (
        <g key={i}>
          <title>{`tickets ${((i / n) * 100).toFixed(0)}–${(((i + 1) / n) * 100).toFixed(0)}%: ${c.toLocaleString()} (expected ${expected.toFixed(0)})`}</title>
          <rect x={pad.l + i * bw + 0.5} y={y(c)} width={Math.max(1, bw - 1)} height={H - pad.b - y(c)} fill={Math.abs(c - expected) > 3 * sd ? "var(--color-bad)" : ACC} />
        </g>
      ))}
      <text x={pad.l} y={H - 8} fontSize="10" fill={AX}>
        ticket 0
      </text>
      <text x={W - pad.r} y={H - 8} fontSize="10" textAnchor="end" fill={AX}>
        ticket T · band = expected ± 2 sd
      </text>
    </svg>
  );
}
