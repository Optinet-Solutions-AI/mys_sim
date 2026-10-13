"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MistyBonusEntry, MistyBox, MistyConfig, MistyOutcome, MistyResult, MistySpin } from "@/engine/types";
import { MistyOpener, buildTable, fitItemOdds, liveWeights, mistyBox, mistyMath, normaliseWeights, verifyMistySpin } from "@/engine/labs/misty";
import { useRun } from "@/lib/useRun";
import { buildRun, persistRun } from "@/lib/runs";
import { reportMarkdown } from "@/lib/report";
import { downloadText } from "@/lib/download";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Button, Card, Field, Info, NumberInput, Select, Td, Th, Toggle } from "./ui";
import { Icon } from "./Icon";
import { ItemTile } from "./ItemTile";
import { SimulateBar } from "./lab/SimulateBar";
import { ResultsSection } from "./lab/ResultsSection";
import { MistyResults } from "./results/MistyResults";
import { BoxMaths, asCatalogItem, iconFor } from "./stages/MistyStage";

const SLUG = "custom";
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";
const fmtCred = (n: number) => (n % 1 ? n.toFixed(2) : String(n));

/** Rarity follows the chance, so the colours and icons follow the design automatically. */
function rarityFor(percent: number, kind: MistyOutcome["kind"]): string {
  if (kind === "bonus") return "bonus";
  if (percent >= 10) return "common";
  if (percent >= 3) return "uncommon";
  if (percent >= 0.5) return "rare";
  if (percent >= 0.1) return "epic";
  if (percent >= 0.01) return "legendary";
  return "grail";
}
let nextId = 1;
const newId = () => `c${(nextId++).toString(36)}`; // deterministic: the page is prerendered

function outcome(label: string, kind: MistyOutcome["kind"], weight: number, value: number, freeSpins = 0): MistyOutcome {
  return { id: newId(), label, rarity: rarityFor(weight, kind), kind, mistees: kind === "item" ? 0 : value, freeSpins: kind === "bonus" ? Math.max(1, freeSpins) : 0, valueUsd: kind === "item" ? value : null, weight };
}

const BONUS_DEFAULT: MistyBonusEntry[] = [
  { mistees: 1, weight: 70 },
  { mistees: 2, weight: 22 },
  { mistees: 5, weight: 6 },
  { mistees: 10, weight: 2 },
  { mistees: 20, weight: 0.2 },
];

function starter(kind: "little" | "timepiece" | "empty"): MistyBox {
  if (kind === "timepiece") {
    const tp = clone(mistyBox("timepiece-suite"));
    return { ...tp, slug: SLUG, name: "My Timepiece Suite", tagline: "A copy of Misty's live table to start from.", fairness: "", creditName: "Mistees" };
  }
  if (kind === "empty") {
    return { slug: SLUG, name: "My box", price: 10, tagline: "", outcomes: [outcome("1 credit", "oroos", 100, 1)], bonus: clone(BONUS_DEFAULT), fairness: "", creditName: "credits" };
  }
  return {
    slug: SLUG,
    name: "The Little Box",
    price: 10,
    tagline: "The example from the explanation page.",
    outcomes: [outcome("A watch", "item", 1, 400), outcome("A perfume", "item", 4, 50), outcome("2 credits", "oroos", 95, 2)],
    bonus: clone(BONUS_DEFAULT),
    fairness: "",
    creditName: "credits",
  };
}

interface Values {
  misteeFace: number;
  misteeReal: number;
  itemRealized: number;
}

