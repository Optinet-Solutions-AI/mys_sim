"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CatalogItem, MistyBox, MistyConfig, MistyOutcome, MistySpin } from "@/engine/types";
import { MISTY_BOXES, MistyOpener, buildTable, itemOddsRatio, lookup, mistyBox, mistyMath, playerWeights, verifyMistySpin, type MistyMath, type MistyTable } from "@/engine/labs/misty";
import { makeRng } from "@/engine/rng";
import { mistyConfigFor } from "@/lib/mistyPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Info, Td, Th } from "../ui";
import { HoverTip } from "../InfoPop";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { CountUp } from "../lab/CountUp";
import { BoxOpen } from "../lab/motifs";
import { reelPosition } from "../lab/reelMotion";

const CARD = 112; // card width plus gap, px
const STRIP = 44; // cards in the strip
const WIN = 36; // index the winner lands on

interface Tally {
  opens: number;
  spent: number;
  mistees: number;
  items: number;
  itemValue: number;
  freeSpins: number;
}
const ZERO: Tally = { opens: 0, spent: 0, mistees: 0, items: 0, itemValue: 0, freeSpins: 0 };

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "");
const fmtMist = (n: number) => (n % 1 ? n.toFixed(2) : String(n));
const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";

const RARITY_HEX: Record<string, string> = { common: "#5b6472", uncommon: "#2f7d4f", rare: "#1e5aa8", epic: "#0f6b6b", legendary: "#5b2a86", grail: "#8a6d1f", bonus: "#b4236b" };
const RARITY_TIER: Record<string, CatalogItem["tier"]> = { common: "common", uncommon: "common", rare: "rare", epic: "epic", legendary: "legendary", grail: "grail", bonus: "rare" };

/** A placeholder icon for an outcome, picked from words in its label. Never a photo, never exact. */
export function iconFor(o: MistyOutcome): string {
  if (o.kind === "bonus" || o.freeSpins > 0) return "fluent:sparkles";
  if (o.kind !== "item") return o.mistees >= 10 ? "fluent:money-bag" : "fluent:coin";
  const l = o.label.toLowerCase();
  const has = (...w: string[]) => w.some((x) => l.includes(x));
  if (has("rolex", "watch", "tank", "tissot", "longines", "omega", "tudor", "datejust", "seamaster")) return "fluent:watch";
  if (has("sunglass", "frames", "eyewear")) return "fluent:sunglasses";
  if (has("lip", "rouge coco", "rouge allure", "gloss", "lipstick")) return "fluent:lipstick";
  if (has("nail")) return "fluent:nail-polish";
  if (has("parfum", "eau de", "fragrance", "n°5", "opium", "good girl", "rouge 540", "spell on you", "cologne", "toilette")) return "fluent:lotion-bottle";
  if (has("shawl", "scarf", "twilly", "stole")) return "fluent:scarf";
  if (has("sandal", "heel", "pump", "mule")) return "fluent:high-heeled-shoe";
  if (has("sneaker", "trainer", "runner")) return "fluent:running-shoe";
  if (has("boot")) return "fluent:womans-boot";
  if (has("loafer", "flat", "slipper", "shoe")) return "fluent:flat-shoe";
  if (has("ring")) return "fluent:ring";
  if (has("bracelet", "necklace", "earring", "pendant", "van cleef", "tiffany", "pandora", "clic h", "jewel", "chain ", "cartier love", "alhambra")) return "fluent:gem-stone";
  if (has("wallet", "card holder", "cardholder", "pouch", "clutch", "purse", "coin case")) return "fluent:clutch-bag";
  if (has("bag", "kelly", "birkin", "flap", "picotin", "tote", "saddle", "backpack", "hobo", "boy", "22", "evelyne", "lindy", "constance", "speedy", "neverfull")) return "fluent:handbag";
  if (has("airwrap", "dyson", "hair", "dryer", "straightener")) return "fluent:headphone";
  if (has("candle", "diffuser")) return "fluent:fire";
  if (has("cream", "serum", "la mer", "la prairie", "skin", "moistur", "mask", "treatment")) return "fluent:lotion-bottle";
  if (has("belt", "tie", "cufflink")) return "fluent:necktie";
  if (has("coat", "jacket", "cardigan", "sweater", "hoodie")) return "fluent:coat";
  if (has("dress", "skirt", "top ", "shirt")) return "fluent:dress";
  if (has("glove")) return "fluent:gloves";
  if (has("hat", "cap", "beanie")) return "fluent:top-hat";
  if (has("bottle", "champagne", "wine")) return "fluent:bottle-with-popping-cork";
  return "fluent:wrapped-gift";
}

