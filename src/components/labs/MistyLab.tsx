"use client";
import { useCallback, useEffect, useState } from "react";
import type { MistyBox, MistyConfig, MistyPlayer, MistyResult } from "@/engine/types";
import { MISTY_BOXES, itemOddsRatio, liveWeights, mistyBox, mistyMath, normaliseWeights, scaleItemOdds } from "@/engine/labs/misty";
import type { FeatureDef } from "@/lib/operators";
import { mistyConfigFor } from "@/lib/mistyPresets";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { SimulateBar } from "../lab/SimulateBar";
import { ResultsSection } from "../lab/ResultsSection";
import { MistyStage } from "../stages/MistyStage";
import { MistyResults } from "../results/MistyResults";
import { Badge, Button, Card, Field, Info, NumberInput, Select, Td, Th, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
/** The simulation (open thousands of boxes) is hidden on the Misty page for now; the code stays. */
const SHOW_SIM = false;

const RARITY_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "accent"> = { common: "neutral", uncommon: "good", rare: "accent", epic: "accent", legendary: "warn", grail: "bad", bonus: "warn" };

/** The odds table as the back office sees it: one percent per outcome, with what each one costs per open. */
export function OddsEditor({ box, weights, onChange, values, bonus }: { box: MistyBox; weights: Record<string, number>; onChange: (w: Record<string, number>) => void; values: { misteeFace: number; misteeReal: number; itemRealized: number }; bonus: MistyConfig["bonus"] }) {
  const m = mistyMath(box, weights, bonus, values);
  const off = Math.abs(m.total - 100) > 0.005;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Outcome</Th>
              <Th right>Value</Th>
              <Th right>Odds %</Th>
              <Th right>1 in</Th>
              <Th right>Costs per open</Th>
            </tr>
          </thead>
          <tbody>
            {box.outcomes.map((o) => {
              const po = m.perOutcome.find((x) => x.id === o.id)!;
              return (
                <tr key={o.id} className="border-t border-line">
                  <Td>
                    <span className="flex items-center gap-2">
                      <Badge tone={RARITY_TONE[o.rarity] ?? "neutral"}>{o.rarity}</Badge>
                      <span className="max-w-[26ch] truncate" title={o.label}>
                        {o.label}
                      </span>
                    </span>
                  </Td>
                  <Td right mono>{o.kind === "item" ? money(o.valueUsd ?? 0) : `${po.mistees % 1 ? po.mistees.toFixed(2) : po.mistees} Mistees`}</Td>
                  <Td right>
                    <div className="ml-auto w-28">
                      <NumberInput value={Math.round((weights[o.id] ?? o.weight) * 1e6) / 1e6} min={0} max={100} step={o.weight < 1 ? 0.001 : 0.5} onChange={(v) => onChange({ ...weights, [o.id]: Math.max(0, v) })} />
                    </div>
                  </Td>
                  <Td right mono>{po.share > 0 ? num(Math.round(1 / po.share)) : "never"}</Td>
                  <Td right mono>{money(po.costFace, 2)}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
              <Td>Total: pays back per open</Td>
              <Td right mono>{m.evMistees.toFixed(2)} Mistees + {money(m.evItems, 2)} in pieces</Td>
              <Td right mono>{m.total.toFixed(3)}%</Td>
              <Td right mono>piece {oneIn(m.pItem)}</Td>
              <Td right mono>{money(m.payFace, 2)}</Td>
            </tr>
            <tr className="border-t border-line">
              <Td>Price of the box</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{money(box.price, 2)}</Td>
            </tr>
            <tr className="border-t border-line font-semibold">
              <Td>Operator keeps per open (price − pays back)</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>return {pct(m.returnFace)}</Td>
              <Td right mono>
                <span className={box.price - m.payFace >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.payFace, 2)}</span>
              </Td>
            </tr>
            <tr className="border-t border-line text-ink-3">
              <Td>Same in real money (Mistees at {money(values.misteeReal)}, pieces at {pct(values.itemRealized, 0)})</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>return {pct(m.returnReal)}</Td>
              <Td right mono>
                pays {money(m.payReal, 2)}, keeps {money(box.price - m.payReal, 2)}
              </Td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={off ? "warn" : "good"}>sum {m.total.toFixed(3)}%</Badge>
        <Badge>item {oneIn(m.pItem)}</Badge>
        <Badge>pays {money(m.payFace, 2)} at face = {pct(m.returnFace)}</Badge>
        <Badge tone="warn">really {money(m.payReal, 2)} = {pct(m.returnReal)}</Badge>
        <span className="ml-auto flex gap-2">
          {off && (
            <Button kind="ghost" onClick={() => onChange(normaliseWeights(box, weights))}>
              Make it 100%
            </Button>
          )}
          <Button kind="ghost" onClick={() => onChange(liveWeights(box))}>
            <Icon name="ph:arrow-counter-clockwise" size={14} /> Live odds
          </Button>
        </span>
      </div>
    </div>
  );
}

function PlayerCard({ cfg, player, box, onChange, onRemove }: { cfg: MistyConfig; player: MistyPlayer; box: MistyBox; onChange: (p: MistyPlayer) => void; onRemove: () => void }) {
  const own = !!player.weights;
  const ratio = itemOddsRatio(box, cfg.weights, player.weights);
  const [showTable, setShowTable] = useState(false);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {player.name}
          {own ? <Badge tone={ratio > 1.001 ? "good" : ratio < 0.999 ? "bad" : "accent"}>own odds · items ×{ratio.toFixed(2)}</Badge> : <Badge>box odds</Badge>}
        </span>
      }
      actions={
        <Button kind="ghost" onClick={onRemove} title="Remove this player">
          Remove
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Name" hint="A player or a segment of players: new sign-ups, a VIP tier, a flagged account.">
          <input className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm" value={player.name} onChange={(e) => onChange({ ...player, name: e.target.value })} />
        </Field>
        <Field label="Share of opens" hint="How much of the simulated traffic this player makes. Shares are relative: 9 and 1 means 90% and 10%.">
          <NumberInput value={player.share} min={0} step={0.1} onChange={(v) => onChange({ ...player, share: Math.max(0, v) })} />
        </Field>
        <Field label="Odds for this player" hint="Box odds: the same table everyone sees. Own odds: a private table for this player; the commitment still proves each roll matched it.">
          <Select<"box" | "own"> value={own ? "own" : "box"} onChange={(v) => onChange(v === "box" ? { ...player, weights: undefined } : { ...player, weights: { ...cfg.weights } })} options={[{ value: "box", label: "Same as the box" }, { value: "own", label: "Own odds" }]} />
        </Field>
        {own && (
          <Field label="Physical item odds ×" hint="Multiplies the chance of every physical item for this player and takes the difference out of the Mistee outcomes, so the table still sums to 100. ×2 doubles their chance of a piece; ×0.5 halves it.">
            <div className="flex gap-1">
              {[0.25, 0.5, 1, 2, 5].map((k) => (
                <button key={k} type="button" className={`chip ${Math.abs(ratio - k) < 0.01 ? "chip-accent" : ""}`} onClick={() => onChange({ ...player, weights: scaleItemOdds(box, cfg.weights, k) })}>
                  ×{k}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
      {own && (
        <div className="mt-3">
          <button type="button" className="chip" onClick={() => setShowTable((s) => !s)}>
            {showTable ? "Hide" : "Edit"} each outcome for {player.name}
          </button>
          {showTable && (
            <div className="mt-3">
              <OddsEditor box={box} weights={{ ...cfg.weights, ...player.weights }} onChange={(w) => onChange({ ...player, weights: w })} values={cfg} bonus={cfg.bonus} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function MistyLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as MistyConfig;
  const [cfg, setCfg] = useState<MistyConfig>(() => clone(initial));
  const [seed, setSeed] = useState(13);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "box" });
  const [saved, setSaved] = useState(false);
  const [lastCfg, setLastCfg] = useState<MistyConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const sim = useRun();
  const result = sim.result && sim.result.kind === "misty" ? (sim.result as MistyResult) : null;
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "box" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const box = mistyBox(cfg.boxSlug);
  const m = mistyMath(box, cfg.weights, cfg.bonus, cfg);

  const start = async () => {
    setSaved(false);
    const snapshot = clone(cfg);
    setLastCfg(snapshot);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "misty", config: snapshot, sizes: { opens: snapshot.run.opens }, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const sizesOf = (c: MistyConfig) => ({ opens: c.run.opens });
  const runName = () => `${operator} · ${mistyBox(cfg.boxSlug).name}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("misty", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`misty-${lastCfg.boxSlug}-${lastSeed}.md`, reportMarkdown(buildRun("misty", runName(), lastCfg, sizesOf(lastCfg), lastSeed, result)), "text/markdown");
  };
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);
  const ownOdds = cfg.players.filter((p) => p.weights).length;
  const edited = box.outcomes.some((o) => Math.abs((cfg.weights[o.id] ?? o.weight) - o.weight) > 1e-9);

  const setPlayer = (i: number, p: MistyPlayer) => setCfg({ ...cfg, players: cfg.players.map((x, j) => (j === i ? p : x)) });
  const addPlayer = () => {
    const id = `p${Date.now().toString(36)}`;
    setCfg({ ...cfg, players: [...cfg.players, { id, name: `Player ${cfg.players.length + 1}`, share: 1 }] });
  };

  const sections: SettingsSection[] = [
    {
      id: "box",
      label: "Box & odds",
      icon: "ph:arrow-up-right",
      content: (
        <div className="space-y-4">
          <Card title="Which box" actions={<Info>The thirteen boxes on the live site, with their names, prices and exact odds as captured on 12 October 2026. Picking a box loads its own table and free-spin table.</Info>}>
            <div className="flex flex-wrap gap-2">
              {MISTY_BOXES.map((b) => (
                <button key={b.slug} type="button" className={`chip ${b.slug === cfg.boxSlug ? "chip-accent" : ""}`} onClick={() => setCfg(mistyConfigFor(b.slug, cfg))}>
                  {b.name} · {b.price > 0 ? money(b.price) : "free"}
                </button>
              ))}
            </div>
          </Card>
          <Card
            title={
              <span className="flex items-center gap-1">
                Odds per outcome (back office)
                <Info>Each row is one thing the box can pay and its chance in percent. The chances add up to 100. &quot;Costs per open&quot; is value × chance: what that row costs the operator on average every time someone opens the box. Add the column up and you have what the box pays back per open.</Info>
              </span>
            }
          >
            <OddsEditor box={box} weights={cfg.weights} onChange={(weights) => setCfg({ ...cfg, weights })} values={cfg} bonus={cfg.bonus} />
          </Card>
          <Card
            title={
              <span className="flex items-center gap-1">
                What a free spin pays
                <Info>Some outcomes carry one or two free spins. A free spin uses this small table, Mistees only, with the same secret and the next spin number.</Info>
              </span>
            }
          >
            <div className="grid gap-3 sm:grid-cols-5">
              {cfg.bonus.map((b, i) => (
                <Field key={i} label={`${b.mistees % 1 ? b.mistees.toFixed(2) : b.mistees} Mistees`} hint="Chance of this bonus amount, percent of free spins.">
                  <NumberInput value={b.weight} min={0} max={100} step={0.1} onChange={(v) => setCfg({ ...cfg, bonus: cfg.bonus.map((x, j) => (j === i ? { ...x, weight: Math.max(0, v) } : x)) })} />
                </Field>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">
              A free spin pays {m.bonusEv.toFixed(2)} Mistees on average. Sum {cfg.bonus.reduce((s, b) => s + b.weight, 0).toFixed(1)}%.
            </p>
          </Card>
        </div>
      ),
    },
    {
      id: "players",
      label: "Per player",
      icon: "ph:users-three",
      badge: ownOdds ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">{ownOdds}</span> : undefined,
      content: (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            The back office can hand a player, or a group of players, a table of their own. In live play, pick who is spinning at the top of the page. In the simulation, opens are shared out by the shares below. The proof still passes for every one of them: it shows the roll matched the table that player was given, not that every player got the same table.
          </p>
          {cfg.players.map((p, i) => (
            <PlayerCard key={p.id} cfg={cfg} player={p} box={box} onChange={(np) => setPlayer(i, np)} onRemove={() => setCfg({ ...cfg, players: cfg.players.filter((_, j) => j !== i), activePlayerId: cfg.activePlayerId === p.id ? (cfg.players.find((x) => x.id !== p.id)?.id ?? "") : cfg.activePlayerId })} />
          ))}
          <Button kind="ghost" onClick={addPlayer}>
            Add a player
          </Button>
        </div>
      ),
    },
    {
      id: "value",
      label: "What things are worth",
      icon: "ph:shield-check",
      content: (
        <Card title="Values used in the sums">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="One Mistee on screen ($)" hint="What Misty counts a Mistee as. The page data stores 100 cents per Mistee, so $1. This is the face value in every return figure.">
              <NumberInput value={cfg.misteeFace} min={0} step={0.1} onChange={(v) => setCfg({ ...cfg, misteeFace: Math.max(0, v) })} />
            </Field>
            <Field label="One Mistee really ($)" hint="What a Mistee costs the operator when it can only be spent on more boxes: about 37 cents on the Timepiece table with items at resale, about 52 cents with items at listed. Set it to 1 to see the picture Misty shows.">
              <NumberInput value={cfg.misteeReal} min={0} step={0.01} onChange={(v) => setCfg({ ...cfg, misteeReal: Math.max(0, v) })} />
            </Field>
            <Field label="Physical items: resale share" hint="Fraction of the listed value an item fetches when sold on, or costs Misty to buy in. 0.7 means 70%.">
              <NumberInput value={cfg.itemRealized} min={0} max={1.5} step={0.05} onChange={(v) => setCfg({ ...cfg, itemRealized: Math.max(0, v) })} />
            </Field>
          </div>
        </Card>
      ),
    },
    {
      id: "algo",
      label: "The proof",
      icon: "ph:detective",
      content: (
        <Card title="How the roll is made">
          <div className="space-y-3">
            <Toggle checked={cfg.provablyFair} onChange={(v) => setCfg({ ...cfg, provablyFair: v })} label="Commit the secret before the player pays (Misty's way)" hint="On: a secret is chosen, its fingerprint is shown before payment, the roll is computed from the secret, your seed and the spin number, and the secret is revealed after. Off: a plain random number, nothing to check afterwards." />
            <Field label="Your seed (client seed)" hint="A word of your choosing that goes into every roll. Misty lets the player set it so the site cannot pick a roll on its own.">
              <input className="w-full max-w-sm rounded-md border border-line bg-paper px-2 py-1 text-sm" value={cfg.clientSeed} onChange={(e) => setCfg({ ...cfg, clientSeed: e.target.value })} />
            </Field>
            <p className="text-xs text-ink-2">
              In plain words: the site picks a secret before you pay and cannot change it; your seed goes in too; the two are mixed into one roll between 0 and 100; the roll is read against the odds table, which is stamped onto your open; free spins reuse the same secret; a new secret is chosen for every open.
            </p>
            <details className="text-xs text-ink-3">
              <summary className="cursor-pointer">For developers: the exact recipe</summary>
              Copied from Misty&apos;s published verifier: digest = HMAC-SHA256 with key &quot;DRAW-{box.slug}-secret-yourSeed-spinNumber&quot; over an empty message; the first 13 hex characters divided by 2^52 give a roll between 0 and 1; the odds table is hashed with SHA-256 and that hash is frozen onto the open; free spins use the same secret and the next spin numbers.
            </details>
          </div>
        </Card>
      ),
    },
    {
      id: "run",
      label: "Simulation",
      icon: "ph:shuffle",
      content: (
        <Card title="Run size">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Opens" hint="How many boxes the simulated players open in one run."><NumberInput value={cfg.run.opens} min={100} max={2000000} step={1000} onChange={(v) => setCfg({ ...cfg, run: { ...cfg.run, opens: Math.max(100, Math.floor(v)) } })} /></Field>
            <Field label="Opens to re-check" hint="How many opens the verifier recomputes from the revealed secrets."><NumberInput value={cfg.run.verifySample} min={0} max={5000} step={50} onChange={(v) => setCfg({ ...cfg, run: { ...cfg.run, verifySample: Math.max(0, Math.floor(v)) } })} /></Field>
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
  ].filter((sec) => SHOW_SIM || sec.id !== "run");

  return (
    <>
      <LabFrame
        doc={variant.doc}
        featureKey={variant.key}
        lab={variant.lab}
        operator={operator}
        rigCount={ownOdds}
        onSettings={openSettings}
        settingsOpen={settings.open}
        chips={[
          { label: `${box.name} · ${box.price > 0 ? money(box.price) : "free"}`, section: "box" },
          { label: `item ${oneIn(m.pItem)} · pays ${pct(m.returnFace)} at face, ${pct(m.returnReal)} really${edited ? " · odds edited" : ""}`, section: "box", tone: edited ? "bad" : undefined },
          { label: ownOdds ? `${cfg.players.length} players · ${ownOdds} with own odds` : `${cfg.players.length} players · same odds`, section: "players", tone: ownOdds ? "bad" : undefined },
          { label: cfg.provablyFair ? "secret committed per open" : "no proof", section: "algo", tone: cfg.provablyFair ? undefined : "bad" },
          ...(SHOW_SIM ? [{ label: `${num(cfg.run.opens)} opens · seed ${seed}`, section: "run", tone: "accent" as const }] : []),
        ]}
      >
        <MistyStage cfg={cfg} seed={seed} onChange={setCfg} onSettings={openSettings} />
        {SHOW_SIM && (
        <SimulateBar
          label={`Open ${num(cfg.run.opens)} boxes`}
          hint="Counts per outcome against the stated odds, return at face and in real money, per-player returns, and a recomputation of the proofs."
          status={sim.status}
          progress={sim.progress}
          elapsed={sim.elapsed}
          error={sim.error}
          onRun={start}
          onCancel={sim.cancel}
          onSettings={() => openSettings("run")}
        />
        )}
        {SHOW_SIM && result && lastCfg && (
          <ResultsSection title="Simulation results" meta={`${num(result.opens)} opens · ${result.boxName} · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <MistyResults r={result} />
          </ResultsSection>
        )}
      </LabFrame>

      <SettingsDialog
        open={settings.open}
        onClose={closeSettings}
        title={`${operator} · ${box.name} · back office`}
        active={settings.section}
        onActive={(id) => setSettings({ open: true, section: id })}
        footer={
          <>
            <Button kind="ghost" onClick={() => setCfg(clone(initial))}>
              <Icon name="ph:arrow-counter-clockwise" size={14} /> Reset
            </Button>
            <span className="ml-auto text-xs text-ink-3">{pctSmart(m.pItem)} of opens pay a piece</span>
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={sections}
      />
    </>
  );
}
