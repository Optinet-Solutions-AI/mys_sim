"use client";
import type { RunStatus } from "@/lib/useRun";
import { Icon } from "../Icon";
import { Progress } from "../ui";

/** The "run many" control: one button, progress, and a shortcut to the run-size settings. */
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
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Simulation (statistics over many runs)</div>
          <div className="text-xs text-ink-3">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          {!running ? (
            <button type="button" className="btn btn-primary" onClick={onRun}>
              <Icon name="ph:fast-forward" size={16} className="text-white" /> {label}
            </button>
          ) : (
            <button type="button" className="btn btn-danger" onClick={onCancel}>
              <Icon name="ph:stop" size={16} /> Cancel · {Math.round(progress * 100)}%
            </button>
          )}
          <button type="button" className="btn btn-icon" onClick={onSettings} title="Change the run size and seed">
            <Icon name="ph:gear-six" size={16} />
          </button>
        </div>
      </div>
      {running && (
        <div className="mt-2">
          <Progress value={progress} />
        </div>
      )}
      {status === "done" && <div className="mt-1 text-xs text-ink-3">Done in {(elapsed / 1000).toFixed(1)} s. Results are below.</div>}
      {error && <div className="mt-2 rounded-lg bg-bad-soft px-3 py-2 text-xs text-bad">{error}</div>}
    </div>
  );
}
