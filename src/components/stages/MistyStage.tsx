"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MistyBox, MistyConfig, MistyOutcome, MistySpin } from "@/engine/types";
import { MISTY_BOXES, MistyOpener, buildTable, itemOddsRatio, lookup, mistyBox, mistyMath, playerWeights, verifyMistySpin, type MistyTable } from "@/engine/labs/misty";
import { makeRng } from "@/engine/rng";
import { mistyConfigFor } from "@/lib/mistyPresets";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Info, Select, Td, Th } from "../ui";
import { CountUp } from "../lab/CountUp";
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

function rarityClass(r: string) {
  return `misty-card misty-${r}`;
}

function buildStrip(table: MistyTable, winner: MistyOutcome, spinIdx: number): MistyOutcome[] {
  const rng = makeRng("sfc32", `misty-strip:${spinIdx}`);
  const arr: MistyOutcome[] = [];
  for (let i = 0; i < STRIP; i++) arr.push(lookup(table, rng.next()).outcome);
  arr[WIN] = winner;
  return arr;
}

function CardFace({ o, big }: { o: MistyOutcome; big?: boolean }) {
  const title = o.kind === "item" ? o.label : o.label.replace(" Mistees", "").replace(" Mistee", "");
  return (
    <div className={`${rarityClass(o.rarity)} ${big ? "misty-card-big" : ""}`} title={o.label}>
      <div className="misty-card-rarity">{o.rarity}</div>
      <div className="misty-card-title">{o.kind === "item" ? title : o.kind === "bonus" ? o.label : `${o.mistees}`}</div>
      <div className="misty-card-sub">{o.kind === "item" ? `${money(o.valueUsd ?? 0)}+` : o.kind === "bonus" ? "" : "Mistees"}</div>
    </div>
  );
}

