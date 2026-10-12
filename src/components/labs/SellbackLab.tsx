"use client";
import { useCallback, useEffect, useState } from "react";
import type { PriceLayer, SellbackConfig, SellbackResult } from "@/engine/types";
import { DEFAULT_SELLBACK, SELLBACK_PRESETS } from "@/lib/presets";
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
import { SellbackStage } from "../stages/SellbackStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { SellbackResults } from "../results/OtherResults";
import { Button, Card, Field, Help, NumberInput, Select, Toggle } from "../ui";
import { Icon } from "../Icon";

export function SellbackLab() {
  const [cfg, setCfg] = useState<SellbackConfig>(DEFAULT_SELLBACK);
  const [seed, setSeed] = useState(7);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "economy" });
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<SellbackConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "sellback" ? (sim.result as SellbackResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "economy" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const P = cfg.population;
  const setP = (patch: Partial<SellbackConfig["population"]>) => setCfg({ ...cfg, population: { ...P, ...patch } });
  const load = (c: SellbackConfig) => setCfg(JSON.parse(JSON.stringify(c)));

  const start = async () => {
    setSaved(false);
    const snapshot = JSON.parse(JSON.stringify(cfg)) as SellbackConfig;
    setLastCfg(snapshot);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "sellback", config: snapshot, sizes: {}, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const sizesOf = (c: SellbackConfig) => ({ agents: c.population.agents, sessions: c.population.sessions });
  const runName = () => (lastCfg ? `${lastCfg.box.name} · ${lastCfg.sellback.mode} · ${lastCfg.withdrawal.mode}` : "run");
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("sellback", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`sellback-${lastSeed}.md`, reportMarkdown(buildRun("sellback", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const options = [cfg.decision && `${cfg.decision.windowMinutes >= 1440 ? `${Math.round(cfg.decision.windowMinutes / 1440)}-day` : `${cfg.decision.windowMinutes}-min`} window`, cfg.keepFees && "keep fees", cfg.estimate && (cfg.estimate.disclosed ? "estimate" : "undisclosed estimate"), cfg.creditExpiry && "credit expires", cfg.guaranteeFloor && `floor ${money(cfg.guaranteeFloor)}`, cfg.vault?.enabled && "vault", cfg.creatorCut && "creator cut"].filter(Boolean) as string[];

  return (
    <>
      <LabFrame
        lab="sellback"
        rigCount={rigs.length}
        onSettings={openSettings}
        settingsOpen={settings.open}
        chips={[
          { label: cfg.sellback.mode === "vendor" ? `Sell-back: credit at displayed value${cfg.sellback.haircut ? ` minus ${pct(cfg.sellback.haircut, 0)}` : ""}` : `Sell-back: cash at ${cfg.sellback.layer}${cfg.sellback.haircut ? ` minus ${pct(cfg.sellback.haircut, 0)}` : ""}`, section: "economy" },
          { label: cfg.withdrawal.mode === "cash" ? "Withdraw: cash" : `Withdraw: only through items ≥ ${money(cfg.withdrawal.minWithdraw)}`, section: "economy" },
          { label: options.length ? `Options: ${options.join(", ")}` : "No operator options", section: "options", tone: options.length ? "accent" : "neutral" },
          { label: `${money(cfg.box.price)} box · RTP on ${cfg.box.valueLayer}`, section: "box" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs: honest operator", section: "rigs" },
          { label: `${num(P.agents)} agents × ${P.sessions} sessions · seed ${seed}`, section: "population", tone: "accent" },
        ]}
      >
        <SellbackStage cfg={cfg} seed={seed} onSettings={openSettings} />
        <SimulateBar
          label={`Run ${num(P.agents)} agents`}
          hint="Hold, GGR, sell-back and ship rates, ruin and bankroll percentiles for a whole population under these rules and options."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("population")}
        />
        {result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.agents)} agents · ${lastCfg.population.sessions} sessions · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <SellbackResults r={result} />
          </ResultsSection>
        )}
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title="Sell-back / Cart · settings"
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => load(DEFAULT_SELLBACK)}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset to vendor economy
            </Button>
            <span className="ml-auto" />
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={[
          {
            id: "economy",
            label: "Economy rules",
            icon: "ph:wallet",
            content: (
              <div className="space-y-4">
                <Card title="Operator presets">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.vendor)} data-tip="Credit at listed value, withdraw only through items">
                      Vendor
                    </button>
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.icybox)} data-tip="Buyback at an undisclosed estimate (70% of realized), 48-hour window then auto-sold, tax, shipping and insurance to keep">
                      IcyBox
                    </button>
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.stockx)} data-tip="Credit at 85% of list value that expires, 5-minute window then charged and shipped, tier-first box with a floor">
                      StockX
                    </button>
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.courtyard)} data-tip="Cash at 95% of fair market value, 7-day window, guaranteed-value floor, EV-priced pack, public log">
                      Courtyard
                    </button>
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.glassbox)} data-tip="Cash at realized value, withdraw freely">
                      Glass Box
                    </button>
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.casesVault)} data-tip="Vendor rules with half of every deposit locked in a vault (Cases.gg)">
                      Cases.gg vault
                    </button>
                    <button type="button" className="btn" onClick={() => load(SELLBACK_PRESETS.creator)} data-tip="Vendor rules with 5% of every box price paid to the box creator (PackDraw Forge)">
                      Creator packs
                    </button>
                  </div>
                </Card>
                <Card title="Sell-back and withdrawal rules">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field label="Sell-back mode">
                      <Select<"vendor" | "cash">
                        value={cfg.sellback.mode}
                        onChange={(m) => setCfg({ ...cfg, sellback: m === "vendor" ? { mode: "vendor", haircut: cfg.sellback.haircut } : { mode: "cash", layer: "realized", haircut: cfg.sellback.haircut } })}
                        options={[
                          { value: "vendor", label: "Vendor: credit to balance at displayed value" },
                          { value: "cash", label: "Cash paid out (leaves the system)" },
                        ]}
                      />
                    </Field>
                    {cfg.sellback.mode === "cash" && (
                      <Field label="Cash at price layer">
                        <Select<PriceLayer> value={cfg.sellback.layer} onChange={(layer) => setCfg({ ...cfg, sellback: { mode: "cash", layer, haircut: cfg.sellback.haircut } })} options={[{ value: "retail", label: "Retail" }, { value: "asking", label: "Asking" }, { value: "realized", label: "Realized" }]} />
                      </Field>
                    )}
                    <Field label="Haircut on sell-back" hint="Jemlit: 0 to 30%. StockX: 10 to 25% below list."><NumberInput value={cfg.sellback.haircut} min={0} max={0.9} step={0.01} onChange={(v) => setCfg({ ...cfg, sellback: { ...cfg.sellback, haircut: v } })} /></Field>
                    <Field label="Withdrawal rule">
                      <Select<"cash" | "through-items">
                        value={cfg.withdrawal.mode}
                        onChange={(mode) => setCfg({ ...cfg, withdrawal: { ...cfg.withdrawal, mode } })}
                        options={[
                          { value: "through-items", label: "Vendor: only through items, after wagering" },
                          { value: "cash", label: "Balance can be withdrawn as cash" },
                        ]}
                      />
                    </Field>
                    {cfg.withdrawal.mode === "through-items" && (
                      <Field label="Minimum item value to withdraw ($)"><NumberInput value={cfg.withdrawal.minWithdraw} min={0} step={10} onChange={(v) => setCfg({ ...cfg, withdrawal: { ...cfg.withdrawal, minWithdraw: v } })} /></Field>
                    )}
                    <Field label="Seed" hint="Also seeds the wallet on the test page.">
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
            id: "options",
            label: "Operator options",
            icon: "ph:sliders-horizontal",
            badge: options.length ? <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] text-white">{options.length}</span> : undefined,
            content: (
              <div className="space-y-4">
                <Card title="Decision window (IcyBox, StockX, Courtyard)">
                  <Toggle checked={!!cfg.decision} onChange={(v) => setCfg({ ...cfg, decision: v ? { windowMinutes: 2880, inattention: 0.15, autoAction: "sell" } : undefined })} label="Time-limited keep-or-sell decision" hint="IcyBox: a buyback period, then the item is automatically sold back. StockX: five minutes, then charged and shipped. Courtyard: seven days. Inattentive agents get the automatic action." />
                  {cfg.decision && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Window (minutes)"><NumberInput value={cfg.decision.windowMinutes} min={1} step={60} onChange={(v) => setCfg({ ...cfg, decision: { ...cfg.decision!, windowMinutes: Math.max(1, v) } })} /></Field>
                      <Field label="Share of agents who miss the window" hint="Assumption. Shorter windows mean more misses."><NumberInput value={cfg.decision.inattention} min={0} max={1} step={0.01} onChange={(v) => setCfg({ ...cfg, decision: { ...cfg.decision!, inattention: v } })} /></Field>
                      <Field label="Automatic action">
                        <Select<"sell" | "ship"> value={cfg.decision.autoAction} onChange={(v) => setCfg({ ...cfg, decision: { ...cfg.decision!, autoAction: v } })} options={[{ value: "sell", label: "Sold back to the operator (IcyBox)" }, { value: "ship", label: "Charged and shipped (StockX)" }]} />
                      </Field>
                    </div>
                  )}
                </Card>
                <Card title="Keep fees (IcyBox)">
                  <Toggle checked={!!cfg.keepFees} onChange={(v) => setCfg({ ...cfg, keepFees: v ? { taxRate: 0.08, shipping: 45, insuranceRate: 0.01 } : undefined })} label="Sales tax, shipping and insurance when keeping an item" hint="Fees push agents towards the buyback. An agent ships only if the item is worth the fees." />
                  {cfg.keepFees && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Sales tax rate"><NumberInput value={cfg.keepFees.taxRate} min={0} max={0.3} step={0.005} onChange={(v) => setCfg({ ...cfg, keepFees: { ...cfg.keepFees!, taxRate: v } })} /></Field>
                      <Field label="Shipping ($)"><NumberInput value={cfg.keepFees.shipping} min={0} step={5} onChange={(v) => setCfg({ ...cfg, keepFees: { ...cfg.keepFees!, shipping: v } })} /></Field>
                      <Field label="Insurance rate"><NumberInput value={cfg.keepFees.insuranceRate} min={0} max={0.1} step={0.005} onChange={(v) => setCfg({ ...cfg, keepFees: { ...cfg.keepFees!, insuranceRate: v } })} /></Field>
                    </div>
                  )}
                </Card>
                <Card title="Buyback at an operator estimate (IcyBox)">
                  <Toggle checked={!!cfg.estimate} onChange={(v) => setCfg({ ...cfg, estimate: v ? { factor: 0.7, disclosed: false } : undefined })} label="Buyback based on an estimated value the operator sets" hint="IcyBox: 'determined solely by IcyBox... we do not disclose how we calculate'. Modelled as a factor on realized value." />
                  {cfg.estimate && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Estimate as a share of realized value"><NumberInput value={cfg.estimate.factor} min={0.1} max={1.5} step={0.05} onChange={(v) => setCfg({ ...cfg, estimate: { ...cfg.estimate!, factor: v } })} /></Field>
                      <div className="pt-5">
                        <Toggle checked={cfg.estimate.disclosed} onChange={(v) => setCfg({ ...cfg, estimate: { ...cfg.estimate!, disclosed: v } })} label="Formula disclosed" />
                      </div>
                    </div>
                  )}
                </Card>
                <Card title="Credit expiry (StockX, Jemlit)">
                  <Toggle checked={!!cfg.creditExpiry} onChange={(v) => setCfg({ ...cfg, creditExpiry: v ? { sessions: 12 } : undefined })} label="Site credit expires when unused" hint="StockX credit is valid one year and not withdrawable; Jemlit credits expire after a year. Unused balance becomes operator income (breakage)." />
                  {cfg.creditExpiry && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Sessions unused before expiry"><NumberInput value={cfg.creditExpiry.sessions} min={1} max={365} step={1} onChange={(v) => setCfg({ ...cfg, creditExpiry: { sessions: Math.max(1, Math.floor(v)) } })} /></Field>
                    </div>
                  )}
                </Card>
                <Card title="Guaranteed-value floor (Courtyard)">
                  <Toggle checked={!!cfg.guaranteeFloor} onChange={(v) => setCfg({ ...cfg, guaranteeFloor: v ? 300 : undefined })} label="Buyback never below a guaranteed value" hint="Courtyard's guaranteed-value pack codes set a floor on the buyback offer." />
                  {cfg.guaranteeFloor !== undefined && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Floor ($)"><NumberInput value={cfg.guaranteeFloor} min={0} step={10} onChange={(v) => setCfg({ ...cfg, guaranteeFloor: Math.max(0, v) })} /></Field>
                    </div>
                  )}
                </Card>
                <Card title="Vault (Cases.gg)">
                  <Toggle checked={!!cfg.vault?.enabled} onChange={(v) => setCfg({ ...cfg, vault: { enabled: v, lockFraction: cfg.vault?.lockFraction ?? 0.5 } })} label="A share of each deposit is locked out of play until cash-out" hint="A self-limiting tool: it lowers wagering and ruin, and the operator's hold with it." />
                  {cfg.vault?.enabled && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Locked share of each deposit"><NumberInput value={cfg.vault.lockFraction} min={0} max={0.95} step={0.05} onChange={(v) => setCfg({ ...cfg, vault: { enabled: true, lockFraction: v } })} /></Field>
                    </div>
                  )}
                </Card>
                <Card title="Creator packs (PackDraw Forge, Cases.gg custom boxes)">
                  <Toggle checked={!!cfg.creatorCut} onChange={(v) => setCfg({ ...cfg, creatorCut: v ? 0.05 : undefined })} label="A share of each box price goes to the box creator" hint="Users build and list packs and earn a cut; the operator's GGR shrinks by that cut." />
                  {cfg.creatorCut !== undefined && (
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field label="Creator cut"><NumberInput value={cfg.creatorCut} min={0} max={0.5} step={0.01} onChange={(v) => setCfg({ ...cfg, creatorCut: Math.max(0, v) })} /></Field>
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
          {
            id: "population",
            label: "Agents (population)",
            icon: "ph:users-three",
            content: (
              <Card title="Agent population (assumptions)">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Agents"><NumberInput value={P.agents} min={10} max={50000} step={100} onChange={(v) => setP({ agents: v })} /></Field>
                  <Field label="Deposit median ($)"><NumberInput value={P.depositMean} min={1} step={10} onChange={(v) => setP({ depositMean: v })} /></Field>
                  <Field label="Deposit spread (lognormal sigma)"><NumberInput value={P.depositSpread} min={0} max={2} step={0.1} onChange={(v) => setP({ depositSpread: v })} /></Field>
                  <Field label="Lifetime deposits (budget)"><NumberInput value={P.maxDeposits} min={1} max={100} step={1} onChange={(v) => setP({ maxDeposits: v })} /></Field>
                  <Field label="Sessions"><NumberInput value={P.sessions} min={1} max={365} step={1} onChange={(v) => setP({ sessions: v })} /></Field>
                  <Field label="Opens per session (max)"><NumberInput value={P.opensPerSession} min={1} max={200} step={1} onChange={(v) => setP({ opensPerSession: v })} /></Field>
                  <Field label="Re-bet fraction of balance per session"><NumberInput value={P.rebetFraction} min={0.05} max={1} step={0.05} onChange={(v) => setP({ rebetFraction: v })} /></Field>
                  <Field label="Ship if displayed value ≥ price ×"><NumberInput value={P.shipAboveMultiple} min={1} max={100} step={0.5} onChange={(v) => setP({ shipAboveMultiple: v })} /></Field>
                  <Field label="Cash-out target (× last deposit)"><NumberInput value={P.cashOutTargetMultiple} min={1} max={100} step={0.5} onChange={(v) => setP({ cashOutTargetMultiple: v })} /></Field>
                </div>
                <Help>Agents sell back everything below the ship threshold. Vendor claims to test: 99.9% sold back, about 200 shipments a month, hold 15 to 30% of deposits.</Help>
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
            content: <RigPanel lab="sellback" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} />,
          },
        ]}
      />
    </>
  );
}
