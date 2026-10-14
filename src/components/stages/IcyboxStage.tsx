"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { IcyboxBandId, IcyboxBox, IcyboxConfig, IcyboxSpin } from "@/engine/types";
import { BAND_LABEL, ICYBOX_BOXES, IcyboxOpener, bandMax, bandMin, icyboxAsCatalogItem, icyboxBox, icyboxMath, type IcyboxMath } from "@/engine/labs/icybox";
import { icyboxConfigFor } from "@/lib/icyboxPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Info, Td, Th } from "../ui";
import { HoverTip } from "../InfoPop";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { BoxOpen } from "../lab/motifs";

const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";

interface Tally {
  opens: number;
  spent: number;
  listed: number;
  balance: number;
  kept: number;
  keptValue: number;
  fees: number;
  grails: number;
}
const ZERO: Tally = { opens: 0, spent: 0, listed: 0, balance: 0, kept: 0, keptValue: 0, fees: 0, grails: 0 };

function Mini({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-ink-3">{sub}</div>}
    </div>
  );
}
function Acc({ title, info, children }: { title: React.ReactNode; info?: string; children: React.ReactNode }) {
  return (
    <details className="acc">
      <summary>
        {title}
        {info && <Info>{info}</Info>}
      </summary>
      <div className="pt-3 text-sm text-ink-2">{children}</div>
    </details>
  );
}

