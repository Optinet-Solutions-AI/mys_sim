"use client";
import { useState } from "react";
import { Button, Card, Field, NumberInput, Progress } from "./ui";
import { Icon } from "./Icon";
import type { RunStatus } from "@/lib/useRun";

export interface SizeDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  hint?: string;
}

export function RunControls({
  sizes,
  sizeDefs,
  onSizes,
  seed,
  onSeed,
  status,
  progress,
  elapsed,
  onRun,
  onCancel,
  onSave,
  saved,
  warning,
}: {
  sizes: Record<string, number>;
  sizeDefs: SizeDef[];
  onSizes: (s: Record<string, number>) => void;
  seed: number;
  onSeed: (s: number) => void;
  status: RunStatus;
  progress: number;
  elapsed: number;
  onRun: () => void;
  onCancel: () => void;
  onSave?: () => void;
  saved?: boolean;
  warning?: string;
}) {
  const [busySave, setBusySave] = useState(false);
  const running = status === "running";
  return (
    <Card title="Run">
      <div className="grid gap-3 md:grid-cols-4">
        {sizeDefs.map((d) => (
          <Field key={d.key} label={d.label} hint={d.hint}>
            <NumberInput value={sizes[d.key] ?? d.min} min={d.min} max={d.max} step={d.step} onChange={(v) => onSizes({ ...sizes, [d.key]: Math.max(d.min, Math.min(d.max, Math.floor(v))) })} />
          </Field>
        ))}
        <Field label="Seed" hint="Same configuration + same seed = identical results.">
          <div className="flex gap-1">
            <NumberInput value={seed} min={0} step={1} onChange={(v) => onSeed(Math.floor(v))} />
            <Button kind="ghost" onClick={() => onSeed(Math.floor(Math.random() * 1e9))} title="New random seed">
              <Icon name="ph:shuffle" size={16} />
            </Button>
          </div>
        </Field>
      </div>
      {warning && <div className="mt-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn">{warning}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!running ? (
          <Button onClick={onRun}>
            <Icon name="ph:play" size={16} className="text-white" /> Run simulation
          </Button>
        ) : (
          <Button kind="danger" onClick={onCancel}>
            <Icon name="ph:stop" size={16} /> Cancel
          </Button>
        )}
        {onSave && status === "done" && (
          <Button
            kind="ghost"
            disabled={busySave || saved}
            onClick={async () => {
              setBusySave(true);
              try {
                await onSave();
              } finally {
                setBusySave(false);
              }
            }}
          >
            <Icon name="ph:download-simple" size={16} /> {saved ? "Saved to history" : "Save run to history"}
          </Button>
        )}
        <span className="ml-auto text-xs text-ink-3">
          {running && `${Math.round(progress * 100)}%`}
          {status === "done" && `done in ${(elapsed / 1000).toFixed(1)} s`}
        </span>
      </div>
      {running && (
        <div className="mt-2">
          <Progress value={progress} />
        </div>
      )}
    </Card>
  );
}
