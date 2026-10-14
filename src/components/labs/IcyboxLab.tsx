"use client";
import { useCallback, useState } from "react";
import type { IcyboxBox, IcyboxConfig } from "@/engine/types";
import { ICYBOX_BOXES, bandMax, bandMin, fitReturn, icyboxBox, icyboxMath, liveChances, normaliseChances } from "@/engine/labs/icybox";
import type { FeatureDef } from "@/lib/operators";
import { icyboxConfigFor } from "@/lib/icyboxPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { LabFrame } from "../lab/LabFrame";
import { SettingsDialog, type SettingsSection } from "../lab/SettingsDialog";
import { IcyboxStage } from "../stages/IcyboxStage";
import { Badge, Button, Card, Field, Info, NumberInput, Td, Th, Toggle } from "../ui";
import { Icon } from "../Icon";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

function BandEditor({ box, cfg, onChange }: { box: IcyboxBox; cfg: IcyboxConfig; onChange: (c: Record<string, number>) => void }) {
  const m = icyboxMath(box, cfg.chances, cfg);
  const off = Math.abs(m.total - 1) > 0.00005;
  return (
    <div className="space-y-3">
      <div className="tbl"><table className="w-full text-sm">
        <thead>
          <tr>
            <Th>Band</Th>
            <Th right>Items</Th>
            <Th right>Value range</Th>
            <Th right>Chance %</Th>
            <Th right>1 in</Th>
            <Th right>Costs per open</Th>
          </tr>
        </thead>
        <tbody>
          {box.bands.map((b) => {
            const pb = m.perBand.find((x) => x.id === b.id)!;
            return (
              <tr key={b.id} className="border-t border-line">
                <Td>
                  <span className={`misty-rarity misty-${b.id}`}>{b.label}</span>
                </Td>
                <Td right mono>{b.items.length}</Td>
                <Td right mono>
                  {money(bandMin(b))} to {money(bandMax(b))}
                </Td>
                <Td right>
                  <div className="ml-auto w-28">
                    <NumberInput value={Math.round((cfg.chances[b.id] ?? b.chance) * 1e6) / 1e4} min={0} max={100} step={b.id === "grail" || b.id === "legendary" ? 0.05 : 0.5} onChange={(v) => onChange({ ...cfg.chances, [b.id]: Math.max(0, v) / 100 })} />
                  </div>
                </Td>
                <Td right mono>{pb.share > 0 ? num(Math.round(1 / pb.share)) : "never"}</Td>
                <Td right mono>{money(pb.costPerOpen, 2)}</Td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
            <Td>Total: pays back per open</Td>
            <Td right> </Td>
            <Td right> </Td>
            <Td right mono>{(m.total * 100).toFixed(3)}%</Td>
            <Td right mono>worth the price {oneIn(m.pAtOrAbovePrice)}</Td>
            <Td right mono>{money(m.evListed, 2)}</Td>
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
            <Td>IcyBox keeps per open</Td>
            <Td right> </Td>
            <Td right> </Td>
            <Td right> </Td>
            <Td right mono>
              RTP {pct(m.returnListed)} listed · {pct(m.returnBuyback)} sold back · {pct(m.returnReal)} really
            </Td>
            <Td right mono>
              <span className={box.price - m.evListed >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.evListed, 2)}</span>
            </Td>
          </tr>
        </tfoot>
      </table></div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={off ? "warn" : "good"}>sum {(m.total * 100).toFixed(3)}%</Badge>
        <span className="ml-auto flex gap-2">
          {off && (
            <Button kind="ghost" onClick={() => onChange(normaliseChances(box, cfg.chances))}>
              Make it 100%
            </Button>
          )}
          <Button kind="ghost" onClick={() => onChange(liveChances(box))}>
            <Icon name="ph:arrow-counter-clockwise" size={14} /> Reconstructed odds
          </Button>
        </span>
      </div>
    </div>
  );
}

export function IcyboxLab({ variant, operator }: { variant: FeatureDef; operator: string }) {
  const initial = variant.initial as IcyboxConfig;
  const [cfg, setCfg] = useState<IcyboxConfig>(() => clone(initial));
  const [settings, setSettings] = useState<{ open: boolean; section: string }>({ open: false, section: "box" });
  const [target, setTarget] = useState(80);
  const openSettings = useCallback((section?: string) => setSettings({ open: true, section: section ?? "box" }), []);
  const closeSettings = useCallback(() => setSettings((s) => ({ ...s, open: false })), []);
  const box = icyboxBox(cfg.boxSlug);
  const m = icyboxMath(box, cfg.chances, cfg);

  const sections: SettingsSection[] = [
    {
      id: "box",
      label: "Box & odds",
      icon: "ph:arrow-up-right",
      content: (
        <div className="space-y-4">
          <Card title="Which box" actions={<Info>Five tiers as the site and the press releases describe them: Bronze to Icy, $50 to $1,000. Picking a box loads its reconstructed bands and price.</Info>}>
            <div className="flex flex-wrap gap-2">
              {ICYBOX_BOXES.map((b) => (
                <button key={b.slug} type="button" className={`chip ${b.slug === cfg.boxSlug ? "chip-accent" : ""}`} onClick={() => setCfg(icyboxConfigFor(b, cfg))}>
                  {b.name} · {money(b.price)}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-3">{box.note}</p>
          </Card>
          <Card
            title={
              <span className="flex items-center gap-1">
                Odds per band (back office)
                <Info>The app publishes a chance and a value range per band. These chances are a reconstruction: the shape is hand-set from reviews, then fitted so the box returns 85% at listed values. Edit any band; the total must be 100.</Info>
              </span>
            }
          >
            <BandEditor box={box} cfg={cfg} onChange={(chances) => setCfg({ ...cfg, chances })} />
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-2 text-sm">
              <span className="text-ink-2">Fit the big bands so the box returns</span>
              <span className="w-20">
                <NumberInput value={target} min={1} max={300} step={1} onChange={(v) => setTarget(Math.max(1, v))} />
              </span>
              <span className="text-ink-2">% at listed values</span>
              <Button onClick={() => setCfg({ ...cfg, chances: fitReturn(box, cfg.chances, target / 100, cfg) })}>Fit</Button>
              <Info>Scales the chance of every band whose average value is at or above the price by one factor and takes the difference out of Common.</Info>
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: "drop",
      label: "Limited drop",
      icon: "ph:package",
      badge: cfg.drop.enabled ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[10px] text-white">on</span> : undefined,
      content: (
        <Card title="Finite stock and the operator exit">
          <div className="space-y-3">
            <Toggle checked={cfg.drop.enabled} onChange={(v) => setCfg({ ...cfg, drop: { ...cfg.drop, enabled: v } })} label="Limited-edition drop: a fixed stock of copies, drawn without replacement" hint="IcyBox: 'Limited edition boxes, once they're gone, they're gone.' Off: plain odds, every open independent." />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Copies in the drop" hint="Spread over the bands by their chances; every item gets at least one copy, which raises the grail odds on small drops.">
                <NumberInput value={cfg.drop.copies} min={10} step={100} onChange={(v) => setCfg({ ...cfg, drop: { ...cfg.drop, copies: Math.max(10, Math.round(v)) } })} />
              </Field>
              <Field label="Retire the drop once this share has sold" hint="Terms, section 3: a box may be removed 'even before all Assets included in the Icebox are distributed'. 0 = never retire. 0.7 = retire at 70% sold; whatever is left, grail included, never ships.">
                <NumberInput value={cfg.drop.retireAt} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, drop: { ...cfg.drop, retireAt: Math.min(1, Math.max(0, v)) } })} />
              </Field>
            </div>
            <p className="text-xs text-ink-2">The simulator starts a new drop whenever one is retired or sold out and counts the grails left behind.</p>
          </div>
        </Card>
      ),
    },
    {
      id: "money",
      label: "Buyback, fees, cash-out",
      icon: "ph:coins",
      content: (
        <div className="space-y-4">
          <Card title="Buyback">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Buyback as a share of the listed value" hint="Terms: set solely by IcyBox, not negotiable, formula not disclosed. Reviews: about 90% ($275 → $247.50; $315 → $283.50; $55 → $49).">
                <NumberInput value={cfg.buybackPercent} min={0} max={1.5} step={0.01} onChange={(v) => setCfg({ ...cfg, buybackPercent: Math.max(0, v) })} />
              </Field>
              <Field label="Buyback window (hours)" hint="Terms: the item is sold back automatically after 'the time period specified on the Platform'. The length is not published; an assumption.">
                <NumberInput value={cfg.buybackWindowHours} min={1} step={12} onChange={(v) => setCfg({ ...cfg, buybackWindowHours: Math.max(1, v) })} />
              </Field>
              <Field label="Share of players who miss the window" hint="They are sold back automatically at the same offer.">
                <NumberInput value={cfg.missWindowRate} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, missWindowRate: Math.min(1, Math.max(0, v)) })} />
              </Field>
            </div>
          </Card>
          <Card title="Keeping an item">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Share of wins worth the price or more that are kept" hint="Everything below the price is assumed sold back. An assumption.">
                <NumberInput value={cfg.keepRate} min={0} max={1} step={0.05} onChange={(v) => setCfg({ ...cfg, keepRate: Math.min(1, Math.max(0, v)) })} />
              </Field>
              <Field label="Shipping and insurance per item ($)" hint="Reviews: about $30; one documented $31.95 with tax. 15 to 20 business days from the fulfilment centre (site FAQ).">
                <NumberInput value={cfg.shippingFee} min={0} step={5} onChange={(v) => setCfg({ ...cfg, shippingFee: Math.max(0, v) })} />
              </Field>
              <Field label="Sales tax on the value" hint="Terms: prices exclude sales tax and shipping.">
                <NumberInput value={cfg.taxRate} min={0} max={0.3} step={0.01} onChange={(v) => setCfg({ ...cfg, taxRate: Math.max(0, v) })} />
              </Field>
            </div>
          </Card>
          <Card title="Cash-out and values">
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Minimum withdrawal ($)" hint="Site FAQ: 'Minimum withdrawal is $6. Fees vary by method.'">
                <NumberInput value={cfg.withdrawMin} min={0} step={1} onChange={(v) => setCfg({ ...cfg, withdrawMin: Math.max(0, v) })} />
              </Field>
              <Field label="Withdrawal fee ($)" hint="Reviews: $2 to bank or Venmo. Not confirmed on the site.">
                <NumberInput value={cfg.withdrawFee} min={0} step={0.5} onChange={(v) => setCfg({ ...cfg, withdrawFee: Math.max(0, v) })} />
              </Field>
              <Field label="Kept items: resale share of the listed value" hint="Reviews say listed values run above resale (a $22 watch sold for $6.99 elsewhere). 0.6 is an assumption.">
                <NumberInput value={cfg.itemRealized} min={0} max={1.5} step={0.05} onChange={(v) => setCfg({ ...cfg, itemRealized: Math.max(0, v) })} />
              </Field>
            </div>
          </Card>
        </div>
      ),
    },
    {
      id: "algo",
      label: "The proof",
      icon: "ph:detective",
      content: (
        <Card title="How the roll is made">
          <p className="text-sm text-ink-2">
            <b>Nothing to switch on.</b> IcyBox publishes no server seed, no hash, no client seed and no verifier; its terms only promise that the items and their probabilities are shown in the app. The simulator rolls with its own seeded generator so runs can be repeated; that is a research convenience, not a copy of anything IcyBox does.
          </p>
          <p className="mt-2 text-xs text-ink-3">Compare: Misty commits a secret per open and reveals it; Jemlit commits a secret per session and rotates it. Both can be checked by the player after the fact. IcyBox cannot.</p>
        </Card>
      ),
    },
  ];

  return (
    <>
      <LabFrame doc={variant.doc} featureKey={variant.key} lab={variant.lab} operator={operator} rigCount={cfg.drop.enabled && cfg.drop.retireAt > 0 ? 1 : 0} onSettings={openSettings} settingsOpen={settings.open} chips={[]}>
        <IcyboxStage cfg={cfg} onChange={setCfg} onSettings={openSettings} />
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
