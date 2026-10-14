"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogItem, JemlitBox, JemlitConfig, JemlitItem, JemlitSpin } from "@/engine/types";
import { JEMLIT_FEATURED, JEMLIT_PACKS } from "@/engine/jemlitLive.generated";
import { JemlitOpener, bigOddsRatio, buildBands, jemlitBoxOf, jemlitMath, lookupBand, playerChances, verifyJemlitSpin, type JemlitMath, type JemlitTable } from "@/engine/labs/jemlit";
import { makeRng } from "@/engine/rng";
import { JEMLIT_BOX_LIST, jemlitConfigFor, loadJemlitBox } from "@/lib/jemlitPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Info, Td, Th } from "../ui";
import { HoverTip } from "../InfoPop";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { CountUp } from "../lab/CountUp";
import { reelPosition } from "../lab/reelMotion";
import { iconFor } from "./MistyStage";

const CARD = 112;
const STRIP = 44;
const WIN = 36;

const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";

/** Jemlit colours its prizes by value class; thresholds from its prize_classes setting (common, uncommon, rare, …). */
export function jemlitRarity(price: number): string {
  if (price >= 1000) return "grail";
  if (price >= 150) return "legendary";
  if (price >= 50) return "epic";
  if (price >= 10) return "rare";
  if (price >= 1) return "uncommon";
  return "common";
}
const RARITY_HEX: Record<string, string> = { common: "#5b6472", uncommon: "#2f7d4f", rare: "#1e5aa8", epic: "#0f6b6b", legendary: "#5b2a86", grail: "#8a6d1f" };
const RARITY_TIER: Record<string, CatalogItem["tier"]> = { common: "common", uncommon: "common", rare: "rare", epic: "epic", legendary: "legendary", grail: "grail" };

export function jemlitIcon(it: JemlitItem): string {
  if (it.autoCashback || !it.shippable) return "fluent:coin";
  return iconFor({ id: it.id, label: it.label, rarity: jemlitRarity(it.price), kind: "item", mistees: 0, freeSpins: 0, valueUsd: it.price, weight: it.chance });
}
export function jemlitAsCatalogItem(it: JemlitItem): CatalogItem {
  const r = jemlitRarity(it.price);
  const credit = it.autoCashback || !it.shippable;
  return { id: it.id, name: it.label, brand: credit ? "Jemlit" : it.label.split(" ")[0], category: credit ? "credit" : "tech", tier: RARITY_TIER[r] ?? "common", retail: it.price, asking: it.price, realized: it.cashback, confidence: "medium", icon: jemlitIcon(it), color: RARITY_HEX[r] ?? "#5b6472", source: "captured", operator: "Jemlit" };
}

function CardFace({ it }: { it: JemlitItem }) {
  const r = jemlitRarity(it.price);
  const credit = it.autoCashback || !it.shippable;
  return (
    <div className={`misty-card misty-${r}`} title={it.label}>
      <div className="misty-card-rarity">{credit ? "credit" : r}</div>
      <div className="flex flex-1 items-center justify-center">
        <Icon name={jemlitIcon(it)} size={34} className="drop-shadow" />
      </div>
      <div className="misty-card-title">{it.label}</div>
      <div className="misty-card-sub">{money(it.price)}</div>
    </div>
  );
}

function buildStrip(table: JemlitTable, winner: JemlitItem, spinIdx: number): JemlitItem[] {
  const rng = makeRng("sfc32", `jemlit-strip:${spinIdx}`);
  const arr: JemlitItem[] = [];
  for (let i = 0; i < STRIP; i++) arr.push(lookupBand(table, rng.next() * 100).item);
  arr[WIN] = winner;
  return arr;
}

interface Tally {
  opens: number;
  spent: number;
  credits: number;
  items: number;
  itemValue: number;
}
const ZERO: Tally = { opens: 0, spent: 0, credits: 0, items: 0, itemValue: 0 };
const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "");

