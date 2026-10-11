"use client";
import { useState } from "react";
import type { BattleMode, BattlesConfig, BattlesResult, BoxDef } from "@/engine/types";
import { BATTLE_MODES } from "@/engine/labs/battles";
import { DEFAULT_BATTLES, VENDOR_BOX } from "@/lib/presets";
import { useRun } from "@/lib/useRun";
import { persistRun } from "@/lib/runs";
import { LabShell } from "../LabShell";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { RunControls } from "../RunControls";
import { BattlesResults } from "../results/OtherResults";
import { Button, Card, Field, Help, NumberInput, Select, Toggle } from "../ui";

export function BattlesLab() {
  const [cfg, setCfg] = useState<BattlesConfig>(DEFAULT_BATTLES);
  const [sizes, setSizes] = useState<Record<string, number>>({ battles: 2000 });
  const [seed, setSeed] = useState(3);
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<BattlesConfig | null>(null);
  const [editBox, setEditBox] = useState(0);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "battles" ? (sim.result as BattlesResult) : null;

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as BattlesConfig;
    setLastCfg(snapshot);
    try {
      await sim.run({ lab: "battles", config: snapshot, sizes, seed });
    } catch {
      /* status */
    }
  };
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("battles", `${lastCfg.mode} · ${lastCfg.boxes.length} boxes · ${lastCfg.players} players`, lastCfg, sizes, seed, result);
    setSaved(true);
  };
  const setBox = (i: number, b: BoxDef) => setCfg({ ...cfg, boxes: cfg.boxes.map((x, k) => (k === i ? b : x)) });
  const mode = BATTLE_MODES.find((m) => m.id === cfg.mode)!;

  return (
    <LabShell
      lab="battles"
      hasResults={!!result}
      configure={
        <>
          <Card title="Battle">
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Mode" hint={mode.rule}>
                <Select<BattleMode> value={cfg.mode} onChange={(m) => setCfg({ ...cfg, mode: m })} options={BATTLE_MODES.map((m) => ({ value: m.id, label: m.name }))} />
              </Field>
              <Field label="Players per battle"><NumberInput value={cfg.players} min={2} max={8} step={1} onChange={(v) => setCfg({ ...cfg, players: v, humansPerBattle: Math.min(v, cfg.humansPerBattle) })} /></Field>
              <Field label="Humans per battle (rest are bots)"><NumberInput value={cfg.humansPerBattle} min={1} max={cfg.players} step={1} disabled={!cfg.bots.enabled} onChange={(v) => setCfg({ ...cfg, humansPerBattle: v })} /></Field>
              <div className="pt-5">
                <Toggle checked={cfg.bots.enabled} onChange={(v) => setCfg({ ...cfg, bots: { enabled: v } })} label="Bots fill empty seats" hint="The vendor: 'call the bots and basically play against the house'." />
              </div>
            </div>
            <Help>Entry per player is the sum of the box prices. All modes are available; test them one at a time with the same seed to compare.</Help>
          </Card>
          <Card
            title={`Boxes in the battle (${cfg.boxes.length})`}
            actions={
              <div className="flex gap-2">
                <Button kind="ghost" onClick={() => setCfg({ ...cfg, boxes: [...cfg.boxes, JSON.parse(JSON.stringify(VENDOR_BOX))] })} disabled={cfg.boxes.length >= 6}>
                  Add box
                </Button>
                <Button kind="ghost" onClick={() => setCfg({ ...cfg, boxes: cfg.boxes.slice(0, -1) })} disabled={cfg.boxes.length <= 1}>
                  Remove last
                </Button>
              </div>
            }
          >
            <div className="mb-3 flex flex-wrap gap-1">
              {cfg.boxes.map((b, i) => (
                <button key={i} type="button" onClick={() => setEditBox(i)} className={`rounded-lg border px-3 py-1 text-xs ${editBox === i ? "border-accent bg-accent-soft text-accent-ink" : "border-line"}`}>
                  Round {i + 1}: {b.name} (${b.price})
                </button>
              ))}
            </div>
            {cfg.boxes[editBox] && <BoxBuilder box={cfg.boxes[editBox]} onChange={(b) => setBox(editBox, b)} compact />}
          </Card>
          <AlgoPanel algo={cfg.algo} onChange={(algo) => setCfg({ ...cfg, algo })} />
          <RigPanel lab="battles" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />
        </>
      }
      run={
        <RunControls sizes={sizes} sizeDefs={[{ key: "battles", label: "Battles", min: 10, max: 200000, step: 100 }]} onSizes={setSizes} seed={seed} onSeed={setSeed} status={sim.status} progress={sim.progress} elapsed={sim.elapsed} onRun={start} onCancel={sim.cancel} onSave={save} saved={saved} warning={sim.error ?? undefined} />
      }
      results={result ? <BattlesResults r={result} /> : null}
    />
  );
}
