"use client";
import { useCallback, useState } from "react";
import type { JemlitConfig } from "@/engine/types";
import { CRASH_DEFAULT, MINES_DEFAULT, UPGRADER_DEFAULT, type CrashSettings, type MinesSettings, type UpgraderSettings } from "@/engine/labs/jemlitGames";
import type { FeatureDef } from "@/lib/operators";
import { pct } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { JemlitBattlesStage, JemlitCrashStage, JemlitMinesStage, JemlitUpgraderStage } from "../stages/JemlitGameStages";
import { Button, Card, Field, NumberInput, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export function JemlitGamesLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const game = variant.key.replace("jemlit-", "").replace("-live", "") as "battles" | "upgrader" | "mines" | "crash";
  const [cfg, setCfg] = useState<JemlitConfig>(() => clone(variant.initial as JemlitConfig));
  const [mines, setMines] = useState<MinesSettings>(MINES_DEFAULT);
  const [crash, setCrash] = useState<CrashSettings>(CRASH_DEFAULT);
  const [upg, setUpg] = useState<UpgraderSettings>(UPGRADER_DEFAULT);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "rules" });
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "rules" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);

  const sections: SettingsSection[] = [
    {
      id: "rules",
      label: "Rules (back office)",
      icon: "ph:sliders-horizontal",
      content: (
        <div className="space-y-4">
          {game === "mines" && (
            <Card title="Mines">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Tiles" hint="Jemlit offers grid layouts from the server; 25 (5×5) is the usual one.">
                  <NumberInput value={mines.totalTiles} min={9} max={100} step={1} onChange={(v) => setMines({ ...mines, totalTiles: Math.max(9, Math.round(v)) })} />
                </Field>
                <Field label="House edge" hint="Applied to every multiplier. Jemlit's value is set by the server and was not visible; 0.08 (the Crash edge) is the placeholder.">
                  <NumberInput value={mines.houseEdge} min={0} max={0.5} step={0.01} onChange={(v) => setMines({ ...mines, houseEdge: Math.max(0, v) })} />
                </Field>
                <Field label="Max win (Credits)">
                  <NumberInput value={mines.maxWinnable} min={1} step={1000} onChange={(v) => setMines({ ...mines, maxWinnable: Math.max(1, v) })} />
                </Field>
              </div>
            </Card>
          )}
          {game === "crash" && (
            <Card title="Crash">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="House edge" hint="crash_house_edge in Jemlit's page settings: 0.08.">
                  <NumberInput value={crash.houseEdge} min={0} max={0.5} step={0.01} onChange={(v) => setCrash({ ...crash, houseEdge: Math.max(0, v) })} />
                </Field>
                <Field label="Max multiplier" hint="crash_max_multiplier: 1,000,000.">
                  <NumberInput value={crash.maxMultiplier} min={2} step={1000} onChange={(v) => setCrash({ ...crash, maxMultiplier: Math.max(2, v) })} />
                </Field>
                <Field label="Max win (Credits)" hint="crash_max_winnable: 250,000.">
                  <NumberInput value={crash.maxWinnable} min={1} step={1000} onChange={(v) => setCrash({ ...crash, maxWinnable: Math.max(1, v) })} />
                </Field>
              </div>
            </Card>
          )}
          {game === "upgrader" && (
            <Card title="Upgrader">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Fee" hint="upgrader_fee in Jemlit's page settings: 0.15. The chance selector is capped at 1 − fee.">
                  <NumberInput value={upg.fee} min={0} max={0.9} step={0.01} onChange={(v) => setUpg({ ...upg, fee: Math.max(0, v) })} />
                </Field>
                <Field label="Chance options" hint="upgrader_chances_options: 1%, 10%, 25%, 50%, 75%, 92% (the last is clipped to the cap).">
                  <div className="text-sm text-ink-2">{upg.chanceOptions.map((o) => pct(o, 0)).join(", ")}</div>
                </Field>
              </div>
            </Card>
          )}
          {game === "battles" && (
            <Card title="Battles">
              <p className="text-sm text-ink-2">Battles use the box&apos;s own table and the same 20% hold. Players, teams, rounds and style are chosen on the page. Timing from Jemlit&apos;s settings: 5 seconds between turns, 2 in fast mode, 3 before the start.</p>
              <div className="mt-3">
                <Toggle checked={cfg.provablyFair} onChange={(v) => setCfg({ ...cfg, provablyFair: v })} label="Commit the server seed before the battle" hint="On: Jemlit's recipe. Off: plain random." />
              </div>
            </Card>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <LabFrame doc={variant.doc} featureKey={variant.key} lab={variant.lab} operator={operator} rigCount={0} onSettings={openSettings} settingsOpen={settings.open} chips={[]}>
        {game === "battles" && <JemlitBattlesStage cfg={cfg} onChange={setCfg} />}
        {game === "upgrader" && <JemlitUpgraderStage cfg={cfg} settings={upg} />}
        {game === "mines" && <JemlitMinesStage settings={mines} />}
        {game === "crash" && <JemlitCrashStage settings={crash} />}
      </LabFrame>
      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title={`${operator} · ${variant.doc.title} · back office`}
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button
              kind="ghost"
              onClick={() => {
                setMines(MINES_DEFAULT);
                setCrash(CRASH_DEFAULT);
                setUpg(UPGRADER_DEFAULT);
                setCfg(clone(variant.initial as JemlitConfig));
              }}
            >
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