export function IcyboxMaths({ box, m, cfg, lastBand }: { box: IcyboxBox; m: IcyboxMath; cfg: IcyboxConfig; lastBand?: IcyboxBandId }) {
  return (
    <div className="space-y-2">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <Th>Band</Th>
            <Th right>Chance</Th>
            <Th right>Average value</Th>
            <Th right>Costs per open</Th>
            <Th right>At buyback ({pct(cfg.buybackPercent, 0)})</Th>
          </tr>
        </thead>
        <tbody>
          {m.perBand.map((b) => (
            <tr key={b.id} className={`border-t border-line ${b.id === lastBand ? "bg-accent-soft" : ""}`}>
              <Td>{b.label}</Td>
              <Td right mono>{fmtPct(b.share * 100)}</Td>
              <Td right mono>{money(b.meanValue)}</Td>
              <Td right mono>{money(b.costPerOpen, 2)}</Td>
              <Td right mono>{money(b.costPerOpen * cfg.buybackPercent, 2)}</Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
            <Td>Total: pays back per open</Td>
            <Td right mono>{fmtPct(m.total * 100)}</Td>
            <Td right> </Td>
            <Td right mono>{money(m.evListed, 2)}</Td>
            <Td right mono>{money(m.evBuyback, 2)}</Td>
          </tr>
          <tr className="border-t border-line">
            <Td>Price of the box</Td>
            <Td right> </Td>
            <Td right> </Td>
            <Td right mono>{money(box.price, 2)}</Td>
            <Td right mono>{money(box.price, 2)}</Td>
          </tr>
          <tr className="border-t border-line font-semibold">
            <Td>IcyBox keeps per open</Td>
            <Td right> </Td>
            <Td right mono>RTP {pct(m.returnListed)} listed · {pct(m.returnBuyback)} sold back · {pct(m.returnReal)} really</Td>
            <Td right mono>
              <span className={box.price - m.evListed >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.evListed, 2)}</span>
            </Td>
            <Td right mono>
              <span className={box.price - m.evBuyback >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.evBuyback, 2)}</span>
            </Td>
          </tr>
        </tfoot>
      </table>
      <p className="text-xs text-ink-3">Average value = the mean of the items in the band (reconstructed). Costs per open = chance × average value. The chances are fitted so the box returns 85% at listed values; the app shows the real ones in its odds modal. Really = kept items at resale minus shipping and tax, everything else sold back at {pct(cfg.buybackPercent, 0)}.</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <div className="text-ink-3">{k}</div>
      <code className="block truncate text-[11px]" title={v}>
        {v}
      </code>
    </div>
  );
}

export function IcyboxStage({ cfg, onChange, onSettings }: { cfg: IcyboxConfig; onChange: (c: IcyboxConfig) => void; onSettings: (section?: string) => void }) {
  const box = icyboxBox(cfg.boxSlug);
  const m = useMemo(() => icyboxMath(box, cfg.chances, cfg), [box, cfg]);
  const openerRef = useRef<{ key: string; opener: IcyboxOpener } | null>(null);
  const key = JSON.stringify({ slug: cfg.boxSlug, chances: cfg.chances, drop: cfg.drop, b: cfg.buybackPercent, s: cfg.shippingFee, t: cfg.taxRate });
  if (!openerRef.current || openerRef.current.key !== key) openerRef.current = { key, opener: new IcyboxOpener(cfg, "live") };
  const opener = openerRef.current.opener;
  const [spinId, setSpinId] = useState(0);
  const [pending, setPending] = useState<IcyboxSpin | null>(null);
  const [last, setLast] = useState<IcyboxSpin | null>(null);
  const [decision, setDecision] = useState<"sold" | "kept" | "auto" | null>(null);
  const [history, setHistory] = useState<IcyboxSpin[]>([]);
  const [tally, setTally] = useState<Tally>(ZERO);
  const [fast, setFast] = useState(false);
  const [busy, setBusy] = useState(false);
  const [drawNo, setDrawNo] = useState(0);
  useEffect(() => {
    setLast(null);
    setPending(null);
    setDecision(null);
    setHistory([]);
    setTally(ZERO);
    setDrawNo(0);
  }, [cfg.boxSlug]);

  const start = () => {
    if (busy) return;
    if (opener.retired) return;
    const s = opener.spin();
    if (!s) return;
    setDrawNo((n) => n + 1);
    setDecision(null);
    setPending(s);
    setBusy(true);
    setSpinId((n) => n + 1);
  };
  const finish = (s: IcyboxSpin) => {
    setLast(s);
    setPending(null);
    setBusy(false);
    setHistory((h) => [s, ...h].slice(0, 8));
    setTally((t) => ({ ...t, opens: t.opens + 1, spent: t.spent + s.price, listed: t.listed + s.item.value, grails: t.grails + (s.bandId === "grail" ? 1 : 0) }));
  };
  const sell = (auto = false) => {
    if (!last || decision) return;
    setDecision(auto ? "auto" : "sold");
    setTally((t) => ({ ...t, balance: t.balance + last.buyback }));
  };
  const keep = () => {
    if (!last || decision) return;
    setDecision("kept");
    setTally((t) => ({ ...t, kept: t.kept + 1, keptValue: t.keptValue + last.item.value, fees: t.fees + last.keepCost }));
  };
  const retired = opener.retired;
  const pool = opener.pool;
  const bandOf = (id: IcyboxBandId) => box.bands.find((b) => b.id === id)!;
  const pendingItem = pending ? icyboxAsCatalogItem(pending.item, pending.bandId) : null;
  const rtpListed = tally.spent > 0 ? tally.listed / tally.spent : 0;
  const rtpMoney = tally.spent > 0 ? (tally.balance + tally.keptValue * cfg.itemRealized - tally.fees) / tally.spent : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
        <Link href="/docs/icybox" className="btn no-underline">
          <Icon name="ph:book-open-text" size={16} /> Document
        </Link>
        <Link href="/build" className="btn no-underline">
          <Icon name="ph:cube" size={16} /> Create Mystery Box
        </Link>
        <Link href={`/simulate?src=icybox&box=${box.slug}`} className="btn no-underline">
          <Icon name="ph:chart-bar" size={16} /> Simulator
        </Link>
        <span className="ml-auto text-xs text-ink-3">Reconstructed from public sources; the app&apos;s odds modal is the source of truth.</span>
      </div>

      <Card>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-2">Select a Mystery Box</h2>
          <span className="text-xs text-ink-3">five tiers, {money(ICYBOX_BOXES[0].price)} to {money(ICYBOX_BOXES[ICYBOX_BOXES.length - 1].price)}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {ICYBOX_BOXES.map((b) => {
            const active = b.slug === cfg.boxSlug;
            const bm = icyboxMath(b, undefined, cfg);
            return (
              <button key={b.slug} type="button" disabled={busy} className={`misty-box-tile ${active ? "misty-box-tile-active" : ""}`} onClick={() => !active && onChange(icyboxConfigFor(b, cfg))} title={b.note}>
                <span className="flex items-center gap-2">
                  <Icon name={b.tier === "icy" ? "fluent:gem-stone" : "fluent:watch"} size={22} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{b.name}</span>
                    <span className="block text-[11px] text-ink-3">
                      {money(b.price)} · grail {oneIn(bm.pGrail)} · top {money(Math.max(...b.showcase))}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">{box.name}</h2>
          <Badge tone="accent">{money(box.price)}</Badge>
          {pool && (
            <Badge tone={retired ? "bad" : "neutral"}>
              {retired ? `drop retired · ${num(pool.left)} copies never sold` : `drop · ${num(pool.left)} of ${num(pool.initial)} copies left · grails left ${num(pool.bandLeft("grail"))}`}
            </Badge>
          )}
          <span className="ml-auto flex items-center gap-2 text-xs text-ink-3">
            <button type="button" className="chip" onClick={() => onSettings("box")}>
              Back office
            </button>
          </span>
        </div>
        <div className="mt-3">
          <BoxOpen winner={pendingItem} spinId={spinId} onDone={() => pending && finish(pending)} fast={fast} label={box.name} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary text-base" disabled={busy || retired} onClick={start}>
            {retired ? "Drop retired" : busy ? "Opening…" : `Open the box · ${money(box.price)}`}
          </button>
          <label className="flex items-center gap-1 text-xs text-ink-3">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> fast reveal
          </label>
          {retired && (
            <Button
              kind="ghost"
              onClick={() => {
                opener.newDrop();
                setDrawNo((n) => n + 1);
              }}
            >
              Start a new drop
            </Button>
          )}
          <span className="ml-auto text-xs text-ink-3">open #{drawNo}</span>
        </div>

        {last && (
          <div className={`mt-4 rounded-xl border p-3 ${last.bandId === "grail" ? "border-good bg-good-soft" : "border-line bg-paper"}`}>
            <div className="flex flex-wrap items-center gap-3">
              <ItemTile item={icyboxAsCatalogItem(last.item, last.bandId)} size={64} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold">{last.item.label}</span>
                  <span className={`misty-rarity misty-${last.bandId}`}>{BAND_LABEL[last.bandId]}</span>
                </div>
                <div className="text-ink-2">
                  Listed at <b>{money(last.item.value)}</b>. Buyback offer <b>{money(last.buyback)}</b> ({pct(cfg.buybackPercent, 0)}). Keeping it costs about {money(last.keepCost)} (shipping {money(cfg.shippingFee)} + tax {pct(cfg.taxRate, 0)}) and takes 15 to 20 business days.
                </div>
                <div className="text-xs text-ink-3">Decide within {cfg.buybackWindowHours} hours or it is sold back automatically. The decision is final. (Window length is an assumption; IcyBox does not publish it.)</div>
              </div>
              <div className="flex flex-col gap-2">
                <Button onClick={() => sell(false)} disabled={!!decision}>
                  Sell back for {money(last.buyback)}
                </Button>
                <Button kind="ghost" onClick={keep} disabled={!!decision}>
                  Keep it · pay {money(last.keepCost)}
                </Button>
                <button type="button" className="chip" disabled={!!decision} onClick={() => sell(true)}>
                  Let the window expire
                </button>
              </div>
            </div>
            {decision && (
              <div className="mt-2 text-xs text-ink-2">
                {decision === "kept" && `Kept: ${last.item.label} ships in 15 to 20 business days. You paid ${money(last.keepCost)} on top. At resale (${pct(cfg.itemRealized, 0)} of listed) it is worth about ${money(last.item.value * cfg.itemRealized)}.`}
                {decision === "sold" && `Sold back: ${money(last.buyback)} added to your balance. It can be withdrawn (minimum ${money(cfg.withdrawMin)}, fee about ${money(cfg.withdrawFee)}) or spent on the next box.`}
                {decision === "auto" && `Window missed: sold back automatically for ${money(last.buyback)}. No reversal.`}
              </div>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Mini label="Opens" value={num(tally.opens)} />
          <Mini label="Paid" value={money(tally.spent)} />
          <Mini label="Listed value won" value={money(tally.listed)} sub={`${num(tally.grails)} grail${tally.grails === 1 ? "" : "s"}`} />
          <Mini label="Balance from buybacks" value={money(tally.balance)} sub={`${num(tally.kept)} kept · fees ${money(tally.fees)}`} />
          <Mini label="RTP at listed" value={tally.spent > 0 ? pct(rtpListed) : "–"} sub={`table says ${pct(m.returnListed)}`} />
          <Mini label="RTP in money" value={tally.spent > 0 ? pct(rtpMoney) : "–"} sub={`buybacks + kept at resale − fees`} />
        </div>
      </Card>

      <Card
        title={
          <span className="flex items-center gap-1">
            Box Content and Odds
            <Info>IcyBox shows a chance and a value range per rarity band, not per item. The bands and ranges here are reconstructed from the site, the press releases and reviews; the chances are fitted to an 85% return at listed values. Hover a band for its example items.</Info>
          </span>
        }
      >
        <table className="w-full text-xs">
          <thead>
            <tr>
              <Th>Band</Th>
              <Th right>Chance</Th>
              <Th right>1 in</Th>
              <Th right>Value range</Th>
              <Th>Example items</Th>
            </tr>
          </thead>
          <tbody>
            {[...m.perBand].reverse().map((b) => {
              const band = bandOf(b.id);
              const names = band.items.map((i) => `${i.label} (${money(i.value)})`).join(" · ");
              return (
                <tr key={b.id} className={`border-t border-line ${last?.bandId === b.id ? "bg-accent-soft" : ""}`}>
                  <Td>
                    <span className={`misty-rarity misty-${b.id}`}>{b.label}</span>
                  </Td>
                  <Td right mono>{fmtPct(b.share * 100)}</Td>
                  <Td right mono>{b.share > 0 ? num(Math.round(1 / b.share)) : "never"}</Td>
                  <Td right mono>
                    {money(bandMin(band))} to {money(bandMax(band))}
                  </Td>
                  <Td>
                    <HoverTip tip={names}>
                      <span className="misty-name block max-w-[44ch] truncate">{names}</span>
                    </HoverTip>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {last && (
        <Card title="Analysis">
          <div className="space-y-2">
            <Acc title="The maths of this box" info="Value × chance for every band, added up, against the price. Three answers: at the values the app lists, at the buyback rate, and really.">
              <IcyboxMaths box={box} m={m} cfg={cfg} lastBand={last.bandId} />
            </Acc>
            <Acc title="How this result was decided, step by step">
              <ol className="list-decimal space-y-1 pl-5">
                <li>You paid {money(box.price)}. IcyBox publishes no secret and no hash before the open, so there is nothing to lock in.</li>
                <li>The app&apos;s server picked a band and an item. Nobody outside can see how. This simulator used its own roll of {last.roll.toFixed(4)} on a line from 0 to 1 and read it against the bands: {BAND_LABEL[last.bandId]} owns {fmtPct(last.bandFrom * 100)} to {fmtPct(last.bandTo * 100)}.</li>
                <li>Inside the band one item was picked: {last.item.label}, listed at {money(last.item.value)}.</li>
                <li>Then the choice: sell back for {money(last.buyback)} ({pct(cfg.buybackPercent, 0)} of the listed value, a rate IcyBox does not disclose), or keep it and pay about {money(last.keepCost)}. Say nothing for {cfg.buybackWindowHours} hours and it is sold back for you.</li>
                {pool && <li>This is a limited drop: {num(pool.left)} copies left of {num(pool.initial)}; the next open&apos;s odds are the copies left over the total left. {cfg.drop.retireAt > 0 ? `The operator retires the drop once ${pct(cfg.drop.retireAt, 0)} has sold, whether or not the grail went out.` : "No retirement rule is set."}</li>}
              </ol>
            </Acc>
            <Acc title="Was it fair? The check">
              <p>
                <b>There is no check.</b> IcyBox has no server seed, no hash, no client seed and no verifier. The terms say only that the items and &quot;the probability of receiving a specific Asset&quot; are shown in the app. You see the odds; you cannot test a single open against them.
              </p>
              <p className="mt-1">What you can do: count. Over many opens the share of each band should match the modal. One player cannot do that; a thousand players comparing notes can.</p>
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-ink-3">Technical details</summary>
                <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 sm:grid-cols-2">
                  <Row k="Commitment before payment" v="none (IcyBox)" />
                  <Row k="Simulator roll (for reproducibility only)" v={last.roll.toFixed(12)} />
                  <Row k="Band" v={`${BAND_LABEL[last.bandId]} · ${fmtPct(last.bandFrom * 100)} to ${fmtPct(last.bandTo * 100)}`} />
                  <Row k="Terms, section 3" v="Any Icebox may be terminated or removed at any time even before all Assets included in the Icebox are distributed" />
                </div>
              </details>
            </Acc>
            <Acc title="The logic behind IcyBox">
              <ul className="list-disc space-y-1 pl-5">
                <li>Five boxes, {money(50)} to {money(1000)}; six bands from Common to Grail; the app shows a chance and a value range per band before you buy.</li>
                <li>Every open pays a watch or a bag. The value shown is IcyBox&apos;s own figure; reviews say it runs above resale.</li>
                <li>The buyback is the engine: about {pct(cfg.buybackPercent, 0)} of the listed value, set by IcyBox, not negotiable, not explained. Miss the window and it happens anyway.</li>
                <li>Keeping costs shipping, insurance and tax and takes 15 to 20 business days; so most wins become balance, and balance buys the next box.</li>
                <li>Limited-edition boxes are finite: &quot;once they&apos;re gone, they&apos;re gone&quot;. The terms let IcyBox end a box before its grail is handed out.</li>
                <li>No proof of any kind. Cash out: minimum {money(cfg.withdrawMin)}, fees by method.</li>
              </ul>
            </Acc>
            <Acc title="Last opens">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <Th>#</Th>
                    <Th>Band</Th>
                    <Th>Item</Th>
                    <Th right>Listed</Th>
                    <Th right>Buyback</Th>
                    <Th right>Roll</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.idx} className="border-t border-line">
                      <Td mono>{s.idx}</Td>
                      <Td>{BAND_LABEL[s.bandId]}</Td>
                      <Td>
                        <span className="block max-w-[32ch] truncate" title={s.item.label}>
                          {s.item.label}
                        </span>
                      </Td>
                      <Td right mono>{money(s.item.value)}</Td>
                      <Td right mono>{money(s.buyback)}</Td>
                      <Td right mono>{s.roll.toFixed(4)}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Acc>
          </div>
        </Card>
      )}
      <p className="text-[11px] text-ink-3">Chance of an item worth the price or more: {pctSmart(m.pAtOrAbovePrice)} ({oneIn(m.pAtOrAbovePrice)}).</p>
    </div>
  );
}