export function MistyStage({ cfg, seed, onChange, onSettings }: { cfg: MistyConfig; seed: number; onChange: (c: MistyConfig) => void; onSettings: (section?: string) => void }) {
  const box = mistyBox(cfg.boxSlug);
  const key = useMemo(() => JSON.stringify([cfg, seed]), [cfg, seed]);
  const openerRef = useRef<{ key: string; opener: MistyOpener } | null>(null);
  if (!openerRef.current || openerRef.current.key !== key) openerRef.current = { key, opener: new MistyOpener(cfg, `live:${seed}`) };
  const opener = openerRef.current.opener;
  const player = cfg.players.find((p) => p.id === cfg.activePlayerId) ?? cfg.players[0];
  const pw = playerWeights(cfg, player?.id ?? "");
  const table = useMemo(() => buildTable(box, pw.weights), [box, pw.weights]);
  const m = useMemo(() => mistyMath(box, pw.weights, cfg.bonus, cfg), [box, pw.weights, cfg]);
  const ratio = itemOddsRatio(box, cfg.weights, player?.weights);

  const [tally, setTally] = useState<Tally>(ZERO);
  const [last, setLast] = useState<MistySpin | null>(null);
  const [strip, setStrip] = useState<MistyOutcome[]>(() => buildStrip(table, table.entries[0].outcome, 0));
  const [x, setX] = useState(0);
  const [phase, setPhase] = useState<"idle" | "spinning" | "bonus" | "done">("idle");
  const [bonusShown, setBonusShown] = useState(0);
  const [fast, setFast] = useState(false);
  const [commit, setCommit] = useState(opener.commitment);
  const [verify, setVerify] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [traded, setTraded] = useState(false);
  const [history, setHistory] = useState<MistySpin[]>([]);
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const viewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTally(ZERO);
    setLast(null);
    setPhase("idle");
    setX(0);
    setBonusShown(0);
    setVerify(null);
    setTraded(false);
    setHistory([]);
    setCommit(opener.commitment);
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

  const spin = () => {
    if (phase === "spinning" || phase === "bonus") return;
    const s = opener.spin(player?.id);
    const winner = box.outcomes.find((o) => o.id === s.outcomeId)!;
    const rng = makeRng("sfc32", `misty-land:${s.idx}:${seed}`);
    const land = (rng.next() - 0.5) * CARD * 0.55; // never dead centre, never past the edge
    setStrip(buildStrip(table, winner, s.idx + seed));
    setVerify(null);
    setTraded(false);
    setBonusShown(0);
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
      setCommit(opener.commitment);
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
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      setX(-reelPosition(k, D));
      if (k < 1) rafRef.current = requestAnimationFrame(step);
      else finish();
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

  return (
    <div className="space-y-4">
      {/* the boxes, as the site lists them */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {MISTY_BOXES.map((b) => {
          const bm = mistyMath(b, undefined, b.bonus, cfg);
          const active = b.slug === cfg.boxSlug;
          return (
            <button key={b.slug} type="button" disabled={busy} className={`misty-box-tile ${active ? "misty-box-tile-active" : ""}`} onClick={() => !active && onChange(mistyConfigFor(b.slug, cfg))} title={b.tagline}>
              <div className="text-[11px] uppercase tracking-wide opacity-70">{b.price > 0 ? money(b.price) : "free"}</div>
              <div className="text-sm font-semibold leading-tight">{b.name}</div>
              <div className="text-[11px] opacity-70">{bm.pItem > 0 ? `a piece ${oneIn(bm.pItem)}` : "Mistees only"}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{box.name}</h2>
            <Badge tone="accent">{box.price > 0 ? money(box.price) : "free"}</Badge>
            <Badge>a piece {oneIn(m.pItem)}</Badge>
            <span className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-ink-3">Playing as</span>
              <span className="w-44">
                <Select<string> value={player?.id ?? ""} onChange={(v) => onChange({ ...cfg, activePlayerId: v })} options={cfg.players.map((p) => ({ value: p.id, label: p.name }))} />
              </span>
              {player?.weights && <Badge tone={ratio > 1 ? "good" : "bad"}>own odds ×{ratio.toFixed(2)}</Badge>}
            </span>
          </div>
          <p className="mb-3 text-xs text-ink-3">{box.tagline}</p>

          <div ref={viewRef} className="misty-view">
            <div className="misty-pointer" />
            <div className="misty-strip" style={{ transform: `translateX(${x}px)`, transition: "none" }}>
              {strip.map((o, i) => (
                <CardFace key={`${i}-${o.id}`} o={o} />
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary text-base" disabled={busy || !player} onClick={spin}>
              {busy ? "Spinning…" : `Tap to spin · ${box.price > 0 ? money(box.price) : "free"}`}
            </button>
            <label className="flex items-center gap-1 text-xs text-ink-3">
              <input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> fast reveal
            </label>
            {cfg.provablyFair ? (
              <span className="ml-auto flex items-center gap-1 text-xs text-ink-3" title={commit}>
                next secret&apos;s fingerprint <code className="text-[11px]">{short(commit)}</code>
                <Info>Shown before you pay. After the spin the secret itself is revealed and must match this fingerprint. That is how you know the secret was fixed before your money went in.</Info>
              </span>
            ) : (
              <Badge tone="bad">no proof: plain random</Badge>
            )}
          </div>

          {last && lastOutcome && phase !== "spinning" && (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <CardFace o={lastOutcome} big />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <div className="text-lg font-semibold">
                  {last.kind === "item" ? (traded ? `Traded in for ${num(last.itemValue)} Mistees` : `You pulled ${last.label}`) : last.kind === "bonus" ? last.label : `${last.mistees} Mistees`}
                </div>
                {last.kind === "item" && (
                  <div className="text-ink-2">
                    Minimum retail value {money(last.itemValue)}. Ship it, or{" "}
                    <button type="button" className="chip" disabled={traded} onClick={tradeIn}>
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
                  <div className="text-ink-2">
                    {last.kind === "item" && !traded ? (
                      <>A piece worth {money(last.itemValue)} at listed, about {money(last.itemValue * cfg.itemRealized)} at resale.</>
                    ) : (
                      <>
                        {fmtMist(traded ? last.itemValue : last.totalMistees)} Mistees credited: {money((traded ? last.itemValue : last.totalMistees) * cfg.misteeFace)} on the screen, about {money((traded ? last.itemValue : last.totalMistees) * cfg.misteeReal)} in real terms, and only good for more boxes.
                      </>
                    )}
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
            <Mini label="Back at face" value={tally.spent > 0 ? pct(faceBack / tally.spent) : "–"} sub={tally.spent > 0 ? `really ${pct((tally.itemValue * cfg.itemRealized + tally.mistees * cfg.misteeReal) / tally.spent)}` : undefined} />
          </div>
        </Card>

        <Card
          title={
            <span className="flex items-center gap-1">
              What you can pull
              <Info>The live odds table, exactly as the page shows it. Tap the cog to change any percentage, or to give this player a table of their own.</Info>
            </span>
          }
          actions={
            <button type="button" className="chip" onClick={() => onSettings("box")}>
              edit odds
            </button>
          }
        >
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Outcome</Th>
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
                          <span className={`misty-dot misty-${e.outcome.rarity}`} />
                          <span className="truncate" title={e.outcome.label}>
                            {e.outcome.label}
                            {e.outcome.kind === "item" && <span className="text-ink-3"> · {money(e.outcome.valueUsd ?? 0)}+</span>}
                          </span>
                        </span>
                      </Td>
                      <Td right mono>{pctSmart(e.percent / table.total)}</Td>
                      <Td right mono>{e.percent > 0 ? num(Math.round(table.total / e.percent)) : "never"}</Td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
            <Badge>pays {money(m.payFace, 2)} per open at face = {pct(m.returnFace)}</Badge>
            <Badge tone="warn">really about {money(m.payReal, 2)} = {pct(m.returnReal)}</Badge>
            <Badge>free spin pays {m.bonusEv.toFixed(2)} Mistees</Badge>
          </div>
        </Card>
      </div>

      {/* the proof */}
      <Card
        title={
          <span className="flex items-center gap-1">
            Provably fair, as Misty states it
            <Info>{box.fairness || "Every open is resolved from a server seed committed before you pay, a client seed you can set, and a nonce. The seed is revealed at the open and the odds table is frozen onto it."}</Info>
          </span>
        }
        actions={
          last && cfg.provablyFair ? (
            <Button kind="ghost" onClick={() => setVerify(verifyMistySpin(last, cfg))}>
              Check this open
            </Button>
          ) : undefined
        }
      >
        {!last ? (
          <p className="text-sm text-ink-2">Before you pay, Misty shows the fingerprint of a secret. Spin once and the secret, your seed, the spin number and the frozen odds table appear here so the spin can be recomputed.</p>
        ) : !cfg.provablyFair ? (
          <p className="text-sm text-ink-2">The proof is switched off in the back office: this spin came from a plain random number and there is nothing to recompute. Turn it on under the cog, &quot;The proof&quot;.</p>
        ) : (
          <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <Row k="Fingerprint shown before you paid" v={last.serverHash} />
            <Row k="Secret revealed after the spin" v={last.serverSeed} />
            <Row k="Your seed" v={last.clientSeed} />
            <Row k="Spin number" v={String(last.nonce)} />
            <Row k="Mixed together (HMAC-SHA256)" v={last.digest} />
            <Row k="Roll (first 13 hex characters ÷ 2^52)" v={`${(last.roll * 100).toFixed(4)} on a 0 to 100 line`} />
            <Row k="Odds table frozen onto this open" v={last.tableHash} />
            <Row k="Band the roll fell in" v={band ? `${band.from.toFixed(3)} to ${band.to.toFixed(3)} = ${band.outcome.label}` : ""} />
            {last.bonus.map((b, i) => (
              <Row key={b.nonce} k={`Free spin ${i + 1}: spin number ${b.nonce}, roll`} v={`${(b.roll * 100).toFixed(2)} → ${fmtMist(b.mistees)} Mistees`} />
            ))}
            {verify && (
              <div className="sm:col-span-2">
                <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Recomputed: everything matches" : `Does not match: ${verify.reason}`}</Badge>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* the logic, narrated */}
      <Card title="How this spin was decided, in plain words">
        {last && lastOutcome ? <Narration spin={last} box={box} cfg={cfg} band={band} playerName={player?.name ?? "the player"} ratio={ratio} traded={traded} /> : <p className="text-sm text-ink-2">Spin once and every step of the decision is written out here.</p>}
      </Card>

      <Card title="The logic behind every Misty box">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
          <li>
            <b>The price is fixed first.</b> {box.name} costs {box.price > 0 ? money(box.price) : "nothing"}. Everything else is tuned to fit that price.
          </li>
          <li>
            <b>Every outcome has a chance, and the chances add up to 100.</b> This box has {box.outcomes.length} outcomes. A piece drops {oneIn(m.pItem)}; the rest of the time the box pays Mistees.
          </li>
          <li>
            <b>Each outcome costs the operator its value times its chance.</b> Add those up and {box.name} pays back about {money(m.payFace, 2)} per open with Mistees counted at {money(cfg.misteeFace)} each, which is {pct(m.returnFace)} of the price. Counting Mistees at what they really cost ({money(cfg.misteeReal)}) and pieces at resale, it is about {money(m.payReal, 2)}, or {pct(m.returnReal)}.
          </li>
          <li>
            <b>The rare piece is the adjustable part.</b> Make the top piece twice as likely and its cost per open doubles; that is how a {money(box.outcomes.reduce((s, o) => Math.max(s, o.valueUsd ?? 0), 0))} piece fits inside a {box.price > 0 ? money(box.price) : "free"} box.
          </li>
          <li>
            <b>Every open is its own draw.</b> Nothing is remembered between opens, no pool runs out, nobody&apos;s result changes anybody else&apos;s. {num(100)} players opening this box are {num(100)} independent rolls.
          </li>
          <li>
            <b>Mistees are credit, not money.</b> They can only buy more boxes or products on the site. On screen one Mistee is {money(cfg.misteeFace)}; spent on boxes it is worth about {money(cfg.misteeReal)}.
          </li>
          <li>
            <b>The proof covers the roll, not the table.</b> The fingerprint shown before payment proves the secret was fixed in advance, and the frozen table proves the roll was read against that table. It does not prove every player was given the same table. The back office here can give {player?.name ?? "a player"} their own odds, and every proof still passes.
          </li>
        </ol>
      </Card>

      {history.length > 1 && (
        <Card title="Last spins">
          <div className="flex flex-wrap gap-2 text-xs">
            {history.map((h) => (
              <span key={h.idx} className="chip" title={`spin ${h.idx} · roll ${(h.roll * 100).toFixed(3)}`}>
                #{h.idx} {h.kind === "item" ? h.label.split(",")[0] : `${fmtMist(h.totalMistees)} Mistees`}
              </span>
            ))}
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

function Narration({ spin, box, cfg, band, playerName, ratio, traded }: { spin: MistySpin; box: MistyBox; cfg: MistyConfig; band?: { from: number; to: number }; playerName: string; ratio: number; traded: boolean }) {
  const own = Math.abs(ratio - 1) > 1e-9 || (cfg.players.find((p) => p.id === spin.playerId)?.weights ? true : false);
  const pf = cfg.provablyFair;
  const steps: React.ReactNode[] = [];
  steps.push(
    <>
      <b>{playerName}</b> picked <b>{box.name}</b> and paid <b>{spin.price > 0 ? money(spin.price) : "nothing"}</b>.
    </>,
  );
  if (pf) {
    steps.push(
      <>
        Before the money went in, the site showed the fingerprint <code>{short(spin.serverHash)}</code> of a secret it had already chosen. The secret cannot be changed afterwards without the fingerprint changing too.
      </>,
    );
    steps.push(
      <>
        {playerName}&apos;s own seed was <code>{spin.clientSeed}</code>, and this was spin number <b>{spin.nonce}</b> under that secret. The secret, the seed and the spin number were mixed with HMAC-SHA256 into <code>{short(spin.digest)}</code>. Nobody can steer that number without knowing the secret and the seed in advance.
      </>,
    );
    steps.push(
      <>
        The first 13 characters of that number were turned into a roll of <b>{(spin.roll * 100).toFixed(3)}</b> on a line from 0 to 100.
      </>,
    );
  } else {
    steps.push(<>The proof is switched off, so the site simply drew a random roll of <b>{(spin.roll * 100).toFixed(3)}</b> on a line from 0 to 100. Nothing was committed in advance and nothing can be checked.</>);
  }
  steps.push(
    <>
      The odds table{own ? <> given to <b>{playerName}</b> (not the box&apos;s own table: pieces are ×{ratio.toFixed(2)} as likely)</> : null} cuts that line into {box.outcomes.length} bands, one per outcome, each as wide as its chance.{pf ? <> The table&apos;s fingerprint <code>{short(spin.tableHash)}</code> was frozen onto this open.</> : null} The roll landed in the band from <b>{band ? band.from.toFixed(3) : "?"}</b> to <b>{band ? band.to.toFixed(3) : "?"}</b>, which belongs to <b>{spin.label}</b>.
    </>,
  );
  if (spin.bonus.length) {
    steps.push(
      <>
        That outcome carries {spin.bonus.length} free spin{spin.bonus.length > 1 ? "s" : ""}. Each one used the same secret with the next spin number and the small free-spin table:{" "}
        {spin.bonus.map((b, i) => (
          <span key={b.nonce}>
            spin {b.nonce} rolled {(b.roll * 100).toFixed(2)} and paid {fmtMist(b.mistees)} Mistees{i < spin.bonus.length - 1 ? "; " : "."}
          </span>
        ))}
      </>,
    );
  }
  if (spin.kind === "item" && !traded) {
    steps.push(
      <>
        Result: a <b>{spin.label}</b>, listed at {money(spin.itemValue)}. Misty will ship it, or swap it for {num(spin.itemValue)} Mistees. At resale it is worth about {money(spin.itemValue * cfg.itemRealized)}.
      </>,
    );
  } else {
    const mist = traded ? spin.itemValue : spin.totalMistees;
    steps.push(
      <>
        Result: <b>{fmtMist(mist)} Mistees</b> credited{traded ? " in place of the piece" : ""}. The screen counts them as {money(mist * cfg.misteeFace)}. They can only be spent on more boxes or products, so in real terms they are worth about {money(mist * cfg.misteeReal)}.
      </>,
    );
  }
  if (pf) {
    steps.push(
      <>
        The secret <code>{short(spin.serverSeed)}</code> is now revealed. Anyone can redo steps 3 and 4 and check it matches the fingerprint from step 2. A new secret has already been committed for the next open.
      </>,
    );
  }
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm text-ink-2">
      {steps.map((s, i) => (
        <li key={i}>{s}</li>
      ))}
    </ol>
  );
}