/** Dress an outcome up as a catalogue item so the shared box-opening animation and tiles can show it. */
export function asCatalogItem(o: MistyOutcome, misteeFace = 1): CatalogItem {
  const item = o.kind === "item";
  const value = item ? (o.valueUsd ?? 0) : o.mistees * misteeFace;
  const parts = o.label.split(" ");
  return {
    id: o.id,
    name: item ? o.label : o.label,
    brand: item ? (o.label.startsWith("Louis Vuitton") ? "Louis Vuitton" : o.label.startsWith("Tiffany") ? "Tiffany & Co." : o.label.startsWith("Ralph Lauren") ? "Ralph Lauren" : parts[0]) : "Misty",
    category: item ? "accessory" : "credit",
    tier: RARITY_TIER[o.rarity] ?? "common",
    retail: value,
    asking: value,
    realized: value,
    confidence: "medium",
    icon: iconFor(o),
    color: RARITY_HEX[o.rarity] ?? "#5b6472",
    source: "captured",
    operator: "Misty",
  };
}

function buildStrip(table: MistyTable, winner: MistyOutcome, spinIdx: number): MistyOutcome[] {
  const rng = makeRng("sfc32", `misty-strip:${spinIdx}`);
  const arr: MistyOutcome[] = [];
  for (let i = 0; i < STRIP; i++) arr.push(lookup(table, rng.next()).outcome);
  arr[WIN] = winner;
  return arr;
}

function CardFace({ o }: { o: MistyOutcome }) {
  return (
    <div className={`misty-card misty-${o.rarity}`} title={o.label}>
      <div className="misty-card-rarity">{o.rarity}</div>
      <div className="flex flex-1 items-center justify-center">
        <Icon name={iconFor(o)} size={34} className="drop-shadow" />
      </div>
      <div className="misty-card-title">{o.kind === "item" ? o.label : o.kind === "bonus" ? o.label.replace(" Mistees", " M") : `${o.mistees} Mistees`}</div>
      <div className="misty-card-sub">{o.kind === "item" ? `${money(o.valueUsd ?? 0)}+` : o.kind === "bonus" ? "free spins" : "site credit"}</div>
    </div>
  );
}

const describeFrequency = (share: number, rank: number) => {
  if (rank === 0) return "the most common result on this box";
  if (share >= 0.15) return "a very common result";
  if (share >= 0.05) return "a common result";
  if (share >= 0.01) return "an uncommon result";
  if (share >= 0.001) return "a rare result";
  return "a very rare result";
};

