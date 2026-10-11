"use client";
import { useState } from "react";
import type { MysteryBoxConfig, MysteryBoxResult } from "@/engine/types";
import { DEFAULT_MYSTERY, PRESETS } from "@/lib/presets";
import { useRun } from "@/lib/useRun";
import { persistRun } from "@/lib/runs";
import { LabShell } from "../LabShell";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { AccountsPanel } from "../config/AccountsPanel";
import { RunControls } from "../RunControls";
import { MysteryBoxResults } from "../results/MysteryBoxResults";
import { Card, Field, Select } from "../ui";

export function MysteryBoxLab() {
  const [cfg, setCfg] = useState<MysteryBoxConfig>(DEFAULT_MYSTERY);
  const [preset, setPreset] = useState("vendor");
  const [sizes, setSizes] = useState<Record<string, number>>({ opens: 100000, verifySample: 200 });
  const [seed, setSeed] = useState(42);
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<MysteryBoxConfig | null>(null);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "mystery-box" ? (sim.result as MysteryBoxResult) : null;

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as MysteryBoxConfig;
    setLastCfg(snapshot);
    try {
      await sim.run({ lab: "mystery-box", config: snapshot, sizes, seed });
    } catch {
      /* shown by status */
    }
  };
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("mystery-box", `${lastCfg.box.name} · ${lastCfg.algo.scheme}`, lastCfg, sizes, seed, result);
    setSaved(true);
  };
  const warn = sizes.opens > 1_000_000 ? "Runs above a million opens may take a minute or more in the browser; server runs arrive in phase 2." : undefined;

  return (
    <LabShell
      lab="mystery-box"
      hasResults={!!result}
      configure={
        <>
          <Card title="Preset">
            <Field label="Start from a preset, then adjust anything below">
              <Select
                value={preset}
                onChange={(id) => {
                  setPreset(id);
                  const p = PRESETS.mystery.find((x) => x.id === id);
                  if (p) setCfg(JSON.parse(JSON.stringify(p.config)));
                }}
                options={PRESETS.mystery.map((p) => ({ value: p.id, label: p.name }))}
              />
            </Field>
          </Card>
          <BoxBuilder box={cfg.box} onChange={(box) => setCfg({ ...cfg, box })} />
          <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} />
          <RigPanel lab="mystery-box" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />
          <AccountsPanel accounts={cfg.accounts} onChange={(accounts) => setCfg({ ...cfg, accounts })} />
        </>
      }
      run={
        <RunControls
          sizes={sizes}
          sizeDefs={[
            { key: "opens", label: "Opens", min: 100, max: 5_000_000, step: 1000 },
            { key: "verifySample", label: "Proofs to verify", min: 0, max: 5000, step: 50, hint: "First N opens are recomputed by the honest verifier." },
          ]}
          onSizes={setSizes}
          seed={seed}
          onSeed={setSeed}
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          onRun={start}
          onCancel={sim.cancel}
          onSave={save}
          saved={saved}
          warning={sim.error ?? warn}
        />
      }
      results={result && lastCfg ? <MysteryBoxResults cfg={lastCfg} r={result} /> : null}
    />
  );
}
