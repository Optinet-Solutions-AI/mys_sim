"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CreditsConfig } from "@/engine/types";
import { CATALOG_BY_ID } from "@/engine/catalog";
import { LiveOpener, type LiveOpen } from "@/lib/live";
import { money, num, pct } from "@/lib/format";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { Badge, Card, Info, Stat } from "../ui";
import { CountUp } from "../lab/CountUp";

interface Session {
  spent: number;
  opens: number;
  credits: number; // my tickets in the current draw
  physicalRealized: number;
  physicalDisplay: number;
  prizesWon: number;
  draws: number;
  poolPaid: number; // tickets sold in the current draw (mine + other players)
  poolFree: number;
  log: { n: number; text: string; tone?: "good" | "bad" | "warn" }[];
  last: LiveOpen | null;
}
const EMPTY: Session = { spent: 0, opens: 0, credits: 0, physicalRealized: 0, physicalDisplay: 0, prizesWon: 0, draws: 0, poolPaid: 0, poolFree: 0, log: [], last: null };

/** Live walkthrough of the two-stage economy: open, collect credits, watch the draw fill, see what a credit is really worth. */
export function CreditsStage({ cfg, seed, onSettings }: { cfg: CreditsConfig; seed: number; onSettings: (section?: string) => void }) {
  const key = useMemo(() => JSON.stringify([cfg.box, cfg.algo, cfg.rigs, cfg.raffle, seed]), [cfg.box, cfg.algo, cfg.rigs, cfg.raffle, seed]);
  const liveRef = useRef<{ key: string; live: LiveOpener | null; error: string | null } | null>(null);
  if (!liveRef.current || liveRef.current.key !== key) {
    try {
      liveRef.current = { key, live: new LiveOpener(cfg.box, cfg.algo, cfg.rigs, `credits:${seed}`), error: null };
    } catch (e) {
      liveRef.current = { key, live: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const live = liveRef.current.live;
  const [s, setS] = useState<Session>(EMPTY);
  const logN = useRef(0);
  useEffect(() => setS(EMPTY), [key]);

  const R = cfg.raffle;
  const price = cfg.box.price;
  const prize = CATALOG_BY_ID.get(R.prizeItemId);
  const prizeValue = prize?.realized ?? 0;
  const log = (text: string, tone?: "good" | "bad" | "warn") => ({ n: ++logN.current, text, tone });
  const push = (st: Session, e: Session["log"][number]): Session => ({ ...st, log: [e, ...st.log].slice(0, 30) });

  // other players fill the pool between your opens: on average the box's expected credits per open, times a crowd factor
  const crowdPerOpen = useMemo(() => {
    const t = live?.opener.displayed;
    if (!t) return 0;
    let ev = 0;
    for (const r of t.items) if (r.item.category === "credit") ev += (r.weight / t.T) * (r.item.retail / Math.max(0.01, R.ticketFace));
    return ev * 40; // forty other players for every one of your opens
  }, [live, R.ticketFace]);

  const drawNow = (st: Session, reason: string): Session => {
    const sold = st.poolPaid + st.poolFree;
    let next = { ...st, draws: st.draws + 1 };
    if (sold <= 0 || !prize) return push(next, log(`Draw ${next.draws}: nothing sold, no prize.`, "warn"));
    const u = Math.random() * sold;
    const mine = u < st.credits;
    const free = !mine && u >= st.poolPaid;
    if (mine) next = push({ ...next, prizesWon: next.prizesWon + prizeValue }, log(`Draw ${next.draws} (${reason}): your ticket won ${prize.brand} ${prize.name} worth ${money(prizeValue)}!`, "good"));
    else next = push(next, log(`Draw ${next.draws} (${reason}): ${free ? "a free postal entrant" : "another paying player"} won the ${prize.name}. Your ${num(st.credits)} tickets expired with it.`, free ? "warn" : undefined));
    return { ...next, credits: 0, poolPaid: 0, poolFree: 0 };
  };

  const open = () => {
    if (!live) return;
    const o = live.open("player");
    setS((st) => {
      let next: Session = { ...st, spent: st.spent + price, opens: st.opens + 1, last: o };
      const crowd = crowdPerOpen * (0.5 + Math.random());
      next.poolPaid += crowd;
      next.poolFree += crowd * R.freeEntryShare;
      if (o.item.category === "credit") {
        const c = Math.round(o.item.retail / Math.max(0.01, R.ticketFace));
        next = push({ ...next, credits: next.credits + c, poolPaid: next.poolPaid + c, poolFree: next.poolFree + c * R.freeEntryShare }, log(`Opened for ${money(price)}: ${c} credits (shown as ${money(o.display)}; each is one ticket).`));
      } else {
        next = push({ ...next, physicalRealized: next.physicalRealized + o.item.realized, physicalDisplay: next.physicalDisplay + o.display }, log(`Opened for ${money(price)}: ${o.item.brand} ${o.item.name}, cash value ${money(o.item.realized)}.`, "good"));
      }
      if (next.poolPaid + next.poolFree >= R.ticketPool) next = drawNow(next, "pool sold out");
      return next;
    });
  };
  const forceDraw = () => setS((st) => drawNow(st, "draw date reached"));
  const reset = () => {
    liveRef.current = null;
    setS(EMPTY);
  };

  if (!live) {
    return (
      <Card title="Nothing to open yet">
        <p className="text-sm text-ink-2">{liveRef.current?.error}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings("box")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Fix the box in Settings
        </button>
      </Card>
    );
  }

  const sold = s.poolPaid + s.poolFree;
  const fill = Math.min(1, sold / Math.max(1, R.ticketPool));
  const ticketValue = prizeValue / Math.max(1, R.ticketPool);
  const realNow = s.physicalRealized + s.prizesWon;
  const nominalNow = s.physicalDisplay + s.credits * R.ticketFace + s.prizesWon;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card
          title={
            <>
              Stage 1 · the box
              <Info>{cfg.box.note ?? "Open the box. Credits are entries in the draw on the right; physical items are yours."}</Info>
            </>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <Icon name="fluent:package" size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{cfg.box.name}</div>
              <div className="text-xs text-ink-2">{money(price)} per open</div>
            </div>
            <button type="button" className="btn btn-primary btn-lg" onClick={open}>
              <Icon name="ph:play" size={18} className="text-white" /> Open for {money(price)}
            </button>
            <button type="button" className="btn" onClick={reset}>
              <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset
            </button>
          </div>
          {s.last && (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-paper p-3 animate-rise">
              <ItemTile item={s.last.item} size={56} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{s.last.item.name}</div>
                <div className="text-xs text-ink-2">
                  {s.last.item.category === "credit" ? (
                    <>
                      shown as <b>{money(s.last.display)}</b> of entries · real value about <b>{money((s.last.item.retail / Math.max(0.01, R.ticketFace)) * ticketValue)}</b>
                      <Info>Real value = credits × prize value ÷ ticket pool, if the pool sells out. {R.disclosedEv ? "This box discloses it." : "The box page shows only the face value."}</Info>
                    </>
                  ) : (
                    <>
                      shown as {money(s.last.display)} · cash value {money(s.last.item.realized)}
                    </>
                  )}
                </div>
              </div>
              {s.last.verified === false && <Badge tone="bad">proof fails</Badge>}
            </div>
          )}
          <div className="mt-3 grid grid-cols-4 gap-2 text-right text-xs">
            <div>
              <div className="text-ink-3">opens</div>
              <div className="font-semibold tabular-nums">{num(s.opens)}</div>
            </div>
            <div>
              <div className="text-ink-3">spent</div>
              <div className="font-semibold tabular-nums">{money(s.spent)}</div>
            </div>
            <div>
              <div className="text-ink-3">nominal back</div>
              <div className="font-semibold tabular-nums">
                <CountUp value={nominalNow} format={money} />
              </div>
            </div>
            <div>
              <div className="text-ink-3">real back</div>
              <div className={`font-semibold tabular-nums ${s.opens && realNow < s.spent * 0.5 ? "text-bad" : ""}`}>
                <CountUp value={realNow} format={money} />
              </div>
            </div>
          </div>
        </Card>

        <Card
          title={
            <>
              Stage 2 · the draw
              <Info>
                {num(R.ticketPool)} tickets at {money(R.ticketFace)} face for one prize. {R.drawRule === "when-sold-out" ? "Drawn when the pool sells out." : "Drawn on the date regardless of sell-through; unsold numbers are redrawn."} Free postal entries add {pct(R.freeEntryShare, 0)} tickets at equal odds.
              </Info>
            </>
          }
          actions={<button type="button" className="chip" onClick={() => onSettings("raffle")}>edit</button>}
        >
          {prize && (
            <div className="flex items-center gap-3">
              <ItemTile item={prize} size={48} />
              <div className="min-w-0">
                <div className="text-xs text-ink-3">prize</div>
                <div className="truncate font-semibold">
                  {prize.brand} {prize.name}
                </div>
                <div className="text-xs text-ink-2">cash value {money(prizeValue)} · one ticket is worth {money(ticketValue)}</div>
              </div>
            </div>
          )}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-ink-2">
              <span>
                {num(Math.round(sold))} of {num(R.ticketPool)} sold
              </span>
              <span>your tickets: {num(s.credits)}</span>
            </div>
            <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${fill * 100}%` }} />
            </div>
            <div className="mt-1 text-[11px] text-ink-3">
              your chance at the prize right now: {sold > 0 ? pct(s.credits / sold, 2) : "—"} · value of your tickets: {money(s.credits * ticketValue)} (face {money(s.credits * R.ticketFace)})
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="btn" onClick={forceDraw} disabled={sold <= 0} data-tip="Simulate the draw date arriving now">
              <Icon name="ph:trophy" size={16} /> Draw now
            </button>
            <span className="text-xs text-ink-3">draws so far: {s.draws} · prizes won: {money(s.prizesWon)}</span>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="The two returns so far">
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Nominal (credits at face)" value={s.spent ? pct(nominalNow / s.spent) : "—"} sub="what the box page implies" />
            <Stat label="Real (cash value + prizes)" value={s.spent ? pct(realNow / s.spent) : "—"} sub="what you could actually get" tone={s.spent && realNow / s.spent < 0.6 ? "bad" : undefined} />
            <Stat label="Gap" value={s.spent ? pct((nominalNow - realNow) / s.spent) : "—"} sub="the credits layer" />
          </div>
        </Card>
        <Card title="Ledger">
          {s.log.length === 0 ? (
            <p className="text-xs text-ink-3">Open the box to start.</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-auto text-xs">
              {s.log.map((e) => (
                <li key={e.n} className={e.tone === "good" ? "text-good" : e.tone === "bad" ? "text-bad" : e.tone === "warn" ? "text-warn" : "text-ink-2"}>
                  {e.text}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
