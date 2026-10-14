"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { JemlitConfig, JemlitItem } from "@/engine/types";
import { JEMLIT_FEATURED } from "@/engine/jemlitLive.generated";
import { jemlitBoxOf, jemlitMath } from "@/engine/labs/jemlit";
import {
  CrashGame,
  MinesGame,
  UpgraderGame,
  battleMath,
  crashProbAtLeast,
  minesMultiplier,
  minesSurvival,
  playBattle,
  simulateBattles,
  upgraderMaxChance,
  upgraderTarget,
  verifyCrash,
  verifyMines,
  type BattleOutcome,
  type BattleSetup,
  type CrashRound,
  type CrashSettings,
  type MinesRound,
  type MinesSettings,
  type UpgraderPlay,
  type UpgraderSettings,
} from "@/engine/labs/jemlitGames";
import { jemlitConfigFor, loadJemlitBox } from "@/lib/jemlitPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Info, NumberInput, Select, Td, Th } from "../ui";
import { Icon } from "../Icon";
import { ItemTile } from "../ItemTile";
import { jemlitAsCatalogItem } from "./JemlitStage";

const short = (h: string, n = 10) => (h ? `${h.slice(0, n)}…${h.slice(-4)}` : "");

function Buttons({ anchor }: { anchor: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm">
      <Link href={`/docs/jemlit#${anchor}`} className="btn no-underline">
        <Icon name="ph:book-open-text" size={16} /> Document
      </Link>
      <Link href="/operators/jemlit" className="btn no-underline">
        <Icon name="ph:package" size={16} /> Mystery boxes
      </Link>
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
function Acc({ title, children, info }: { title: React.ReactNode; children: React.ReactNode; info?: string }) {
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

/* ================================================================ Battles */

const SOLO = [2, 3, 4];
const TEAMS: { label: string; players: number; teams: number }[] = [
  { label: "2v2", players: 4, teams: 2 },
  { label: "3v3", players: 6, teams: 2 },
  { label: "2v2v2", players: 6, teams: 3 },
];
const STYLE_LABEL: Record<BattleSetup["style"], string> = { classic: "Classic: highest total wins", crazy: "Crazy: lowest total wins", jackpot: "Jackpot: winner drawn by share of the pot", finaldrop: "Final drop: the last round alone decides" };

export function JemlitBattlesStage({ cfg, onChange }: { cfg: JemlitConfig; onChange: (c: JemlitConfig) => void }) {
  const box = jemlitBoxOf(cfg);
  const [setup, setSetup] = useState<BattleSetup>({ players: 2, teams: 1, rounds: 3, style: "classic" });
  const [outcome, setOutcome] = useState<BattleOutcome | null>(null);
  const [shown, setShown] = useState(0);
  const [fast, setFast] = useState(false);
  const [count, setCount] = useState(0);
  const [tally, setTally] = useState({ battles: 0, paid: 0, won: 0, wins: 0 });
  const [mc, setMc] = useState<ReturnType<typeof simulateBattles> | null>(null);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);
  const bm = battleMath(cfg, setup);
  const busy = outcome !== null && shown < outcome.pulls.length;

  const start = () => {
    if (busy) return;
    timers.current.forEach((t) => clearTimeout(t));
    const o = playBattle(cfg, setup, `${count}:${box.slug}`);
    setCount((c) => c + 1);
    setOutcome(o);
    setShown(0);
    setMc(null);
    const step = fast ? 60 : 650;
    o.pulls.forEach((_, i) => {
      const t = window.setTimeout(() => {
        setShown(i + 1);
        if (i === o.pulls.length - 1) {
          const youWon = o.winners.includes(0);
          setTally((x) => ({ battles: x.battles + 1, paid: x.paid + bm.stakePerPlayer, won: x.won + (youWon ? o.prizePerWinner : 0), wins: x.wins + (youWon ? 1 : 0) }));
        }
      }, step * (i + 1));
      timers.current.push(t);
    });
  };
  const runMc = () => setMc(simulateBattles(cfg, setup, 400, `mc:${box.slug}:${setup.players}:${setup.rounds}:${setup.style}`));
  const done = outcome && shown >= outcome.pulls.length;
  const nSeats = setup.teams > 1 ? setup.teams : setup.players;
  const seatName = (p: number) => (setup.teams > 1 ? `Team ${Math.floor(p / (setup.players / setup.teams)) + 1} · P${p + 1}` : p === 0 ? "You" : `Player ${p + 1}`);

  return (
    <div className="space-y-4">
      <Buttons anchor="games" />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Battle on {box.name}</h2>
          <Badge tone="accent">{money(box.price)} per open</Badge>
          <span className="ml-auto flex flex-wrap gap-1">
            {JEMLIT_FEATURED.slice(0, 8).map((b) => (
              <button key={b.slug} type="button" className={`chip ${b.slug === cfg.boxSlug ? "chip-accent" : ""}`} disabled={busy} onClick={() => loadJemlitBox(b.slug).then((bx) => onChange(jemlitConfigFor(bx, cfg)))}>
                {b.name}
              </button>
            ))}
          </span>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <div>
            <div className="mb-1 text-xs text-ink-3">Players</div>
            <div className="flex flex-wrap gap-1">
              {SOLO.map((n) => (
                <button key={n} type="button" className={`chip ${setup.teams === 1 && setup.players === n ? "chip-accent" : ""}`} disabled={busy} onClick={() => setSetup({ ...setup, players: n, teams: 1 })}>
                  {n} solo
                </button>
              ))}
              {TEAMS.map((t) => (
                <button key={t.label} type="button" className={`chip ${setup.teams === t.teams && setup.players === t.players ? "chip-accent" : ""}`} disabled={busy} onClick={() => setSetup({ ...setup, players: t.players, teams: t.teams })}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-ink-3">Rounds (boxes each)</div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={`chip ${setup.rounds === n ? "chip-accent" : ""}`} disabled={busy} onClick={() => setSetup({ ...setup, rounds: n })}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="mb-1 text-xs text-ink-3">Style</div>
            <Select<BattleSetup["style"]> value={setup.style} onChange={(v) => !busy && setSetup({ ...setup, style: v })} options={(Object.keys(STYLE_LABEL) as BattleSetup["style"][]).map((k) => ({ value: k, label: STYLE_LABEL[k] }))} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-primary text-base" disabled={busy} onClick={start}>
            {busy ? "Opening…" : `Start battle · ${money(bm.stakePerPlayer)} each`}
          </button>
          <label className="flex items-center gap-1 text-xs text-ink-3">
            <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> fast reveal
          </label>
          <span className="ml-auto flex flex-wrap gap-1 text-[11px]">
            <Badge>pot {money(bm.pot)}</Badge>
            <Badge>the table says the pot is worth {money(bm.expectedPot, 2)}</Badge>
            <Badge>your chance {oneIn(bm.winChance)}</Badge>
          </span>
        </div>

        {outcome && (
          <div className="mt-4 overflow-x-auto">
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Round</Th>
                  {Array.from({ length: setup.players }, (_, p) => (
                    <Th key={p}>{seatName(p)}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: setup.rounds }, (_, r) => (
                  <tr key={r} className="border-t border-line">
                    <Td>{r + 1}</Td>
                    {Array.from({ length: setup.players }, (_, p) => {
                      const i = r * setup.players + p;
                      const pull = outcome.pulls[i];
                      const vis = i < shown;
                      return (
                        <Td key={p}>
                          {vis ? (
                            <span className="flex items-center gap-2">
                              <ItemTile item={jemlitAsCatalogItem(box.items.find((it) => it.id === pull.spin.itemId)!)} size={26} />
                              <span className="min-w-0">
                                <span className="block max-w-[14ch] truncate" title={pull.spin.label}>
                                  {pull.spin.label}
                                </span>
                                <span className="font-mono text-ink-3">{money(pull.spin.itemPrice)}</span>
                              </span>
                            </span>
                          ) : (
                            <span className="text-ink-3">…</span>
                          )}
                        </Td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-ink font-semibold">
                  <Td>Total</Td>
                  {Array.from({ length: setup.players }, (_, p) => (
                    <Td key={p} mono>
                      {done ? money(outcome.totals[p]) : "…"} {done && outcome.winners.includes(p) && <Badge tone="good">winner</Badge>}
                    </Td>
                  ))}
                </tr>
              </tbody>
            </table></div>
            {done && (
              <div className="mt-3 rounded-lg border border-line bg-paper p-3 text-sm">
                <b>{setup.teams > 1 ? `Team ${outcome.winningTeam + 1}` : seatName(outcome.winningTeam)} wins</b> the pot of {money(outcome.pot)} at listed prices ({money(outcome.prizePerWinner)} per winner), against {money(bm.stakePerPlayer)} paid each.
                {outcome.jackpotRoll !== undefined && <> Jackpot roll {(outcome.jackpotRoll * 100).toFixed(2)} on 0 to 100, read against the shares of the pot.</>}
              </div>
            )}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Mini label="Battles" value={num(tally.battles)} />
          <Mini label="You paid" value={money(tally.paid)} />
          <Mini label="You won" value={`${num(tally.wins)} battle${tally.wins === 1 ? "" : "s"}`} sub={money(tally.won)} />
          <Mini label="RTP" value={tally.paid > 0 ? pct(tally.won / tally.paid) : "–"} sub="at listed prices" />
        </div>
      </Card>

      {done && outcome && (
        <Card title="Analysis">
          <div className="space-y-2">
            <Acc title="The maths of this battle" info="Each open pays back the box's return on average; the battle only moves the money between the players. Jemlit keeps the same 20% whoever wins.">
              <div className="tbl"><table className="w-full max-w-xl text-xs">
                <tbody>
                  {[
                    ["Each player pays", `${setup.rounds} × ${money(box.price)} = ${money(bm.stakePerPlayer)}`],
                    ["Pot paid in", `${setup.players} × ${money(bm.stakePerPlayer)} = ${money(bm.pot)}`],
                    ["What the pot is worth at listed prices, on average", `${money(bm.pot)} × ${pct(bm.returnAtListed)} = ${money(bm.expectedPot, 2)}`],
                    ["Jemlit keeps, on average", `${money(bm.pot - bm.expectedPot, 2)} (${pct(1 - bm.returnAtListed)})`],
                    ["Your chance to win", `${oneIn(bm.winChance)} (${pct(bm.winChance)}), every seat alike`],
                    ["Your expected prize", `${money(bm.expectedPerPlayer, 2)} per battle, against ${money(bm.stakePerPlayer)} paid: ${pct(bm.returnAtListed)}`],
                    ["Really (resale and Credits)", pct(bm.returnReal)],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-line">
                      <Td>{k}</Td>
                      <Td right mono>{v}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button kind="ghost" onClick={runMc}>
                  Play 400 battles like this
                </Button>
                {mc && (
                  <span className="text-xs">
                    wins per seat: {mc.wins.map((w, i) => `${setup.teams > 1 ? "team " : "P"}${i + 1} ${pct(w / 400, 0)}`).join(" · ")} · average pot {money(mc.avgPot)} · average prize {money(mc.avgPrize)} · biggest {money(mc.maxPrize)}
                  </span>
                )}
              </div>
            </Acc>
            <Acc title="How this battle was decided, step by step">
              <ol className="list-decimal space-y-1 pl-5">
                <li>One server seed was locked in for the whole battle (hash {short(outcome.serverHash)}); every open is a normal box open with the play count going 1, 2, 3… across the seats in turn.</li>
                <li>Each open rolled a number from 0 to 100 and read it against {box.name}&apos;s bands, exactly as on the box page.</li>
                <li>
                  {setup.style === "classic" && "Totals were added up at listed prices; the highest total won."}
                  {setup.style === "crazy" && "Totals were added up at listed prices; the lowest total won."}
                  {setup.style === "finaldrop" && "Only the last round counted; the highest last pull won."}
                  {setup.style === "jackpot" && `One more roll (${((outcome.jackpotRoll ?? 0) * 100).toFixed(2)}) was read against the shares of the pot: a seat holding 60% of the pot wins 60% of the time.`}
                </li>
                <li>The winner takes every item pulled: {money(outcome.pot)} at listed prices, {money(outcome.pot * 0.9)} if exchanged for Credits.</li>
              </ol>
            </Acc>
            <Acc title="Was it fair? The check">
              <p>The same check as a box: the seed was committed before the battle and each pull can be recomputed from it. It proves the pulls, not the table, and not that every seat was given the same table.</p>
              <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 text-xs sm:grid-cols-2">
                <Row k="Server seed hash" v={outcome.serverHash} />
                <Row k="Server seed" v={outcome.serverSeed} />
                <Row k="Pulls (play count)" v={`1 to ${outcome.pulls.length}`} />
                <Row k="Rolls" v={outcome.pulls.map((p) => p.spin.roll.toFixed(2)).join(", ")} />
              </div>
            </Acc>
            <Acc title="The logic behind battles">
              <ul className="list-disc space-y-1 pl-5">
                <li>A battle is boxes opened in company. Nothing about the odds changes; the losers&apos; pulls go to the winner.</li>
                <li>The house takes nothing extra: it keeps the box&apos;s 20% on every open, win or lose.</li>
                <li>Variance is the product: the same 80% return, but paid to one seat instead of spread over all.</li>
                <li>Jemlit&apos;s page lists solo (2, 3, 4) and team formats (2v2, 3v3, 2v2v2) and the classic, crazy, jackpot and final-drop styles; an alliance mode exists and is not modelled here.</li>
              </ul>
            </Acc>
          </div>
        </Card>
      )}
    </div>
  );
}

/* =============================================================== Upgrader */

function Ring({ chance, roll, spinning }: { chance: number; roll: number | null; spinning: boolean }) {
  const R = 46;
  const C = 2 * Math.PI * R;
  const deg = roll == null ? 0 : roll * 360;
  return (
    <svg viewBox="0 0 120 120" className="mx-auto h-56 w-56">
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-line)" strokeWidth="12" />
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-accent)" strokeWidth="12" strokeDasharray={`${C * chance} ${C}`} transform="rotate(-90 60 60)" strokeLinecap="butt" />
      <g style={{ transform: `rotate(${deg}deg)`, transformOrigin: "60px 60px", transition: spinning ? "transform 3.2s cubic-bezier(.1,.9,.2,1)" : "none" }}>
        <line x1="60" y1="60" x2="60" y2="10" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="60" cy="60" r="4" fill="var(--color-ink)" />
      </g>
      <text x="60" y="64" textAnchor="middle" fontSize="12" fill="var(--color-ink)" fontWeight="600">
        {pct(chance, 0)}
      </text>
    </svg>
  );
}

export function JemlitUpgraderStage({ cfg, settings }: { cfg: JemlitConfig; settings: UpgraderSettings }) {
  const box = jemlitBoxOf(cfg);
  const items = useMemo(() => {
    const seen = new Map<string, JemlitItem>();
    for (const b of [box, ...JEMLIT_FEATURED]) for (const it of b.items) if (it.shippable && !it.autoCashback && !seen.has(it.label)) seen.set(it.label, it);
    return [...seen.values()].sort((a, b) => a.price - b.price);
  }, [box]);
  const maxChance = upgraderMaxChance(settings);
  const [wager, setWager] = useState(10);
  const [chance, setChance] = useState(0.25);
  const [clientSeed, setClientSeed] = useState("my-lucky-seed");
  const gameRef = useRef<UpgraderGame | null>(null);
  if (!gameRef.current) gameRef.current = new UpgraderGame("live");
  const game = gameRef.current;
  const target = upgraderTarget(wager, chance, settings);
  const prize = useMemo(() => items.reduce((best, it) => (Math.abs(it.price - target) < Math.abs(best.price - target) ? it : best), items[0]), [items, target]);
  const [last, setLast] = useState<UpgraderPlay | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [tally, setTally] = useState({ plays: 0, paid: 0, won: 0, wins: 0 });
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  const play = () => {
    if (spinning || !prize) return;
    const p = game.play(wager, chance, clientSeed, prize.price, prize.label);
    setLast(p);
    setSpinning(true);
    timer.current = window.setTimeout(() => {
      setSpinning(false);
      setTally((t) => ({ plays: t.plays + 1, paid: t.paid + wager, won: t.won + (p.won ? p.target : 0), wins: t.wins + (p.won ? 1 : 0) }));
    }, 3300);
  };
  const done = last && !spinning;
  const c = Math.min(Math.max(chance, settings.minChance), maxChance);

  return (
    <div className="space-y-4">
      <Buttons anchor="games" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Upgrader</h2>
            <Badge tone="accent">fee {pct(settings.fee, 0)}</Badge>
            <Badge>chance up to {pct(maxChance, 0)}</Badge>
          </div>
          <Ring chance={c} roll={last ? last.roll : null} spinning={spinning} />
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs text-ink-3">Wager (Credits)</div>
              <NumberInput value={wager} min={1} step={5} onChange={(v) => !spinning && setWager(Math.max(1, v))} />
            </div>
            <div className="md:col-span-2">
              <div className="mb-1 text-xs text-ink-3">Chance</div>
              <div className="flex flex-wrap items-center gap-1">
                {settings.chanceOptions.map((o) => (
                  <button key={o} type="button" className={`chip ${Math.abs(c - Math.min(o, maxChance)) < 0.001 ? "chip-accent" : ""}`} disabled={spinning} onClick={() => setChance(Math.min(o, maxChance))}>
                    {pct(o, 0)}
                    {o > maxChance ? ` → ${pct(maxChance, 0)}` : ""}
                  </button>
                ))}
                <span className="w-24">
                  <NumberInput value={Math.round(c * 100)} min={1} max={Math.round(maxChance * 100)} step={1} onChange={(v) => !spinning && setChance(Math.min(maxChance, Math.max(settings.minChance, v / 100)))} />
                </span>
                <span className="text-xs text-ink-3">%</span>
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-line bg-paper p-3 text-sm">
            For {money(wager)} at {pct(c, 0)} you play for an item worth about <b>{money(target, 2)}</b>: {money(wager)} × (1 − {pct(settings.fee, 0)}) ÷ {pct(c, 0)}. Nearest item in the catalogue:{" "}
            <b>
              {prize?.label} ({money(prize?.price ?? 0)})
            </b>
            .
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary text-base" disabled={spinning} onClick={play}>
              {spinning ? "Spinning…" : `Upgrade · ${money(wager)}`}
            </button>
            <span className="text-xs text-ink-3">Your seed</span>
            <input className="w-40 rounded-md border border-line bg-paper px-2 py-1 text-xs" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
          </div>
          {done && last && (
            <div className="mt-4 flex items-center gap-4 rounded-xl border border-line bg-paper p-3">
              {prize && <ItemTile item={jemlitAsCatalogItem(prize)} size={64} />}
              <div className="text-sm">
                <div className="text-lg font-semibold">{last.won ? `You won ${last.targetLabel}` : "Lost the wager"}</div>
                <div className="text-ink-2">
                  Roll {(last.roll * 100).toFixed(2)} on 0 to 100 against a win zone of 0 to {pct(last.chance, 0)}: {last.won ? "inside" : "outside"}.
                  {last.won ? ` Item worth ${money(last.target)} listed, ${money(last.target * 0.9)} as Credits.` : ` ${money(last.wager)} gone.`}
                </div>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Plays" value={num(tally.plays)} />
            <Mini label="Paid" value={money(tally.paid)} />
            <Mini label="Wins" value={num(tally.wins)} sub={money(tally.won)} />
            <Mini label="RTP" value={tally.paid > 0 ? pct(tally.won / tally.paid) : "–"} sub="at listed prices" />
          </div>
        </Card>
        <Card title="What the chance buys">
          <div className="tbl"><table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Chance</Th>
                <Th right>1 in</Th>
                <Th right>Item worth, for {money(wager)}</Th>
                <Th right>Chance × worth</Th>
              </tr>
            </thead>
            <tbody>
              {[0.01, 0.05, 0.1, 0.25, 0.5, 0.75, maxChance].map((o) => (
                <tr key={o} className={`border-t border-line ${Math.abs(o - c) < 0.001 ? "bg-accent-soft" : ""}`}>
                  <Td mono>{pct(o, 0)}</Td>
                  <Td right mono>{num(Math.round(1 / o))}</Td>
                  <Td right mono>{money(upgraderTarget(wager, o, settings), 2)}</Td>
                  <Td right mono>{money(o * upgraderTarget(wager, o, settings), 2)}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="mt-2 text-xs text-ink-3">Whatever the chance, chance × worth = {money(wager * (1 - settings.fee), 2)}: the wager minus the fee. That is the whole Upgrader.</p>
        </Card>
      </div>
      {done && last && (
        <Card title="Analysis">
          <div className="space-y-2">
            <Acc title="The maths of the Upgrader" info="The fee is the margin: whatever chance you pick, the item on offer is worth the wager less 15%, divided by the chance.">
              <div className="tbl"><table className="w-full max-w-xl text-xs">
                <tbody>
                  {[
                    ["Wager", money(last.wager)],
                    ["Chance chosen", `${pct(last.chance, 0)} (${oneIn(last.chance)})`],
                    ["Item on offer", `${money(last.wager)} × (1 − ${pct(settings.fee, 0)}) ÷ ${pct(last.chance, 0)} = ${money(upgraderTarget(last.wager, last.chance, settings), 2)}`],
                    ["Average payout per play", `${pct(last.chance, 0)} × ${money(last.target)} = ${money(last.chance * last.target, 2)}`],
                    ["Return at listed prices", `${pct((last.chance * last.target) / last.wager)} (the rule says ${pct(1 - settings.fee)})`],
                    ["Return in Credits (cashback 90%)", pct(((last.chance * last.target) / last.wager) * 0.9)],
                    ["Jemlit keeps per play", `${money(last.wager - last.chance * last.target, 2)}`],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-line">
                      <Td>{k}</Td>
                      <Td right mono>{v}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Acc>
            <Acc title="How this play was decided, step by step">
              <ol className="list-decimal space-y-1 pl-5">
                <li>You put in {money(last.wager)} and chose {pct(last.chance, 0)}. The offer was an item worth about {money(last.target)}.</li>
                <li>A secret was locked in before play (hash {short(last.serverHash)}); your seed was {last.clientSeed}; this was play number {last.nonce}.</li>
                <li>Secret, seed and play number were mixed into a roll of {(last.roll * 100).toFixed(2)} on a line from 0 to 100.</li>
                <li>The win zone is 0 to {pct(last.chance, 0)}. The roll was {last.won ? "inside: you got the item" : "outside: the wager is gone"}.</li>
              </ol>
            </Acc>
            <Acc title="Was it fair? The check">
              <p>The same primitive as the boxes. It proves the roll came from the committed secret and your seed. It does not prove the item&apos;s listed value.</p>
              <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 text-xs sm:grid-cols-2">
                <Row k="Server seed hash" v={last.serverHash} />
                <Row k="Server seed" v={last.serverSeed} />
                <Row k="Client seed · play number" v={`${last.clientSeed} · ${last.nonce}`} />
                <Row k="Roll (fraction)" v={last.roll.toFixed(10)} />
              </div>
            </Acc>
            <Acc title="The logic behind the Upgrader">
              <ul className="list-disc space-y-1 pl-5">
                <li>It sells a chance. Pick the chance, and the prize scales down to match: wager × 0.85 ÷ chance.</li>
                <li>The 15% fee is Jemlit&apos;s setting (upgrader_fee) and caps the selector at 85%.</li>
                <li>Expected return is 85% at listed prices on every play, 76.5% if the prize is exchanged for Credits.</li>
                <li>Winning an item lets you &quot;upgrade again&quot; from it: the same fee each time.</li>
              </ul>
            </Acc>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================== Mines */

export function JemlitMinesStage({ settings }: { settings: MinesSettings }) {
  const [mines, setMines] = useState(3);
  const [wager, setWager] = useState(10);
  const [clientSeed, setClientSeed] = useState("my-lucky-seed");
  const gameRef = useRef<{ key: string; game: MinesGame } | null>(null);
  const key = JSON.stringify(settings);
  if (!gameRef.current || gameRef.current.key !== key) gameRef.current = { key, game: new MinesGame(settings, "live") };
  const game = gameRef.current.game;
  const [round, setRound] = useState<MinesRound | null>(null);
  const [tally, setTally] = useState({ rounds: 0, paid: 0, won: 0 });
  const [verify, setVerify] = useState<{ ok: boolean; reason?: string } | null>(null);
  const n = settings.totalTiles;
  const cols = Math.round(Math.sqrt(n));
  const playing = round?.status === "playing";
  const start = () => {
    if (playing) return;
    const r = game.start(wager, mines, clientSeed);
    setRound(r);
    setVerify(null);
    setTally((t) => ({ ...t, rounds: t.rounds + 1, paid: t.paid + wager }));
  };
  const reveal = (tile: number) => {
    if (!round || !playing) return;
    const r = game.reveal(round, tile);
    setRound(r);
    if (r.status === "cashed") setTally((t) => ({ ...t, won: t.won + r.payout }));
  };
  const cashout = () => {
    if (!round || !playing) return;
    const r = game.cashout(round);
    setRound(r);
    if (r.status === "cashed") setTally((t) => ({ ...t, won: t.won + r.payout }));
  };
  const nextMult = round ? minesMultiplier(n, round.mines, round.revealed.length + 1, settings.houseEdge) : minesMultiplier(n, mines, 1, settings.houseEdge);
  const ended = round && round.status !== "playing";

  return (
    <div className="space-y-4">
      <Buttons anchor="games" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Mines</h2>
            <Badge tone="accent">{n} tiles</Badge>
            <Badge>house edge {pct(settings.houseEdge, 0)}</Badge>
            {round && <Badge>{round.status === "playing" ? `playing · ×${round.multiplier.toFixed(2)}` : round.status === "cashed" ? `cashed out ${money(round.payout)}` : "hit a mine"}</Badge>}
          </div>
          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, maxWidth: "26rem" }}>
            {Array.from({ length: n }, (_, i) => {
              const revealed = round?.revealed.includes(i) ?? false;
              const isMine = round?.minePositions.includes(i) ?? false;
              const show = revealed || (ended && isMine);
              return (
                <button key={i} type="button" disabled={!playing || revealed} onClick={() => reveal(i)} className={`aspect-square rounded-lg border text-sm font-semibold transition ${show ? (isMine ? "border-bad bg-bad-soft text-bad" : "border-good bg-good-soft text-good") : "border-line bg-paper hover:border-accent"}`} aria-label={`tile ${i}`}>
                  {show ? (isMine ? "✸" : "✓") : ""}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <div className="mb-1 text-xs text-ink-3">Mines</div>
              <span className="block w-24">
                <NumberInput value={mines} min={1} max={n - 1} step={1} onChange={(v) => !playing && setMines(Math.max(1, Math.min(n - 1, Math.round(v))))} />
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs text-ink-3">Wager (Credits)</div>
              <span className="block w-28">
                <NumberInput value={wager} min={settings.minWager} max={settings.maxWager} step={5} onChange={(v) => !playing && setWager(Math.max(settings.minWager, v))} />
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs text-ink-3">Your seed</div>
              <input className="w-40 rounded-md border border-line bg-paper px-2 py-1 text-sm" value={clientSeed} onChange={(e) => !playing && setClientSeed(e.target.value)} />
            </div>
            {!playing ? (
              <button type="button" className="btn btn-primary" onClick={start}>
                Start round · {money(wager)}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={(round?.revealed.length ?? 0) === 0} onClick={cashout}>
                Cash out {money(round?.payout ?? 0)}
              </button>
            )}
            <span className="text-xs text-ink-3">next safe tile → ×{nextMult.toFixed(2)}</span>
          </div>
          {round && !playing && (
            <div className="mt-3 text-xs text-ink-3">
              Secret locked in before the round: {short(round.serverHash)}. {round.status === "busted" ? `Mine on tile ${round.revealed[round.revealed.length - 1]} after ${round.revealed.length - 1} safe tiles.` : `${round.revealed.length} safe tiles, ×${round.multiplier.toFixed(2)}.`}
            </div>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Rounds" value={num(tally.rounds)} />
            <Mini label="Paid" value={money(tally.paid)} />
            <Mini label="Cashed out" value={money(tally.won)} />
            <Mini label="RTP" value={tally.paid > 0 ? pct(tally.won / tally.paid) : "–"} sub={`the rule says ${pct(1 - settings.houseEdge, 0)}`} />
          </div>
        </Card>
        <Card title={`Multipliers with ${round?.mines ?? mines} mines`}>
          <div className="tbl"><table className="w-full text-xs">
            <thead>
              <tr>
                <Th right>Safe tiles</Th>
                <Th right>Chance to get there</Th>
                <Th right>Multiplier</Th>
                <Th right>Chance × multiplier</Th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.min(12, n - (round?.mines ?? mines)) }, (_, i) => i + 1).map((s) => {
                const m = round?.mines ?? mines;
                return (
                  <tr key={s} className={`border-t border-line ${round && round.revealed.length === s && round.status === "playing" ? "bg-accent-soft" : ""}`}>
                    <Td right mono>{s}</Td>
                    <Td right mono>{pctSmart(minesSurvival(n, m, s))}</Td>
                    <Td right mono>×{minesMultiplier(n, m, s, settings.houseEdge).toFixed(2)}</Td>
                    <Td right mono>{(minesSurvival(n, m, s) * minesMultiplier(n, m, s, settings.houseEdge)).toFixed(3)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <p className="mt-2 text-xs text-ink-3">Chance × multiplier is always {(1 - settings.houseEdge).toFixed(2)}: cash out after one tile or after ten, the average is the same. Only the swing changes.</p>
        </Card>
      </div>
      {ended && round && (
        <Card title="Analysis">
          <div className="space-y-2">
            <Acc title="The maths of Mines" info="The multiplier is the fair odds of surviving, times one minus the house edge. So every strategy returns the same share of the wager on average.">
              <div className="tbl"><table className="w-full max-w-xl text-xs">
                <tbody>
                  {[
                    ["Tiles, mines, safe tiles", `${n}, ${round.mines}, ${n - round.mines}`],
                    ["Chance the first tile is safe", `${n - round.mines} ÷ ${n} = ${pct((n - round.mines) / n)}`],
                    ["Fair multiplier for one safe tile", `${n} ÷ ${n - round.mines} = ×${(n / (n - round.mines)).toFixed(3)}`],
                    ["After the house edge", `×${(n / (n - round.mines)).toFixed(3)} × (1 − ${pct(settings.houseEdge, 0)}) = ×${minesMultiplier(n, round.mines, 1, settings.houseEdge).toFixed(3)}`],
                    ["Each further tile", "multiply by (tiles left ÷ safe tiles left)"],
                    ["Average return, any strategy", pct(1 - settings.houseEdge)],
                    ["This round", round.status === "cashed" ? `${round.revealed.length} safe tiles, ×${round.multiplier.toFixed(2)}, ${money(round.payout)} for ${money(round.wager)}` : `hit a mine, ${money(round.wager)} gone`],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-line">
                      <Td>{k}</Td>
                      <Td right mono>{v}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Acc>
            <Acc title="How the mines were placed, step by step">
              <ol className="list-decimal space-y-1 pl-5">
                <li>Before you touched a tile the site locked in a secret and showed its scrambled copy ({short(round.serverHash)}). Your seed was {round.clientSeed}.</li>
                <li>Start with the tiles in order, 0 to {n - 1}. For each step from 1 to {n - 1}: mix the secret, your seed and the step number into a fraction; use it to pick one tile from the unshuffled part and swap it to the end. This is a Fisher–Yates shuffle, Jemlit&apos;s own description.</li>
                <li>The first {round.mines} tiles of the shuffled list, sorted, are the mines: {round.minePositions.join(", ")}.</li>
                <li>Every layout is equally likely. The house edge touches only the multiplier, never the placement.</li>
              </ol>
            </Acc>
            <Acc title="Was it fair? The check">
              <div className="flex flex-wrap items-center gap-2">
                <Button kind="ghost" onClick={() => setVerify(verifyMines(round))}>
                  Check this round
                </Button>
                {verify && <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Checked: the seed matches its hash and the mines recompute to the same tiles" : `Does not match: ${verify.reason}`}</Badge>}
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 text-xs sm:grid-cols-2">
                <Row k="Server seed hash (SHA-512)" v={round.serverHash} />
                <Row k="Server seed" v={round.serverSeed} />
                <Row k="Client seed" v={round.clientSeed} />
                <Row k="Mine positions" v={round.minePositions.join(", ")} />
              </div>
            </Acc>
            <Acc title="The logic behind Mines">
              <ul className="list-disc space-y-1 pl-5">
                <li>A pure gamble on Credits: no items in the box, only a multiplier.</li>
                <li>The edge is a flat cut of every multiplier. Jemlit&apos;s client applies it as multiplier × (1 − house_edge); the value of the edge is set by the server and was not visible from outside, so {pct(settings.houseEdge, 0)} here is the Crash edge used as a placeholder.</li>
                <li>Cashing out early or late does not change the average. More tiles means a bigger prize with a smaller chance, in exact proportion.</li>
                <li>The API lets a win be taken as an item instead of Credits.</li>
              </ul>
            </Acc>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ================================================================== Crash */

export function JemlitCrashStage({ settings }: { settings: CrashSettings }) {
  const [wager, setWager] = useState(10);
  const [auto, setAuto] = useState(2);
  const [clientSeed, setClientSeed] = useState("my-lucky-seed");
  const gameRef = useRef<{ key: string; game: CrashGame } | null>(null);
  const key = JSON.stringify(settings);
  if (!gameRef.current || gameRef.current.key !== key) gameRef.current = { key, game: new CrashGame(settings, "live") };
  const game = gameRef.current.game;
  const [round, setRound] = useState<CrashRound | null>(null);
  const [shown, setShown] = useState(1);
  const [running, setRunning] = useState(false);
  const [tally, setTally] = useState({ rounds: 0, paid: 0, won: 0 });
  const [verify, setVerify] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [nextHash, setNextHash] = useState(game.nextHash);
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const play = () => {
    if (running) return;
    const r = game.play(wager, auto, clientSeed);
    setRound(r);
    setVerify(null);
    setRunning(true);
    setShown(1);
    const t0 = performance.now();
    const step = (t: number) => {
      const secs = (t - t0) / 1000;
      const m = Math.min(r.multiplier, Math.exp(0.35 * secs)); // the curve climbs; the crash point is already fixed
      setShown(m);
      if (m < r.multiplier) raf.current = requestAnimationFrame(step);
      else {
        setRunning(false);
        setNextHash(game.nextHash);
        setTally((x) => ({ rounds: x.rounds + 1, paid: x.paid + wager, won: x.won + r.payout }));
      }
    };
    raf.current = requestAnimationFrame(step);
  };
  const done = round && !running;
  return (
    <div className="space-y-4">
      <Buttons anchor="games" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Crash</h2>
            <Badge tone="accent">house edge {pct(settings.houseEdge, 0)}</Badge>
            <Badge>max ×{num(settings.maxMultiplier)}</Badge>
            <Badge>max win {money(settings.maxWinnable)}</Badge>
          </div>
          <div className={`mt-3 flex h-40 items-center justify-center rounded-xl border ${done && round ? (round.won ? "border-good bg-good-soft" : "border-bad bg-bad-soft") : "border-line bg-paper"}`}>
            <div className="text-center">
              <div className="font-mono text-5xl font-semibold tabular-nums">×{shown.toFixed(2)}</div>
              {done && round && <div className="mt-1 text-sm">{round.won ? `cashed out at ×${round.autoCashout.toFixed(2)}: ${money(round.payout)}` : `crashed at ×${round.multiplier.toFixed(2)} before ×${round.autoCashout.toFixed(2)}: ${money(round.wager)} gone`}</div>}
              {running && <div className="mt-1 text-sm text-ink-3">climbing…</div>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div>
              <div className="mb-1 text-xs text-ink-3">Wager (Credits)</div>
              <span className="block w-28">
                <NumberInput value={wager} min={settings.minWager} max={settings.maxWager} step={5} onChange={(v) => !running && setWager(Math.max(settings.minWager, v))} />
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs text-ink-3">Auto cash-out at ×</div>
              <span className="block w-28">
                <NumberInput value={auto} min={1.01} max={1000} step={0.1} onChange={(v) => !running && setAuto(Math.max(1.01, v))} />
              </span>
            </div>
            <div>
              <div className="mb-1 text-xs text-ink-3">Your seed</div>
              <input className="w-40 rounded-md border border-line bg-paper px-2 py-1 text-sm" value={clientSeed} onChange={(e) => !running && setClientSeed(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary" disabled={running} onClick={play}>
              {running ? "Climbing…" : `Play round · ${money(wager)}`}
            </button>
          </div>
          <div className="mt-2 text-xs text-ink-3" title={nextHash}>
            Next round&apos;s seed hash, published ahead: <code>{short(nextHash, 14)}</code>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Mini label="Rounds" value={num(tally.rounds)} />
            <Mini label="Paid" value={money(tally.paid)} />
            <Mini label="Cashed out" value={money(tally.won)} />
            <Mini label="RTP" value={tally.paid > 0 ? pct(tally.won / tally.paid) : "–"} sub={`the rule says ${pct(1 - settings.houseEdge, 0)}`} />
          </div>
        </Card>
        <Card title="How often the round gets there">
          <div className="tbl"><table className="w-full text-xs">
            <thead>
              <tr>
                <Th right>Cash out at</Th>
                <Th right>Chance the round reaches it</Th>
                <Th right>1 in</Th>
                <Th right>Chance × multiplier</Th>
              </tr>
            </thead>
            <tbody>
              {[1.2, 1.5, 2, 3, 5, 10, 25, 100].map((m) => {
                const p = crashProbAtLeast(m, settings.houseEdge);
                return (
                  <tr key={m} className={`border-t border-line ${Math.abs(m - auto) < 0.001 ? "bg-accent-soft" : ""}`}>
                    <Td right mono>×{m.toFixed(2)}</Td>
                    <Td right mono>{pct(p)}</Td>
                    <Td right mono>{num(Math.round(1 / p))}</Td>
                    <Td right mono>{(p * m).toFixed(2)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
          <p className="mt-2 text-xs text-ink-3">Chance × multiplier is always {(1 - settings.houseEdge).toFixed(2)}. The round shows ×1.00 and takes everything {pct(settings.houseEdge, 0)} of the time.</p>
        </Card>
      </div>
      {done && round && (
        <Card title="Analysis">
          <div className="space-y-2">
            <Acc title="The maths of Crash" info="The crash point is (1 − edge) divided by (1 − roll). The chance of reaching any multiplier m is (1 − edge) ÷ m, so the average return is 1 − edge whatever you aim for.">
              <div className="tbl"><table className="w-full max-w-xl text-xs">
                <tbody>
                  {[
                    ["Roll (fraction)", `${(1 - (1 - settings.houseEdge) / round.multiplier).toFixed(6)} (recovered from the multiplier)`],
                    ["Crash point", `(1 − ${settings.houseEdge}) ÷ (1 − roll) = ×${round.multiplier.toFixed(2)}`],
                    ["Your target", `×${round.autoCashout.toFixed(2)}, reached ${pct(crashProbAtLeast(round.autoCashout, settings.houseEdge))} of the time`],
                    ["Average payout per round", `${pct(crashProbAtLeast(round.autoCashout, settings.houseEdge))} × ${money(round.wager * round.autoCashout)} = ${money(crashProbAtLeast(round.autoCashout, settings.houseEdge) * round.wager * round.autoCashout, 2)}`],
                    ["Return", pct(1 - settings.houseEdge)],
                    ["This round", round.won ? `cashed out: ${money(round.payout)} for ${money(round.wager)}` : `crashed first: ${money(round.wager)} gone`],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-t border-line">
                      <Td>{k}</Td>
                      <Td right mono>{v}</Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Acc>
            <Acc title="How this round was decided, step by step">
              <ol className="list-decimal space-y-1 pl-5">
                <li>The seeds for all rounds form a chain made in advance: each round&apos;s seed is the scrambled copy of the next round&apos;s hash. The hash of this round ({short(round.serverHash)}) was published before it started.</li>
                <li>The seed and your seed were mixed (with play number 0) into a roll from 0 to 1.</li>
                <li>Crash point = (1 − {pct(settings.houseEdge, 0)}) ÷ (1 − roll) = ×{round.multiplier.toFixed(2)}, capped at ×{num(settings.maxMultiplier)} and never below ×1.00.</li>
                <li>The curve climbed on screen; the crash point was fixed before the first frame. Your auto cash-out at ×{round.autoCashout.toFixed(2)} {round.won ? "came first" : "came too late"}.</li>
              </ol>
            </Acc>
            <Acc title="Was it fair? The check">
              <div className="flex flex-wrap items-center gap-2">
                <Button kind="ghost" onClick={() => setVerify(verifyCrash(round, settings))}>
                  Check this round
                </Button>
                {verify && <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Checked: the seed matches its hash and the crash point recomputes" : `Does not match: ${verify.reason}`}</Badge>}
              </div>
              <div className="mt-2 grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-3 text-xs sm:grid-cols-2">
                <Row k="Server seed hash, published ahead" v={round.serverHash} />
                <Row k="Server seed" v={round.serverSeed} />
                <Row k="Client seed" v={round.clientSeed} />
                <Row k="Crash point" v={`×${round.multiplier.toFixed(2)}`} />
              </div>
            </Acc>
            <Acc title="The logic behind Crash">
              <ul className="list-disc space-y-1 pl-5">
                <li>A pure gamble on Credits with a stated 8% edge: Jemlit&apos;s crash_house_edge setting.</li>
                <li>Because the chance of reaching ×m is (1 − edge) ÷ m, no cash-out target beats another on average. Low targets win often and little; high targets rarely and much.</li>
                <li>The hash chain means every round&apos;s seed was fixed before the first round was ever played; the client seed stops the chain from being precomputed into results.</li>
                <li>Jemlit&apos;s API lets a Crash win be taken as a prize item instead of Credits.</li>
              </ul>
            </Acc>
          </div>
        </Card>
      )}
    </div>
  );
}

export function gamesMath(cfg: JemlitConfig) {
  return jemlitMath(jemlitBoxOf(cfg), cfg.chances, cfg);
}