export function BuildBox() {
  const [box, setBox] = useState<MistyBox>(() => starter("little"));
  const [values, setValues] = useState<Values>({ misteeFace: 1, misteeReal: 0.37, itemRealized: 0.7 });
  const [provablyFair, setProvablyFair] = useState(true);
  const [clientSeed, setClientSeed] = useState("my-lucky-seed");
  const [target, setTarget] = useState(65);
  const [opens, setOpens] = useState(20000);
  const [seed, setSeed] = useState(13);
  const unit = box.creditName || "credits";

  const weights = useMemo(() => liveWeights(box), [box]);
  const cfg: MistyConfig = useMemo(
    () => ({ boxSlug: SLUG, customBox: box, weights, bonus: box.bonus, ...values, provablyFair, clientSeed, players: [{ id: "guest", name: "Guest", share: 1 }], activePlayerId: "guest", run: { opens, verifySample: 200 } }),
    [box, weights, values, provablyFair, clientSeed, opens],
  );
  const m = useMemo(() => mistyMath(box, weights, box.bonus, values), [box, weights, values]);
  const table = useMemo(() => buildTable(box, weights), [box, weights]);
  const off = Math.abs(m.total - 100) > 0.005;
  const problems: string[] = [];
  if (box.price <= 0) problems.push("the price must be above zero");
  if (!box.outcomes.some((o) => o.weight > 0)) problems.push("at least one outcome needs a chance above zero");
  if (off) problems.push(`the chances add up to ${m.total.toFixed(3)}%, not 100%`);
  if (box.outcomes.some((o) => o.kind === "bonus") && box.bonus.reduce((s, b) => s + b.weight, 0) <= 0) problems.push("an outcome has free spins but the free-spin table is empty");

  // ---------- design helpers ----------
  const setOutcome = (i: number, patch: Partial<MistyOutcome>) =>
    setBox((b) => {
      const outcomes = b.outcomes.map((o, j) => {
        if (j !== i) return o;
        const n = { ...o, ...patch };
        if (patch.kind) {
          if (n.kind === "item") {
            n.mistees = 0;
            n.freeSpins = 0;
            n.valueUsd = n.valueUsd ?? 50;
          } else {
            n.valueUsd = null;
            n.mistees = n.mistees || 1;
            n.freeSpins = n.kind === "bonus" ? Math.max(1, n.freeSpins) : 0;
          }
        }
        n.rarity = rarityFor(n.weight, n.kind);
        return n;
      });
      return { ...b, outcomes };
    });
  const removeOutcome = (i: number) => setBox((b) => ({ ...b, outcomes: b.outcomes.filter((_, j) => j !== i) }));
  const addOutcome = (kind: MistyOutcome["kind"]) => setBox((b) => ({ ...b, outcomes: [...b.outcomes, kind === "item" ? outcome("New piece", "item", 0.5, 100) : kind === "bonus" ? outcome(`Free spin + 1 ${unit}`, "bonus", 5, 1, 1) : outcome(`2 ${unit}`, "oroos", 10, 2)] }));
  const applyWeights = (w: Record<string, number>) => setBox((b) => ({ ...b, outcomes: b.outcomes.map((o) => ({ ...o, weight: w[o.id] ?? o.weight, rarity: rarityFor(w[o.id] ?? o.weight, o.kind) })) }));
  const normalise = () => applyWeights(normaliseWeights(box, weights));
  const fit = () => applyWeights(fitItemOdds(box, weights, target / 100, values));

  const exportJson = () => downloadText(`${box.name.replace(/\s+/g, "-").toLowerCase()}.json`, JSON.stringify({ box, values }, null, 2), "application/json");
  const importJson = (file: File | undefined) => {
    if (!file) return;
    file.text().then((t) => {
      try {
        const j = JSON.parse(t) as { box?: MistyBox; values?: Values };
        if (j.box && Array.isArray(j.box.outcomes)) setBox({ ...j.box, slug: SLUG });
        if (j.values) setValues(j.values);
      } catch {
        /* ignore bad files */
      }
    });
  };

  // ---------- play ----------
  const key = useMemo(() => JSON.stringify([cfg, seed]), [cfg, seed]);
  const openerRef = useRef<{ key: string; opener: MistyOpener } | null>(null);
  if (!openerRef.current || openerRef.current.key !== key) openerRef.current = { key, opener: new MistyOpener(cfg, `build:${seed}`) };
  const opener = openerRef.current.opener;
  const [last, setLast] = useState<MistySpin | null>(null);
  const [tally, setTally] = useState({ opens: 0, spent: 0, credits: 0, items: 0, itemValue: 0 });
  const [verify, setVerify] = useState<{ ok: boolean; reason?: string } | null>(null);
  const [showProof, setShowProof] = useState(false);
  useEffect(() => {
    setLast(null);
    setTally({ opens: 0, spent: 0, credits: 0, items: 0, itemValue: 0 });
    setVerify(null);
  }, [key]);
  const spin = () => {
    if (problems.length) return;
    const s = opener.spin("guest");
    setLast(s);
    setVerify(null);
    setTally((t) => ({ opens: t.opens + 1, spent: t.spent + s.price, credits: t.credits + s.totalMistees, items: t.items + (s.kind === "item" ? 1 : 0), itemValue: t.itemValue + s.itemValue }));
  };
  const lastOutcome = last ? box.outcomes.find((o) => o.id === last.outcomeId) : undefined;
  const lastMath = last ? m.perOutcome.find((p) => p.id === last.outcomeId) : undefined;
  const band = last ? table.entries.find((e) => e.outcome.id === last.outcomeId) : undefined;
  const lastFace = last ? (last.kind === "item" ? last.itemValue : last.totalMistees * values.misteeFace) : 0;
  const lastReal = last ? (last.kind === "item" ? last.itemValue * values.itemRealized : last.totalMistees * values.misteeReal) : 0;

  // ---------- simulate ----------
  const sim = useRun();
  const result = sim.result && sim.result.kind === "misty" ? (sim.result as MistyResult) : null;
  const [lastCfg, setLastCfg] = useState<MistyConfig | null>(null);
  const [lastSeed, setLastSeed] = useState(seed);
  const [saved, setSaved] = useState(false);
  const start = async () => {
    if (problems.length) return;
    setSaved(false);
    const snapshot = clone(cfg);
    setLastCfg(snapshot);
    setLastSeed(seed);
    try {
      await sim.run({ lab: "misty", config: snapshot, sizes: { opens: snapshot.run.opens }, seed });
    } catch {
      /* shown in the bar */
    }
  };
  useEffect(() => {
    if (sim.status === "done") requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [sim.status]);
  const runName = () => `Builder · ${box.name}`;
  const save = async () => {
    if (!result || !lastCfg) return;
    await persistRun("misty", runName(), lastCfg, { opens: lastCfg.run.opens }, lastSeed, result);
    setSaved(true);
  };
  const report = () => {
    if (!result || !lastCfg) return;
    downloadText(`build-${lastSeed}.md`, reportMarkdown(buildRun("misty", runName(), lastCfg, { opens: lastCfg.run.opens }, lastSeed, result)), "text/markdown");
  };
  const stale = !!lastCfg && JSON.stringify(lastCfg) !== JSON.stringify(cfg);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <header className="space-y-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Demo</div>
        <h1 className="text-2xl font-semibold">Build your own mystery box</h1>
        <p className="max-w-[78ch] text-sm text-ink-2">
          Set a price, add outcomes, set chances. Maths, open and run follow.{" "}
          <Link href="/docs/misty" className="text-accent-ink underline underline-offset-2">
            What the numbers mean
          </Link>
          .
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-ink-3">Start from</span>
          <button type="button" className="chip" onClick={() => setBox(starter("little"))}>
            the Little Box
          </button>
          <button type="button" className="chip" onClick={() => setBox(starter("timepiece"))}>
            Misty&apos;s Timepiece Suite
          </button>
          <button type="button" className="chip" onClick={() => setBox(starter("empty"))}>
            an empty box
          </button>
          <span className="mx-1 text-ink-3">·</span>
          <button type="button" className="chip" onClick={exportJson}>
            save as JSON
          </button>
          <label className="chip cursor-pointer">
            load JSON
            <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
          </label>
        </div>
      </header>

      {/* ---------- design ---------- */}
      <Card title="1. Design">
        <div className="grid gap-3 md:grid-cols-5">
          <Field label="Box name">
            <input className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm" value={box.name} onChange={(e) => setBox({ ...box, name: e.target.value })} />
          </Field>
          <Field label="Price ($)" hint="Cost of one open.">
            <NumberInput value={box.price} min={0} step={1} onChange={(v) => setBox({ ...box, price: Math.max(0, v) })} />
          </Field>
          <Field label="Credit unit name" hint="Misty: Mistees.">
            <input className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm" value={box.creditName ?? ""} onChange={(e) => setBox({ ...box, creditName: e.target.value })} />
          </Field>
          <Field label={`One ${unit.replace(/s$/, "")} on screen ($)`} hint="Face value per credit. Misty: $1.">
            <NumberInput value={values.misteeFace} min={0} step={0.1} onChange={(v) => setValues({ ...values, misteeFace: Math.max(0, v) })} />
          </Field>
          <Field label={`One ${unit.replace(/s$/, "")} really ($)`} hint="Cost to you per credit. Misty: about $0.37.">
            <NumberInput value={values.misteeReal} min={0} step={0.01} onChange={(v) => setValues({ ...values, misteeReal: Math.max(0, v) })} />
          </Field>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr>
                <Th>Outcome</Th>
                <Th>Kind</Th>
                <Th right>Worth</Th>
                <Th right>Free spins</Th>
                <Th right>Chance %</Th>
                <Th right>1 in</Th>
                <Th right>Costs per open</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody>
              {box.outcomes.map((o, i) => {
                const po = m.perOutcome.find((x) => x.id === o.id);
                return (
                  <tr key={o.id} className="border-t border-line">
                    <Td>
                      <span className="flex items-center gap-2">
                        <span className="misty-row-icon" style={{ background: `var(--misty-c-${o.rarity}, #5b6472)` }}>
                          <Icon name={iconFor(o)} size={14} />
                        </span>
                        <input className="w-56 rounded-md border border-line bg-paper px-2 py-1 text-xs" value={o.label} onChange={(e) => setOutcome(i, { label: e.target.value })} />
                      </span>
                    </Td>
                    <Td>
                      <span className="block w-36">
                        <Select<MistyOutcome["kind"]> value={o.kind} onChange={(v) => setOutcome(i, { kind: v })} options={[{ value: "item", label: "A piece (ships)" }, { value: "oroos", label: `${unit} (credit)` }, { value: "bonus", label: `${unit} + free spins` }]} />
                      </span>
                    </Td>
                    <Td right>
                      <span className="ml-auto flex w-32 items-center gap-1">
                        {o.kind === "item" ? <span className="text-ink-3">$</span> : null}
                        <NumberInput value={o.kind === "item" ? (o.valueUsd ?? 0) : o.mistees} min={0} step={o.kind === "item" ? 5 : 1} onChange={(v) => setOutcome(i, o.kind === "item" ? { valueUsd: Math.max(0, v) } : { mistees: Math.max(0, v) })} />
                        {o.kind !== "item" ? <span className="text-ink-3">{unit}</span> : null}
                      </span>
                    </Td>
                    <Td right>{o.kind === "bonus" ? <span className="ml-auto block w-16"><NumberInput value={o.freeSpins} min={1} max={3} step={1} onChange={(v) => setOutcome(i, { freeSpins: Math.max(1, Math.min(3, Math.round(v))) })} /></span> : <span className="text-ink-3">–</span>}</Td>
                    <Td right>
                      <span className="ml-auto block w-28">
                        <NumberInput value={Math.round(o.weight * 1e6) / 1e6} min={0} max={100} step={o.weight < 1 ? 0.01 : 1} onChange={(v) => setOutcome(i, { weight: Math.max(0, v) })} />
                      </span>
                    </Td>
                    <Td right mono>{po && po.share > 0 ? num(Math.round(1 / po.share)) : "never"}</Td>
                    <Td right mono>{po ? money(po.costFace, 2) : "–"}</Td>
                    <Td>
                      <button type="button" className="chip" onClick={() => removeOutcome(i)} title="Remove">
                        ×
                      </button>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
                <Td>Total: pays back per open</Td>
                <Td> </Td>
                <Td right mono>
                  {money(m.evItems, 2)} in pieces + {m.evMistees.toFixed(2)} {unit}
                </Td>
                <Td right> </Td>
                <Td right mono>{m.total.toFixed(3)}%</Td>
                <Td right mono>piece {oneIn(m.pItem)}</Td>
                <Td right mono>{money(m.payFace, 2)}</Td>
                <Td> </Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Price of the box</Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td right mono>{money(box.price, 2)}</Td>
                <Td> </Td>
              </tr>
              <tr className="border-t border-line font-semibold">
                <Td>You keep per open (price − pays back)</Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td> </Td>
                <Td right mono>return {box.price > 0 ? pct(m.returnFace) : "–"}</Td>
                <Td right mono>
                  <span className={box.price - m.payFace >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.payFace, 2)}</span>
                </Td>
                <Td> </Td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <Button kind="ghost" onClick={() => addOutcome("item")}>
            + piece
          </Button>
          <Button kind="ghost" onClick={() => addOutcome("oroos")}>
            + credit
          </Button>
          <Button kind="ghost" onClick={() => addOutcome("bonus")}>
            + free spins
          </Button>
          <span className="mx-1 text-ink-3">·</span>
          <Badge tone={off ? "warn" : "good"}>sum {m.total.toFixed(3)}%</Badge>
          {off && (
            <Button kind="ghost" onClick={normalise}>
              Make it 100%
            </Button>
          )}
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-ink-3">Fit piece odds to</span>
            <span className="w-20">
              <NumberInput value={target} min={1} max={300} step={1} onChange={(v) => setTarget(Math.max(1, v))} />
            </span>
            <span className="text-xs text-ink-3">% return</span>
            <Button kind="ghost" onClick={fit} title="Scales piece odds; credit rows absorb the difference">
              Fit
            </Button>
            <Info>Scales every piece chance by one factor; credit rows absorb the difference; total stays 100.</Info>
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
          <div>
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-2">
              Free-spin table ({unit})
              <Info>Rows with free spins roll again on this table.</Info>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              {box.bonus.map((b, i) => (
                <div key={i} className="flex items-end gap-1 rounded-md border border-line bg-paper p-2">
                  <Field label={unit}>
                    <span className="block w-20">
                      <NumberInput value={b.mistees} min={0} step={1} onChange={(v) => setBox({ ...box, bonus: box.bonus.map((x, j) => (j === i ? { ...x, mistees: Math.max(0, v) } : x)) })} />
                    </span>
                  </Field>
                  <Field label="%">
                    <span className="block w-20">
                      <NumberInput value={b.weight} min={0} max={100} step={1} onChange={(v) => setBox({ ...box, bonus: box.bonus.map((x, j) => (j === i ? { ...x, weight: Math.max(0, v) } : x)) })} />
                    </span>
                  </Field>
                  <button type="button" className="chip" onClick={() => setBox({ ...box, bonus: box.bonus.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </div>
              ))}
              <Button kind="ghost" onClick={() => setBox({ ...box, bonus: [...box.bonus, { mistees: 1, weight: 10 }] })}>
                + row
              </Button>
              <span className="text-xs text-ink-3">average {m.bonusEv.toFixed(2)} per spin</span>
            </div>
          </div>
          <div className="space-y-2">
            <Field label="Pieces at resale (share of listed)" hint="0.7 = 70% of listed.">
              <NumberInput value={values.itemRealized} min={0} max={1.5} step={0.05} onChange={(v) => setValues({ ...values, itemRealized: Math.max(0, v) })} />
            </Field>
            <Toggle checked={provablyFair} onChange={setProvablyFair} label="Commit a secret before each open" hint="On: secret, seed, reveal. Off: plain random." />
            <Field label="Your seed">
              <input className="w-full rounded-md border border-line bg-paper px-2 py-1 text-sm" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
            </Field>
          </div>
        </div>
        {problems.length > 0 && (
          <div className="mt-3 rounded-md border border-warn bg-warn-soft px-3 py-2 text-xs text-ink">
            Fix first: {problems.join("; ")}.
          </div>
        )}
      </Card>

      {/* ---------- maths ---------- */}
      <Card
        title={
          <span className="flex items-center gap-1">
            2. Maths: {money(box.price)} in, {money(m.payFace, 2)} back per open
            <Info>Worth × chance per row, summed. On screen: credit at face. Really: credit at cost, pieces at resale.</Info>
          </span>
        }
      >
        <BoxMaths box={box} m={m} cfg={cfg} lastId={last?.outcomeId} />
      </Card>

      {/* ---------- play ---------- */}
      <Card title="3. Open">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary text-base" disabled={problems.length > 0} onClick={spin}>
            Open the box · {money(box.price)}
          </button>
          {provablyFair ? (
            <span className="flex items-center gap-1 text-xs text-ink-3" title={opener.commitment}>
              <Icon name="ph:lock-key" size={14} /> secret locked in: <code>{opener.commitment.slice(0, 12)}…</code>
            </span>
          ) : (
            <Badge tone="bad">no proof: plain random</Badge>
          )}
          <span className="ml-auto flex flex-wrap gap-1 text-xs">
            <Badge>opens {num(tally.opens)}</Badge>
            <Badge>paid {money(tally.spent)}</Badge>
            <Badge>
              {fmtCred(tally.credits)} {unit}
            </Badge>
            <Badge>pieces {num(tally.items)}</Badge>
            {tally.spent > 0 && <Badge tone="accent">back {pct((tally.itemValue + tally.credits * values.misteeFace) / tally.spent)} on screen · {pct((tally.itemValue * values.itemRealized + tally.credits * values.misteeReal) / tally.spent)} really</Badge>}
          </span>
        </div>
        {last && lastOutcome && lastMath && (
          <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
            <ItemTile item={asCatalogItem(lastOutcome, values.misteeFace)} size={72} />
            <div className="space-y-1 text-sm">
              <div className="text-lg font-semibold">{last.kind === "item" ? `You pulled ${last.label}` : `${fmtCred(last.totalMistees)} ${unit}`}</div>
              {last.bonus.length > 0 && (
                <div className="text-ink-2">
                  Free spins: {last.bonus.map((b) => `+${fmtCred(b.mistees)}`).join(", ")} {unit}.
                </div>
              )}
              <div className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
                <div>
                  <span className="text-ink-3">Roll: </span>
                  {(last.roll * 100).toFixed(3)} → band {band ? `${band.from.toFixed(3)}–${band.to.toFixed(3)}` : ""} = {last.label}
                </div>
                <div>
                  <span className="text-ink-3">Odds: </span>
                  {fmtPct(lastMath.share * 100)} · {oneIn(lastMath.share)}
                </div>
                <div>
                  <span className="text-ink-3">On screen: </span>
                  {money(lastFace)}
                </div>
                <div>
                  <span className="text-ink-3">Really: </span>
                  {money(lastReal)} · net{" "}
                  <b className={lastReal >= last.price ? "text-good" : "text-bad"}>
                    {lastReal >= last.price ? "+" : "−"}
                    {money(Math.abs(lastReal - last.price))}
                  </b>
                </div>
              </div>
              {provablyFair && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <Button kind="ghost" onClick={() => setVerify(verifyMistySpin(last, cfg))}>
                    Check this open
                  </Button>
                  <button type="button" className="chip" onClick={() => setShowProof((s) => !s)}>
                    {showProof ? "hide details" : "technical details"}
                  </button>
                  {verify && <Badge tone={verify.ok ? "good" : "bad"}>{verify.ok ? "Checked: matches" : `Mismatch: ${verify.reason}`}</Badge>}
                </div>
              )}
              {showProof && provablyFair && (
                <div className="grid gap-x-6 gap-y-1 rounded-lg border border-line bg-paper p-2 text-[11px] sm:grid-cols-2">
                  {[
                    ["Scrambled secret shown before", last.serverHash],
                    ["Secret revealed after", last.serverSeed],
                    ["Your seed · spin number", `${last.clientSeed} · ${last.nonce}`],
                    ["Mixed (HMAC-SHA256)", last.digest],
                    ["Table frozen onto the open", last.tableHash],
                  ].map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <div className="text-ink-3">{k}</div>
                      <code className="block truncate" title={v}>
                        {v}
                      </code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-ink-2">Bands on 0 to 100{last ? ` (roll ${(last.roll * 100).toFixed(3)})` : ""}</summary>
          <table className="mt-2 w-full max-w-2xl">
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
                .map((e) => (
                  <tr key={e.outcome.id} className={`border-t border-line ${last?.outcomeId === e.outcome.id ? "bg-accent-soft font-semibold" : ""}`}>
                    <Td mono>{e.from.toFixed(3)}</Td>
                    <Td mono>{e.to.toFixed(3)}</Td>
                    <Td mono>{pctSmart(e.percent / 100)}</Td>
                    <Td>{e.outcome.label}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      </Card>

      {/* ---------- simulate ---------- */}
      <Card title="4. Run">
        <div className="mb-2 grid gap-3 sm:grid-cols-3">
          <Field label="Opens" hint="Number of simulated opens.">
            <NumberInput value={opens} min={100} max={2000000} step={1000} onChange={(v) => setOpens(Math.max(100, Math.floor(v)))} />
          </Field>
          <Field label="Seed" hint="Same seed, same results.">
            <NumberInput value={seed} min={0} step={1} onChange={(v) => setSeed(Math.floor(v))} />
          </Field>
        </div>
        <SimulateBar label={`Open ${num(opens)} boxes`} hint="Counts vs chances, returns vs maths, proofs." status={sim.status} progress={sim.progress} elapsed={sim.elapsed} error={sim.error} onRun={start} onCancel={sim.cancel} onSettings={() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" })} />
        {result && lastCfg && (
          <div className="mt-3">
            <ResultsSection title="Simulation results" meta={`${num(result.opens)} opens · ${result.boxName} · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
              <MistyResults r={result} />
            </ResultsSection>
          </div>
        )}
      </Card>
    </div>
  );
}
