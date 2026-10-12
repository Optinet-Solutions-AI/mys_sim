"use client";
import { useCallback, useEffect, useState } from "react";
import type { RetentionConfig, RetentionResult } from "@/engine/types";
import { DEFAULT_RETENTION } from "@/lib/presets";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { activeRigNames, algoLabel } from "@/lib/live";
import { money, num } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog } from "../lab/SettingsDialog";
import { SimulateBar } from "../lab/SimulateBar";
import { ResultsSection } from "../lab/ResultsSection";
import { RetentionStage } from "../stages/RetentionStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { RetentionResults } from "../results/OtherResults";
import { Button, Card, Field, Help, NumberInput, Select, Toggle } from "../ui";
import { Icon } from "../Icon";

export function RetentionLab() {
  const [cfg, setCfg] = useState<RetentionConfig>(DEFAULT_RETENTION);
  const [seed, setSeed] = useState(11);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "incentives" });
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<RetentionConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "retention" ? (sim.result as RetentionResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "incentives" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const V = cfg.visitor;
  const setV = (patch: Partial<RetentionConfig["visitor"]>) => setCfg({ ...cfg, visitor: { ...V, ...patch } });

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as RetentionConfig;
    setLastCfg(snapshot);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "retention", config: snapshot, sizes: {}, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const sizesOf = (c: RetentionConfig) => ({ agents: c.agents, days: c.days });
  const runName = () => (lastCfg ? `${lastCfg.agents} agents × ${lastCfg.days} days` : "run");
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("retention", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`retention-${lastSeed}.md`, reportMarkdown(buildRun("retention", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const on = [cfg.dailyBox.enabled && "daily box", cfg.race.enabled && "races", cfg.affiliate.enabled && "affiliate"].filter(Boolean) as string[];

  return (
    <>
      <LabFrame
        lab="retention"
        rigCount={rigs.length}
        onSettings={openSettings}
        chips={[
          { label: on.length ? `Incentives: ${on.join(", ")}` : "Incentives: none", section: "incentives" },
          { label: `Visitor model: ${Math.round(V.baseVisit * 100)}% base visit · ${Math.round(V.churnHazard * 100)}% churn after a loss`, section: "visitor" },
          { label: `${money(cfg.box.price)} box · RTP on ${cfg.box.valueLayer}`, section: "box" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs: honest operator", section: "rigs" },
          { label: `${num(cfg.agents)} visitors × ${cfg.days} days · seed ${seed}`, section: "population", tone: "accent" },
        ]}
      >
        <RetentionStage cfg={cfg} onSettings={openSettings} />
        <SimulateBar
          label={`Run ${num(cfg.agents)} visitors × ${cfg.days} days`}
          hint="Retention curves against a control run with no incentives, bonus cost, incremental wager per bonus dollar, LTV and hold after bonuses."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("population")}
        />
        {result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.agents)} visitors × ${result.days} days · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <RetentionResults r={result} />
          </ResultsSection>
        )}
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title="Retention · settings"
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => setCfg(JSON.parse(JSON.stringify(DEFAULT_RETENTION)))}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset to vendor default
            </Button>
            <span className="ml-auto" />
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={[
          {
            id: "population",
            label: "Visitors & horizon",
            icon: "ph:users-three",
            content: (
              <Card title="Population and horizon">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Visitors (agents)"><NumberInput value={cfg.agents} min={50} max={50000} step={100} onChange={(v) => setCfg({ ...cfg, agents: v })} /></Field>
                  <Field label="Days"><NumberInput value={cfg.days} min={7} max={365} step={1} onChange={(v) => setCfg({ ...cfg, days: v })} /></Field>
                  <Field label="Seed">
                    <div className="flex gap-1">
                      <NumberInput value={seed} min={0} step={1} onChange={(v) => setSeed(Math.floor(v))} />
                      <Button kind="ghost" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} title="New random seed">
                        <Icon name="ph:shuffle" size={16} />
                      </Button>
                    </div>
                  </Field>
                </div>
              </Card>
            ),
          },
          {
            id: "incentives",
            label: "Incentives",
            icon: "ph:gift",
            content: (
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
                    <Field label="Share of visitors who are referred"><NumberInput value={cfg.affiliate.referredShare} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, referredShare: v } })} /></Field>
                    <Field label="Free boxes for referred users"><NumberInput value={cfg.affiliate.freeBoxes} min={0} max={10} step={1} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, freeBoxes: v } })} /></Field>
                    <Field label="Commission on referred deposits"><NumberInput value={cfg.affiliate.commission} min={0} max={0.5} step={0.01} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, commission: v } })} /></Field>
                  </div>
                </div>
              </Card>
            ),
          },
          {
            id: "visitor",
            label: "Visitor model",
            icon: "ph:user",
            content: (
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
            ),
          },
          { id: "box", label: "Box & items", icon: "ph:package", content: <BoxBuilder box={cfg.box} onChange={(box) => setCfg({ ...cfg, box })} /> },
          { id: "algo", label: "Algorithm", icon: "ph:shield-check", content: <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} /> },
          {
            id: "rigs",
            label: "Rigs",
            icon: "ph:detective",
            badge: rigs.length ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">{rigs.length}</span> : undefined,
            content: <RigPanel lab="retention" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />,
          },
        ]}
      />
    </>
  );
}
