"use client";
import { useCallback, useState } from "react";
import type { JemlitBox, JemlitConfig, JemlitPlayer } from "@/engine/types";
import { JEMLIT_FEATURED, JEMLIT_PACKS } from "@/engine/jemlitLive.generated";
import { bigOddsRatio, fitBigOdds, jemlitBoxOf, jemlitMath, liveChances, normaliseChances, scaleBigOdds } from "@/engine/labs/jemlit";
import type { FeatureDef } from "@/lib/operators";
import { JEMLIT_BOX_LIST, jemlitConfigFor, loadJemlitBox } from "@/lib/jemlitPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { JemlitStage } from "../stages/JemlitStage";
import { Badge, Button, Card, Field, Info, NumberInput, Select, Td, Th, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

/** The odds table as the back office sees it: one chance per item, with what each one costs per open. */
function OddsEditor({ box, chances, onChange, values }: { box: JemlitBox; chances: Record<string, number>; onChange: (c: Record<string, number>) => void; values: JemlitConfig }) {
  const m = jemlitMath(box, chances, values);
  const off = Math.abs(m.total - 1) > 0.00005;
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th right>Price</Th>
              <Th right>Cashback</Th>
              <Th right>Chance %</Th>
              <Th right>1 in</Th>
              <Th right>Costs per open</Th>
            </tr>
          </thead>
          <tbody>
            {box.items.map((it) => {
              const pi = m.perItem.find((x) => x.id === it.id)!;
              return (
                <tr key={it.id} className="border-t border-line">
                  <Td>
                    <span className="flex items-center gap-2">
                      <span className="max-w-[26ch] truncate" title={it.label}>
                        {it.label}
                      </span>
                      {pi.credit && <Badge>credit</Badge>}
                    </span>
                  </Td>
                  <Td right mono>{money(it.price)}</Td>
                  <Td right mono>{money(it.cashback)}</Td>
                  <Td right>
                    <div className="ml-auto w-28">
                      <NumberInput value={Math.round((chances[it.id] ?? it.chance) * 1e8) / 1e6} min={0} max={100} step={it.chance < 0.01 ? 0.0001 : 0.5} onChange={(v) => onChange({ ...chances, [it.id]: Math.max(0, v) / 100 })} />
                    </div>
                  </Td>
                  <Td right mono>{pi.share > 0 ? num(Math.round(1 / pi.share)) : "never"}</Td>
                  <Td right mono>{money(pi.costPrice, 3)}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
              <Td>Total: pays back per open</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{(m.total * 100).toFixed(4)}%</Td>
              <Td right mono>worth the price {oneIn(m.pAtOrAbovePrice)}</Td>
              <Td right mono>{money(m.evPrice, 2)}</Td>
            </tr>
            <tr className="border-t border-line">
              <Td>Price of the box</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{money(box.price, 2)}</Td>
            </tr>
            <tr className="border-t border-line font-semibold">
              <Td>Operator keeps per open</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>return {pct(m.returnPrice)} at listed · {pct(m.returnCashback)} in Credits · {pct(m.returnReal)} really</Td>
              <Td right mono>
                <span className={box.price - m.evPrice >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.evPrice, 2)}</span>
              </Td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={off ? "warn" : "good"}>sum {(m.total * 100).toFixed(4)}%</Badge>
        <span className="ml-auto flex gap-2">
          {off && (
            <Button kind="ghost" onClick={() => onChange(normaliseChances(box, chances))}>
              Make it 100%
            </Button>
          )}
          <Button kind="ghost" onClick={() => onChange(liveChances(box))}>
            <Icon name="ph:arrow-counter-clockwise" size={14} /> Live odds
          </Button>
        </span>
      </div>
    </div>
  );
}

function PlayerCard({ cfg, player, box, onChange, onRemove }: { cfg: JemlitConfig; player: JemlitPlayer; box: JemlitBox; onChange: (p: JemlitPlayer) => void; onRemove: () => void }) {
  const own = !!player.chances;
  const ratio = bigOddsRatio(box, cfg.chances, player.chances);
  const [showTable, setShowTable] = useState(false);
  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {player.name}
          {own ? <Badge tone={ratio > 1.001 ? "good" : ratio < 0.999 ? "bad" : "accent"}>own odds · big items ×{ratio.toFixed(2)}</Badge> : <Badge>box odds</Badge>}
        </span>
      }
      actions={
        <Button kind="ghost" onClick={onRemove}>
          Remove
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="Name">
          <input className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm" value={player.name} onChange={(e) => onChange({ ...player, name: e.target.value })} />
        </Field>
        <Field label="Share of opens" hint="Relative: 9 and 1 means 90% and 10%.">
          <NumberInput value={player.share} min={0} step={0.1} onChange={(v) => onChange({ ...player, share: Math.max(0, v) })} />
        </Field>
        <Field label="Odds for this player" hint="Box odds: the table everyone sees. Own odds: a private table; the check still passes.">
          <Select<"box" | "own"> value={own ? "own" : "box"} onChange={(v) => onChange(v === "box" ? { ...player, chances: undefined } : { ...player, chances: { ...cfg.chances } })} options={[{ value: "box", label: "Same as the box" }, { value: "own", label: "Own odds" }]} />
        </Field>
        {own && (
          <Field label="Items worth the price or more ×" hint="Multiplies the chance of every item worth at least the box price; the cheap rows absorb the difference.">
            <div className="flex gap-1">
              {[0.25, 0.5, 1, 2, 5].map((k) => (
                <button key={k} type="button" className={`chip ${Math.abs(ratio - k) < 0.01 ? "chip-accent" : ""}`} onClick={() => onChange({ ...player, chances: scaleBigOdds(box, cfg.chances, k) })}>
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
            {showTable ? "Hide" : "Edit"} each item for {player.name}
          </button>
          {showTable && (
            <div className="mt-3">
              <OddsEditor box={box} chances={{ ...cfg.chances, ...player.chances }} onChange={(c) => onChange({ ...player, chances: c })} values={cfg} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function JemlitLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as JemlitConfig;
  const [cfg, setCfg] = useState<JemlitConfig>(() => clone(initial));
  const [seed] = useState(13);
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "box" });
  const [target, setTarget] = useState(80);
  const [query, setQuery] = useState("");
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "box" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const box = jemlitBoxOf(cfg);
  const m = jemlitMath(box, cfg.chances, cfg);
  const ownOdds = cfg.players.filter((p) => p.chances).length;
  const setPlayer = (i: number, p: JemlitPlayer) => setCfg({ ...cfg, players: cfg.players.map((x, j) => (j === i ? p : x)) });
  const pick = async (slug: string) => setCfg(jemlitConfigFor(await loadJemlitBox(slug), cfg));
  const matches = query.trim().length >= 2 ? JEMLIT_BOX_LIST.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()) || b.slug.includes(query.toLowerCase())).slice(0, 20) : [];

  const sections: SettingsSection[] = [
    {
      id: "box",
      label: "Box & odds",
      icon: "ph:arrow-up-right",
      content: (
        <div className="space-y-4">
          <Card title="Which box" actions={<Info>{JEMLIT_FEATURED.length} boxes are embedded; all {JEMLIT_BOX_LIST.length} captured boxes can be loaded by name. Picking a box loads its own table and price.</Info>}>
            <div className="flex flex-wrap gap-2">
              {(variant.key === "jemlit-packs" ? JEMLIT_PACKS : JEMLIT_FEATURED).map((b) => (
                <button key={b.slug} type="button" className={`chip ${b.slug === cfg.boxSlug ? "chip-accent" : ""}`} onClick={() => pick(b.slug)}>
                  {b.name} · {money(b.price)}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input className="w-64 rounded-md border border-line bg-paper px-2 py-1 text-sm" placeholder="Search all captured boxes…" value={query} onChange={(e) => setQuery(e.target.value)} />
              {matches.map((b) => (
                <button key={b.slug} type="button" className={`chip ${b.slug === cfg.boxSlug ? "chip-accent" : ""}`} onClick={() => pick(b.slug)}>
                  {b.name} · {money(b.price)}
                </button>
              ))}
            </div>
          </Card>
          <Card
            title={
              <span className="flex items-center gap-1">
                Odds per item (back office)
                <Info>Each row is one item and its chance. The chances add up to 100. Costs per open is price × chance: what that row costs the operator every time the box is opened. Jemlit sets these so the total is 80% of the price.</Info>
              </span>
            }
          >
            <OddsEditor box={box} chances={cfg.chances} onChange={(chances) => setCfg({ ...cfg, chances })} values={cfg} />
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-2 text-sm">
              <span className="text-ink-2">Fit the big items so the box returns</span>
              <span className="w-20">
                <NumberInput value={target} min={1} max={300} step={1} onChange={(v) => setTarget(Math.max(1, v))} />
              </span>
              <span className="text-ink-2">% at listed prices</span>
              <Button onClick={() => setCfg({ ...cfg, chances: fitBigOdds(box, cfg.chances, target / 100, cfg) })}>Fit</Button>
              <Info>Scales the chance of every item worth at least the box price by one factor and takes the difference out of the cheap rows. Jemlit&apos;s own tables come out at 80%.</Info>
            </div>
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
          <p className="text-sm text-ink-2">Jemlit commits the seed, not the table, so a private table for a player or a segment would pass every check. This is a research setting; there is no evidence Jemlit does it.</p>
          {cfg.players.map((p, i) => (
            <PlayerCard key={p.id} cfg={cfg} player={p} box={box} onChange={(np) => setPlayer(i, np)} onRemove={() => setCfg({ ...cfg, players: cfg.players.filter((_, j) => j !== i), activePlayerId: cfg.activePlayerId === p.id ? (cfg.players.find((x) => x.id !== p.id)?.id ?? "") : cfg.activePlayerId })} />
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <Button kind="ghost" onClick={() => setCfg({ ...cfg, players: [...cfg.players, { id: `p${Date.now().toString(36)}`, name: `Player ${cfg.players.length + 1}`, share: 1 }] })}>
              Add a player
            </Button>
            <span className="text-xs text-ink-3">Playing as</span>
            <span className="w-48">
              <Select<string> value={cfg.activePlayerId} onChange={(v) => setCfg({ ...cfg, activePlayerId: v })} options={cfg.players.map((p) => ({ value: p.id, label: p.name }))} />
            </span>
          </div>
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
            <Field label="One Credit on screen ($)" hint="Credits are spent 1:1 on box prices, so $1.">
              <NumberInput value={cfg.creditFace} min={0} step={0.1} onChange={(v) => setCfg({ ...cfg, creditFace: Math.max(0, v) })} />
            </Field>
            <Field label="One Credit really ($)" hint="What a Credit costs the operator when it only buys more boxes. If players ship items worth the price or more and exchange the rest: about 40 cents on the Apple eBox. An assumption.">
              <NumberInput value={cfg.creditReal} min={0} step={0.01} onChange={(v) => setCfg({ ...cfg, creditReal: Math.max(0, v) })} />
            </Field>
            <Field label="Shipped items: resale share" hint="Fraction of the listed price an item fetches when sold on. 0.7 means 70%. An assumption.">
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
            <Toggle checked={cfg.provablyFair} onChange={(v) => setCfg({ ...cfg, provablyFair: v })} label="Commit the server seed before play (Jemlit's way)" hint="On: a server seed is chosen, its SHA-512 hash shown, the play count rises by one per open, the seed is revealed when rotated. Off: plain random, nothing to check." />
            <Field label="Client seed" hint="Jemlit's browser generates one; the player can change it. If they never do, the site knows both inputs.">
              <input className="w-full max-w-sm rounded-md border border-line bg-paper px-2 py-1 text-sm" value={cfg.clientSeed} onChange={(e) => setCfg({ ...cfg, clientSeed: e.target.value })} />
            </Field>
            <p className="text-xs text-ink-2">In plain words: the site picks a secret and shows its scrambled copy; your seed and a play count that rises by one each open are mixed with the secret into a roll from 0 to 100; the item whose band holds the roll wins; the secret is revealed only when you ask to rotate it.</p>
            <details className="text-xs text-ink-3">
              <summary className="cursor-pointer">For developers: the exact recipe, as Jemlit publishes it</summary>
              hash = hash_hmac(&apos;sha512/256&apos;, clientSeed + &apos;-&apos; + nonce, serverSeed); roll = hexdec(hash) ÷ 16^64 × 100; the item with lower &lt; roll ≤ upper wins; the commitment is SHA-512 of the server seed. The engine reproduces Jemlit&apos;s published example (hash 38611068…, roll 22.0231).
            </details>
          </div>
        </Card>
      ),
    },
  ];

  return (
    <>
      <LabFrame doc={variant.doc} featureKey={variant.key} lab={variant.lab} operator={operator} rigCount={ownOdds} onSettings={openSettings} settingsOpen={settings.open} chips={[]}>
        <JemlitStage cfg={cfg} seed={seed} onChange={setCfg} onSettings={openSettings} collection={variant.key === "jemlit-packs" ? "packs" : "boxes"} />
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
            <span className="ml-auto text-xs text-ink-3">{pctSmart(m.pAtOrAbovePrice)} of opens pay the price or more</span>
            <Button onClick={closeSettings}>Done</Button>
          </>
        }
        sections={sections}
      />
    </>
  );
}
