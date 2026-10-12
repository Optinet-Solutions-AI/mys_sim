"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CatalogItem, MysteryBoxConfig } from "@/engine/types";
import { expectedValue } from "@/engine/table";
import { LiveOpener, type LiveOpen } from "@/lib/live";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { copyText } from "@/lib/download";
import { Icon } from "../Icon";
import { ItemTile, TierBadge } from "../ItemTile";
import { Badge, Card, Info, Stat } from "../ui";
import { Reel, type SpinInfo } from "../lab/Reel";
import { CountUp } from "../lab/CountUp";

interface Tally {
  opens: number;
  spent: number;
  returned: number;
  displayed: number;
  losses: number;
  staged: number;
  best: LiveOpen | null;
}
const EMPTY: Tally = { opens: 0, spent: 0, returned: 0, displayed: 0, losses: 0, staged: 0, best: null };

export function MysteryBoxStage({ cfg, seed, onSettings }: { cfg: MysteryBoxConfig; seed: number; onSettings: (section?: string) => void }) {
  const key = useMemo(() => JSON.stringify([cfg.box, cfg.algo, cfg.rigs, seed]), [cfg.box, cfg.algo, cfg.rigs, seed]);
  const liveRef = useRef<{ key: string; live: LiveOpener | null; error: string | null } | null>(null);
  if (!liveRef.current || liveRef.current.key !== key) {
    try {
      liveRef.current = { key, live: new LiveOpener(cfg.box, cfg.algo, cfg.rigs, `live:${seed}`), error: null };
    } catch (e) {
      liveRef.current = { key, live: null, error: e instanceof Error ? e.message : String(e) };
    }
  }
  const live = liveRef.current.live;
  const tags = cfg.accounts.tags.length ? cfg.accounts.tags : [{ tag: "player", share: 1 }];
  const [tag, setTag] = useState(tags[0].tag);
  const [spinId, setSpinId] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [fast, setFast] = useState(false);
  const [pending, setPending] = useState<LiveOpen | null>(null);
  const [last, setLast] = useState<LiveOpen | null>(null);
  const [lastStaged, setLastStaged] = useState<CatalogItem | null>(null);
  const [batch, setBatch] = useState<LiveOpen[] | null>(null);
  const [batchRevealed, setBatchRevealed] = useState(0);
  const batchPending = useRef<LiveOpen[] | null>(null);
  const [history, setHistory] = useState<LiveOpen[]>([]);
  const [tally, setTally] = useState<Tally>(EMPTY);
  const [copied, setCopied] = useState(false);

  const clearSession = () => {
    setPending(null);
    setLast(null);
    setLastStaged(null);
    setBatch(null);
    setBatchRevealed(0);
    batchPending.current = null;
    setHistory([]);
    setTally(EMPTY);
    setSpinning(false);
  };
  // a settings change starts a new session (new seeds, fresh counters)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(clearSession, [key]);
  useEffect(() => {
    if (!tags.some((t) => t.tag === tag)) setTag(tags[0].tag);
  }, [tags, tag]);

  const price = cfg.box.price;
  const layer = cfg.box.valueLayer;
  const table = live?.opener.displayed ?? null;
  const statedRtp = table ? expectedValue(table, layer) / price : 0;
  const pool = useMemo(() => (table ? table.items.map((r) => ({ item: r.item, weight: r.weight })) : []), [table]);
  const nearMiss = cfg.rigs.nearMiss;

  const account = (opens: LiveOpen[], staged = 0) =>
    setTally((t) => {
      const best = opens.reduce<LiveOpen | null>((b, o) => (!b || o.payout > b.payout ? o : b), t.best);
      return {
        opens: t.opens + opens.length,
        spent: t.spent + opens.length * price,
        returned: t.returned + opens.reduce((a, o) => a + o.payout, 0),
        displayed: t.displayed + opens.reduce((a, o) => a + o.display, 0),
        losses: t.losses + opens.filter((o) => o.payout < price).length,
        staged: t.staged + staged,
        best,
      };
    });
  const finishBatch = (list: LiveOpen[]) => {
    setLast(list[list.length - 1]);
    setLastStaged(null);
    setHistory((h) => [...list.slice().reverse(), ...h].slice(0, 24));
    account(list);
    setSpinning(false);
  };

  const openOne = () => {
    if (!live || spinning) return;
    const o = live.open(tag);
    setBatch(null);
    setPending(o);
    setSpinning(true);
    setSpinId((s) => s + 1);
  };
  const reveal = (info?: SpinInfo) => {
    if (!pending) return;
    setLast(pending);
    setLastStaged(info?.staged ?? null);
    setHistory((h) => [pending, ...h].slice(0, 24));
    account([pending], info?.staged ? 1 : 0);
    setPending(null);
    setSpinning(false);
  };
  const openMany = (n: number) => {
    if (!live || spinning) return;
    const list: LiveOpen[] = [];
    for (let i = 0; i < n; i++) list.push(live.open(tag));
    setBatch(list);
    const reduce = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fast || reduce) {
      setBatchRevealed(n);
      finishBatch(list);
    } else {
      setBatchRevealed(0);
      batchPending.current = list;
      setSpinning(true);
    }
  };
  // staggered reveal of a batch
  useEffect(() => {
    if (!batch || !batchPending.current) return;
    if (batchRevealed >= batch.length) {
      const list = batchPending.current;
      batchPending.current = null;
      finishBatch(list);
      return;
    }
    const t = setTimeout(() => setBatchRevealed((r) => r + 1), batch.length > 20 ? 26 : 170);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batch, batchRevealed]);
  const reset = () => {
    liveRef.current = null;
    clearSession();
    setSpinId(0);
  };

  if (!live || !table) {
    return (
      <Card title="Nothing to open yet">
        <p className="text-sm text-ink-2">{liveRef.current?.error ?? "The box has no items."}</p>
        <button type="button" className="btn btn-primary mt-3" onClick={() => onSettings("box")}>
          <Icon name="ph:gear-six" size={16} className="text-white" /> Add items in Settings
        </button>
      </Card>
    );
  }

  const sessionRtp = tally.spent ? tally.returned / tally.spent : 0;
  const proofBadge = (o: LiveOpen) => (o.verified === null ? <Badge tone="warn">no proof</Badge> : o.verified ? <Badge tone="good">proof ok</Badge> : <Badge tone="bad">proof fails</Badge>);
  const oddsOf = (item: CatalogItem) => (table.items.find((r) => r.itemId === item.id)?.weight ?? 0) / table.T;
  const shown = batch ? batch.slice(0, batchRevealed) : [];
  const batchBack = shown.reduce((a, o) => a + o.payout, 0);
  const batchDone = !!batch && batchRevealed >= batch.length;
  const tileSize = batch && batch.length > 20 ? 32 : 52;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Icon name="fluent:package" size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">{cfg.box.name}</div>
            <div className="flex items-center gap-1 text-xs text-ink-2">
              {money(price)} · {table.items.length} items · stated return {pct(statedRtp)}
              <Info>
                Stated return is the expected value of one open divided by the price, computed on <b>{layer}</b> prices. Players are shown values at <b>{cfg.box.displayLayer}</b> prices.
              </Info>
            </div>
          </div>
          {tags.length > 1 && (
            <label className="text-xs text-ink-2">
              Open as{" "}
              <select value={tag} onChange={(e) => setTag(e.target.value)} className="w-36">
                {tags.map((t) => (
                  <option key={t.tag} value={t.tag}>
                    {t.tag}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-1 text-xs text-ink-2">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} disabled={spinning} /> skip animation
          </label>
        </div>
        <div className="mt-3">
          <Reel pool={pool} winner={pending?.item ?? null} spinId={spinId} onDone={reveal} fast={fast} loss={!!pending && pending.payout < price} price={price} nearMiss={nearMiss} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary btn-lg" onClick={openOne} disabled={spinning}>
            <Icon name="ph:play" size={18} className="text-white" /> {spinning ? "Opening…" : `Open for ${money(price)}`}
          </button>
          <button type="button" className="btn" onClick={() => openMany(10)} disabled={spinning}>
            Open ×10
          </button>
          <button type="button" className="btn" onClick={() => openMany(100)} disabled={spinning}>
            Open ×100
          </button>
          <button type="button" className="btn" onClick={reset} disabled={spinning} data-tip="New session: fresh seeds and counters">
            <Icon name="ph:arrow-counter-clockwise" size={16} /> Reset
          </button>
          <div className={`ml-auto grid gap-2 text-right text-xs ${nearMiss ? "grid-cols-5" : "grid-cols-4"}`}>
            <div>
              <div className="text-ink-3">opens</div>
              <div className="font-semibold tabular-nums">{num(tally.opens)}</div>
            </div>
            <div>
              <div className="text-ink-3">spent</div>
              <div className="font-semibold tabular-nums">
                <CountUp value={tally.spent} format={money} />
              </div>
            </div>
            <div>
              <div className="text-ink-3">back ({layer})</div>
              <div className="font-semibold tabular-nums">
                <CountUp value={tally.returned} format={money} />
              </div>
            </div>
            <div>
              <div className="text-ink-3">session RTP</div>
              <div className={`font-semibold tabular-nums ${tally.opens && sessionRtp < statedRtp - 0.15 ? "text-bad" : ""}`}>{tally.opens ? pct(sessionRtp) : "—"}</div>
            </div>
            {nearMiss && (
              <div data-tip="Losing spins shown as near misses by the reel setting; the odds were unchanged" data-tip-end="">
                <div className="text-warn">near misses</div>
                <div className="font-semibold tabular-nums text-warn">
                  {num(tally.staged)}/{num(tally.losses)}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {batch && (
        <Card
          title={`${batch.length} opens`}
          actions={
            <span className="text-xs text-ink-2 tabular-nums">
              {batchDone ? (
                <>
                  spent {money(batch.length * price)} · back {money(batchBack)} · best {money(Math.max(...batch.map((o) => o.payout)))}
                </>
              ) : (
                <>
                  {batchRevealed}/{batch.length} · back <CountUp value={batchBack} format={money} duration={200} />
                </>
              )}
            </span>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {batch.map((o, i) =>
              i < batchRevealed ? (
                <div key={o.n} className="animate-flip flex flex-col items-center" data-tip={`${o.item.brand} ${o.item.name} · pays ${money(o.payout)} · ${o.reason}`}>
                  <ItemTile item={o.item} size={tileSize} />
                  {batch.length <= 20 && <span className={`mt-0.5 font-mono text-[10px] ${o.payout >= price ? "text-good" : "text-ink-3"}`}>{money(o.payout)}</span>}
                </div>
              ) : (
                <div key={o.n} className="flex flex-col items-center">
                  <div className="flex items-center justify-center rounded-xl border border-dashed border-line bg-paper" style={{ width: tileSize, height: tileSize }}>
                    <Icon name="ph:package" size={Math.round(tileSize * 0.5)} className="text-ink-3" />
                  </div>
                  {batch.length <= 20 && <span className="mt-0.5 text-[10px] text-ink-3">·</span>}
                </div>
              ),
            )}
          </div>
        </Card>
      )}

      {last && !batch && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="You got">
            <div className="flex items-center gap-4 animate-rise">
              <div className="animate-glow rounded-xl">
                <ItemTile item={last.item} size={96} />
              </div>
              <div className="min-w-0">
                <div className="text-xs text-ink-3">{last.item.brand}</div>
                <div className="text-xl font-semibold leading-tight">{last.item.name}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <TierBadge tier={last.item.tier} />
                  <span className="text-xs text-ink-3">
                    odds {pctSmart(oddsOf(last.item))} · {oneIn(oddsOf(last.item))}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <Stat label="shown as" value={money(last.display)} />
                  <Stat label={`pays (${layer})`} value={money(last.payout)} tone={last.payout >= price ? "good" : undefined} />
                  <Stat label="cash value" value={money(last.item.realized)} sub="realized" />
                </div>
              </div>
            </div>
            {lastStaged && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-warn-soft px-3 py-2 text-xs text-warn animate-rise">
                <Icon name="ph:warning" size={16} />
                <span>
                  <b>Staged near miss.</b> The reel stopped beside {lastStaged.brand} {lastStaged.name} ({money(lastStaged[cfg.box.displayLayer])}), whose odds are {pctSmart(oddsOf(lastStaged))}. The neighbour was placed by the near-miss setting, not by the draw.
                </span>
              </div>
            )}
          </Card>
          <Card
            title={
              <>
                Proof {proofBadge(last)}
                <Info>The verifier recomputes the digest from the revealed seeds and looks the ticket up in the displayed table. It proves the dice, not the table, the values, how the seeds were chosen, or what the animation showed.</Info>
              </>
            }
            actions={
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  setCopied(await copyText(JSON.stringify(last.rec, null, 2)));
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <Icon name="ph:copy" size={14} /> {copied ? "Copied" : "Copy record"}
              </button>
            }
          >
            {cfg.algo.scheme === "none" ? (
              <p className="flex items-center gap-1 text-sm text-ink-2">
                No commitment published. <Info>The player gets a result and nothing to check it against. This is how the vendor platform works by default.</Info>
              </p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-[11px]">
                <dt className="text-ink-3">server hash</dt>
                <dd className="truncate">{last.rec.serverHash}</dd>
                <dt className="text-ink-3">client seed</dt>
                <dd className="truncate">{last.rec.clientSeed}</dd>
                <dt className="text-ink-3">nonce</dt>
                <dd>{last.rec.nonce}</dd>
                {last.rec.beaconRound !== undefined && (
                  <>
                    <dt className="text-ink-3">beacon</dt>
                    <dd className="truncate">
                      round {last.rec.beaconRound} · {last.rec.beaconValue}
                    </dd>
                  </>
                )}
                <dt className="text-ink-3">digest</dt>
                <dd className="truncate">{last.rec.digest}</dd>
                <dt className="text-ink-3">ticket</dt>
                <dd>
                  {num(last.rec.ticket)} of {num(table.T)}
                </dd>
                <dt className="text-ink-3">verifier</dt>
                <dd className={last.verified ? "text-good" : "text-bad"}>{last.reason}</dd>
              </dl>
            )}
          </Card>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card
          title="In the box"
          actions={
            <button type="button" className="chip" onClick={() => onSettings("box")}>
              edit items and odds
            </button>
          }
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {table.items.map((r) => {
              const won = last?.item.id === r.itemId;
              return (
                <div key={r.itemId} className={`flex items-center gap-2 rounded-lg border p-2 ${won ? "border-accent bg-accent-soft" : "border-line bg-paper"}`}>
                  <ItemTile item={r.item} size={40} />
                  <div className="min-w-0 flex-1 text-xs">
                    <div className="truncate font-medium">{r.item.name}</div>
                    <div className="text-ink-3">
                      {r.item.brand} · {pctSmart(r.weight / table.T)}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-mono font-semibold">{money(r.item[cfg.box.displayLayer])}</div>
                    {cfg.box.displayLayer !== "realized" && <div className="text-[10px] text-ink-3">cash {money(r.item.realized)}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Recent pulls">
          {history.length === 0 ? (
            <p className="text-xs text-ink-3">Open the box to start.</p>
          ) : (
            <ul className="space-y-1">
              {history.map((o) => (
                <li key={o.n} className="flex items-center gap-2 text-xs">
                  <ItemTile item={o.item} size={24} />
                  <span className="min-w-0 flex-1 truncate">{o.item.name}</span>
                  <span className={`font-mono ${o.payout >= price ? "text-good" : "text-ink-2"}`}>{money(o.payout)}</span>
                  {o.verified === false && <Icon name="ph:warning" size={14} className="text-bad" />}
                </li>
              ))}
            </ul>
          )}
          {tally.best && (
            <div className="mt-3 border-t border-line pt-2 text-xs">
              <div className="text-ink-3">best pull this session</div>
              <div className="font-medium">
                {tally.best.item.name} · {money(tally.best.payout)}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