export function JemlitStage({ cfg, seed, onChange, onSettings, collection = "boxes" }: { cfg: JemlitConfig; seed: number; onChange: (c: JemlitConfig) => void; onSettings: (section?: string) => void; collection?: "boxes" | "packs" }) {
  const box = jemlitBoxOf(cfg);
  const featured = collection === "packs" ? JEMLIT_PACKS : JEMLIT_FEATURED;
  const key = useMemo(() => JSON.stringify([cfg, seed]), [cfg, seed]);
  const openerRef = useRef<{ key: string; opener: JemlitOpener } | null>(null);
  if (!openerRef.current || openerRef.current.key !== key) openerRef.current = { key, opener: new JemlitOpener(cfg, `live:${seed}`) };
  const opener = openerRef.current.opener;
  const player = cfg.players.find((p) => p.id === cfg.activePlayerId) ?? cfg.players[0];
  const chances = useMemo(() => playerChances(cfg, player?.id ?? ""), [cfg, player?.id]);
  const table = useMemo(() => buildBands(box, chances), [box, chances]);
  const m = useMemo(() => jemlitMath(box, chances, cfg), [box, chances, cfg]);
  const ratio = bigOddsRatio(box, cfg.chances, player?.chances);

  const [tally, setTally] = useState<Tally>(ZERO);
  const [last, setLast] = useState<JemlitSpin | null>(null);
  const [strip, setStrip] = useState<JemlitItem[]>(() => buildStrip(table, table.bands[0].item, 0));
  const [x, setX] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">("idle");
  const [fast, setFast] = useState(false);
  const [verify, setVerify] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [exchanged, setExchanged] = useState(false);
  const [history, setHistory] = useState<JemlitSpin[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const rafRef = useRef(0);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTally(ZERO);
    setLast(null);
    setPhase("idle");
    setX(0);
    setVerify(null);
    setExchanged(false);
    setHistory([]);
    setStrip(buildStrip(table, table.bands[0].item, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const pickBox = async (slug: string) => {
    if (slug === cfg.boxSlug || phase === "spinning") return;
    setLoading(slug);
    try {
      const b = await loadJemlitBox(slug);
      onChange(jemlitConfigFor(b, cfg));
    } finally {
      setLoading(null);
    }
  };

  const spin = () => {
    if (phase === "spinning") return;
    const s = opener.spin(player?.id);
    const winner = box.items.find((i) => i.id === s.itemId)!;
    const rng = makeRng("sfc32", `jemlit-land:${s.idx}:${seed}`);
    const land = (rng.next() - 0.5) * CARD * 0.55;
    setStrip(buildStrip(table, winner, s.idx + seed));
    setVerify(null);
    setExchanged(false);
    setPhase("spinning");
    const width = viewRef.current?.clientWidth ?? 640;
    const D = WIN * CARD - (width / 2 - CARD / 2) + land;
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = fast || reduce ? 420 : 4200;
    const t0 = performance.now();
    setX(0);
    const finish = () => {
      setLast(s);
      setHistory((h) => [s, ...h].slice(0, 8));
      setTally((t) => ({ opens: t.opens + 1, spent: t.spent + s.price, credits: t.credits + (s.credit ? s.cashback : 0), items: t.items + (s.credit ? 0 : 1), itemValue: t.itemValue + (s.credit ? 0 : s.itemPrice) }));
      setPhase("done");
    };
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setX(-reelPosition(k, D));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else finish();
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const exchange = () => {
    if (!last || last.credit || exchanged) return;
    setExchanged(true);
    setTally((t) => ({ ...t, items: t.items - 1, itemValue: t.itemValue - last.itemPrice, credits: t.credits + last.cashback }));
  };

  const busy = phase === "spinning";
  const lastItem = last ? box.items.find((i) => i.id === last.itemId) : undefined;
  const lastMath = last ? m.perItem.find((p) => p.id === last.itemId) : undefined;
  const lastGotCredits = last ? (last.credit || exchanged ? last.cashback : 0) : 0;
  const lastFace = last ? (last.credit || exchanged ? last.cashback * cfg.creditFace : last.itemPrice) : 0;
  const lastReal = last ? (last.credit || exchanged ? last.cashback * cfg.creditReal : last.itemPrice * cfg.itemRealized) : 0;
  const backFace = tally.itemValue + tally.credits * cfg.creditFace;
  const backReal = tally.itemValue * cfg.itemRealized + tally.credits * cfg.creditReal;
  const matches = query.trim().length >= 2 ? JEMLIT_BOX_LIST.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()) || b.slug.includes(query.toLowerCase())).slice(0, 12) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
        <Link href="/docs/jemlit" className="btn no-underline">
          <Icon name="ph:book-open-text" size={16} /> Document
        </Link>
        <Link href="/build" className="btn no-underline">
          <Icon name="ph:cube" size={16} /> Create Mystery Box
        </Link>
        <Link href={`/simulate?src=jemlit&box=${cfg.boxSlug}`} className="btn no-underline">
          <Icon name="ph:chart-bar" size={16} /> Simulator
        </Link>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-2">{collection === "packs" ? "Select a Pack" : "Select a Mystery Box"}</h2>
          <span className="text-xs text-ink-3">{featured.length} shown · {JEMLIT_BOX_LIST.length} captured</span>
          <input className="ml-auto w-56 rounded-md border border-line bg-paper px-2 py-1 text-xs" placeholder="Search all boxes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {matches.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {matches.map((b) => (
              <button key={b.slug} type="button" className={`chip ${b.slug === cfg.boxSlug ? "chip-accent" : ""}`} disabled={busy || loading === b.slug} onClick={() => pickBox(b.slug)}>
                {b.name} · {money(b.price)}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {featured.map((b) => {
            const bm = jemlitMath(b, undefined, cfg);
            const active = b.slug === cfg.boxSlug;
            const top = b.items.reduce((best, i) => (i.price > best.price ? i : best), b.items[0]);
            return (
              <button key={b.slug} type="button" disabled={busy || !!loading} className={`misty-box-tile ${active ? "misty-box-tile-active" : ""}`} onClick={() => pickBox(b.slug)}>
                <div className="flex items-center gap-2">
                  <span className="misty-tile-icon" style={{ background: RARITY_HEX[jemlitRarity(top.price)] ?? "#5b6472" }}>
                    <Icon name={jemlitIcon(top)} size={18} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11px] uppercase tracking-wide opacity-70">{money(b.price)}</span>
                    <span className="block truncate text-sm font-semibold leading-tight">{b.name}</span>
                    <span className="block text-[11px] opacity-70">worth the price {oneIn(bm.pAtOrAbovePrice)}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{box.name}</h2>
            <Badge tone="accent">{money(box.price)}</Badge>
            {player?.chances && <Badge tone={ratio > 1 ? "good" : "bad"}>own odds ×{ratio.toFixed(2)}</Badge>}
            {loading && <Badge>loading {loading}…</Badge>}
          </div>

          <div ref={viewRef} className="misty-view">
            <div className="misty-pointer" />
            <div className="misty-strip" style={{ transform: `translateX(${x}px)`, transition: "none" }}>
              {strip.map((it, i) => (
                <CardFace key={`${i}-${it.id}`} it={it} />
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary text-base" disabled={busy || !player} onClick={spin}>
              {busy ? "Spinning…" : `Open the box · ${money(box.price)}`}
            </button>
            <label className="flex items-center gap-1 text-xs text-ink-3">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> fast reveal
            </label>
            {!cfg.provablyFair && <Badge tone="bad">no proof: plain random</Badge>}
          </div>

          {last && lastItem && lastMath && phase === "done" && (
            <div className="mt-4 flex flex-wrap items-start gap-4 rounded-xl border border-line bg-paper p-3">
              <ItemTile item={jemlitAsCatalogItem(lastItem)} size={72} />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="text-lg font-semibold">{last.credit ? `${money(last.cashback)} in Credits` : exchanged ? `Exchanged for ${money(last.cashback)} in Credits` : `You won ${last.label}`}</div>
                {!last.credit && !exchanged && (
                  <div className="text-ink-2">
                    Listed at {money(last.itemPrice)}. Ship it, or{" "}
                    <button type="button" className="chip" onClick={exchange}>
                      exchange it for {money(last.cashback)} in Credits
                    </button>
                  </div>
                )}
                <div className="mt-1 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-ink-3">Odds: </span>
                    {fmtPct(lastMath.share * 100)} · {oneIn(lastMath.share)}
                  </div>
                  <div>
                    <span className="text-ink-3">On screen: </span>
                    {money(lastFace)}
                    {lastGotCredits ? ` (${money(lastGotCredits)} Credits × ${money(cfg.creditFace)})` : " (listed price)"}
                  </div>
                  <div>
                    <span className="text-ink-3">Really: </span>
                    about {money(lastReal)}
                    {lastGotCredits ? ` (Credits only buy more boxes, counted at ${money(cfg.creditReal)})` : ` (${pct(cfg.itemRealized, 0)} of listed at resale)`}
                  </div>
                  <div>
                    <span className="text-ink-3">This open, in real money: </span>
                    <b className={lastReal >= last.price ? "text-good" : "text-bad"}>
                      {lastReal >= last.price ? "+" : "−"}
                      {money(Math.abs(lastReal - last.price))}
                    </b>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Mini label="Opens" value={num(tally.opens)} />
            <Mini label="Paid" value={money(tally.spent)} />
            <Mini label="Credits" value={<CountUp value={tally.credits} format={(n) => money(n)} />} sub="only buy more boxes" />
            <Mini label="Items" value={num(tally.items)} sub={money(tally.itemValue)} />
            <Mini label="RTP" value={tally.spent > 0 ? pct(backFace / tally.spent) : "–"} sub={tally.spent > 0 ? `really ${pct(backReal / tally.spent)}` : undefined} />
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-center gap-1">
              Box Content and Odds
              <Info>The live table from Jemlit&apos;s box API, exactly as the page shows it under &quot;Show chances&quot;. Cashback is what you get in Credits if you exchange the item instead of shipping it. Tap the cog to change any chance.</Info>
            </span>
          }
          actions={
            <button type="button" className="chip" onClick={() => onSettings("box")}>
              edit odds
            </button>
          }
        >
          <div>
            <table className="w-full table-fixed text-xs">
              <colgroup>
                <col />
                <col style={{ width: "4.6rem" }} />
                <col style={{ width: "4.6rem" }} />
                <col style={{ width: "4.4rem" }} />
                <col style={{ width: "4rem" }} />
              </colgroup>
              <thead>
                <tr>
                  <Th>Item</Th>
                  <Th right>Price</Th>
                  <Th right>Cashback</Th>
                  <Th right>Odds</Th>
                  <Th right>1 in</Th>
                </tr>
              </thead>
              <tbody>
                {[...table.bands]
                  .sort((a, b) => a.chance - b.chance)
                  .map((b) => (
                    <tr key={b.item.id} className={`border-t border-line ${last?.itemId === b.item.id && phase === "done" ? "bg-accent-soft" : ""}`}>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="misty-row-icon" style={{ background: RARITY_HEX[jemlitRarity(b.item.price)] ?? "#5b6472" }}>
                            <Icon name={jemlitIcon(b.item)} size={14} />
                          </span>
                          <HoverTip className="min-w-0 flex-1" tip={`${b.item.label} · ${money(b.item.price)} · cashback ${money(b.item.cashback)} · odds ${pctSmart(b.chance / table.total)} · 1 in ${b.chance > 0 ? num(Math.round(table.total / b.chance)) : "∞"}${b.item.autoCashback || !b.item.shippable ? " · credit only" : ""}`}>
                            <span className="block truncate">{b.item.label}</span>
                          </HoverTip>
                        </span>
                      </Td>
                      <Td right mono>{money(b.item.price)}</Td>
                      <Td right mono>{money(b.item.cashback)}</Td>
                      <Td right mono>{pctSmart(b.chance / table.total)}</Td>
                      <Td right mono>{b.chance > 0 ? num(Math.round(table.total / b.chance)) : "never"}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {last && lastItem && lastMath && phase === "done" && (
        <Card title="Analysis">
          <div className="space-y-2">
            <details className="acc">
              <summary>
                The maths of this box: how {money(box.price)} becomes {money(m.evPrice, 2)} back
                <Info>Every row costs the operator its listed price multiplied by its chance. Add the rows up and you have what the box pays back per open on average. Jemlit tunes this to 80% of the price on almost every box.</Info>
              </summary>
              <div className="pt-3">
                <JemlitMaths box={box} m={m} cfg={cfg} lastId={last.itemId} />
              </div>
            </details>

            <details className="acc">
              <summary>How this result was decided, step by step</summary>
              <div className="pt-3">
                <Narration spin={last} box={box} cfg={cfg} table={table} im={lastMath} playerName={player?.name ?? "the player"} ratio={ratio} exchanged={exchanged} />
              </div>
            </details>

            <details className="acc">
              <summary>
                Was it fair? The check
                <Info>Jemlit publishes the recipe: the server seed is hashed with SHA-512 and shown before play; the roll is HMAC-SHA512/256 of your seed and the play count, keyed by the server seed, turned into a number from 0 to 100; the item whose band contains it wins.</Info>
              </summary>
              <div className="space-y-2 pt-3 text-sm text-ink-2">
                {!cfg.provablyFair ? (
                  <p>The proof is switched off in the back office: this open came from a plain random number and there is nothing to check.</p>
                ) : (
                  <>
                    <p>
                      <b>What this proves:</b> the server seed behind this open was fixed before play (its hash was shown), and the roll of {last.roll.toFixed(4)} really comes from that seed, {player?.name ?? "the player"}&apos;s seed and play number {last.nonce}. So the result was not changed after the money went in.
                    </p>
                    <p>
                      <b>What it does not prove:</b> that the table was the same for everyone or the same as yesterday (Jemlit commits the seed, not the table), or that the Credits are worth the dollars they show. And if the player kept the browser&apos;s default seed, the site knew both inputs before play.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button kind="ghost" onClick={() => setVerify(verifyJemlitSpin(last, cfg))}>
                        Check this open
                      </Button>
                      <button type="button" className="chip" onClick={() => setShowProof((v) => !v)}>
                        {showProof ? "hide details" : "technical details"}
                      </button>
                      {verify && <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Checked: the seed matches its hash, the roll matches, the item matches" : `Does not match: ${verify.reason}`}</Badge>}
                    </div>
                    {showProof && (
                      <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 text-xs sm:grid-cols-2">
                        <Row k="Server seed hash (SHA-512), shown before play" v={last.serverHash} />
                        <Row k="Server seed, revealed" v={last.serverSeed} />
                        <Row k="Client seed" v={last.clientSeed} />
                        <Row k="Nonce (play count under this seed)" v={String(last.nonce)} />
                        <Row k="HMAC-SHA512/256(server seed, client-nonce)" v={last.digest} />
                        <Row k="Roll = hexdec(hash) ÷ 16^64 × 100" v={last.roll.toFixed(6)} />
                        <Row k="Band (lower < roll ≤ upper)" v={`${last.lower.toFixed(4)} to ${last.upper.toFixed(4)} = ${last.label}`} />
                        <Row k="Odds table used (SHA-256 of the chances)" v={last.tableHash} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>

            <details className="acc">
              <summary>The logic behind every Jemlit box</summary>
              <ol className="list-decimal space-y-2 pl-5 pt-3 text-sm text-ink-2">
                <li>
                  <b>The price is fixed first, and the odds are solved to 80%.</b> {box.name} costs {money(box.price)}; its rows add up to {pct(m.returnPrice)} of the price at listed values. 326 of the 333 captured boxes sit at exactly 80%.
                </li>
                <li>
                  <b>Every item has a chance, and the chances add up to 100.</b> {box.items.length} items; each one owns a band on a 0 to 100 line, listed on the page under &quot;See rolls&quot;.
                </li>
                <li>
                  <b>Each item costs the operator its price times its chance.</b> An item worth the box price or more drops {oneIn(m.pAtOrAbovePrice)}; the rest of the time the open pays less than it cost.
                </li>
                <li>
                  <b>Credits are the cushion.</b> Exchange a win and you get its cashback in Credits, {pct(0.9, 0)} of the listed price for most items; some rows are Credits only. Credits buy boxes and games and never become money. At listed prices the table returns {pct(m.returnPrice)}; in Credits {pct(m.returnCashback)}; in real terms about {pct(m.returnReal)}.
                </li>
                <li>
                  <b>Every open is its own roll.</b> The nonce counts up under one server seed, but nothing about an earlier open changes the next one&apos;s odds.
                </li>
                <li>
                  <b>The check covers the roll, not the table.</b> Jemlit hashes the server seed, not the odds, so the bands can change between seed rotations without any check failing. A player who never changes the browser&apos;s default client seed trusts the site with both inputs.
                </li>
              </ol>
            </details>

            {history.length > 1 && (
              <details className="acc">
                <summary>Last opens</summary>
                <div className="flex flex-wrap gap-2 pt-3 text-xs">
                  {history.map((h) => (
                    <span key={h.idx} className="chip" title={`nonce ${h.nonce} · roll ${h.roll.toFixed(4)}`}>
                      #{h.nonce} {h.credit ? `${money(h.cashback)} Credits` : h.label}
                    </span>
                  ))}
                </div>
              </details>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-paper px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-ink-3">{label}</div>
      <div className="text-base font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-ink-3">{sub}</div>}
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

/** Price × chance for every item, the totals and what the operator keeps, at listed prices, in Credits and really. */
export function JemlitMaths({ box, m, cfg, lastId }: { box: JemlitBox; m: JemlitMath; cfg: JemlitConfig; lastId?: string }) {
  const rows = [...m.perItem].sort((a, b) => b.share - a.share);
  const keepsPrice = box.price - m.evPrice;
  const keepsCash = box.price - m.evCashback;
  const keepsReal = box.price - m.evReal;
  return (
    <div className="space-y-3 text-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead>
            <tr>
              <Th>Item</Th>
              <Th right>Price</Th>
              <Th right>×</Th>
              <Th right>Chance</Th>
              <Th right>= costs per open</Th>
              <Th right>in Credits</Th>
              <Th right>really</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t border-line ${r.id === lastId ? "bg-accent-soft" : ""}`}>
                <Td>
                  <span className="flex items-center gap-2">
                    <span className="misty-name" title={r.label}>
                      {r.label}
                    </span>
                    {r.credit && <Badge>credit</Badge>}
                  </span>
                </Td>
                <Td right mono>{money(r.price)}</Td>
                <Td right>×</Td>
                <Td right mono>{fmtPct(r.chance * 100)}</Td>
                <Td right mono>{money(r.costPrice, 3)}</Td>
                <Td right mono>{money(r.costCashback, 3)}</Td>
                <Td right mono>{money(r.costReal, 3)}</Td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
              <Td>Total: pays back per open</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{fmtPct(m.total * 100)}</Td>
              <Td right mono>{money(m.evPrice, 2)}</Td>
              <Td right mono>{money(m.evCashback, 2)}</Td>
              <Td right mono>{money(m.evReal, 2)}</Td>
            </tr>
            <tr className="border-t border-line">
              <Td>Price of the box</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{money(box.price, 2)}</Td>
              <Td right mono>{money(box.price, 2)}</Td>
              <Td right mono>{money(box.price, 2)}</Td>
            </tr>
            <tr className="border-t border-line font-semibold">
              <Td>Jemlit keeps per open (price − pays back)</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>
                {money(keepsPrice, 2)} <span className="text-ink-3">({pct(keepsPrice / box.price)})</span>
              </Td>
              <Td right mono>
                {money(keepsCash, 2)} <span className="text-ink-3">({pct(keepsCash / box.price)})</span>
              </Td>
              <Td right mono>
                {money(keepsReal, 2)} <span className="text-ink-3">({pct(keepsReal / box.price)})</span>
              </Td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-3">
        Price = the listed value Jemlit shows. In Credits = the cashback if every win were exchanged (mostly {pct(0.9, 0)} of price; credit rows 100%). Really = credit rows at {money(cfg.creditReal)} per Credit and shipped items at {pct(cfg.itemRealized, 0)} of listed. Return = pays back ÷ price: {pct(m.returnPrice)}, {pct(m.returnCashback)}, {pct(m.returnReal)}.
      </p>
    </div>
  );
}

function Narration({ spin, box, cfg, table, im, playerName, ratio, exchanged }: { spin: JemlitSpin; box: JemlitBox; cfg: JemlitConfig; table: JemlitTable; im: JemlitMath["perItem"][number]; playerName: string; ratio: number; exchanged: boolean }) {
  const own = !!cfg.players.find((p) => p.id === spin.playerId)?.chances;
  const pf = cfg.provablyFair;
  const got = spin.credit || exchanged ? spin.cashback : 0;
  const face = got ? got * cfg.creditFace : spin.itemPrice;
  const real = got ? got * cfg.creditReal : spin.itemPrice * cfg.itemRealized;
  const steps: React.ReactNode[] = [
    <>
      <b>{playerName}</b> paid <b>{money(spin.price)}</b> in Credits for <b>{box.name}</b>.
    </>,
    pf ? (
      <>
        Before play the site had already chosen a secret (the server seed) and shown its scrambled copy. {playerName}&apos;s own seed was <code>{spin.clientSeed}</code>, and this was play number <b>{spin.nonce}</b> under that secret: the count goes up by one every open until the seed is changed.
      </>
    ) : (
      <>The proof is switched off, so the site simply drew a random number. Nothing was locked in and nothing can be checked.</>
    ),
    pf ? (
      <>
        The secret, the seed and the play number were mixed into one long number and turned into a roll of <b>{spin.roll.toFixed(4)}</b> on a line from 0 to 100. Every point on the line is equally likely.
      </>
    ) : (
      <>
        The roll was <b>{spin.roll.toFixed(4)}</b> on a line from 0 to 100.
      </>
    ),
    <>
      The odds table{own ? <> given to <b>{playerName}</b> (items worth the price or more are ×{ratio.toFixed(2)} as likely)</> : null} cuts that line into {box.items.length} bands, one per item, each as wide as its chance. The roll landed above <b>{spin.lower.toFixed(4)}</b> and at or below <b>{spin.upper.toFixed(4)}</b>: the band of <b>{spin.label}</b>. The page shows these bands under &quot;See rolls&quot;.
    </>,
    <>
      <b>How often this happens:</b> {spin.label} has a chance of {fmtPct(im.share * 100)}, about {oneIn(im.share)}.
    </>,
    spin.credit ? (
      <>
        <b>What it is worth:</b> a Credits-only row. {money(spin.cashback)} went straight to the balance. On screen that is {money(face)}; in real terms about {money(real)}, because Credits only buy more boxes and games and never become money.
      </>
    ) : exchanged ? (
      <>
        <b>What it is worth:</b> {spin.label} was exchanged for its cashback, {money(spin.cashback)} in Credits ({pct(spin.cashback / spin.itemPrice, 0)} of its listed price). In real terms about {money(real)}.
      </>
    ) : (
      <>
        <b>What it is worth:</b> {spin.label}, listed at {money(spin.itemPrice)}. Jemlit will ship it, or exchange it for {money(spin.cashback)} in Credits. At resale it is worth about {money(real)}.
      </>
    ),
    <>
      <b>This open in real money:</b> paid {money(spin.price)}, got about {money(real)}, so{" "}
      <b className={real >= spin.price ? "text-good" : "text-bad"}>
        {real >= spin.price ? "+" : "−"}
        {money(Math.abs(real - spin.price))}
      </b>
      . Over many opens this table pays back {pct(jemlitMath(box, playerChances(cfg, spin.playerId), cfg).returnReal)} of the price in real terms.
    </>,
    pf ? <>The server seed stays secret until {playerName} asks to rotate it; then it is revealed and every open made under it can be rechecked. Until then, the play count keeps rising under the same seed.</> : null,
  ];
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
        {steps.filter(Boolean).map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <details className="rounded-lg border border-line bg-paper p-3 text-xs">
        <summary className="cursor-pointer font-semibold">The bands on the 0 to 100 line (the roll was {spin.roll.toFixed(4)})</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr>
                <Th>Above</Th>
                <Th>Up to</Th>
                <Th>Width = chance</Th>
                <Th>Item</Th>
              </tr>
            </thead>
            <tbody>
              {table.bands
                .filter((b) => b.chance > 0)
                .map((b) => {
                  const hit = b.item.id === spin.itemId;
                  return (
                    <tr key={b.item.id} className={`border-t border-line ${hit ? "bg-accent-soft font-semibold" : ""}`}>
                      <Td mono>{b.lower.toFixed(4)}</Td>
                      <Td mono>{b.upper.toFixed(4)}</Td>
                      <Td mono>{fmtPct(b.chance * 100)}</Td>
                      <Td>
                        {b.item.label}
                        {hit && <Badge tone="accent">← {spin.roll.toFixed(4)} landed here</Badge>}
                      </Td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
