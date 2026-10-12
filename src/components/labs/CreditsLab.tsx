"use client";
import { useCallback, useEffect, useState } from "react";
import type { CreditsConfig, CreditsResult } from "@/engine/types";
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
import { CreditsStage } from "../stages/CreditsStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { CreditsResults } from "../results/MoreResults";
import { Button, Card, Field, NumberInput, Select, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function CreditsLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as CreditsConfig;
  const presets = (variant.presets ?? []) as { id: string; name: string; config: CreditsConfig }[];
  const [cfg, setCfg] = useState<CreditsConfig>(() => clone(initial));
  const [seed, setSeed] = useState(5);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "raffle" });
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<CreditsConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "credits" ? (sim.result as CreditsResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "raffle" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const R = cfg.raffle;
  const setR = (patch: Partial<CreditsConfig["raffle"]>) => setCfg({ ...cfg, raffle: { ...R, ...patch } });
  const allowed = (id: string) => !variant.sections || variant.sections.includes(id);

  const start = async () => {
    setSaved(false);
    const snapshot = clone(cfg);
    setLastCfg(snapshot);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "credits", config: snapshot, sizes: {}, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const sizesOf = (c: CreditsConfig) => ({ agents: c.population.agents, opensPerAgent: c.population.opensPerAgent });
  const runName = () => `${operator} · ${variant.doc.title}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("credits", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`${variant.key}-${lastSeed}.md`, reportMarkdown(buildRun("credits", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const prizeOptions = CATALOG.filter((c) => c.realized >= 100).map((c) => ({ value: c.id, label: `${c.brand} ${c.name} (${money(c.realized)})${c.source === "captured" ? ` · ${c.operator}` : ""}` }));

  const sections: SettingsSection[] = [
    {
      id: "raffle",
      label: "The draw",
      icon: "ph:ticket",
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
          <Card title="Draw rules">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Ticket pool" hint="Numbers in one draw."><NumberInput value={R.ticketPool} min={100} step={1000} onChange={(v) => setR({ ticketPool: Math.max(100, Math.floor(v)) })} /></Field>
              <Field label="Credit face value ($)" hint="What one credit is presented as being worth."><NumberInput value={R.ticketFace} min={0.01} step={0.05} onChange={(v) => setR({ ticketFace: Math.max(0.01, v) })} /></Field>
              <Field label="Prize of the draw" hint="One winner per draw takes this item. Its real value divided by the pool is what one ticket is really worth."><Select<string> value={R.prizeItemId} onChange={(v) => setR({ prizeItemId: v })} options={prizeOptions} /></Field>
              <Field label="Draw rule" hint="On the date regardless of sell-through (unsold numbers redrawn among sold ones), or when the pool sells out.">
                <Select<"when-sold-out" | "on-schedule"> value={R.drawRule} onChange={(v) => setR({ drawRule: v })} options={[{ value: "on-schedule", label: "On the date, regardless of sell-through" }, { value: "when-sold-out", label: "When the pool sells out" }]} />
              </Field>
              {R.drawRule === "on-schedule" && (
                <Field label="Paid opens between draws" hint="Stands in for the calendar: how many paid opens happen before the draw date."><NumberInput value={R.scheduleEvery} min={10} step={100} onChange={(v) => setR({ scheduleEvery: Math.max(10, Math.floor(v)) })} /></Field>
              )}
              <Field label="Free entries per paid ticket" hint="The free route with equal odds."><NumberInput value={R.freeEntryShare} min={0} max={5} step={0.01} onChange={(v) => setR({ freeEntryShare: Math.max(0, v) })} /></Field>
              <Field label="Spend cap per player ($, 0 = none)" hint="Omaze-style: nobody can spend more than this on tickets. Opens above the cap are refused."><NumberInput value={R.monthlyCap} min={0} step={10} onChange={(v) => setR({ monthlyCap: Math.max(0, v) })} /></Field>
              <div className="pt-5">
                <Toggle checked={R.disclosedEv} onChange={(v) => setR({ disclosedEv: v })} label="Disclose the expected value of a ticket" hint="Show prize ÷ pool next to the face value." />
              </div>
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
        <Card title="Population">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Simulated players" hint="How many players open boxes and enter the draws."><NumberInput value={cfg.population.agents} min={10} max={50000} step={100} onChange={(v) => setCfg({ ...cfg, population: { ...cfg.population, agents: v } })} /></Field>
            <Field label="Opens per player" hint="How many boxes each player opens over the run."><NumberInput value={cfg.population.opensPerAgent} min={1} max={500} step={1} onChange={(v) => setCfg({ ...cfg, population: { ...cfg.population, opensPerAgent: v } })} /></Field>
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
    { id: "box", label: "Box & items", icon: "ph:package", content: <BoxBuilder box={cfg.box} onChange={(box) => setCfg({ ...cfg, box })} lockModel={variant.lockModel} lockItems={variant.lockItems} /> },
    { id: "algo", label: "Algorithm", icon: "ph:shield-check", content: <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} /> },
    {
      id: "rigs",
      label: "Rigs",
      icon: "ph:detective",
      badge: rigs.length ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">{rigs.length}</span> : undefined,
      content: <RigPanel lab="credits" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} allow={variant.rigIds} />,
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
        chips={[
          { label: `${money(cfg.box.price)} box · ${cfg.box.items.length} items`, section: "box" },
          { label: `${num(R.ticketPool)} tickets · face ${money(R.ticketFace)} · ${R.drawRule === "when-sold-out" ? "draw when sold out" : `draw every ${num(R.scheduleEvery)} opens`}`, section: "raffle" },
          { label: `free entries ${pct(R.freeEntryShare, 0)}${R.monthlyCap ? ` · cap ${money(R.monthlyCap)}` : ""}${R.disclosedEv ? " · EV disclosed" : ""}`, section: "raffle" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs", section: "rigs" },
          { label: `${num(cfg.population.agents)} agents × ${cfg.population.opensPerAgent} opens · seed ${seed}`, section: "run", tone: "accent" },
        ]}
      >
        <CreditsStage cfg={cfg} seed={seed} onSettings={openSettings} />
        <SimulateBar
          label={`Run ${num(cfg.population.agents)} agents`}
          hint="Both stages for the whole population: nominal return with credits at face, end-to-end return with the draw, the real value of a credit, prizes to free entrants, hold."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("run")}
        />
        {result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.opens)} opens · ${result.raffles} draws · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <CreditsResults r={result} />
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
