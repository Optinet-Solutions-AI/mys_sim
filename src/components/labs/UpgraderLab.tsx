"use client";
import { useCallback, useEffect, useState } from "react";
import type { PriceLayer, UpgraderConfig, UpgraderResult } from "@/engine/types";
import { CATALOG } from "@/engine/catalog";
import type { FeatureDef } from "@/lib/operators";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { activeRigNames, algoLabel } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { SimulateBar } from "../lab/SimulateBar";
import { ResultsSection } from "../lab/ResultsSection";
import { UpgraderStage } from "../stages/UpgraderStage";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { UpgraderResults } from "../results/MoreResults";
import { Button, Card, Field, NumberInput, Select } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function UpgraderLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as UpgraderConfig;
  const presets = (variant.presets ?? []) as { id: string; name: string; config: UpgraderConfig }[];
  const [cfg, setCfg] = useState<UpgraderConfig>(() => clone(initial));
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
  const allowed = (id: string) => !variant.sections || variant.sections.includes(id);

  const start = async () => {
    setSaved(false);
    const snapshot = clone(cfg);
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
  const runName = () => `${operator} · ${variant.doc.title}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("upgrader", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`${variant.key}-${lastSeed}.md`, reportMarkdown(buildRun("upgrader", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const targets = CATALOG.filter((c) => c.source !== "captured" && c.realized >= 50).map((c) => ({ value: c.id, label: `${c.brand} ${c.name} (${money(c.realized)})` }));
  const upg = cfg.mode === "upgrader";

  const sections: SettingsSection[] = [
    {
      id: "terms",
      label: "Terms",
      icon: "ph:arrow-up-right",
      content: (
        <div className="space-y-4">
          {presets.length > 1 && (
            <Card title={`${operator} presets`}>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => (
                  <button key={p.id} type="button" className="btn" onClick={() => setCfg(clone(p.config))}>
                    {p.name}
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Card title="Mechanic">
            <div className="grid gap-3 md:grid-cols-3">
              {!variant.lockMode && (
                <Field label="Which side of the mechanic" hint="Upgrader: you choose the stake and the site tells you the chance. Deals: you choose the chance and the site tells you the price. Same maths either way.">
                  <Select<"upgrader" | "deals"> value={cfg.mode} onChange={(v) => setCfg({ ...cfg, mode: v })} options={[{ value: "upgrader", label: "Upgrader: stake for a chance" }, { value: "deals", label: "Deals: choose the chance, pay the price" }]} />
                </Field>
              )}
              <Field label="Item to win" hint="The prize of the attempt. Its value sets the chance for a given stake, or the price for a given chance."><Select<string> value={cfg.targetItemId} onChange={(v) => setCfg({ ...cfg, targetItemId: v })} options={targets} /></Field>
              <Field label="Value layer" hint="Which price the item is valued at for the odds.">
                <Select<PriceLayer> value={cfg.valueLayer} onChange={(v) => setCfg({ ...cfg, valueLayer: v })} options={[{ value: "retail", label: "Retail (listed)" }, { value: "asking", label: "Asking" }, { value: "realized", label: "Realized" }]} />
              </Field>
              <Field label="House cut the site states" hint="0.1 means the site keeps 10% on average: a fair 50% chance is sold as 45%, or priced as if the item were 11% dearer. Cases.gg discloses 10%."><NumberInput value={cfg.edge} min={0} max={0.9} step={0.01} onChange={(v) => setCfg({ ...cfg, edge: v })} /></Field>
              <Field label="Highest chance allowed" hint="The vendor caps Deals at 80%; nobody can buy a near-certain win."><NumberInput value={cfg.maxChance} min={0.01} max={0.99} step={0.01} onChange={(v) => setCfg({ ...cfg, maxChance: v })} /></Field>
              {upg ? (
                <Field label="Stake per attempt ($)" hint="What one try costs in Upgrader mode. The chance is the stake divided by the item value, less the house cut."><NumberInput value={cfg.stake} min={1} step={5} onChange={(v) => setCfg({ ...cfg, stake: Math.max(1, v) })} /></Field>
              ) : (
                <Field label="Chance you choose" hint="In Deals mode, 0.5 means a 50% chance; the price follows."><NumberInput value={cfg.chance} min={0.01} max={cfg.maxChance} step={0.01} onChange={(v) => setCfg({ ...cfg, chance: v })} /></Field>
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
            <Field label="Simulated players" hint="How many players try their luck."><NumberInput value={P.agents} min={10} max={50000} step={100} onChange={(v) => setCfg({ ...cfg, population: { ...P, agents: v } })} /></Field>
            <Field label="Money each player starts with ($)" hint="When it is gone the player is bust."><NumberInput value={P.bankroll} min={1} step={10} onChange={(v) => setCfg({ ...cfg, population: { ...P, bankroll: v } })} /></Field>
            <Field label="Most attempts per player" hint="On the ladder policy a player keeps trying up to this many times, or until they win or go bust."><NumberInput value={P.attempts} min={1} max={1000} step={1} onChange={(v) => setCfg({ ...cfg, population: { ...P, attempts: v } })} /></Field>
            <Field label="Policy" hint="Ladder: keep trying until the target is won, the attempts run out or the bankroll is gone.">
              <Select<"single" | "ladder"> value={P.policy} onChange={(v) => setCfg({ ...cfg, population: { ...P, policy: v } })} options={[{ value: "ladder", label: "Ladder until won or bust" }, { value: "single", label: "One attempt each" }]} />
            </Field>
            <Field label="Seed" hint="A number that makes the run repeatable: same settings and seed, same results. Not a casino seed.">
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
      content: <RigPanel lab="upgrader" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} allow={variant.rigIds} />,
    },
  ].filter((s) => allowed(s.id));

  return (
    <>
      <LabFrame
        doc={variant.doc}
        featureKey={variant.key}
        lab={variant.lab}
        operator={operator}
        rigCount={rigs.length}
        onSettings={openSettings}
        settingsOpen={settings.open}
        chips={variant.minimal ? [] : [
          { label: upg ? `Upgrader · stake ${money(cfg.stake)}` : `Deals · chance ${pct(Math.min(cfg.maxChance, cfg.chance), 0)} (cap ${pct(cfg.maxChance, 0)})`, section: "terms" },
          { label: `stated edge ${pct(cfg.edge)} · value at ${cfg.valueLayer}`, section: "terms" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs", section: "rigs" },
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
        title={`${operator} · ${variant.doc.title} · settings`}
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => setCfg(clone(initial))}>
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
