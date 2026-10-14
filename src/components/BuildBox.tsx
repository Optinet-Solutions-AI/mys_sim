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
import { Badge, Button, Card, Field, Info, NumberInput, Td, Th, Toggle } from "./ui";
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

/** Rarity follows the chance, so colours and icons follow the design. */
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
    return { ...tp, slug: SLUG, name: "My Timepiece Suite", tagline: "", fairness: "", creditName: "Mistees" };
  }
  if (kind === "empty") {
    return { slug: SLUG, name: "My box", price: 10, tagline: "", outcomes: [], bonus: clone(BONUS_DEFAULT), fairness: "", creditName: "credits" };
  }
  return {
    slug: SLUG,
    name: "The Little Box",
    price: 10,
    tagline: "",
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

const STEPS = [
  { key: "price", title: "Name and price" },
  { key: "pieces", title: "The prizes" },
  { key: "credit", title: "The credit" },
  { key: "chances", title: "The chances" },
  { key: "worth", title: "What credit is worth" },
  { key: "maths", title: "Check the maths" },
  { key: "open", title: "Open it" },
  { key: "run", title: "Run it" },
  { key: "done", title: "Done" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

const input = "w-full rounded-md border border-line bg-paper px-2 py-1 text-sm";

export function BuildBox() {
  const [box, setBox] = useState<MistyBox>(() => starter("empty"));
  const [values, setValues] = useState<Values>({ misteeFace: 1, misteeReal: 0.37, itemRealized: 0.7 });
  const [provablyFair, setProvablyFair] = useState(true);
  const [clientSeed, setClientSeed] = useState("my-lucky-seed");
  const [target, setTarget] = useState(65);
  const [opens, setOpens] = useState(20000);
  const [seed, setSeed] = useState(13);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"guided" | "all">("guided");
  const unit = box.creditName || "credits";
  const unit1 = unit.replace(/s$/, "");

  const weights = useMemo(() => liveWeights(box), [box]);
  const cfg: MistyConfig = useMemo(
    () => ({ boxSlug: SLUG, customBox: box, weights, bonus: box.bonus, ...values, provablyFair, clientSeed, players: [{ id: "guest", name: "Guest", share: 1 }], activePlayerId: "guest", run: { opens, verifySample: 200 } }),
    [box, weights, values, provablyFair, clientSeed, opens],
  );
  const m = useMemo(() => mistyMath(box, weights, box.bonus, values), [box, weights, values]);
  const table = useMemo(() => buildTable(box, weights), [box, weights]);
  const off = Math.abs(m.total - 100) > 0.005;
  const pieces = box.outcomes.filter((o) => o.kind === "item");
  const credits = box.outcomes.filter((o) => o.kind !== "item");
  const problems: string[] = [];
  if (box.price <= 0) problems.push("the price must be above zero");
  if (!box.outcomes.some((o) => o.weight > 0)) problems.push("at least one row needs a chance above zero");
  if (off) problems.push(`the chances add up to ${m.total.toFixed(3)}%, not 100%`);
  if (box.outcomes.some((o) => o.kind === "bonus") && box.bonus.reduce((s, b) => s + b.weight, 0) <= 0) problems.push("a row has free spins but the free-spin table is empty");

  // ---------- design helpers ----------
  const setOutcome = (id: string, patch: Partial<MistyOutcome>) =>
    setBox((b) => ({
      ...b,
      outcomes: b.outcomes.map((o) => {
        if (o.id !== id) return o;
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
      }),
    }));
  const removeOutcome = (id: string) => setBox((b) => ({ ...b, outcomes: b.outcomes.filter((o) => o.id !== id) }));
  const addPiece = () => setBox((b) => ({ ...b, outcomes: [...b.outcomes, outcome(b.outcomes.some((o) => o.kind === "item") ? "Another prize" : "The big prize", "item", 0, b.outcomes.some((o) => o.kind === "item") ? 100 : 1000)] }));
  const addCredit = (n: number) => setBox((b) => ({ ...b, outcomes: [...b.outcomes, outcome(`${n} ${unit}`, "oroos", 0, n)] }));
  const addFreeSpin = () => setBox((b) => ({ ...b, outcomes: [...b.outcomes, outcome(`Free spin + 1 ${unit1}`, "bonus", 0, 1, 1)] }));
  const applyWeights = (w: Record<string, number>) => setBox((b) => ({ ...b, outcomes: b.outcomes.map((o) => ({ ...o, weight: w[o.id] ?? o.weight, rarity: rarityFor(w[o.id] ?? o.weight, o.kind) })) }));
  const normalise = () => applyWeights(normaliseWeights(box, weights));
  const fit = () => {
    // give credit rows a share first if everything is still zero, so the solver has something to take from
    let base = weights;
    if (box.outcomes.every((o) => o.weight <= 0)) {
      const cr = credits.length || 1;
      base = Object.fromEntries(box.outcomes.map((o) => [o.id, o.kind === "item" ? 0.1 : (100 - 0.1 * pieces.length) / cr]));
    }
    applyWeights(fitItemOdds(box, base, target / 100, values));
  };
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

  // ---------- step gating ----------
  const canLeave: Record<StepKey, string | null> = {
    price: box.name.trim() ? (box.price > 0 ? null : "Set a price above zero.") : "Give the box a name.",
    pieces: pieces.some((o) => (o.valueUsd ?? 0) > 0) ? null : "Add at least one prize with a value.",
    credit: credits.length ? null : "Add at least one credit row, so no open pays nothing.",
    chances: off ? "The chances must add up to 100. Press Fit or Make it 100%." : box.outcomes.some((o) => o.weight > 0) ? null : "Give the rows a chance.",
    worth: null,
    maths: null,
    open: null,
    run: null,
    done: null,
  };
  const current = STEPS[step].key;
  const blocker = canLeave[current];
  const go = (i: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, i)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const reached = (i: number) => {
    for (let k = 0; k < i; k++) if (canLeave[STEPS[k].key]) return false;
    return true;
  };

  // ---------- shared blocks ----------
  const RowIcon = ({ o }: { o: MistyOutcome }) => (
    <span className="misty-row-icon" style={{ background: `var(--misty-c-${o.rarity}, #5b6472)` }}>
      <Icon name={iconFor(o)} size={14} />
    </span>
  );

  const pieceRows = (
    <div className="space-y-2">
      {pieces.length === 0 && <p className="text-sm text-ink-3">No prizes yet.</p>}
      {pieces.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-2">
          <RowIcon o={o} />
          <input className={`${input} w-56 flex-1`} value={o.label} onChange={(e) => setOutcome(o.id, { label: e.target.value })} placeholder="Name of the prize" />
          <span className="text-xs text-ink-3">worth $</span>
          <span className="w-28">
            <NumberInput value={o.valueUsd ?? 0} min={0} step={10} onChange={(v) => setOutcome(o.id, { valueUsd: Math.max(0, v) })} />
          </span>
          <button type="button" className="chip" onClick={() => removeOutcome(o.id)} title="Remove">
            ×
          </button>
        </div>
      ))}
      <Button kind="ghost" onClick={addPiece}>
        + add a prize
      </Button>
    </div>
  );

  const creditRows = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-ink-2">Call the credit</span>
        <input className={`${input} w-32`} value={box.creditName ?? ""} onChange={(e) => setBox({ ...box, creditName: e.target.value })} placeholder="credits" />
        <Info>Misty calls it Mistees. Use any name.</Info>
      </div>
      {credits.length === 0 && <p className="text-sm text-ink-3">No credit rows yet.</p>}
      {credits.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-2">
          <RowIcon o={o} />
          <input className={`${input} w-48 flex-1`} value={o.label} onChange={(e) => setOutcome(o.id, { label: e.target.value })} />
          <span className="text-xs text-ink-3">pays</span>
          <span className="w-24">
            <NumberInput value={o.mistees} min={0} step={1} onChange={(v) => setOutcome(o.id, { mistees: Math.max(0, v) })} />
          </span>
          <span className="text-xs text-ink-3">{unit}</span>
          {o.kind === "bonus" && (
            <>
              <span className="text-xs text-ink-3">+ free spins</span>
              <span className="w-16">
                <NumberInput value={o.freeSpins} min={1} max={3} step={1} onChange={(v) => setOutcome(o.id, { freeSpins: Math.max(1, Math.min(3, Math.round(v))) })} />
              </span>
            </>
          )}
          <button type="button" className="chip" onClick={() => removeOutcome(o.id)} title="Remove">
            ×
          </button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 5, 10].map((n) => (
          <button key={n} type="button" className="chip" onClick={() => addCredit(n)}>
            + {n} {unit}
          </button>
        ))}
        <button type="button" className="chip" onClick={addFreeSpin}>
          + free spin row
        </button>
      </div>
      {box.outcomes.some((o) => o.kind === "bonus") && (
        <div className="rounded-md border border-line bg-paper p-2">
          <div className="mb-1 flex items-center gap-1 text-xs font-medium text-ink-2">
            Free-spin table ({unit}) <Info>A free spin rolls once more on this small table.</Info>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            {box.bonus.map((b, i) => (
              <div key={i} className="flex items-end gap-1">
                <Field label={unit}>
                  <span className="block w-16">
                    <NumberInput value={b.mistees} min={0} step={1} onChange={(v) => setBox({ ...box, bonus: box.bonus.map((x, j) => (j === i ? { ...x, mistees: Math.max(0, v) } : x)) })} />
                  </span>
                </Field>
                <Field label="%">
                  <span className="block w-16">
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
      )}
    </div>
  );

  const chanceTable = (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <div className="tbl"><table className="w-full min-w-[640px] text-xs">
          <thead>
            <tr>
              <Th>Row</Th>
              <Th right>Worth</Th>
              <Th right>Chance %</Th>
              <Th right>1 in</Th>
              <Th right>Costs you per open</Th>
            </tr>
          </thead>
          <tbody>
            {[...pieces].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0)).concat(credits).map((o) => {
              const po = m.perOutcome.find((x) => x.id === o.id);
              return (
                <tr key={o.id} className="border-t border-line">
                  <Td>
                    <span className="flex items-center gap-2">
                      <RowIcon o={o} />
                      {o.label}
                    </span>
                  </Td>
                  <Td right mono>{o.kind === "item" ? money(o.valueUsd ?? 0) : `${fmtCred(o.mistees)} ${unit}${o.freeSpins ? ` + ${o.freeSpins} spin${o.freeSpins > 1 ? "s" : ""}` : ""}`}</Td>
                  <Td right>
                    <span className="ml-auto block w-28">
                      <NumberInput value={Math.round(o.weight * 1e6) / 1e6} min={0} max={100} step={o.weight < 1 ? 0.01 : 1} onChange={(v) => setOutcome(o.id, { weight: Math.max(0, v) })} />
                    </span>
                  </Td>
                  <Td right mono>{po && po.share > 0 ? num(Math.round(1 / po.share)) : "never"}</Td>
                  <Td right mono>{po ? money(po.costFace, 2) : "–"}</Td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
              <Td>Total: pays back per open</Td>
              <Td right> </Td>
              <Td right mono>{m.total.toFixed(3)}%</Td>
              <Td right mono>a prize {oneIn(m.pItem)}</Td>
              <Td right mono>{money(m.payFace, 2)}</Td>
            </tr>
            <tr className="border-t border-line">
              <Td>Price</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>{money(box.price, 2)}</Td>
            </tr>
            <tr className="border-t border-line font-semibold">
              <Td>You keep per open</Td>
              <Td right> </Td>
              <Td right> </Td>
              <Td right mono>return {box.price > 0 ? pct(m.returnFace) : "–"}</Td>
              <Td right mono>
                <span className={box.price - m.payFace >= 0 ? "text-good" : "text-bad"}>{money(box.price - m.payFace, 2)}</span>
              </Td>
            </tr>
          </tfoot>
        </table></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-paper p-2 text-sm">
        <span className="text-ink-2">Easy way: the box should give back</span>
        <span className="w-20">
          <NumberInput value={target} min={1} max={300} step={1} onChange={(v) => setTarget(Math.max(1, v))} />
        </span>
        <span className="text-ink-2">out of 100 on screen</span>
        <Button onClick={fit}>Fit the chances</Button>
        <Info>Keeps the mix you typed and scales the prize chances up or down until the total pays back that share of the price. Credit rows absorb the difference. Misty: 55 to 66.</Info>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <Badge tone={off ? "warn" : "good"}>sum {m.total.toFixed(3)}%</Badge>
          {off && (
            <Button kind="ghost" onClick={normalise}>
              Make it 100%
            </Button>
          )}
        </span>
      </div>
    </div>
  );

  const worthBlock = (
    <div className="grid gap-3 md:grid-cols-3">
      <Field label={`One ${unit1} on screen ($)`} hint="What the screen counts a credit as. Misty: $1.">
        <NumberInput value={values.misteeFace} min={0} step={0.1} onChange={(v) => setValues({ ...values, misteeFace: Math.max(0, v) })} />
      </Field>
      <Field label={`One ${unit1} really ($)`} hint="What it costs you when it can only buy more boxes. Misty: about $0.37.">
        <NumberInput value={values.misteeReal} min={0} step={0.01} onChange={(v) => setValues({ ...values, misteeReal: Math.max(0, v) })} />
      </Field>
      <Field label="Prizes: what you pay for them (share of listed)" hint="0.7 = you buy a $100 prize for $70.">
        <NumberInput value={values.itemRealized} min={0} max={1.5} step={0.05} onChange={(v) => setValues({ ...values, itemRealized: Math.max(0, v) })} />
      </Field>
      <div className="rounded-md border border-line bg-paper p-3 md:col-span-3">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-3">On screen</div>
            <div className="font-mono text-xs leading-6">
              pays back {money(m.payFace, 2)} of {money(box.price, 2)} = <b>{pct(m.returnFace)}</b>
              <br />
              you keep <b>{money(box.price - m.payFace, 2)}</b>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-ink-3">Really</div>
            <div className="font-mono text-xs leading-6">
              pays back {money(m.payReal, 2)} of {money(box.price, 2)} = <b>{pct(m.returnReal)}</b>
              <br />
              you keep <b>{money(box.price - m.payReal, 2)}</b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const playBlock = (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-primary text-base" disabled={problems.length > 0} onClick={spin}>
          Open the box · {money(box.price)}
        </button>
        <Toggle checked={provablyFair} onChange={setProvablyFair} label="Lock in a secret first" hint="On: a secret is chosen before the open and shown scrambled; revealed after. Off: plain random." />
        {provablyFair && (
          <span className="flex items-center gap-1 text-xs text-ink-3" title={opener.commitment}>
            <Icon name="ph:lock-key" size={14} /> secret locked: <code>{opener.commitment.slice(0, 12)}…</code>
          </span>
        )}
        <span className="ml-auto flex flex-wrap gap-1 text-xs">
          <Badge>opens {num(tally.opens)}</Badge>
          <Badge>paid {money(tally.spent)}</Badge>
          <Badge>
            {fmtCred(tally.credits)} {unit}
          </Badge>
          <Badge>prizes {num(tally.items)}</Badge>
          {tally.spent > 0 && <Badge tone="accent">back {pct((tally.itemValue + tally.credits * values.misteeFace) / tally.spent)} on screen · {pct((tally.itemValue * values.itemRealized + tally.credits * values.misteeReal) / tally.spent)} really</Badge>}
        </span>
      </div>
      {last && lastOutcome && lastMath && (
        <div className="mt-3 grid gap-3 md:grid-cols-[auto_1fr]">
          <ItemTile item={asCatalogItem(lastOutcome, values.misteeFace)} size={72} />
          <div className="space-y-1 text-sm">
            <div className="text-lg font-semibold">{last.kind === "item" ? `You got ${last.label}` : `${fmtCred(last.totalMistees)} ${unit}`}</div>
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
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-ink-3">Your seed</span>
        <input className={`${input} w-44`} value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} />
        <Info>Any word. It goes into the roll so the site cannot pick the result alone.</Info>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-ink-2">Bands on 0 to 100{last ? ` (roll ${(last.roll * 100).toFixed(3)})` : ""}</summary>
        <div className="tbl"><table className="mt-2 w-full max-w-2xl">
          <thead>
            <tr>
              <Th>From</Th>
              <Th>To</Th>
              <Th>Width = chance</Th>
              <Th>Row</Th>
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
        </table></div>
      </details>
    </div>
  );

  const runBlock = (
    <div>
      <div className="mb-2 grid gap-3 sm:grid-cols-3">
        <Field label="Opens" hint="Number of simulated opens.">
          <NumberInput value={opens} min={100} max={2000000} step={1000} onChange={(v) => setOpens(Math.max(100, Math.floor(v)))} />
        </Field>
        <Field label="Seed" hint="Same seed, same results.">
          <NumberInput value={seed} min={0} step={1} onChange={(v) => setSeed(Math.floor(v))} />
        </Field>
      </div>
      <SimulateBar label={`Open ${num(opens)} boxes`} hint="Counts vs chances, returns vs maths, proofs." status={sim.status} progress={sim.progress} elapsed={sim.elapsed} error={sim.error} onRun={start} onCancel={sim.cancel} onSettings={() => undefined} />
      {result && lastCfg && (
        <div className="mt-3">
          <ResultsSection title="Results" meta={`${num(result.opens)} opens · ${result.boxName} · seed ${lastSeed}`} stale={stale} saved={saved} onSave={save} onReport={report}>
            <MistyResults r={result} />
          </ResultsSection>
        </div>
      )}
    </div>
  );

  const summaryStrip = (
    <div className="flex flex-wrap gap-1 text-[11px]">
      <Badge>{box.name || "My box"}</Badge>
      <Badge>{money(box.price)}</Badge>
      <Badge>
        {pieces.length} prize{pieces.length === 1 ? "" : "s"} · {credits.length} credit row{credits.length === 1 ? "" : "s"}
      </Badge>
      <Badge tone={off ? "warn" : "good"}>chances {m.total.toFixed(1)}%</Badge>
      {!off && box.price > 0 && (
        <>
          <Badge>a prize {oneIn(m.pItem)}</Badge>
          <Badge>pays back {money(m.payFace, 2)} = {pct(m.returnFace)} on screen</Badge>
          <Badge tone="warn">{pct(m.returnReal)} really</Badge>
        </>
      )}
    </div>
  );

  // ---------- guided steps ----------
  const guide: Record<StepKey, { heading: string; say: React.ReactNode; body: React.ReactNode }> = {
    price: {
      heading: "Step 1 · Give your box a name and a price",
      say: (
        <>
          A mystery box starts with its price, not its prizes. Misty sells boxes at $10, $25 and $50. Everything you do next has to fit under that price.
        </>
      ),
      body: (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input className={input} value={box.name} onChange={(e) => setBox({ ...box, name: e.target.value })} placeholder="The Little Box" />
          </Field>
          <Field label="Price ($)" hint="Cost of one open.">
            <NumberInput value={box.price} min={0} step={1} onChange={(v) => setBox({ ...box, price: Math.max(0, v) })} />
          </Field>
          <div className="text-xs text-ink-3 sm:col-span-2">
            Want a head start?{" "}
            <button type="button" className="chip" onClick={() => setBox(starter("little"))}>
              load the Little Box
            </button>{" "}
            <button type="button" className="chip" onClick={() => setBox(starter("timepiece"))}>
              load Misty&apos;s Timepiece Suite
            </button>{" "}
            <label className="chip cursor-pointer">
              load a saved JSON
              <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
            </label>
          </div>
        </div>
      ),
    },
    pieces: {
      heading: "Step 2 · Add the prizes",
      say: <>These are the real things a player can win. Put the big one first: it is the one on the poster. Then add a few cheaper ones. Only name and value for now. Chances come later.</>,
      body: pieceRows,
    },
    credit: {
      heading: "Step 3 · Add the credit",
      say: (
        <>
          Most opens will not win a prize. Misty never lets an open pay nothing: it pays credit instead. Credit only buys more boxes. Add a few credit amounts, small ones most of all. A free-spin row is optional: it gives one extra roll on a tiny credit table.
        </>
      ),
      body: creditRows,
    },
    chances: {
      heading: "Step 4 · Set the chances",
      say: (
        <>
          Now decide how often each row comes up. All the chances together must make 100. Rule of thumb: the dearer the prize, the smaller its chance. Each row costs you its worth × its chance; the total is what the box pays back per open. Type how much of the price the box should give back and press Fit, or type the chances yourself.
        </>
      ),
      body: chanceTable,
    },
    worth: {
      heading: "Step 5 · What is your credit really worth?",
      say: (
        <>
          On screen a credit counts as $1. But it only buys more boxes, so it costs you less: on Misty about $0.37. And you buy prizes below their listed price. These two numbers turn the on-screen return into the real one.
        </>
      ),
      body: worthBlock,
    },
    maths: {
      heading: "Step 6 · Check the maths",
      say: <>Every row: worth × chance = what it costs you per open. Add the rows, compare with the price. The last line is your margin. If it is negative, go back to step 4.</>,
      body: <BoxMaths box={box} m={m} cfg={cfg} lastId={last?.outcomeId} />,
    },
    open: {
      heading: "Step 7 · Open your box",
      say: <>This is what the player does. A secret is locked in before the open, the roll lands in one band, you see the result, what it is worth, and you can check the open afterwards.</>,
      body: playBlock,
    },
    run: {
      heading: "Step 8 · Open it thousands of times",
      say: <>One open proves nothing. Run it 20,000 times: the counts should match your chances, and the return should match the maths.</>,
      body: runBlock,
    },
    done: {
      heading: "Step 9 · Done",
      say: <>Your box is designed. Save it, hand it to the developers, or compare it with Misty&apos;s.</>,
      body: (
        <div className="space-y-3">
          {summaryStrip}
          <div className="flex flex-wrap gap-2">
            <Button onClick={exportJson}>Save as JSON</Button>
            <Link href="/docs/misty/dev" className="btn no-underline">
              For developers: how to build it
            </Link>
            <Link href="/operators/misty" className="btn no-underline">
              Compare with Misty
            </Link>
            <Button kind="ghost" onClick={() => go(0)}>
              Start another box
            </Button>
          </div>
        </div>
      ),
    },
  };

  const g = guide[current];

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-16">
      <header className="flex flex-wrap items-center gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Demo</div>
          <h1 className="text-2xl font-semibold">Build your own mystery box</h1>
        </div>
        <span className="ml-auto flex flex-wrap items-center justify-end gap-2 text-xs">
          <Link href="/operators/misty" className="btn no-underline">
            ← Back to Misty
          </Link>
          <button type="button" className={`chip ${mode === "guided" ? "chip-accent" : ""}`} onClick={() => setMode("guided")}>
            step by step
          </button>
          <button type="button" className={`chip ${mode === "all" ? "chip-accent" : ""}`} onClick={() => setMode("all")}>
            everything at once
          </button>
        </span>
      </header>

      {mode === "guided" ? (
        <>
          <ol className="flex flex-wrap gap-1 text-xs">
            {STEPS.map((s, i) => {
              const done = i < step && reached(i + 1);
              const open = reached(i);
              return (
                <li key={s.key}>
                  <button type="button" disabled={!open} className={`chip ${i === step ? "chip-accent" : ""} ${!open ? "opacity-50" : ""}`} onClick={() => go(i)}>
                    {done ? "✓ " : `${i + 1}. `}
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
          <Card title={g.heading}>
            <p className="mb-3 max-w-[78ch] text-sm leading-6 text-ink-2">{g.say}</p>
            {g.body}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <Button kind="ghost" onClick={() => go(step - 1)} disabled={step === 0}>
                ← Back
              </Button>
              {blocker ? <span className="text-xs text-warn">{blocker}</span> : <span className="text-xs text-ink-3">{step < STEPS.length - 1 ? "Looks good." : ""}</span>}
              <span className="ml-auto" />
              {step < STEPS.length - 1 && (
                <Button onClick={() => go(step + 1)} disabled={!!blocker}>
                  Next →
                </Button>
              )}
            </div>
          </Card>
          {step > 0 && step < STEPS.length - 1 && summaryStrip}
        </>
      ) : (
        <>
          <Card title="1. Design">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name">
                <input className={input} value={box.name} onChange={(e) => setBox({ ...box, name: e.target.value })} />
              </Field>
              <Field label="Price ($)" hint="Cost of one open.">
                <NumberInput value={box.price} min={0} step={1} onChange={(v) => setBox({ ...box, price: Math.max(0, v) })} />
              </Field>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-medium text-ink-2">Prizes</div>
                {pieceRows}
              </div>
              <div>
                <div className="mb-1 text-xs font-medium text-ink-2">Credit</div>
                {creditRows}
              </div>
            </div>
            <div className="mt-4">{chanceTable}</div>
            <div className="mt-4">{worthBlock}</div>
            {problems.length > 0 && <div className="mt-3 rounded-md border border-warn bg-warn-soft px-3 py-2 text-xs text-ink">Fix first: {problems.join("; ")}.</div>}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <button type="button" className="chip" onClick={() => setBox(starter("little"))}>
                load the Little Box
              </button>
              <button type="button" className="chip" onClick={() => setBox(starter("timepiece"))}>
                load Misty&apos;s Timepiece Suite
              </button>
              <button type="button" className="chip" onClick={() => setBox(starter("empty"))}>
                empty box
              </button>
              <button type="button" className="chip" onClick={exportJson}>
                save as JSON
              </button>
              <label className="chip cursor-pointer">
                load JSON
                <input type="file" accept="application/json" className="hidden" onChange={(e) => importJson(e.target.files?.[0])} />
              </label>
            </div>
          </Card>
          <Card title={`2. Maths: ${money(box.price)} in, ${money(m.payFace, 2)} back per open`}>
            <BoxMaths box={box} m={m} cfg={cfg} lastId={last?.outcomeId} />
          </Card>
          <Card title="3. Open">{playBlock}</Card>
          <Card title="4. Run">{runBlock}</Card>
        </>
      )}
    </div>
  );
}
