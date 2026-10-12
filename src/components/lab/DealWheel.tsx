"use client";
import { useRef } from "react";
import { pct } from "@/lib/format";

const R = 104; // ring radius
const W = 30; // ring width
const C = 130; // centre

/** Polar to screen, 0° at the top, clockwise. */
function pt(deg: number, r: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: C + r * Math.cos(a), y: C + r * Math.sin(a) };
}

function arcPath(start: number, span: number, r: number) {
  if (span >= 359.9) return `M ${C} ${C - r} A ${r} ${r} 0 1 1 ${C - 0.01} ${C - r}`;
  const a = pt(start, r);
  const b = pt(start + span, r);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${span > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

/**
 * The upgrader wheel: a ring with a green win zone sized by the chance, which the player can drag around the circle,
 * and a needle that spins and settles on the result. The needle keeps its position between spins.
 */
export function DealWheel({
  chance,
  offset,
  onOffset,
  needle,
  spinning,
  landed,
  roll,
  label,
  sub,
}: {
  chance: number; // 0..1
  offset: number; // degrees where the win zone starts, 0 = top
  onOffset: (deg: number) => void;
  needle: number; // degrees, 0 = top
  spinning: boolean;
  landed: "win" | "lose" | null;
  roll: number | null; // 0..100 shown like the sites do
  label: string;
  sub: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const span = Math.max(0.5, Math.min(360, chance * 360));

  const angleOf = (e: React.PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = e.clientX - (rect.left + rect.width / 2);
    const y = e.clientY - (rect.top + rect.height / 2);
    return (Math.atan2(y, x) * 180) / Math.PI + 90 + 360;
  };
  const place = (e: React.PointerEvent) => {
    const a = angleOf(e) % 360;
    onOffset(((a - span / 2) % 360 + 360) % 360);
  };
  const n = pt(needle, R + W / 2 + 4);
  const hub = pt(needle, R - W / 2 - 10);
  const tip = pt(needle, R + W / 2 + 14);

  return (
    <div className="flex flex-col items-center">
      <svg
        ref={svgRef}
        viewBox="0 0 260 260"
        className={`h-[260px] w-[260px] touch-none select-none ${spinning ? "cursor-default" : "cursor-grab"}`}
        onPointerDown={(e) => {
          if (spinning) return;
          dragging.current = true;
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          place(e);
        }}
        onPointerMove={(e) => {
          if (dragging.current && !spinning) place(e);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {/* ring */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--color-line)" strokeWidth={W} />
        {/* tick marks every 10% */}
        {Array.from({ length: 10 }, (_, i) => {
          const a = pt(i * 36, R + W / 2);
          const b = pt(i * 36, R + W / 2 + 5);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-ink-3)" strokeWidth={1} />;
        })}
        {/* win zone */}
        <path d={arcPath(offset, span, R)} fill="none" stroke="var(--color-good)" strokeWidth={W} strokeLinecap="butt" className={landed === "win" ? "animate-pulse" : ""} />
        {/* zone label */}
        {(() => {
          const m = pt(offset + span / 2, R);
          return (
            <text x={m.x} y={m.y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" style={{ pointerEvents: "none" }}>
              {pct(chance, 0)}
            </text>
          );
        })()}
        {/* needle */}
        <line x1={hub.x} y1={hub.y} x2={n.x} y2={n.y} stroke="var(--color-ink)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={tip.x} cy={tip.y} r={5} fill={landed === "win" ? "var(--color-good)" : landed === "lose" ? "var(--color-bad)" : "var(--color-ink)"} />
        <circle cx={C} cy={C} r={62} fill="var(--color-surface)" stroke="var(--color-line)" />
        <text x={C} y={C - 10} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--color-ink)">
          {roll === null ? pct(chance, 1) : roll.toFixed(2)}
        </text>
        <text x={C} y={C + 10} textAnchor="middle" fontSize="10" fill="var(--color-ink-3)">
          {roll === null ? label : landed === "win" ? "WIN" : "LOSE"}
        </text>
        <text x={C} y={C + 26} textAnchor="middle" fontSize="9" fill="var(--color-ink-3)">
          {sub}
        </text>
      </svg>
      <div className="text-[11px] text-ink-3">drag the green zone anywhere around the wheel · the needle starts where it last stopped</div>
    </div>
  );
}
