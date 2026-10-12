"use client";
import { useCallback, useEffect, useState } from "react";
import type { BattleMode, BattlesConfig, BattlesResult, BoxDef } from "@/engine/types";
import { BATTLE_MODES } from "@/engine/labs/battles";
import { DEFAULT_BATTLES, VENDOR_BOX } from "@/lib/presets";
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
import { BattlesStage } from "../stages/BattlesStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { BattlesResults } from "../results/OtherResults";
import { Button, Card, Field, Help, NumberInput, Select, Toggle } from "../ui";
import { Icon } from "../Icon";

export function BattlesLab() {
  const [cfg, setCfg] = useState<BattlesConfig>(DEFAULT_BATTLES);
  const [sizes, setSizes] = useState<Record<string, number>>({ battles: 2000 });
  const [seed, setSeed] = useState(3);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "battle" });
  const [editBox, setEditBox] = useState(0);
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<BattlesConfig | null>(null);
  const [lastSizes, setLastSizes] = useState(sizes);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "battles" ? (sim.result as BattlesResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "battle" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as BattlesConfig;
    setLastCfg(snapshot);
    setLastSizes(sizes);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "battles", config: snapshot, sizes, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const runName = () => (lastCfg ? `${lastCfg.mode} · ${lastCfg.boxes.length} boxes · ${lastCfg.players} players` : "run");
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("battles", runName(), lastCfg, lastSizes, lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`battles-${lastSeed}.md`, reportMarkdown(buildRun("battles", runName(), lastCfg, lastSizes, lastSeed, result)), "text/markdown");
  };
  const setBox = (i: number, b: BoxDef) => setCfg({ ...cfg, boxes: cfg.boxes.map((x, k) => (k === i ? b : x)) });
  const mode = BATTLE_MODES.find((m) => m.id === cfg.mode)!;
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const bots = cfg.bots.enabled ? cfg.players - Math.min(cfg.players, cfg.humansPerBattle) : 0;

  return (
    <>
      <LabFrame
        lab="battles"
        rigCount={rigs.length}
        onSettings={openSettings}
        settingsOpen={settings.open}
        chips={[
          { label: `${mode.name} · ${cfg.players} players · ${bots} bot${bots === 1 ? "" : "s"}`, section: "battle" },
          { label: `${cfg.boxes.length} round${cfg.boxes.length === 1 ? "" : "s"} · entry ${money(cfg.boxes.reduce((a, b) => a + b.price, 0))}`, section: "boxes" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs: honest operator", section: "rigs" },
          { label: `${num(sizes.battles)} battles · seed ${seed}`, section: "battle", tone: "accent" },
        ]}
      >
        <BattlesStage cfg={cfg} seed={seed} onSettings={openSettings} />
        <SimulateBar
          label={`Run ${num(sizes.battles)} battles`}
          hint="Wager multiplier, realized house edge, human win rate against the fair expectation and the pot distribution."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("battle")}
        />
        {result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.battles)} battles · ${result.mode} · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <BattlesResults r={result} />
          </ResultsSection>
        )}
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title="Battles · settings"
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => setCfg(JSON.parse(JSON.stringify(DEFAULT_BATTLES)))}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset to vendor default
            </Button>
            <span className="ml-auto" />
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={[
          {
            id: "battle",
            label: "Battle & run",
            icon: "ph:users-three",
            content: (
              <div className="space-y-4">
                <Card title="Battle">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Mode" hint={mode.rule}>
                      <Select<BattleMode> value={cfg.mode} onChange={(m) => setCfg({ ...cfg, mode: m })} options={BATTLE_MODES.map((m) => ({ value: m.id, label: m.name }))} />
                    </Field>
                    <Field label="Players per battle (2 to 8)">
                      <NumberInput value={cfg.players} min={2} max={8} step={1} onChange={(v) => setCfg({ ...cfg, players: v, humansPerBattle: Math.min(v, cfg.humansPerBattle) })} />
                    </Field>
                    <div className="pt-1">
                      <Toggle checked={cfg.bots.enabled} onChange={(v) => setCfg({ ...cfg, bots: { enabled: v } })} label="Bots fill the empty seats" hint="The vendor: 'call the bots and basically play against the house'. Off means every seat is a human." />
                    </div>
                    <Field label="Humans per battle (the rest are bots)">
                      <NumberInput value={cfg.humansPerBattle} min={1} max={cfg.players} step={1} disabled={!cfg.bots.enabled} onChange={(v) => setCfg({ ...cfg, humansPerBattle: v })} />
                    </Field>
                  </div>
                  <Help>Entry per player is the sum of the box prices. All five modes are available; test them one at a time with the same seed to compare.</Help>
                </Card>
                <Card title="Simulation size">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Battles to simulate">
                      <NumberInput value={sizes.battles} min={10} max={200000} step={100} onChange={(v) => setSizes({ battles: Math.max(10, Math.min(200000, Math.floor(v))) })} />
                    </Field>
                    <Field label="Seed" hint="Also seeds the live battles.">
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
          {
            id: "boxes",
            label: "Boxes (rounds)",
            icon: "ph:package",
            content: (
              <Card
                title={`Boxes in the battle (${cfg.boxes.length})`}
                actions={
                  <div className="flex gap-2">
                    <Button kind="ghost" onClick={() => setCfg({ ...cfg, boxes: [...cfg.boxes, JSON.parse(JSON.stringify(VENDOR_BOX))] })} disabled={cfg.boxes.length >= 6}>
                      <Icon name="ph:plus" size={14} /> Add round
                    </Button>
                    <Button kind="ghost" onClick={() => { setCfg({ ...cfg, boxes: cfg.boxes.slice(0, -1) }); setEditBox((i) => Math.min(i, Math.max(0, cfg.boxes.length - 2))); }} disabled={cfg.boxes.length <= 1}>
                      <Icon name="ph:minus" size={14} /> Remove last
                    </Button>
                  </div>
                }
              >
                <div className="mb-3 flex flex-wrap gap-1">
                  {cfg.boxes.map((b, i) => (
                    <button key={i} type="button" onClick={() => setEditBox(i)} className={`chip ${editBox === i ? "chip-accent" : ""}`}>
                      Round {i + 1}: {b.name.split(" · ")[0]} ({money(b.price)})
                    </button>
                  ))}
                </div>
                {cfg.boxes[editBox] && <BoxBuilder box={cfg.boxes[editBox]} onChange={(b) => setBox(editBox, b)} compact />}
              </Card>
            ),
          },
          { id: "algo", label: "Algorithm", icon: "ph:shield-check", content: <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} /> },
          {
            id: "rigs",
            label: "Rigs",
            icon: "ph:detective",
            badge: rigs.length ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">{rigs.length}</span> : undefined,
            content: <RigPanel lab="battles" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />,
          },
        ]}
      />
    </>
  );
}
