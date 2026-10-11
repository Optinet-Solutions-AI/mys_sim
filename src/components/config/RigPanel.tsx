"use client";
import type { LabId, RigConfig } from "@/engine/types";
import { RIGS, type RigDoc } from "@/engine/rigs";
import { Card, Help, Toggle } from "../ui";

type RigValue = Record<string, number | string> | boolean;

function defaultValue(r: RigDoc): RigValue {
  if (!r.params.length) return true;
  return Object.fromEntries(r.params.map((p) => [p.key, p.defaultValue]));
}

export function RigPanel({ rigs, onChange, lab }: { rigs: RigConfig; onChange: (r: RigConfig) => void; lab: LabId }) {
  const list = RIGS.filter((r) => r.labs.includes(lab));
  const active = Object.keys(rigs).filter((k) => (rigs as Record<string, unknown>)[k]);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          White-hat rigging toolkit
          {active.length > 0 && <span className="rounded-full bg-bad-soft px-2 py-0.5 text-[11px] text-bad">{active.length} active</span>}
        </span>
      }
    >
      <Help>
        Each switch reproduces a manipulation documented in the research, inside the simulator only. Turn one on, run, then read the detector to see what an honest verifier and the statistics would catch.
      </Help>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {list.map((r) => {
          const val = (rigs as Record<string, RigValue | undefined>)[r.id];
          const on = !!val;
          return (
            <div key={r.id} className={`rounded-lg border p-3 ${on ? "border-bad/50 bg-bad-soft/40" : "border-line bg-paper"}`}>
              <Toggle
                checked={on}
                onChange={(c) => onChange({ ...rigs, [r.id]: c ? defaultValue(r) : undefined } as RigConfig)}
                label={<span className="font-medium">{r.name}</span>}
                hint={r.summary}
              />
              {on && r.params.length > 0 && typeof val === "object" && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {r.params.map((p) => (
                    <label key={p.key} className="text-xs">
                      <span className="block text-ink-2">{p.label}</span>
                      {typeof p.defaultValue === "number" ? (
                        <input
                          type="number"
                          min={p.min}
                          max={p.max}
                          step={p.step}
                          value={Number(val[p.key] ?? p.defaultValue)}
                          onChange={(e) => onChange({ ...rigs, [r.id]: { ...val, [p.key]: Number(e.target.value) } } as RigConfig)}
                        />
                      ) : (
                        <input type="text" value={String(val[p.key] ?? p.defaultValue)} onChange={(e) => onChange({ ...rigs, [r.id]: { ...val, [p.key]: e.target.value } } as RigConfig)} />
                      )}
                    </label>
                  ))}
                </div>
              )}
              <div className="mt-2 text-[11px] text-ink-3">
                <b>Source:</b> {r.source}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
