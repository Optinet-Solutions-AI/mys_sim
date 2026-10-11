"use client";
import { useState } from "react";
import type { RetentionConfig, RetentionResult } from "@/engine/types";
import { DEFAULT_RETENTION } from "@/lib/presets";
import { useRun } from "@/lib/useRun";
import { persistRun } from "@/lib/runs";
import { LabShell } from "../LabShell";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { RunControls } from "../RunControls";
import { RetentionResults } from "../results/OtherResults";
import { Card, Field, Help, NumberInput, Select, Toggle } from "../ui";

export function RetentionLab() {
  const [cfg, setCfg] = useState<RetentionConfig>(DEFAULT_RETENTION);
  const [seed, setSeed] = useState(11);
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<RetentionConfig | null>(null);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "retention" ? (sim.result as RetentionResult) : null;
  const V = cfg.visitor;
  const setV = (patch: Partial<RetentionConfig["visitor"]>) => setCfg({ ...cfg, visitor: { ...V, ...patch } });

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as RetentionConfig;
    setLastCfg(snapshot);
    try {
      await sim.run({ lab: "retention", config: snapshot, sizes: {}, seed });
    } catch {
      /* status */
    }
  };
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("retention", `${lastCfg.agents} agents × ${lastCfg.days} days`, lastCfg, { agents: lastCfg.agents, days: lastCfg.days }, seed, result);
    setSaved(true);
  };

  return (
    <LabShell
      lab="retention"
      hasResults={!!result}
      configure={
        <>
          <Card title="Population and horizon">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Agents"><NumberInput value={cfg.agents} min={50} max={50000} step={100} onChange={(v) => setCfg({ ...cfg, agents: v })} /></Field>
              <Field label="Days"><NumberInput value={cfg.days} min={7} max={365} step={1} onChange={(v) => setCfg({ ...cfg, days: v })} /></Field>
            </div>
          </Card>
          <Card title="Incentives (the vendor's reward system)">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Toggle checked={cfg.dailyBox.enabled} onChange={(v) => setCfg({ ...cfg, dailyBox: { ...cfg.dailyBox, enabled: v } })} label="Daily free box" hint="Tiered by cumulative wager." />
                <Field label="Expiry rule">
                  <Select<"24h" | "stack"> value={cfg.dailyBox.expiry} onChange={(e) => setCfg({ ...cfg, dailyBox: { ...cfg.dailyBox, expiry: e } })} options={[{ value: "24h", label: "Expires after 24 hours (vendor)" }, { value: "stack", label: "Stacks until claimed" }]} />
                </Field>
                <Field label="Tier values ($, comma separated)">
                  <input type="text" value={cfg.dailyBox.tierValues.join(",")} onChange={(e) => setCfg({ ...cfg, dailyBox: { ...cfg.dailyBox, tierValues: e.target.value.split(",").map((x) => Number(x.trim()) || 0) } })} />
                </Field>
              </div>
              <div className="space-y-2">
                <Toggle checked={cfg.race.enabled} onChange={(v) => setCfg({ ...cfg, race: { ...cfg.race, enabled: v } })} label="Wager races (leaderboards)" />
                <Field label="Cadence (days)"><NumberInput value={cfg.race.cadenceDays} min={1} max={30} step={1} onChange={(v) => setCfg({ ...cfg, race: { ...cfg.race, cadenceDays: v } })} /></Field>
                <Field label="Prizes ($, top first)">
                  <input type="text" value={cfg.race.prizes.join(",")} onChange={(e) => setCfg({ ...cfg, race: { ...cfg.race, prizes: e.target.value.split(",").map((x) => Number(x.trim()) || 0) } })} />
                </Field>
              </div>
              <div className="space-y-2">
                <Toggle checked={cfg.affiliate.enabled} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, enabled: v } })} label="Affiliate / invite a friend" />
                <Field label="Share of agents who are referred"><NumberInput value={cfg.affiliate.referredShare} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, referredShare: v } })} /></Field>
                <Field label="Free boxes for referred users"><NumberInput value={cfg.affiliate.freeBoxes} min={0} max={10} step={1} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, freeBoxes: v } })} /></Field>
                <Field label="Commission on referred deposits"><NumberInput value={cfg.affiliate.commission} min={0} max={0.5} step={0.01} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, commission: v } })} /></Field>
              </div>
            </div>
          </Card>
          <Card title="Visitor model (assumptions, labelled)">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Base daily visit probability"><NumberInput value={V.baseVisit} min={0} max={1} step={0.05} onChange={(v) => setV({ baseVisit: v })} /></Field>
              <Field label="Lift when a free box is available"><NumberInput value={V.incentiveLift} min={0} max={1} step={0.05} onChange={(v) => setV({ incentiveLift: v })} /></Field>
              <Field label="Lift when near the top of a race"><NumberInput value={V.raceLift} min={0} max={1} step={0.05} onChange={(v) => setV({ raceLift: v })} /></Field>
              <Field label="Churn hazard after a losing day"><NumberInput value={V.churnHazard} min={0} max={1} step={0.01} onChange={(v) => setV({ churnHazard: v })} /></Field>
              <Field label="Deposit per visit ($)"><NumberInput value={V.depositPerVisit} min={0} step={5} onChange={(v) => setV({ depositPerVisit: v })} /></Field>
              <Field label="Opens per visit"><NumberInput value={V.opensPerVisit} min={0} max={50} step={1} onChange={(v) => setV({ opensPerVisit: v })} /></Field>
            </div>
            <Help>A control run with all incentives off uses the same seed; the difference is the incentives&apos; effect. None of these numbers come from data yet.</Help>
          </Card>
          <BoxBuilder box={cfg.box} onChange={(box) => setCfg({ ...cfg, box })} compact />
          <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} />
          <RigPanel lab="retention" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />
        </>
      }
      run={<RunControls sizes={{}} sizeDefs={[]} onSizes={() => {}} seed={seed} onSeed={setSeed} status={sim.status} progress={sim.progress} elapsed={sim.elapsed} onRun={start} onCancel={sim.cancel} onSave={save} saved={saved} warning={sim.error ?? undefined} />}
      results={result ? <RetentionResults r={result} /> : null}
    />
  );
}
