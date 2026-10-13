"use client";
import { useCallback, useEffect, useState } from "react";
import type { RetentionConfig, RetentionResult } from "@/engine/types";
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
import { RetentionStage } from "../stages/RetentionStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { RetentionResults } from "../results/OtherResults";
import { Button, Card, Field, Help, NumberInput, Select, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const ALL_EXTRAS = ["missions", "freeEntry", "spendCap"];

export function RetentionLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as RetentionConfig;
  const extras = variant.retentionExtras ?? ALL_EXTRAS;
  const [cfg, setCfg] = useState<RetentionConfig>(() => clone(initial));
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
  const allowed = (id: string) => !variant.sections || variant.sections.includes(id);
  const ex = (id: string) => extras.includes(id);

  const start = async () => {
    setSaved(false);
    const snapshot = clone(cfg);
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
  const runName = () => `${operator} · ${variant.doc.title}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("retention", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`${variant.key}-${lastSeed}.md`, reportMarkdown(buildRun("retention", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const on = [cfg.dailyBox.enabled && "daily box", cfg.race.enabled && "races", cfg.affiliate.enabled && "affiliate", cfg.missions?.enabled && "missions", cfg.freeEntry?.enabled && "free route", cfg.spendCap?.enabled && "spend cap"].filter(Boolean) as string[];

  const sections: SettingsSection[] = [
    {
      id: "population",
      label: "Visitors & horizon",
      icon: "ph:users-three",
      content: (
        <Card title="Population and horizon">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Simulated visitors" hint="How many people the simulation follows day by day."><NumberInput value={cfg.agents} min={50} max={50000} step={100} onChange={(v) => setCfg({ ...cfg, agents: v })} /></Field>
            <Field label="Days to simulate" hint="The run covers this many days; retention is read at day 1, 7 and 30."><NumberInput value={cfg.days} min={7} max={365} step={1} onChange={(v) => setCfg({ ...cfg, days: v })} /></Field>
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
    {
      id: "incentives",
      label: "Incentives",
      icon: "ph:gift",
      content: (
        <Card title="Incentives">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Toggle checked={cfg.dailyBox.enabled} onChange={(v) => setCfg({ ...cfg, dailyBox: { ...cfg.dailyBox, enabled: v } })} label="Daily free box" hint="Tiered by cumulative wager." />
              <Field label="What happens to an unclaimed daily box" hint="Expires: miss a day and it is gone, which pulls people back every day (the vendor). Stacks: it waits for you.">
                <Select<"24h" | "stack"> value={cfg.dailyBox.expiry} onChange={(e) => setCfg({ ...cfg, dailyBox: { ...cfg.dailyBox, expiry: e } })} options={[{ value: "24h", label: "Expires after 24 hours" }, { value: "stack", label: "Stacks until claimed" }]} />
              </Field>
              <Field label="Daily box value by level ($)" hint="The box is worth more as the player climbs levels by wagering. Enter one value per level, separated by commas.">
                <input type="text" value={cfg.dailyBox.tierValues.join(",")} onChange={(e) => setCfg({ ...cfg, dailyBox: { ...cfg.dailyBox, tierValues: e.target.value.split(",").map((x) => Number(x.trim()) || 0) } })} />
              </Field>
            </div>
            <div className="space-y-2">
              <Toggle checked={cfg.race.enabled} onChange={(v) => setCfg({ ...cfg, race: { ...cfg.race, enabled: v } })} label="Wager races (leaderboards)" />
              <Field label="Race length (days)" hint="How often the leaderboard pays out and resets."><NumberInput value={cfg.race.cadenceDays} min={1} max={30} step={1} onChange={(v) => setCfg({ ...cfg, race: { ...cfg.race, cadenceDays: v } })} /></Field>
              <Field label="Race prizes ($, biggest first)" hint="Paid to the top wagerers at the end of each race.">
                <input type="text" value={cfg.race.prizes.join(",")} onChange={(e) => setCfg({ ...cfg, race: { ...cfg.race, prizes: e.target.value.split(",").map((x) => Number(x.trim()) || 0) } })} />
              </Field>
            </div>
            <div className="space-y-2">
              <Toggle checked={cfg.affiliate.enabled} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, enabled: v } })} label="Affiliate / invite a friend" />
              <Field label="Share who arrive through an invite code" hint="0.2 means one visitor in five came through a friend&apos;s link."><NumberInput value={cfg.affiliate.referredShare} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, referredShare: v } })} /></Field>
              <Field label="Free boxes for an invited visitor" hint="Given on arrival. Their value is a bonus cost."><NumberInput value={cfg.affiliate.freeBoxes} min={0} max={10} step={1} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, freeBoxes: v } })} /></Field>
              <Field label="Commission paid to the inviter" hint="0.05 means 5% of everything the invited visitor deposits goes to the person who invited them."><NumberInput value={cfg.affiliate.commission} min={0} max={0.5} step={0.01} onChange={(v) => setCfg({ ...cfg, affiliate: { ...cfg.affiliate, commission: v } })} /></Field>
            </div>
          </div>
        </Card>
      ),
    },
    {
      id: "more",
      label: extras.length === 1 ? (ex("missions") ? "Missions" : ex("freeEntry") ? "Free route" : "Spend cap") : "Missions, free route, cap",
      icon: "ph:sliders-horizontal",
      content: (
        <div className="space-y-4">
          {ex("missions") && (
            <Card title="Missions">
              <Toggle checked={!!cfg.missions?.enabled} onChange={(v) => setCfg({ ...cfg, missions: { enabled: v, wagerTarget: cfg.missions?.wagerTarget ?? 100, reward: cfg.missions?.reward ?? 5 } })} label="Daily wager target with a reward" hint="Pays a bonus for reaching a wager target in a day, which pays for volume like a race does." />
              {cfg.missions?.enabled && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Daily wager target ($)" hint="Bet this much in a day and the mission pays out."><NumberInput value={cfg.missions.wagerTarget} min={1} step={10} onChange={(v) => setCfg({ ...cfg, missions: { ...cfg.missions!, wagerTarget: v } })} /></Field>
                  <Field label="Mission reward ($)" hint="Added to balance when the target is reached. A bonus cost."><NumberInput value={cfg.missions.reward} min={0} step={1} onChange={(v) => setCfg({ ...cfg, missions: { ...cfg.missions!, reward: v } })} /></Field>
                </div>
              )}
            </Card>
          )}
          {ex("freeEntry") && (
            <Card title="Free entry route">
              <Toggle checked={!!cfg.freeEntry?.enabled} onChange={(v) => setCfg({ ...cfg, freeEntry: { enabled: v, share: cfg.freeEntry?.share ?? 0.1 } })} label="A share of visitors never deposit and get one free open per visit at equal odds" hint="The no-purchase route a sweepstakes needs. The cost is the value of what free entrants win." />
              {cfg.freeEntry?.enabled && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Share who play the free route" hint="They never deposit and get one free open per visit at the same odds. What they win is a cost."><NumberInput value={cfg.freeEntry.share} min={0} max={1} step={0.01} onChange={(v) => setCfg({ ...cfg, freeEntry: { enabled: true, share: v } })} /></Field>
                </div>
              )}
            </Card>
          )}
          {ex("spendCap") && (
            <Card title="Spend cap">
              <Toggle checked={!!cfg.spendCap?.enabled} onChange={(v) => setCfg({ ...cfg, spendCap: { enabled: v, perDay: cfg.spendCap?.perDay ?? 50 } })} label="Daily deposit cap per visitor" hint="Deposits above the cap are refused. The lab reports what it costs the operator." />
              {cfg.spendCap?.enabled && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Deposit cap per day ($)" hint="No visitor can deposit more than this in a day."><NumberInput value={cfg.spendCap.perDay} min={1} step={5} onChange={(v) => setCfg({ ...cfg, spendCap: { enabled: true, perDay: v } })} /></Field>
                </div>
              )}
            </Card>
          )}
        </div>
      ),
    },
    {
      id: "visitor",
      label: "Visitor model",
      icon: "ph:user",
      content: (
        <Card title="Visitor model (assumptions, labelled)">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Chance of visiting on any day" hint="0.3 means a visitor shows up on three days in ten, before any incentive."><NumberInput value={V.baseVisit} min={0} max={1} step={0.05} onChange={(v) => setV({ baseVisit: v })} /></Field>
            <Field label="Extra chance when a free box is waiting" hint="Added to the daily chance of visiting. 0.2 means twenty points more likely."><NumberInput value={V.incentiveLift} min={0} max={1} step={0.05} onChange={(v) => setV({ incentiveLift: v })} /></Field>
            <Field label="Extra chance when near the top of a race" hint="Added to the daily chance of visiting for people in the running for a prize."><NumberInput value={V.raceLift} min={0} max={1} step={0.05} onChange={(v) => setV({ raceLift: v })} /></Field>
            <Field label="Chance of quitting after a losing day" hint="0.05 means one visitor in twenty leaves for good after a day they lost money."><NumberInput value={V.churnHazard} min={0} max={1} step={0.01} onChange={(v) => setV({ churnHazard: v })} /></Field>
            <Field label="Deposit per visit ($)" hint="What a visitor puts in on each visit."><NumberInput value={V.depositPerVisit} min={0} step={5} onChange={(v) => setV({ depositPerVisit: v })} /></Field>
            <Field label="Opens per visit" hint="How many boxes a visitor opens each time, money permitting."><NumberInput value={V.opensPerVisit} min={0} max={50} step={1} onChange={(v) => setV({ opensPerVisit: v })} /></Field>
          </div>
          <Help>A control run with all incentives off uses the same seed; the difference is the incentives&apos; effect. None of these numbers come from data yet.</Help>
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
      content: <RigPanel lab="retention" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} allow={variant.rigIds} />,
    },
  ].filter((s) => allowed(s.id) && (s.id !== "more" || extras.length > 0));

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
          { label: on.length ? `On: ${on.join(", ")}` : "No incentives on", section: "incentives" },
          { label: `Visitor model: ${Math.round(V.baseVisit * 100)}% base visit · ${Math.round(V.churnHazard * 100)}% churn after a loss`, section: "visitor" },
          { label: `${money(cfg.box.price)} box`, section: "box" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs", section: "rigs" },
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
