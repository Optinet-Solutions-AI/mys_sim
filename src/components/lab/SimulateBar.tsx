"use client";
import type { RunStatus } from "@/lib/useRun";
import { Icon } from "../Icon";
import { Info, Progress } from "../ui";

/** The "run many" control: one button, progress, a shortcut to the run-size settings. */
export function SimulateBar({
  label,
  hint,
  status,
  progress,
  elapsed,
  error,
  onRun,
  onCancel,
  onSettings,
}: {
  label: string;
  hint: string;
  status: RunStatus;
  progress: number;
  elapsed: number;
  error: string | null;
  onRun: () => void;
  onCancel: () => void;
  onSettings: () => void;
}) {
  const running = status === "running";
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-3">
        <Icon name="ph:chart-bar" size={22} className="text-accent-ink" />
        <span className="text-sm font-semibold">Simulation</span>
        <Info>{hint}</Info>
        {status === "done" && <span className="text-xs text-ink-3">done in {(elapsed / 1000).toFixed(1)} s · results below</span>}
        <div className="ml-auto flex items-center gap-2">
          {!running ? (
            <button type="button" className="btn btn-primary" onClick={onRun}>
              <Icon name="ph:fast-forward" size={16} className="text-white" /> {label}
            </button>
          ) : (
            <button type="button" className="btn btn-danger" onClick={onCancel}>
              <Icon name="ph:stop" size={16} /> Cancel · {Math.round(progress * 100)}%
            </button>
          )}
          <button type="button" className="btn btn-icon" data-tip="Run size and seed" data-tip-end="" onClick={onSettings} aria-label="Run size and seed">
            <Icon name="ph:gear-six" size={16} />
          </button>
        </div>
      </div>
      {running && (
        <div className="mt-2">
          <Progress value={progress} />
        </div>
      )}
      {error && <div className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{error}</div>}
    </div>
  );
}
