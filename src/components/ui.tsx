import type { ReactNode } from "react";
import { Icon } from "./Icon";

export function Card({ title, children, className = "", actions }: { title?: ReactNode; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-4 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="flex items-center gap-1.5 text-base font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

/** An info icon whose explanation appears on hover or focus. Pages stay minimal; the words are one hover away. */
export function Info({ children, align = "left", size = 14, className = "" }: { children: ReactNode; align?: "left" | "right" | "center"; size?: number; className?: string }) {
  return (
    <span className={`info ${className}`} tabIndex={0} aria-label="More information">
      <Icon name="ph:info" size={size} className="text-ink-3" />
      <span className={`info-pop ${align === "right" ? "info-pop-right" : align === "center" ? "info-pop-center" : ""}`} role="tooltip">
        {children}
      </span>
    </span>
  );
}

export function Button({
  children,
  onClick,
  kind = "primary",
  disabled,
  type = "button",
  className = "",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  title?: string;
}) {
  const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const k =
    kind === "primary"
      ? "bg-accent text-white hover:bg-accent-ink"
      : kind === "danger"
        ? "border border-bad/40 text-bad hover:bg-bad-soft"
        : "border border-line bg-surface text-ink hover:bg-paper";
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${k} ${className}`} title={title}>
      {children}
    </button>
  );
}

export function Field({ label, hint, children, inline = false }: { label: ReactNode; hint?: ReactNode; children: ReactNode; inline?: boolean }) {
  return (
    <label className={`block ${inline ? "flex items-center justify-between gap-3" : ""}`}>
      <span className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-2">
        {label}
        {hint && <Info>{hint}</Info>}
      </span>
      {children}
    </label>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ""}
      min={min}
      max={max}
      step={step ?? "any"}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} disabled={disabled}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex items-center gap-1 text-sm">
        {label}
        {hint && <Info>{hint}</Info>}
      </span>
    </label>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "good" | "warn" | "bad" }) {
  const t = tone === "good" ? "text-good" : tone === "warn" ? "text-warn" : tone === "bad" ? "text-bad" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${t}`}>{value}</div>
      {sub && <div className="text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "accent" }) {
  const c =
    tone === "good"
      ? "bg-good-soft text-good"
      : tone === "warn"
        ? "bg-warn-soft text-warn"
        : tone === "bad"
          ? "bg-bad-soft text-bad"
          : tone === "accent"
            ? "bg-accent-soft text-accent-ink"
            : "bg-paper text-ink-2 border border-line";
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

/** Explanation on demand: a lone info icon that opens a popover. */
export function Help({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex">
      <Info>{children}</Info>
    </div>
  );
}

export function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return <th className={`border-b border-line px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3 ${right ? "text-right" : ""}`}>{children}</th>;
}
export function Td({ children, right, mono }: { children: ReactNode; right?: boolean; mono?: boolean }) {
  return <td className={`border-b border-line/60 px-2 py-1.5 align-top ${right ? "text-right" : ""} ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}
