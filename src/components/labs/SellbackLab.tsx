"use client";
import { useCallback, useEffect, useState } from "react";
import type { PriceLayer, SellbackConfig, SellbackResult } from "@/engine/types";
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
import { SellbackStage } from "../stages/SellbackStage";
import { BoxBuilder } from "../config/BoxBuilder";
import { AlgoPanel } from "../config/AlgoPanel";
import { RigPanel } from "../config/RigPanel";
import { SellbackResults } from "../results/OtherResults";
import { Button, Card, Field, Help, NumberInput, Select, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const ALL_OPTIONS = ["decision", "keepFees", "estimate", "creditExpiry", "guaranteeFloor", "vault", "creatorCut"];

export function SellbackLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as SellbackConfig;
  const presets = (variant.presets ?? []) as { id: string; name: string; config: SellbackConfig }[];
  const optionIds = variant.sellbackOptions ?? ALL_OPTIONS;
  const [cfg, setCfg] = useState<SellbackConfig>(() => clone(initial));
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
  const allowed = (id: string) => !variant.sections || variant.sections.includes(id);
  const opt = (id: string) => optionIds.includes(id);

  const start = async () => {
    setSaved(false);
    const snapshot = clone(cfg);
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
  const runName = () => `${operator} · ${variant.doc.title}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("sellback", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`${variant.key}-${lastSeed}.md`, reportMarkdown(buildRun("sellback", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const rigs = activeRigNames(cfg.rigs);
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const options = [cfg.decision && `${cfg.decision.windowMinutes >= 1440 ? `${Math.round(cfg.decision.windowMinutes / 1440)}-day` : `${cfg.decision.windowMinutes}-min`} window`, cfg.keepFees && "keep fees", cfg.estimate && (cfg.estimate.disclosed ? "estimate" : "undisclosed estimate"), cfg.creditExpiry && "credit expires", cfg.guaranteeFloor && `floor ${money(cfg.guaranteeFloor)}`, cfg.vault?.enabled && "vault", cfg.creatorCut && "creator cut"].filter(Boolean) as string[];

  const sections: SettingsSection[] = [
    {
      id: "economy",
      label: "Economy rules",
      icon: "ph:wallet",
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
          <Card title="Sell-back and withdrawal rules">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="What happens when an item is sold back" hint="Credit: the item becomes site balance at its shown value and stays inside the system (the vendor, Jemlit, StockX). Cash: the player is paid out and the money leaves (Courtyard, the Glass Box).">
                <Select<"vendor" | "cash">
                  value={cfg.sellback.mode}
                  onChange={(m) => setCfg({ ...cfg, sellback: m === "vendor" ? { mode: "vendor", haircut: cfg.sellback.haircut } : { mode: "cash", layer: "realized", haircut: cfg.sellback.haircut } })}
                  options={[
                    { value: "vendor", label: "Credit to balance at displayed value" },
                    { value: "cash", label: "Cash paid out (leaves the system)" },
                  ]}
                />
              </Field>
              {cfg.sellback.mode === "cash" && (
                <Field label="Cash paid at which price" hint="Retail is the boutique price, asking the reseller listing, realized what the item actually sells for. Paying at realized is honest; paying at retail would lose money.">
                  <Select<PriceLayer> value={cfg.sellback.layer} onChange={(layer) => setCfg({ ...cfg, sellback: { mode: "cash", layer, haircut: cfg.sellback.haircut } })} options={[{ value: "retail", label: "Retail" }, { value: "asking", label: "Asking" }, { value: "realized", label: "Realized" }]} />
                </Field>
              )}
              <Field label="Cut the site takes on a sell-back" hint="0.15 means the player gets 85% of the value. Jemlit takes 0 to 30%; StockX pays 75 to 90% of list."><NumberInput value={cfg.sellback.haircut} min={0} max={0.9} step={0.01} onChange={(v) => setCfg({ ...cfg, sellback: { ...cfg.sellback, haircut: v } })} /></Field>
              <Field label="Can balance be withdrawn?" hint="Cash: yes, at any time. Only through items: balance can never be withdrawn; the player must win an item worth enough and ship it. The vendor&apos;s default.">
                <Select<"cash" | "through-items">
                  value={cfg.withdrawal.mode}
                  onChange={(mode) => setCfg({ ...cfg, withdrawal: { ...cfg.withdrawal, mode } })}
                  options={[
                    { value: "through-items", label: "Only through items, after wagering" },
                    { value: "cash", label: "Balance can be withdrawn as cash" },
                  ]}
                />
              </Field>
              {cfg.withdrawal.mode === "through-items" && (
                <Field label="Smallest item that can be withdrawn ($)" hint="Under the through-items rule, items below this value cannot be used to get money out."><NumberInput value={cfg.withdrawal.minWithdraw} min={0} step={10} onChange={(v) => setCfg({ ...cfg, withdrawal: { ...cfg.withdrawal, minWithdraw: v } })} /></Field>
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
      label: `${operator} options`,
      icon: "ph:sliders-horizontal",
      badge: options.length ? <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] text-white">{options.length}</span> : undefined,
      content: (
        <div className="space-y-4">
          {opt("decision") && (
            <Card title="Decision window">
              <Toggle checked={!!cfg.decision} onChange={(v) => setCfg({ ...cfg, decision: v ? { windowMinutes: 2880, inattention: 0.15, autoAction: "sell" } : undefined })} label="Time-limited keep-or-sell decision" hint="After the window the automatic action applies. Inattentive agents get it." />
              {cfg.decision && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Time to decide (minutes)" hint="How long the player has to keep or sell before the automatic action applies. IcyBox: a buyback period of days. StockX: five minutes. Courtyard: seven days."><NumberInput value={cfg.decision.windowMinutes} min={1} step={60} onChange={(v) => setCfg({ ...cfg, decision: { ...cfg.decision!, windowMinutes: Math.max(1, v) } })} /></Field>
                  <Field label="Share of agents who miss the window" hint="Assumption. Shorter windows mean more misses."><NumberInput value={cfg.decision.inattention} min={0} max={1} step={0.01} onChange={(v) => setCfg({ ...cfg, decision: { ...cfg.decision!, inattention: v } })} /></Field>
                  <Field label="What happens if they miss it" hint="Sold back to the operator (IcyBox) or charged and shipped (StockX).">
                    <Select<"sell" | "ship"> value={cfg.decision.autoAction} onChange={(v) => setCfg({ ...cfg, decision: { ...cfg.decision!, autoAction: v } })} options={[{ value: "sell", label: "Sold back to the operator" }, { value: "ship", label: "Charged and shipped" }]} />
                  </Field>
                </div>
              )}
            </Card>
          )}
          {opt("keepFees") && (
            <Card title="Keep fees">
              <Toggle checked={!!cfg.keepFees} onChange={(v) => setCfg({ ...cfg, keepFees: v ? { taxRate: 0.08, shipping: 45, insuranceRate: 0.01 } : undefined })} label="Sales tax, shipping and insurance when keeping an item" hint="Fees push agents towards the buyback. An agent ships only if the item is worth the fees." />
              {cfg.keepFees && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Sales tax on kept items" hint="0.08 means 8% of the item value, charged when a player keeps an item."><NumberInput value={cfg.keepFees.taxRate} min={0} max={0.3} step={0.005} onChange={(v) => setCfg({ ...cfg, keepFees: { ...cfg.keepFees!, taxRate: v } })} /></Field>
                  <Field label="Shipping charge ($)" hint="A flat charge when a player keeps an item."><NumberInput value={cfg.keepFees.shipping} min={0} step={5} onChange={(v) => setCfg({ ...cfg, keepFees: { ...cfg.keepFees!, shipping: v } })} /></Field>
                  <Field label="Insurance on kept items" hint="0.01 means 1% of the item value."><NumberInput value={cfg.keepFees.insuranceRate} min={0} max={0.1} step={0.005} onChange={(v) => setCfg({ ...cfg, keepFees: { ...cfg.keepFees!, insuranceRate: v } })} /></Field>
                </div>
              )}
            </Card>
          )}
          {opt("estimate") && (
            <Card title="Buyback at an operator estimate">
              <Toggle checked={!!cfg.estimate} onChange={(v) => setCfg({ ...cfg, estimate: v ? { factor: 0.7, disclosed: false } : undefined })} label="Buyback based on an estimated value the operator sets" hint="'Determined solely by IcyBox... we do not disclose how we calculate'. Modelled as a factor on realized value." />
              {cfg.estimate && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Buyback offer as a share of real value" hint="0.7 means the operator offers 70% of what the item actually sells for, without saying how it got there."><NumberInput value={cfg.estimate.factor} min={0.1} max={1.5} step={0.05} onChange={(v) => setCfg({ ...cfg, estimate: { ...cfg.estimate!, factor: v } })} /></Field>
                  <div className="pt-5">
                    <Toggle checked={cfg.estimate.disclosed} onChange={(v) => setCfg({ ...cfg, estimate: { ...cfg.estimate!, disclosed: v } })} label="Formula disclosed" />
                  </div>
                </div>
              )}
            </Card>
          )}
          {opt("creditExpiry") && (
            <Card title="Credit expiry">
              <Toggle checked={!!cfg.creditExpiry} onChange={(v) => setCfg({ ...cfg, creditExpiry: v ? { sessions: 12 } : undefined })} label="Site credit expires when unused" hint="Unused balance becomes operator income (breakage)." />
              {cfg.creditExpiry && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Visits before unused credit expires" hint="Balance that sits untouched for this many visits is lost to the player and kept by the operator."><NumberInput value={cfg.creditExpiry.sessions} min={1} max={365} step={1} onChange={(v) => setCfg({ ...cfg, creditExpiry: { sessions: Math.max(1, Math.floor(v)) } })} /></Field>
                </div>
              )}
            </Card>
          )}
          {opt("guaranteeFloor") && (
            <Card title="Guaranteed-value floor">
              <Toggle checked={!!cfg.guaranteeFloor} onChange={(v) => setCfg({ ...cfg, guaranteeFloor: v ? 300 : undefined })} label="Buyback never below a guaranteed value" hint="Guaranteed-value pack codes set a floor on the buyback offer." />
              {cfg.guaranteeFloor !== undefined && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Guaranteed minimum buyback ($)" hint="The operator never offers less than this for an item, whatever it is worth."><NumberInput value={cfg.guaranteeFloor} min={0} step={10} onChange={(v) => setCfg({ ...cfg, guaranteeFloor: Math.max(0, v) })} /></Field>
                </div>
              )}
            </Card>
          )}
          {opt("vault") && (
            <Card title="Vault">
              <Toggle checked={!!cfg.vault?.enabled} onChange={(v) => setCfg({ ...cfg, vault: { enabled: v, lockFraction: cfg.vault?.lockFraction ?? 0.5 } })} label="A share of each deposit is locked out of play until cash-out" hint="A self-limiting tool: it lowers wagering and ruin, and the hold with it." />
              {cfg.vault?.enabled && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Share of each deposit locked away" hint="0.5 means half of every deposit goes into the vault and cannot be bet until the player cashes out."><NumberInput value={cfg.vault.lockFraction} min={0} max={0.95} step={0.05} onChange={(v) => setCfg({ ...cfg, vault: { enabled: true, lockFraction: v } })} /></Field>
                </div>
              )}
            </Card>
          )}
          {opt("creatorCut") && (
            <Card title="Creator packs">
              <Toggle checked={!!cfg.creatorCut} onChange={(v) => setCfg({ ...cfg, creatorCut: v ? 0.05 : undefined })} label="A share of each box price goes to the box creator" hint="Users build and list packs and earn a cut; GGR shrinks by that cut." />
              {cfg.creatorCut !== undefined && (
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <Field label="Share paid to the box creator" hint="0.05 means 5% of every open goes to whoever built the box."><NumberInput value={cfg.creatorCut} min={0} max={0.5} step={0.01} onChange={(v) => setCfg({ ...cfg, creatorCut: Math.max(0, v) })} /></Field>
                </div>
              )}
            </Card>
          )}
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
            <Field label="Simulated players" hint="How many players the simulation runs. More players means steadier averages and a longer run."><NumberInput value={P.agents} min={10} max={50000} step={100} onChange={(v) => setP({ agents: v })} /></Field>
            <Field label="Typical deposit ($)" hint="The middle deposit size. Half the players deposit less, half more."><NumberInput value={P.depositMean} min={1} step={10} onChange={(v) => setP({ depositMean: v })} /></Field>
            <Field label="How much deposits vary" hint="0 means everyone deposits the same amount; 0.8 gives a wide spread with a long tail of big depositors, which is what real data looks like."><NumberInput value={P.depositSpread} min={0} max={2} step={0.1} onChange={(v) => setP({ depositSpread: v })} /></Field>
            <Field label="How many times a player tops up" hint="After this many deposits a busted player stops for good. This single number drives most of the hold figure."><NumberInput value={P.maxDeposits} min={1} max={100} step={1} onChange={(v) => setP({ maxDeposits: v })} /></Field>
            <Field label="Visits per player" hint="How many separate visits each player makes over the run."><NumberInput value={P.sessions} min={1} max={365} step={1} onChange={(v) => setP({ sessions: v })} /></Field>
            <Field label="Most opens in one visit" hint="A player stops a visit after this many opens, or earlier if the money runs out."><NumberInput value={P.opensPerSession} min={1} max={200} step={1} onChange={(v) => setP({ opensPerSession: v })} /></Field>
            <Field label="Share of balance bet per visit" hint="0.5 means a player bets up to half of what they have in a visit."><NumberInput value={P.rebetFraction} min={0.05} max={1} step={0.05} onChange={(v) => setP({ rebetFraction: v })} /></Field>
            <Field label="Keep an item worth at least ... times the price" hint="Anything below this gets sold back. 4 means a player only ships items shown at four times what they paid."><NumberInput value={P.shipAboveMultiple} min={1} max={100} step={0.5} onChange={(v) => setP({ shipAboveMultiple: v })} /></Field>
            <Field label="Try to cash out at ... times the deposit" hint="When the balance reaches this multiple of the last deposit, the player tries to take the money out."><NumberInput value={P.cashOutTargetMultiple} min={1} max={100} step={0.5} onChange={(v) => setP({ cashOutTargetMultiple: v })} /></Field>
          </div>
          <Help>Agents sell back everything below the ship threshold. These numbers are assumptions until data replaces them.</Help>
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
      content: <RigPanel lab="sellback" rigs={cfg.rigs} onChange={(rigs) => setCfg({ ...cfg, rigs })} allow={variant.rigIds} />,
    },
  ].filter((s) => allowed(s.id) && (s.id !== "options" || optionIds.length > 0));

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
          { label: cfg.sellback.mode === "vendor" ? `Sell-back: credit at displayed value${cfg.sellback.haircut ? ` minus ${pct(cfg.sellback.haircut, 0)}` : ""}` : `Sell-back: cash at ${cfg.sellback.layer}${cfg.sellback.haircut ? ` minus ${pct(cfg.sellback.haircut, 0)}` : ""}`, section: "economy" },
          { label: cfg.withdrawal.mode === "cash" ? "Withdraw: cash" : `Withdraw: only through items ≥ ${money(cfg.withdrawal.minWithdraw)}`, section: "economy" },
          ...(optionIds.length ? [{ label: options.length ? `Options: ${options.join(", ")}` : "No options on", section: "options", tone: options.length ? ("accent" as const) : ("neutral" as const) }] : []),
          { label: `${money(cfg.box.price)} box`, section: "box" },
          { label: algoLabel(cfg.algo), section: "algo" },
          rigs.length ? { label: `Rigs: ${rigs.join(", ")}`, section: "rigs", tone: "bad" } : { label: "No rigs", section: "rigs" },
          { label: `${num(P.agents)} agents × ${P.sessions} sessions · seed ${seed}`, section: "population", tone: "accent" },
        ]}
      >
        <SellbackStage cfg={cfg} seed={seed} onSettings={openSettings} />
        <SimulateBar
          label={`Run ${num(P.agents)} agents`}
          hint="Hold, GGR, sell-back and ship rates, ruin and bankroll percentiles for a whole population under these rules."
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
