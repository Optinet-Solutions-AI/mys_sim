"use client";
import { useCallback, useEffect, useState } from "react";
import type { MysteryBoxConfig, MysteryBoxResult } from "@/engine/types";
import type { FeatureDef } from "@/lib/operators";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { activeRigNames, algoLabel } from "@/lib/live";
import { money, num } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { SimulateBar } from "../lab/SimulateBar";
import { ResultsSection } from "../lab/ResultsSection";
import { MysteryBoxStage } from "../stages/MysteryBoxStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { AccountsPanel } from "../config/AccountsPanel";
import { MysteryBoxResults } from "../results/MysteryBoxResults";
import { Button, Card, Field, NumberInput, Select } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function MysteryBoxLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as MysteryBoxConfig;
  const presets = (variant.presets ?? []) as { id: string; name: string; config: MysteryBoxConfig }[];
  const [cfg, setCfg] = useState<MysteryBoxConfig>(() => clone(initial));
  const [preset, setPreset] = useState(presets[0]?.id ?? "");
  const [sizes, setSizes] = useState<Record<string, number>>({ opens: 100000, verifySample: 200 });
  const [seed, setSeed] = useState(42);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "run" });
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<MysteryBoxConfig | null>(null);
  const [lastSizes, setLastSizes] = useState(sizes);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "mystery-box" ? (sim.result as MysteryBoxResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "run" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const allowed = (id: string) => !variant.sections || variant.sections.includes(id);

  const start = async () => {
    setSaved(false);
    const snapshot = clone(cfg);
    setLastCfg(snapshot);
    setLastSizes(sizes);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "mystery-box", config: snapshot, sizes, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);

  const runName = () => `${operator} · ${variant.doc.title}${lastCfg ? ` · ${lastCfg.algo.scheme}` : ""}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("mystery-box", runName(), lastCfg, lastSizes, lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`${variant.key}-${lastSeed}.md`, reportMarkdown(buildRun("mystery-box", runName(), lastCfg, lastSizes, lastSeed, result)), "text/markdown");
  };
  const applyPreset = (id: string) => {
    setPreset(id);
    const p = presets.find((x) => x.id === id);
    setCfg(clone(p ? p.config : initial));
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);

  const sections: SettingsSection[] = [
    {
      id: "run",
      label: presets.length > 1 ? "Run & presets" : "Run",
      icon: "ph:fast-forward",
      content: (
        <div className="space-y-4">
          {presets.length > 1 && (
            <Card title={`${operator} presets`}>
              <Field label="Start from a preset, then adjust any section">
                <Select value={preset} onChange={applyPreset} options={presets.map((p) => ({ value: p.id, label: p.name }))} />
              </Field>
            </Card>
          )}
          <Card title="Simulation size">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Opens" hint="Up to 5,000,000 in the browser. Above a million takes a minute or more.">
                <NumberInput value={sizes.opens} min={100} max={5_000_000} step={1000} onChange={(v) => setSizes({ ...sizes, opens: Math.max(100, Math.min(5_000_000, Math.floor(v))) })} />
              </Field>
              <Field label="Proofs to verify" hint="The first N opens are recomputed by the honest verifier.">
                <NumberInput value={sizes.verifySample} min={0} max={5000} step={50} onChange={(v) => setSizes({ ...sizes, verifySample: Math.max(0, Math.min(5000, Math.floor(v))) })} />
              </Field>
              <Field label="Seed" hint="Same settings and seed give identical results. It also seeds the live opens.">
                <div className="flex gap-1">
                  <NumberInput value={seed} min={0} step={1} onChange={(v) => setSeed(Math.floor(v))} />
                  <Button kind="ghost" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} title="New random seed">
                    <Icon name="ph:shuffle" size={16} />
                  </Button>
                </div>
              </Field>
            </div>
          </Card>
        </div>
      ),
    },
    { id: "box", label: "Box & items", icon: "ph:package", content: <BoxBuilder box={cfg.box} onChange={(box) => setCfg({ ...cfg, box })} lockModel={variant.lockModel} lockItems={variant.lockItems} /> },
    { id: "algo", label: "Algorithm", icon: "ph:shield-check", content: <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} /> },
    {
      id: "rigs",
      label: "Rigs",
      icon: "ph:detective",
      badge: rigs.length ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">{rigs.length}</span> : undefined,
      content: <RigPanel lab="mystery-box" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} allow={variant.rigIds} />,
    },
    { id: "accounts", label: "Accounts", icon: "ph:users-three", content: <AccountsPanel accounts={cfg.accounts} onChange={(accounts) => setCfg({ ...cfg, accounts })} /> },
  ].filter((s) => allowed(s.id));

  return (
    <>
      <LabFrame
        doc={variant.doc}
        operator={operator}
        rigCount={rigs.length}
        onSettings={openSettings}
        settingsOpen={settings.open}
        chips={[
          { label: `${money(cfg.box.price)} box · ${cfg.box.items.length} items · ${cfg.box.model === "pool" ? "finite drop" : cfg.box.model === "tiered" ? "tier-first" : `RTP on ${cfg.box.valueLayer}`}`, section: "box" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs", section: "rigs" },
          { label: `${num(sizes.opens)} opens · seed ${seed}`, section: "run", tone: "accent" },
        ]}
      >
        <MysteryBoxStage cfg={cfg} seed={seed} onSettings={openSettings} />
        <SimulateBar
          label={`Run ${num(sizes.opens)} opens`}
          hint="Stated vs observed odds, realized return with its error bar, proof checks and the detector, computed in a background worker."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("run")}
        />
        {result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.opens)} opens · seed ${lastSeed} · ${lastCfg.box.name} · ${algoLabel(lastCfg.algo)}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <MysteryBoxResults cfg={lastCfg} r={result} />
          </ResultsSection>
        )}
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title={`${operator} · ${variant.doc.title} · settings`}
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => applyPreset(preset)}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset
            </Button>
            <span className="ml-auto" />
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={sections}
      />
    </>
  );
}
