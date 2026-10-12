"use client";
import { useCallback, useEffect, useState } from "react";
import type { PriceLayer, UpgraderConfig, UpgraderResult } from "@/engine/types";
import { CATALOG } from "@/engine/catalog";
import { DEFAULT_UPGRADER, JEMLIT_ALGO, VENDOR_ALGO } from "@/lib/presets";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { activeRigNames, algoLabel } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog } from "../lab/SettingsDialog";
import { SimulateBar } from "../lab/SimulateBar";
import { ResultsSection } from "../lab/ResultsSection";
import { UpgraderStage } from "../stages/UpgraderStage";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { UpgraderResults } from "../results/MoreResults";
import { Button, Card, Field, NumberInput, Select } from "../ui";
import { Icon } from "../Icon";

export function UpgraderLab() {
  const [cfg, setCfg] = useState<UpgraderConfig>(DEFAULT_UPGRADER);
  const [seed, setSeed] = useState(13);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "terms" });
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<UpgraderConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "upgrader" ? (sim.result as UpgraderResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "terms" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const P = cfg.population;

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as UpgraderConfig;
    setLastCfg(snapshot);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "upgrader", config: snapshot, sizes: {}, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const sizesOf = (c: UpgraderConfig) => ({ agents: c.population.agents, attempts: c.population.attempts });
  const runName = () => (lastCfg ? `${lastCfg.mode} · ${lastCfg.targetItemId} · edge ${pct(lastCfg.edge, 0)}` : "run");
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("upgrader", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`upgrader-${lastSeed}.md`, reportMarkdown(buildRun("upgrader", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const targets = CATALOG.filter((c) => c.source !== "captured" && c.realized >= 50).map((c) => ({ value: c.id, label: `${c.brand} ${c.name} (${money(c.realized)})` }));

  return (
    <>
      <LabFrame
        lab="upgrader"
        rigCount={rigs.length}
        onSettings={openSettings}
        settingsOpen={settings.open}
        chips={[
          { label: cfg.mode === "upgrader" ? `Upgrader · stake ${money(cfg.stake)}` : `Deals · chance ${pct(Math.min(cfg.maxChance, cfg.chance), 0)} (cap ${pct(cfg.maxChance, 0)})`, section: "terms" },
          { label: `stated edge ${pct(cfg.edge)} · value at ${cfg.valueLayer}`, section: "terms" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs: honest operator", section: "rigs" },
          { label: `${num(P.agents)} agents · ${P.policy === "ladder" ? `ladder up to ${P.attempts}` : "single attempt"} · bankroll ${money(P.bankroll)} · seed ${seed}`, section: "run", tone: "accent" },
        ]}
      >
        <UpgraderStage cfg={cfg} seed={seed} onSettings={openSettings} onChange={setCfg} />
        <SimulateBar
          label={`Run ${num(P.agents)} agents`}
          hint="Win rate against the stated chance, realized edge against the stated edge, ruin under the ladder policy, proofs."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("run")}
        />
        {result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.attempts)} attempts · ${result.mode} · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <UpgraderResults r={result} />
          </ResultsSection>
        )}
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title="Upgrader & Deals · settings"
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => setCfg(JSON.parse(JSON.stringify(DEFAULT_UPGRADER)))}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset to Cases.gg default
            </Button>
            <span className="ml-auto" />
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={[
          {
            id: "terms",
            label: "Terms",
            icon: "ph:arrow-up-right",
            content: (
              <div className="space-y-4">
                <Card title="Presets">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn" onClick={() => setCfg(JSON.parse(JSON.stringify(DEFAULT_UPGRADER)))}>
                      Cases.gg Upgrader: 10% edge, rotation every 1,000
                    </button>
                    <button type="button" className="btn" onClick={() => setCfg({ ...JSON.parse(JSON.stringify(DEFAULT_UPGRADER)), algo: JEMLIT_ALGO, edge: 0.1 })}>
                      Jemlit Upgrader: 10% edge, Jemlit scheme
                    </button>
                    <button type="button" className="btn" onClick={() => setCfg({ ...JSON.parse(JSON.stringify(DEFAULT_UPGRADER)), mode: "deals", algo: VENDOR_ALGO, edge: 0.1, chance: 0.5, maxChance: 0.8, valueLayer: "retail", targetItemId: "s-aireau-jordan-1", population: { ...DEFAULT_UPGRADER.population, bankroll: 1000 } })}>
                      Vendor Deals: pick a chance up to 80%, no commitment, listed values
                    </button>
                    <button type="button" className="btn" onClick={() => setCfg({ ...JSON.parse(JSON.stringify(DEFAULT_UPGRADER)), rigs: { tableSwap: { hiddenRtp: 0.7 } } })}>
                      Rigged: states 10% edge, draws at 30%
                    </button>
                  </div>
                </Card>
                <Card title="Mechanic">
                  <div className="grid gap-3 md:grid-cols-3">
                    <Field label="Mode">
                      <Select<"upgrader" | "deals"> value={cfg.mode} onChange={(v) => setCfg({ ...cfg, mode: v })} options={[{ value: "upgrader", label: "Upgrader: stake for a chance" }, { value: "deals", label: "Deals: choose the chance, pay the price" }]} />
                    </Field>
                    <Field label="Target item"><Select<string> value={cfg.targetItemId} onChange={(v) => setCfg({ ...cfg, targetItemId: v })} options={targets} /></Field>
                    <Field label="Value layer" hint="The vendor prices Deals on listed values; Cases.gg on its own item prices.">
                      <Select<PriceLayer> value={cfg.valueLayer} onChange={(v) => setCfg({ ...cfg, valueLayer: v })} options={[{ value: "retail", label: "Retail (listed)" }, { value: "asking", label: "Asking" }, { value: "realized", label: "Realized" }]} />
                    </Field>
                    <Field label="Stated house edge" hint="Cases.gg discloses 10% on the Upgrader."><NumberInput value={cfg.edge} min={0} max={0.9} step={0.01} onChange={(v) => setCfg({ ...cfg, edge: v })} /></Field>
                    <Field label="Chance cap" hint="The vendor caps Deals at 80%."><NumberInput value={cfg.maxChance} min={0.01} max={0.99} step={0.01} onChange={(v) => setCfg({ ...cfg, maxChance: v })} /></Field>
                    {cfg.mode === "upgrader" ? (
                      <Field label="Stake per attempt ($)"><NumberInput value={cfg.stake} min={1} step={5} onChange={(v) => setCfg({ ...cfg, stake: Math.max(1, v) })} /></Field>
                    ) : (
                      <Field label="Chosen chance"><NumberInput value={cfg.chance} min={0.01} max={cfg.maxChance} step={0.01} onChange={(v) => setCfg({ ...cfg, chance: v })} /></Field>
                    )}
                  </div>
                </Card>
              </div>
            ),
          },
          {
            id: "run",
            label: "Agents & run",
            icon: "ph:users-three",
            content: (
              <Card title="Population (assumptions)">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Agents"><NumberInput value={P.agents} min={10} max={50000} step={100} onChange={(v) => setCfg({ ...cfg, population: { ...P, agents: v } })} /></Field>
                  <Field label="Bankroll per agent ($)"><NumberInput value={P.bankroll} min={1} step={10} onChange={(v) => setCfg({ ...cfg, population: { ...P, bankroll: v } })} /></Field>
                  <Field label="Attempts (ladder)"><NumberInput value={P.attempts} min={1} max={1000} step={1} onChange={(v) => setCfg({ ...cfg, population: { ...P, attempts: v } })} /></Field>
                  <Field label="Policy" hint="Ladder: keep trying until the target is won, the attempts run out or the bankroll is gone.">
                    <Select<"single" | "ladder"> value={P.policy} onChange={(v) => setCfg({ ...cfg, population: { ...P, policy: v } })} options={[{ value: "ladder", label: "Ladder until won or bust" }, { value: "single", label: "One attempt each" }]} />
                  </Field>
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
          { id: "algo", label: "Algorithm", icon: "ph:shield-check", content: <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} /> },
          {
            id: "rigs",
            label: "Rigs",
            icon: "ph:detective",
            badge: rigs.length ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">{rigs.length}</span> : undefined,
            content: <RigPanel lab="upgrader" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />,
          },
        ]}
      />
    </>
  );
}