export function MistyStage({ cfg, seed, onChange, onSettings }: { cfg: MistyConfig; seed: number; onChange: (c: MistyConfig) => void; onSettings: (section?: string) => void }) {
  const box = mistyBox(cfg.boxSlug);
  const key = useMemo(() => JSON.stringify([cfg, seed]), [cfg, seed]);
  const openerRef = useRef<{ key: string; opener: MistyOpener } | null>(null);
  if (!openerRef.current || openerRef.current.key !== key) openerRef.current = { key, opener: new MistyOpener(cfg, `live:${seed}`) };
  const opener = openerRef.current.opener;
  const player = cfg.players.find((p) => p.id === cfg.activePlayerId) ?? cfg.players[0];
  const pw = useMemo(() => playerWeights(cfg, player?.id ?? ""), [cfg, player?.id]);
  const table = useMemo(() => buildTable(box, pw.weights), [box, pw.weights]);
  const m = useMemo(() => mistyMath(box, pw.weights, cfg.bonus, cfg), [box, pw.weights, cfg]);
  const ratio = itemOddsRatio(box, cfg.weights, player?.weights);

  const [reveal] = useState<"box" | "strip">("box"); // the spin strip stays in the code; the box opening is the reveal
  const [tally, setTally] = useState<Tally>(ZERO);
  const [last, setLast] = useState<MistySpin | null>(null);
  const [pending, setPending] = useState<MistySpin | null>(null);
  const [spinId, setSpinId] = useState(0);
  const [strip, setStrip] = useState<MistyOutcome[]>(() => buildStrip(table, table.entries[0].outcome, 0));
  const [x, setX] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "bonus" | "done">("idle");
  const [bonusShown, setBonusShown] = useState(0);
  const [fast, setFast] = useState(false);
  const [verify, setVerify] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [traded, setTraded] = useState(false);
  const [history, setHistory] = useState<MistySpin[]>([]);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTally(ZERO);
    setLast(null);
    setPending(null);
    setSpinId(0);
    setPhase("idle");
    setX(0);
    setBonusShown(0);
    setVerify(null);
    setTraded(false);
    setHistory([]);
    setStrip(buildStrip(table, table.entries[0].outcome, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      timersRef.current.forEach((t) => clearTimeout(t));
    },
    [],
  );

  const finish = (s: MistySpin) => {
    setLast(s);
    setHistory((h) => [s, ...h].slice(0, 8));
    setTally((t) => ({ opens: t.opens + 1, spent: t.spent + s.price, mistees: t.mistees + s.mistees, items: t.items + (s.kind === "item" ? 1 : 0), itemValue: t.itemValue + s.itemValue, freeSpins: t.freeSpins + s.freeSpins }));
    if (s.bonus.length) {
      setPhase("bonus");
      s.bonus.forEach((b, i) => {
        const t = window.setTimeout(
          () => {
            setBonusShown(i + 1);
            setTally((tt) => ({ ...tt, mistees: tt.mistees + b.mistees }));
            if (i === s.bonus.length - 1) setPhase("done");
          },
          (fast ? 250 : 900) * (i + 1),
        );
        timersRef.current.push(t);
      });
    } else setPhase("done");
  };

  const spin = () => {
    if (phase === "spinning" || phase === "bonus") return;
    const s = opener.spin(player?.id);
    const winner = box.outcomes.find((o) => o.id === s.outcomeId)!;
    setVerify(null);
    setTraded(false);
    setBonusShown(0);
    setPhase("spinning");
    setPending(s);
    if (reveal === "box") {
      setSpinId(s.idx);
      return; // BoxOpen animates and calls finish through onDone
    }
    const rng = makeRng("sfc32", `misty-land:${s.idx}:${seed}`);
    const land = (rng.next() - 0.5) * CARD * 0.55; // never dead centre, never past the edge
    setStrip(buildStrip(table, winner, s.idx + seed));
    const width = viewRef.current?.clientWidth ?? 640;
    const D = WIN * CARD - (width / 2 - CARD / 2) + land;
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dur = fast || reduce ? 420 : 4200;
    const t0 = performance.now();
    setX(0);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setX(-reelPosition(k, D));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else finish(s);
    };
    rafRef.current = requestAnimationFrame(step);
  };

  const tradeIn = () => {
    if (!last || last.kind !== "item" || traded) return;
    setTraded(true);
    setTally((t) => ({ ...t, items: t.items - 1, itemValue: t.itemValue - last.itemValue, mistees: t.mistees + last.itemValue }));
  };

  const busy = phase === "spinning" || phase === "bonus";
  const faceBack = tally.itemValue + tally.mistees * cfg.misteeFace;
  const band = last ? table.entries.find((e) => e.outcome.id === last.outcomeId) : undefined;
  const lastOutcome = last ? box.outcomes.find((o) => o.id === last.outcomeId) : undefined;
  const pendingItem = pending ? asCatalogItem(box.outcomes.find((o) => o.id === pending.outcomeId)!, cfg.misteeFace) : null;
  const lastMath = last ? m.perOutcome.find((p) => p.id === last.outcomeId) : undefined;
  const rankOfLast = last ? [...m.perOutcome].sort((a, b) => b.share - a.share).findIndex((p) => p.id === last.outcomeId) : -1;
  const lastMistees = last ? (traded ? last.itemValue : last.totalMistees) : 0;
  const lastFace = last ? (last.kind === "item" && !traded ? last.itemValue : lastMistees * cfg.misteeFace) : 0;
  const lastReal = last ? (last.kind === "item" && !traded ? last.itemValue * cfg.itemRealized : lastMistees * cfg.misteeReal) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
        <Link href="/docs/misty" className="btn no-underline">
          <Icon name="ph:book-open-text" size={16} /> Document
        </Link>
        <Link href="/build" className="btn no-underline">
          <Icon name="ph:cube" size={16} /> Create Mystery Box
        </Link>
      </div>
      {/* the boxes, as the site lists them */}
      <div>
      <h2 className="mb-2 text-sm font-semibold text-ink-2">Select a Mystery Box</h2>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MISTY_BOXES.map((b) => {
          const bm = mistyMath(b, undefined, b.bonus, cfg);
          const active = b.slug === cfg.boxSlug;
          const top = b.outcomes.reduce((best, o) => ((o.valueUsd ?? 0) > (best.valueUsd ?? 0) ? o : best), b.outcomes[0]);
          return (
            <button key={b.slug} type="button" disabled={busy} className={`misty-box-tile ${active ? "misty-box-tile-active" : ""}`} onClick={() => !active && onChange(mistyConfigFor(b.slug, cfg))} title={b.tagline}>
              <div className="flex items-center gap-2">
                <span className="misty-tile-icon" style={{ background: RARITY_HEX[top.rarity] ?? "#5b6472" }}>
                  <Icon name={iconFor(top)} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] uppercase tracking-wide opacity-70">{b.price > 0 ? money(b.price) : "free"}</span>
                  <span className="block truncate text-sm font-semibold leading-tight">{b.name}</span>
                  <span className="block text-[11px] opacity-70">{bm.pItem > 0 ? `a piece ${oneIn(bm.pItem)}` : "Mistees only"}</span>
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
            <Badge tone="accent">{box.price > 0 ? money(box.price) : "free"}</Badge>
            {player?.weights && <Badge tone={ratio > 1 ? "good" : "bad"}>own odds ×{ratio.toFixed(2)}</Badge>}
          </div>

          {reveal === "box" ? (
            <div className="rounded-xl border border-line bg-paper">
              <BoxOpen winner={pendingItem} spinId={spinId} onDone={() => pending && finish(pending)} fast={fast} label={box.name.replace(/^The /, "")} />
            </div>
          ) : (
            <div ref={viewRef} className="misty-view">
              <div className="misty-pointer" />
              <div className="misty-strip" style={{ transform: `translateX(${x}px)`, transition: "none" }}>
                {strip.map((o, i) => (
                  <CardFace key={`${i}-${o.id}`} o={o} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary text-base" disabled={busy || !player} onClick={spin}>
              {busy ? (reveal === "box" ? "Opening…" : "Spinning…") : `${reveal === "box" ? "Open the box" : "Tap to spin"} · ${box.price > 0 ? money(box.price) : "free"}`}
            </button>
            <label className="flex items-center gap-1 text-xs text-ink-3">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> fast reveal
            </label>
            {!cfg.provablyFair && <Badge tone="bad">no proof: plain random</Badge>}
          </div>

          {last && lastOutcome && lastMath && phase !== "spinning" && (
            <div className="mt-4 flex flex-wrap items-start gap-4 rounded-xl border border-line bg-paper p-3">
              <ItemTile item={asCatalogItem(lastOutcome, cfg.misteeFace)} size={72} />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="text-lg font-semibold">
                  {last.kind === "item" ? (traded ? `Traded in for ${num(last.itemValue)} Mistees` : `You pulled ${last.label}`) : last.kind === "bonus" ? last.label : `${last.mistees} Mistees`}
                </div>
                {last.kind === "item" && !traded && (
                  <div className="text-ink-2">
                    Listed at {money(last.itemValue)}. Ship it, or{" "}
                    <button type="button" className="chip" onClick={tradeIn}>
                      trade it in for {num(last.itemValue)} Mistees
                    </button>
                  </div>
                )}
                {last.bonus.length > 0 && (
                  <div className="space-y-1">
                    {last.bonus.map((b, i) => (
                      <div key={b.nonce} className={`misty-bonus ${i < bonusShown ? "misty-bonus-in" : "misty-bonus-wait"}`}>
                        Free spin {i + 1}: {i < bonusShown ? `+${fmtMist(b.mistees)} Mistees` : "spinning…"}
                      </div>
                    ))}
                  </div>
                )}
                {phase === "done" && (
                  <div className="mt-1 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                    <div>
                      <span className="text-ink-3">How often: </span>
                      {fmtPct(lastMath.share * 100)} of opens, about {oneIn(lastMath.share)}. {describeFrequency(lastMath.share, rankOfLast)}.
                    </div>
                    <div>
                      <span className="text-ink-3">Worth on screen: </span>
                      {money(lastFace)}
                      {last.kind !== "item" || traded ? ` (${fmtMist(lastMistees)} Mistees × ${money(cfg.misteeFace)})` : " (listed price)"}
                    </div>
                    <div>
                      <span className="text-ink-3">Worth really: </span>
                      about {money(lastReal)}
                      {last.kind !== "item" || traded ? ` (${fmtMist(lastMistees)} × ${money(cfg.misteeReal)}, credit that only buys more boxes)` : ` (${pct(cfg.itemRealized, 0)} of listed at resale)`}
                    </div>
                    <div>
                      <span className="text-ink-3">This open, in real money: </span>
                      <b className={lastReal >= last.price ? "text-good" : "text-bad"}>
                        {lastReal >= last.price ? "+" : "−"}
                        {money(Math.abs(lastReal - last.price))}
                      </b>{" "}
                      (paid {money(last.price)}, got about {money(lastReal)})
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Mini label="Opens" value={num(tally.opens)} />
            <Mini label="Paid" value={money(tally.spent)} />
            <Mini label="Mistees" value={<CountUp value={tally.mistees} format={(n) => fmtMist(Math.round(n * 100) / 100)} />} sub={`${money(tally.mistees * cfg.misteeFace)} on screen`} />
            <Mini label="Pieces" value={num(tally.items)} sub={money(tally.itemValue)} />
            <Mini label="RTP" value={tally.spent > 0 ? pct(faceBack / tally.spent) : "–"} sub={tally.spent > 0 ? `really ${pct((tally.itemValue * cfg.itemRealized + tally.mistees * cfg.misteeReal) / tally.spent)}` : undefined} />
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-center gap-1">
              Box Content and Odds
              <Info>The live odds table, exactly as the page shows it. Tap the cog to change any percentage, or to give a player a table of their own.</Info>
            </span>
          }
          actions={
            <button type="button" className="chip" onClick={() => onSettings("box")}>
              edit odds
            </button>
          }
        >
          <div className="max-h-[460px] overflow-auto">
            <table className="w-full min-w-[440px] text-xs">
              <thead>
                <tr>
                  <Th>Outcome</Th>
                  <Th right>Price</Th>
                  <Th right>Odds</Th>
                  <Th right>1 in</Th>
                </tr>
              </thead>
              <tbody>
                {[...table.entries]
                  .sort((a, b) => a.percent - b.percent)
                  .map((e) => (
                    <tr key={e.outcome.id} className={`border-t border-line ${last?.outcomeId === e.outcome.id && phase !== "spinning" ? "bg-accent-soft" : ""}`}>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="misty-row-icon" style={{ background: RARITY_HEX[e.outcome.rarity] ?? "#5b6472" }}>
                            <Icon name={iconFor(e.outcome)} size={14} />
                          </span>
                          <HoverTip tip={`${e.outcome.label} · ${e.outcome.kind === "item" ? money(e.outcome.valueUsd ?? 0) : `${e.outcome.mistees} Mistees${e.outcome.freeSpins ? ` + ${e.outcome.freeSpins} free spin${e.outcome.freeSpins > 1 ? "s" : ""}` : ""}`} · odds ${pctSmart(e.percent / table.total)} · 1 in ${e.percent > 0 ? num(Math.round(table.total / e.percent)) : "∞"}`}>
                            <span className="misty-name">{e.outcome.label}</span>
                          </HoverTip>
                        </span>
                      </Td>
                      <Td right mono>{e.outcome.kind === "item" ? money(e.outcome.valueUsd ?? 0) : e.outcome.kind === "bonus" ? `${e.outcome.mistees} M + spins` : `${e.outcome.mistees} M`}</Td>
                      <Td right mono>{pctSmart(e.percent / table.total)}</Td>
                      <Td right mono>{e.percent > 0 ? num(Math.round(table.total / e.percent)) : "never"}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* analysis, only after an open, every part folded */}
      {last && lastOutcome && lastMath && phase !== "spinning" && (
        <Card title="Analysis">
          <div className="space-y-2">
            <details className="acc">
              <summary>
                The maths of this box: how {money(box.price)} becomes {money(m.payFace, 2)} back
                <Info>Every row costs the operator its worth multiplied by its chance. Add the rows up and you have what the box pays back per open on average.</Info>
              </summary>
              <div className="pt-3">
                <BoxMaths box={box} m={m} cfg={cfg} lastId={last.outcomeId} />
              </div>
            </details>

            <details className="acc">
              <summary>How this result was decided, step by step</summary>
              <div className="pt-3">
                <Narration spin={last} box={box} cfg={cfg} table={table} om={lastMath} rank={rankOfLast} playerName={player?.name ?? "the player"} ratio={ratio} traded={traded} />
              </div>
            </details>

            <details className="acc">
              <summary>
                Was it fair? The check
                <Info>{box.fairness || "Every open is resolved from a secret committed before you pay, a seed you can set, and a spin number. The secret is revealed at the open and the odds table is frozen onto it."}</Info>
              </summary>
              <div className="space-y-2 pt-3 text-sm text-ink-2">
                {!cfg.provablyFair ? (
                  <p>The proof is switched off in the back office: this open came from a plain random number, nothing was locked in beforehand, and there is nothing to check. Turn it on under the cog, &quot;The proof&quot;.</p>
                ) : (
                  <>
                    <p>
                      <b>What this proves:</b> the secret that decided this open was locked in before {player?.name ?? "the player"} paid, and the roll of {(last.roll * 100).toFixed(3)} really comes from that secret plus the seed. So the result was not changed after the money went in, and it was read against the table that was frozen onto the open.
                    </p>
                    <p>
                      <b>What it does not prove:</b> that every player gets the same table, or that a Mistee is worth a dollar.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button kind="ghost" onClick={() => setVerify(verifyMistySpin(last, cfg))}>
                        Check this open
                      </Button>
                      <button type="button" className="chip" onClick={() => setShowProof((v) => !v)}>
                        {showProof ? "hide details" : "technical details"}
                      </button>
                      {verify && <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Checked: the secret matches, the roll matches, the result matches" : `Does not match: ${verify.reason}`}</Badge>}
                    </div>
                    {showProof && (
                      <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 text-xs sm:grid-cols-2">
                        <Row k="Scrambled copy of the secret, shown before payment" v={last.serverHash} />
                        <Row k="Secret, revealed after the open" v={last.serverSeed} />
                        <Row k="Player's seed" v={last.clientSeed} />
                        <Row k="Spin number" v={String(last.nonce)} />
                        <Row k="Secret + seed + spin number, mixed (HMAC-SHA256)" v={last.digest} />
                        <Row k="Roll: first 13 characters ÷ 2^52" v={`${(last.roll * 100).toFixed(4)} on a 0 to 100 line`} />
                        <Row k="Odds table frozen onto this open (SHA-256)" v={last.tableHash} />
                        <Row k="Band the roll fell in" v={band ? `${band.from.toFixed(3)} to ${band.to.toFixed(3)} = ${band.outcome.label}` : ""} />
                        {last.bonus.map((b, i) => (
                          <Row key={b.nonce} k={`Free spin ${i + 1}: spin number ${b.nonce}, roll`} v={`${(b.roll * 100).toFixed(2)} → ${fmtMist(b.mistees)} Mistees`} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </details>

            <details className="acc">
              <summary>The logic behind every Misty box</summary>
              <ol className="list-decimal space-y-2 pl-5 pt-3 text-sm text-ink-2">
                <li>
                  <b>The price is fixed first.</b> {box.name} costs {box.price > 0 ? money(box.price) : "nothing"}. Everything else is tuned to fit that price.
                </li>
                <li>
                  <b>Every outcome has a chance, and the chances add up to 100.</b> This box has {box.outcomes.length} outcomes. A piece drops {oneIn(m.pItem)}; the rest of the time the box pays Mistees.
                </li>
                <li>
                  <b>Each outcome costs the operator its worth times its chance.</b> Add those up and {box.name} pays back about {money(m.payFace, 2)} per open with Mistees counted at {money(cfg.misteeFace)} each, which is {pct(m.returnFace)} of the price. Counting Mistees at what they really cost ({money(cfg.misteeReal)}) and pieces at resale, it is about {money(m.payReal, 2)}, or {pct(m.returnReal)}.
                </li>
                <li>
                  <b>The rare piece is the adjustable part.</b> Make the top piece twice as likely and its cost per open doubles; that is how a {money(box.outcomes.reduce((s, o) => Math.max(s, o.valueUsd ?? 0), 0))} piece fits inside a {box.price > 0 ? money(box.price) : "free"} box.
                </li>
                <li>
                  <b>Every open is its own roll.</b> Nothing is remembered between opens, no pool runs out, nobody&apos;s result changes anybody else&apos;s. A hundred players opening this box are a hundred independent rolls.
                </li>
                <li>
                  <b>Mistees are credit, not money.</b> They can only buy more boxes or products on the site. On screen one Mistee is {money(cfg.misteeFace)}; spent on boxes it is worth about {money(cfg.misteeReal)}.
                </li>
                <li>
                  <b>The check covers the roll, not the table.</b> The secret locked in before payment proves the result was not changed afterwards, and the frozen table proves the roll was read against that table. It does not prove every player was given the same table. The back office here can give {player?.name ?? "a player"} their own odds, and every check still passes.
                </li>
              </ol>
            </details>

            {history.length > 1 && (
              <details className="acc">
                <summary>Last opens</summary>
                <div className="flex flex-wrap gap-2 pt-3 text-xs">
                  {history.map((h) => (
                    <span key={h.idx} className="chip" title={`open ${h.idx} · roll ${(h.roll * 100).toFixed(3)}`}>
                      #{h.idx} {h.kind === "item" ? h.label.split(",")[0] : `${fmtMist(h.totalMistees)} Mistees`}
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

/** Worth × chance for every row, the subtotals and the return, on screen and really. */
export function BoxMaths({ box, m, cfg, lastId }: { box: MistyBox; m: MistyMath; cfg: MistyConfig; lastId?: string }) {
  const rows = [...m.perOutcome].sort((a, b) => (a.kind === "item" ? 1 : 0) - (b.kind === "item" ? 1 : 0) || b.share - a.share);
  const pieces = rows.filter((r) => r.kind === "item");
  const credits = rows.filter((r) => r.kind !== "item");
  const sum = (xs: typeof rows, k: "costFace" | "costReal") => xs.reduce((s, r) => s + r[k], 0);
  const keepsFace = box.price - m.payFace;
  const keepsReal = box.price - m.payReal;
  return (
    <div className="space-y-3 text-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr>
              <Th>Outcome</Th>
              <Th right>Worth</Th>
              <Th right>×</Th>
              <Th right>Chance</Th>
              <Th right>= costs per open</Th>
              <Th right>really</Th>
            </tr>
          </thead>
          <tbody>
            {credits.map((r) => (
              <MathRow key={r.id} r={r} box={box} cfg={cfg} hi={r.id === lastId} />
            ))}
            <tr className="border-t-2 border-line bg-paper font-semibold">
              <Td>All the Mistee rows together</Td>
              <Td right mono>{m.evMistees.toFixed(2)} Mistees per open</Td>
              <Td right> </Td>
              <Td right mono>{fmtPct((1 - m.pItem) * 100)}</Td>
              <Td right mono>{money(sum(credits, "costFace"), 2)}</Td>
              <Td right mono>{money(sum(credits, "costReal"), 2)}</Td>
            </tr>
            {pieces.map((r) => (
              <MathRow key={r.id} r={r} box={box} cfg={cfg} hi={r.id === lastId} />
            ))}
            <tr className="border-t-2 border-line bg-paper font-semibold">
              <Td>All the pieces together</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>
                {fmtPct(m.pItem * 100)} = {oneIn(m.pItem)}
              </Td>
              <Td right mono>{money(sum(pieces, "costFace"), 2)}</Td>
              <Td right mono>{money(sum(pieces, "costReal"), 2)}</Td>
            </tr>
            <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
              <Td>Total: pays back per open</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{fmtPct(m.total)}</Td>
              <Td right mono>{money(m.payFace, 2)}</Td>
              <Td right mono>{money(m.payReal, 2)}</Td>
            </tr>
            <tr className="border-t border-line">
              <Td>Price of the box</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{money(box.price, 2)}</Td>
              <Td right mono>{money(box.price, 2)}</Td>
            </tr>
            <tr className="border-t border-line font-semibold">
              <Td>Misty keeps per open (price − pays back)</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>
                <span className={keepsFace >= 0 ? "text-good" : "text-bad"}>{money(keepsFace, 2)}</span> <span className="text-ink-3">({pct(box.price > 0 ? keepsFace / box.price : 0)})</span>
              </Td>
              <Td right mono>
                <span className={keepsReal >= 0 ? "text-good" : "text-bad"}>{money(keepsReal, 2)}</span> <span className="text-ink-3">({pct(box.price > 0 ? keepsReal / box.price : 0)})</span>
              </Td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-line bg-paper p-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-3">On screen (Mistees at {money(cfg.misteeFace)}, pieces at listed)</div>
          <div className="mt-1 font-mono text-xs leading-6">
            price {money(box.price, 2)} − pays back {money(m.payFace, 2)} = <b>Misty keeps {money(keepsFace, 2)}</b>
            <br />
            return = {money(m.payFace, 2)} ÷ {money(box.price, 2)} = <b>{pct(m.returnFace)}</b>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-paper p-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-3">Really (Mistees at {money(cfg.misteeReal)}, pieces at {pct(cfg.itemRealized, 0)} of listed)</div>
          <div className="mt-1 font-mono text-xs leading-6">
            price {money(box.price, 2)} − pays back {money(m.payReal, 2)} = <b>Misty keeps {money(keepsReal, 2)}</b>
            <br />
            return = {money(m.payReal, 2)} ÷ {money(box.price, 2)} = <b>{pct(m.returnReal)}</b>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-3">
        A free spin pays {m.bonusEv.toFixed(2)} Mistees on average ({cfg.bonus.map((b) => `${fmtMist(b.mistees)} at ${b.weight}%`).join(", ")}), so a row with free spins is worth its own Mistees plus {m.bonusEv.toFixed(2)} per spin. Read the pieces from the bottom: the dearer the piece, the rarer it is made, so every piece costs about the same few cents per open.
      </p>
    </div>
  );
}

function MathRow({ r, box, cfg, hi }: { r: MistyMath["perOutcome"][number]; box: MistyBox; cfg: MistyConfig; hi: boolean }) {
  const o = box.outcomes.find((x) => x.id === r.id)!;
  const worth = r.kind === "item" ? money(o.valueUsd ?? 0) : `${fmtMist(Math.round(r.mistees * 100) / 100)} M × ${money(cfg.misteeFace)} = ${money(r.valueFace, 2)}`;
  return (
    <tr className={`border-t border-line ${hi ? "bg-accent-soft" : ""}`}>
      <Td>
        <span className="flex items-center gap-2">
          <span className="misty-row-icon" style={{ background: RARITY_HEX[o.rarity] ?? "#5b6472" }}>
            <Icon name={iconFor(o)} size={14} />
          </span>
          <span className="misty-name" title={o.label}>
            {o.label}
          </span>
        </span>
      </Td>
      <Td right mono>{worth}</Td>
      <Td right>×</Td>
      <Td right mono>{fmtPct(r.percent)}</Td>
      <Td right mono>{money(r.costFace, 2)}</Td>
      <Td right mono>{money(r.costReal, 2)}</Td>
    </tr>
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

/** Every step of one open in plain words, with the sums, and the bands the roll was read against. */
function Narration({ spin, box, cfg, table, om, rank, playerName, ratio, traded }: { spin: MistySpin; box: MistyBox; cfg: MistyConfig; table: MistyTable; om: MistyMath["perOutcome"][number]; rank: number; playerName: string; ratio: number; traded: boolean }) {
  const own = !!cfg.players.find((p) => p.id === spin.playerId)?.weights;
  const pf = cfg.provablyFair;
  const roll = spin.roll * 100;
  const band = table.entries.find((e) => e.outcome.id === spin.outcomeId);
  const mist = traded ? spin.itemValue : spin.totalMistees;
  const face = spin.kind === "item" && !traded ? spin.itemValue : mist * cfg.misteeFace;
  const real = spin.kind === "item" && !traded ? spin.itemValue * cfg.itemRealized : mist * cfg.misteeReal;
  const steps: React.ReactNode[] = [];
  steps.push(
    <>
      <b>{playerName}</b> paid <b>{spin.price > 0 ? money(spin.price) : "nothing"}</b> for <b>{box.name}</b>.
    </>,
  );
  if (pf) {
    steps.push(<>Before the money went in, the site had already locked in a secret number for this open. It could not change that number afterwards. {playerName} added a seed of their own, so neither side could pick the result alone.</>);
    steps.push(
      <>
        The secret and the seed were mixed into one roll: <b>{roll.toFixed(3)}</b> on a line from 0 to 100. Every point on that line is equally likely.
      </>,
    );
  } else {
    steps.push(
      <>
        The proof is switched off, so the site simply drew a roll of <b>{roll.toFixed(3)}</b> on a line from 0 to 100. Nothing was locked in beforehand and nothing can be checked.
      </>,
    );
  }
  steps.push(
    <>
      The odds table{own ? <> given to <b>{playerName}</b> (not the box&apos;s own table: pieces are ×{ratio.toFixed(2)} as likely)</> : null} cuts that line into {box.outcomes.length} bands, one per outcome, each as wide as its chance. <b>{roll.toFixed(3)}</b> sits between <b>{band ? band.from.toFixed(3) : "?"}</b> and <b>{band ? band.to.toFixed(3) : "?"}</b>, and that band belongs to <b>{spin.label}</b>. The bands are listed below.
    </>,
  );
  if (spin.bonus.length) {
    steps.push(
      <>
        {spin.label} carries {spin.bonus.length} free spin{spin.bonus.length > 1 ? "s" : ""}. Each one is a new roll from the same secret, read against the small free-spin table ({cfg.bonus.map((b) => `${fmtMist(b.mistees)} Mistees at ${b.weight}%`).join(", ")}):{" "}
        {spin.bonus.map((b, i) => (
          <span key={b.nonce}>
            roll {(b.roll * 100).toFixed(2)} paid {fmtMist(b.mistees)} Mistees{i < spin.bonus.length - 1 ? "; " : "."}
          </span>
        ))}{" "}
        Together with the {spin.mistees} Mistees of the outcome itself that makes <b>{fmtMist(spin.totalMistees)} Mistees</b>.
      </>,
    );
  }
  steps.push(
    <>
      <b>How often this happens:</b> {spin.label} has a chance of {fmtPct(om.percent)}, which is about {oneIn(om.share)}. That is {describeFrequency(om.share, rank)}.
    </>,
  );
  if (spin.kind === "item" && !traded) {
    steps.push(
      <>
        <b>What it is worth:</b> a {spin.label}, listed at {money(spin.itemValue)}. Shipped and sold on, about {money(spin.itemValue)} × {pct(cfg.itemRealized, 0)} = <b>{money(real)}</b>. Traded in instead, it becomes {num(spin.itemValue)} Mistees, about {money(spin.itemValue * cfg.misteeReal)} in real terms.
      </>,
    );
  } else {
    steps.push(
      <>
        <b>What it is worth:</b> {fmtMist(mist)} Mistees{traded ? " in place of the piece" : ""}. On screen: {fmtMist(mist)} × {money(cfg.misteeFace)} = <b>{money(face)}</b>. Really: {fmtMist(mist)} × {money(cfg.misteeReal)} = <b>{money(real)}</b>, because Mistees only buy more boxes and never become money.
      </>,
    );
  }
  steps.push(
    <>
      <b>This open in real money:</b> paid {money(spin.price)}, got about {money(real)}, so{" "}
      <b className={real >= spin.price ? "text-good" : "text-bad"}>
        {real >= spin.price ? "+" : "−"}
        {money(Math.abs(real - spin.price))}
      </b>
      . One open proves nothing on its own; over many opens this table pays back {pct(mistyMath(box, playerWeights(cfg, spin.playerId).weights, cfg.bonus, cfg).returnReal)} of the price in real terms.
    </>,
  );
  if (pf) {
    steps.push(<>The secret is now shown. Anyone can redo the sum and get the same roll, which proves nothing was changed after payment. A new secret is already locked in for the next open.</>);
  }
  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
      <details className="rounded-lg border border-line bg-paper p-3 text-xs" open>
        <summary className="cursor-pointer font-semibold">The bands on the 0 to 100 line (the roll was {roll.toFixed(3)})</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Width = chance</Th>
                <Th>Outcome</Th>
              </tr>
            </thead>
            <tbody>
              {table.entries
                .filter((e) => e.percent > 0)
                .map((e) => {
                  const hit = e.outcome.id === spin.outcomeId;
                  return (
                    <tr key={e.outcome.id} className={`border-t border-line ${hit ? "bg-accent-soft font-semibold" : ""}`}>
                      <Td mono>{e.from.toFixed(3)}</Td>
                      <Td mono>{e.to.toFixed(3)}</Td>
                      <Td mono>{fmtPct(e.percent)}</Td>
                      <Td>
                        <span className="flex items-center gap-2">
                          <span className="misty-row-icon" style={{ background: RARITY_HEX[e.outcome.rarity] ?? "#5b6472" }}>
                            <Icon name={iconFor(e.outcome)} size={12} />
                          </span>
                          {e.outcome.label}
                          {hit && <Badge tone="accent">← {roll.toFixed(3)} landed here</Badge>}
                        </span>
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
