"use client";
import { useState } from "react";
import type { PriceLayer, SellbackConfig, SellbackResult } from "@/engine/types";
import { DEFAULT_SELLBACK, GLASSBOX_ALGO, GLASSBOX_BOX } from "@/lib/presets";
import { useRun } from "@/lib/useRun";
import { persistRun } from "@/lib/runs";
import { LabShell } from "../LabShell";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { RunControls } from "../RunControls";
import { SellbackResults } from "../results/OtherResults";
import { Card, Field, Help, NumberInput, Select } from "../ui";

export function SellbackLab() {
  const [cfg, setCfg] = useState<SellbackConfig>(DEFAULT_SELLBACK);
  const [seed, setSeed] = useState(7);
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<SellbackConfig | null>(null);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "sellback" ? (sim.result as SellbackResult) : null;
  const P = cfg.population;
  const setP = (patch: Partial<SellbackConfig["population"]>) => setCfg({ ...cfg, population: { ...P, ...patch } });

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as SellbackConfig;
    setLastCfg(snapshot);
    try {
      await sim.run({ lab: "sellback", config: snapshot, sizes: {}, seed });
    } catch {
      /* status */
    }
  };
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("sellback", `${lastCfg.box.name} · ${lastCfg.sellback.mode} · ${lastCfg.withdrawal.mode}`, lastCfg, { agents: P.agents, sessions: P.sessions }, seed, result);
    setSaved(true);
  };

  return (
    <LabShell
      lab="sellback"
      hasResults={!!result}
      configure={
        <>
          <Card title="Economy preset">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-paper" onClick={() => setCfg(JSON.parse(JSON.stringify(DEFAULT_SELLBACK)))}>
                Vendor: credit at listed value, withdraw only through items
              </button>
              <button
                type="button"
                className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-paper"
                onClick={() => setCfg({ ...JSON.parse(JSON.stringify(DEFAULT_SELLBACK)), box: GLASSBOX_BOX, algo: GLASSBOX_ALGO, sellback: { mode: "cash", layer: "realized", haircut: 0 }, withdrawal: { mode: "cash", minWithdraw: 0 } })}
              >
                Glass Box: cash at realized value, withdraw freely
              </button>
            </div>
          </Card>
          <Card title="Sell-back and withdrawal rules">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Sell-back mode">
                <Select<"vendor" | "cash">
                  value={cfg.sellback.mode}
                  onChange={(m) => setCfg({ ...cfg, sellback: m === "vendor" ? { mode: "vendor", haircut: cfg.sellback.haircut } : { mode: "cash", layer: "realized", haircut: cfg.sellback.haircut } })}
                  options={[
                    { value: "vendor", label: "Vendor: credit to balance at displayed value" },
                    { value: "cash", label: "Cash paid out (leaves the system)" },
                  ]}
                />
              </Field>
              {cfg.sellback.mode === "cash" && (
                <Field label="Cash at price layer">
                  <Select<PriceLayer> value={cfg.sellback.layer} onChange={(layer) => setCfg({ ...cfg, sellback: { mode: "cash", layer, haircut: cfg.sellback.haircut } })} options={[{ value: "retail", label: "Retail" }, { value: "asking", label: "Asking" }, { value: "realized", label: "Realized" }]} />
                </Field>
              )}
              <Field label="Haircut on sell-back (Jemlit: 0 to 30%)">
                <NumberInput value={cfg.sellback.haircut} min={0} max={0.9} step={0.01} onChange={(v) => setCfg({ ...cfg, sellback: { ...cfg.sellback, haircut: v } })} />
              </Field>
              <Field label="Withdrawal rule">
                <Select<"cash" | "through-items">
                  value={cfg.withdrawal.mode}
                  onChange={(mode) => setCfg({ ...cfg, withdrawal: { ...cfg.withdrawal, mode } })}
                  options={[
                    { value: "through-items", label: "Vendor: only through items, after wagering" },
                    { value: "cash", label: "Balance can be withdrawn as cash" },
                  ]}
                />
              </Field>
              {cfg.withdrawal.mode === "through-items" && (
                <Field label="Minimum item value to withdraw ($)">
                  <NumberInput value={cfg.withdrawal.minWithdraw} min={0} step={10} onChange={(v) => setCfg({ ...cfg, withdrawal: { ...cfg.withdrawal, minWithdraw: v } })} />
                </Field>
              )}
            </div>
          </Card>
          <Card title="Agent population (assumptions)">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Agents"><NumberInput value={P.agents} min={10} max={50000} step={100} onChange={(v) => setP({ agents: v })} /></Field>
              <Field label="Deposit median ($)"><NumberInput value={P.depositMean} min={1} step={10} onChange={(v) => setP({ depositMean: v })} /></Field>
              <Field label="Deposit spread (lognormal sigma)"><NumberInput value={P.depositSpread} min={0} max={2} step={0.1} onChange={(v) => setP({ depositSpread: v })} /></Field>
              <Field label="Lifetime deposits (budget)"><NumberInput value={P.maxDeposits} min={1} max={100} step={1} onChange={(v) => setP({ maxDeposits: v })} /></Field>
              <Field label="Sessions"><NumberInput value={P.sessions} min={1} max={365} step={1} onChange={(v) => setP({ sessions: v })} /></Field>
              <Field label="Opens per session (max)"><NumberInput value={P.opensPerSession} min={1} max={200} step={1} onChange={(v) => setP({ opensPerSession: v })} /></Field>
              <Field label="Re-bet fraction of balance per session"><NumberInput value={P.rebetFraction} min={0.05} max={1} step={0.05} onChange={(v) => setP({ rebetFraction: v })} /></Field>
              <Field label="Ship if displayed value ≥ price ×"><NumberInput value={P.shipAboveMultiple} min={1} max={100} step={0.5} onChange={(v) => setP({ shipAboveMultiple: v })} /></Field>
              <Field label="Cash-out target (× last deposit)"><NumberInput value={P.cashOutTargetMultiple} min={1} max={100} step={0.5} onChange={(v) => setP({ cashOutTargetMultiple: v })} /></Field>
            </div>
            <Help>Agents sell back everything below the ship threshold. Vendor claim to test: 99.9% sold back, about 200 shipments a month, hold 15 to 30% of deposits.</Help>
          </Card>
          <BoxBuilder box={cfg.box} onChange={(box) => setCfg({ ...cfg, box })} compact />
          <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} />
          <RigPanel lab="sellback" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />
        </>
      }
      run={
        <RunControls sizes={{}} sizeDefs={[]} onSizes={() => {}} seed={seed} onSeed={setSeed} status={sim.status} progress={sim.progress} elapsed={sim.elapsed} onRun={start} onCancel={sim.cancel} onSave={save} saved={saved} warning={sim.error ?? undefined} />
      }
      results={result ? <SellbackResults r={result} /> : null}
    />
  );
}
