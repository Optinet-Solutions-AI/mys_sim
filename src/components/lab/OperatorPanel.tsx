"use client";
import { useEffect, useState } from "react";
import type { MysteryBoxConfig } from "@/engine/types";
import { expectedValue } from "@/engine/table";
import type { LiveOpener, LiveOpen } from "@/lib/live";
import { money, num, pct, pctSmart } from "@/lib/format";
import type { Skin } from "@/lib/skins";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { Badge, Card, Info } from "../ui";

function Countdown({ seconds, keyOf }: { seconds: number; keyOf: number }) {
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [seconds, keyOf]);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  return <span className="font-mono tabular-nums">{h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`}</span>;
}

/** The operator-specific panel beside the result: what that operator's own screen would show around an open. */
export function OperatorPanel({ skin, cfg, live, last, history, spent }: { skin: Skin; cfg: MysteryBoxConfig; live: LiveOpener | null; last: LiveOpen | null; history: LiveOpen[]; spent: number }) {
  const [choice, setChoice] = useState<string | null>(null);
  useEffect(() => setChoice(null), [last?.n]);
  const price = cfg.box.price;
  const table = live?.opener.displayed;
  if (!skin.panel || !live || !table) return null;

  switch (skin.panel) {
    case "vendor": {
      const stated = expectedValue(table, cfg.box.valueLayer) / price;
      return (
        <Card title={<>Back office <Info>What the vendor&apos;s admin panel shows for this box: a return knob and item prices. Nothing is published to players beyond the odds.</Info></>}>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge tone="accent">RTP knob {pct(stated, 0)} on {cfg.box.valueLayer}</Badge>
            <Badge>{cfg.algo.scheme === "none" ? "no commitment published" : "commitment on (research)"}</Badge>
            <Badge>sell-back credits at displayed value</Badge>
          </div>
        </Card>
      );
    }
    case "icybox": {
      const pool = live.opener.poolStatus;
      const est = last ? last.item.realized * 0.7 : 0;
      const fees = last ? last.display * 0.08 + 45 + last.display * 0.01 : 0;
      return (
        <Card title={<>Keep or sell back <Info>IcyBox: the buyback is &ldquo;based on its estimated value, determined solely by IcyBox&rdquo;; the formula is not disclosed (modelled at 70% of realized). You must choose within the buyback period or the item is sold back automatically. Keeping adds sales tax, insurance and premium shipping.</Info></>}>
          {pool && (
            <div className="mb-2 text-xs text-ink-2">
              <b>{num(pool.left)}</b> of {num(pool.total)} left in this drop · once they&apos;re gone, they&apos;re gone
            </div>
          )}
          {!last ? (
            <p className="text-xs text-ink-3">Open a drop to see the offer.</p>
          ) : choice ? (
            <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{choice}</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Buyback offer <span className="font-mono font-semibold">{money(est)}</span>
                </span>
                <span className="text-xs text-warn">
                  auto-sellback in <Countdown seconds={48 * 3600} keyOf={last.n} />
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setChoice(`Sold back for ${money(est)} (wallet credit).`)}>
                  {skin.terms.sellBack} · {money(est)}
                </button>
                <button type="button" className="btn" onClick={() => setChoice(`Kept. Tax, insurance and shipping: ${money(fees)} on top.`)}>
                  {skin.terms.ship} · + {money(fees)} fees
                </button>
              </div>
              <div className="text-[11px] text-ink-3">
                shown as {money(last.display)} · estimate {money(est)} · fees to keep {money(fees)}
              </div>
            </div>
          )}
        </Card>
      );
    }
    case "stockx": {
      const credit = last ? last.display * 0.85 : 0;
      return (
        <Card title={<>Keep or sell <Info>StockX: sell back instantly for 75 to 90% of list value as StockX Credit (not withdrawable, valid one year), or keep it. Five minutes to decide, otherwise you are charged and shipped.</Info></>}>
          <div className="mb-2 rounded-lg bg-accent-soft px-3 py-1.5 text-xs text-accent-ink">Every item is worth at least {money(price)} before processing fees. Odds are per tier and identical for everyone.</div>
          {!last ? (
            <p className="text-xs text-ink-3">Buy a box to see the offer.</p>
          ) : choice ? (
            <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{choice}</div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>
                  Credit offer <span className="font-mono font-semibold">{money(credit)}</span> <span className="text-xs text-ink-3">(85% of list)</span>
                </span>
                <span className="text-xs text-warn">
                  decide in <Countdown seconds={5 * 60} keyOf={last.n} />
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setChoice(`Sold for ${money(credit)} in StockX Credit, valid one year, not withdrawable.`)}>
                  {skin.terms.sellBack} · {money(credit)}
                </button>
                <button type="button" className="btn" onClick={() => setChoice("Kept. Charged and shipped.")}>
                  {skin.terms.ship}
                </button>
              </div>
            </div>
          )}
        </Card>
      );
    }
    case "courtyard": {
      const fmv = last ? last.item.realized * 0.95 : 0;
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={<>Buyback offer <Info>Courtyard: buyback at fair market value, which &ldquo;ignores what you paid&rdquo;, seven days to accept; vault free; or ship. Modelled at 95% of realized.</Info></>}>
            {!last ? (
              <p className="text-xs text-ink-3">Rip a pack to see the offer.</p>
            ) : choice ? (
              <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{choice}</div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm">
                  FMV {money(last.item.realized)} · offer <span className="font-mono font-semibold">{money(fmv)}</span> · <span className="text-xs text-ink-3">7 days to accept</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary" onClick={() => setChoice(`Buyback accepted: ${money(fmv)} cash.`)}>
                    {skin.terms.sellBack}
                  </button>
                  <button type="button" className="btn" onClick={() => setChoice("Vaulted, no storage fee. You can list it or ship it later.")}>
                    Vault it
                  </button>
                </div>
              </div>
            )}
          </Card>
          <Card title={<>Public pull log <Info>Every pull is recorded publicly, so anyone can check observed odds against the stated ones over all pulls (PullValue already does this for Courtyard).</Info></>}>
            {history.length === 0 ? (
              <p className="text-xs text-ink-3">Pulls appear here as they happen.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {history.slice(0, 6).map((o) => {
                  const r = table.items.find((x) => x.itemId === o.item.id);
                  return (
                    <li key={o.n} className="flex items-center gap-2">
                      <span className="font-mono text-ink-3">#{o.n}</span>
                      <ItemTile item={o.item} size={20} />
                      <span className="min-w-0 flex-1 truncate">{o.item.name}</span>
                      <span className="font-mono text-ink-3">{r ? pctSmart(r.weight / table.T) : ""}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      );
    }
    case "jemlit": {
      const credit = last ? last.display * 0.85 : 0;
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={<>Provably fair <Info>Jemlit publishes the server seed hash before the open and the full recipe (HMAC-SHA512/256 over client seed and nonce). The default client seed is generated by the site; change it to remove that trust.</Info></>}>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
              <dt className="text-ink-3">server seed hash</dt>
              <dd className="truncate">{live.opener.commitment || "—"}</dd>
              <dt className="text-ink-3">client seed</dt>
              <dd className="truncate">{last ? last.rec.clientSeed : "generated at open"}</dd>
              <dt className="text-ink-3">nonce</dt>
              <dd>{last ? last.rec.nonce : "—"}</dd>
            </dl>
          </Card>
          <Card title={<>Exchange for credits <Info>Items can be exchanged for credits at the item value less 0 to 30%; credits are not withdrawable and expire after a year.</Info></>}>
            {!last ? (
              <p className="text-xs text-ink-3">Open a box to see the exchange.</p>
            ) : choice ? (
              <div className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-ink">{choice}</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => setChoice(`Exchanged for ${money(credit)} in credits (15% haircut). Credits expire in a year.`)}>
                  {skin.terms.sellBack} · {money(credit)}
                </button>
                <button type="button" className="btn" onClick={() => setChoice("Shipping requested.")}>
                  {skin.terms.ship}
                </button>
              </div>
            )}
          </Card>
        </div>
      );
    }
    case "cases": {
      const level = Math.floor(spent / 500) + 1;
      const progress = (spent % 500) / 500;
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <Card title={<>Account <Info>Cases.gg discloses a 10% house edge on cases and rotates seeds every 1,000 bets. Levels unlock daily free cases.</Info></>}>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="accent">house edge 10%</Badge>
              <Badge>seeds rotate every 1,000 bets</Badge>
              <Badge>level {level}</Badge>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-ink-3">{money(500 - (spent % 500))} wagered to the next level</div>
          </Card>
          <Card title={<>Live drops <Info>Your own session&apos;s opens. On the real site the feed shows everyone&apos;s; the fabricated-feed rig in the Presentation layer shows how it can be staged.</Info></>}>
            {history.length === 0 ? (
              <p className="text-xs text-ink-3">Drops appear here as they happen.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {history.slice(0, 6).map((o) => (
                  <li key={o.n} className="flex items-center gap-2 animate-slide">
                    <ItemTile item={o.item} size={20} />
                    <span className="min-w-0 flex-1 truncate">{o.item.name}</span>
                    <span className={`font-mono ${o.payout >= price ? "text-good" : "text-ink-3"}`}>{money(o.payout)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      );
    }
    case "misty": {
      const entries = history.filter((o) => o.item.category === "credit").reduce((a, o) => a + Math.round(o.item.retail), 0);
      return (
        <Card title={<>Your entries <Info>Misty: credits are entries in a prize competition with a fixed pool of 100,000 numbers, drawn on the date regardless of sell-through. Free postal entry has the same odds.</Info></>}>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-xl bg-accent-soft px-3 py-2 text-accent-ink">
              <span className="text-2xl font-semibold tabular-nums">{num(entries)}</span> entries
            </span>
            <div className="text-xs text-ink-2">
              into the next draw · 100,000 numbers · prize drawn on the date
              <br />
              your chance right now: {entries ? pctSmart(entries / 100000) : "—"} · <span className="text-ink-3">free postal entry available</span>
            </div>
          </div>
        </Card>
      );
    }
    case "glassbox":
      return (
        <Card title={<>Manifest <Info>The Glass Box commits the whole box (items, odds, three prices, cash-out) with the seed, uses a public beacon, and pays cash at realized value.</Info></>}>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
            <dt className="text-ink-3">manifest hash</dt>
            <dd className="truncate">{live.opener.manifestHash}</dd>
            <dt className="text-ink-3">commitment</dt>
            <dd className="truncate">{live.opener.commitment || "—"}</dd>
            <dt className="text-ink-3">beacon round</dt>
            <dd>{last?.rec.beaconRound ?? "next open"}</dd>
          </dl>
          {last && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <button type="button" className="btn btn-primary" onClick={() => setChoice(`Cashed out ${money(last.item.realized)} at realized value.`)}>
                <Icon name="ph:hand-coins" size={16} className="text-white" /> {skin.terms.sellBack} · {money(last.item.realized)}
              </button>
              {choice && <span className="text-xs text-accent-ink">{choice}</span>}
            </div>
          )}
        </Card>
      );
  }
  return null;
}
