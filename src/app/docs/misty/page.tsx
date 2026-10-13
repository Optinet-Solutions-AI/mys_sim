import Link from "next/link";
import { MISTY_BOXES, bonusEv, mistyBox, mistyMath, type MistyMath } from "@/engine/labs/misty";
import { money, num, oneIn, pct } from "@/lib/format";
import { Badge, Card, Td, Th } from "@/components/ui";

export const metadata = { title: "Misty, explained · Simulator" };

/** The values every sum on this page uses. The same three knobs sit in the Misty back office. */
const V = { misteeFace: 1, misteeReal: 0.37, itemRealized: 0.7 };
const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";
const fmtMist = (n: number) => (n % 1 ? n.toFixed(2) : String(n));
/** One Mistee only buys a slice of another open: v = items × r ÷ (price − Mistees per open). */
const misteeWorth = (m: MistyMath, price: number, r: number) => (price - m.evMistees > 0 ? (m.evItems * r) / (price - m.evMistees) : 0);

const CAPTURED = "12 October 2026";
const SITE = "https://www.themistybox.com";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 text-xl font-semibold">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[72ch] text-sm leading-6 text-ink-2">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">{children}</ul>;
}
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">
      {children}
    </a>
  );
}
function Legend({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="max-w-[78ch] rounded-lg border border-line bg-paper p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Columns</div>
      <dl className="grid gap-x-6 gap-y-2 text-sm leading-6 text-ink-2 md:grid-cols-2">
        {items.map(([t, d]) => (
          <div key={t}>
            <dt className="font-semibold text-ink">{t}</dt>
            <dd>{d}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

const TOC = [
  ["in-short", "In short"],
  ["boxes", "1. Box content"],
  ["one-open", "2. One open, step by step"],
  ["little-box", "3. The sums"],
  ["timepiece", "4. The Timepiece Suite"],
  ["price", "5. Why $10"],
  ["mistee", "6. What a Mistee is worth"],
  ["big-prize", "7. The big prize"],
  ["free-spins", "8. Free spins"],
  ["proof", "9. The check"],
  ["back-office", "10. Back office"],
  ["sources", "11. Sources"],
  ["critique", "12. Critique"],
  ["glossary", "Glossary"],
] as const;

const STEPS: { what: string; why: string; example: string }[] = [
  { what: "Pick a box. The price is fixed.", why: "Price comes first; the odds are tuned to fit under it (section 5).", example: "Anna picks the Little Box, $10." },
  {
    what: "Before you pay, the site locks in a secret number and shows you a scrambled copy (a seal).",
    why: "Proves the result was decided before your money went in. Swap the secret later and the seal no longer matches.",
    example: "Anna sees the seal 9f3c2a…; she cannot read the secret.",
  },
  { what: "You may type a seed: any word. It goes into the roll.", why: "Neither side alone decides the roll. No seed = the site uses a default, and this protection is weaker.", example: "Anna types anna-2026." },
  { what: "You pay and spin. Secret + seed + spin number → one long number, by a fixed recipe.", why: "Same inputs, same number, every time. That is what makes step 9 possible.", example: "Spin number 1 for the box." },
  { what: "The long number becomes a roll from 0 to 100. Every point equally likely.", why: "The method favours nothing; only the table decides.", example: "Anna rolls 37.2." },
  {
    what: "The roll is read against the odds table: the 0 to 100 line cut into bands, one per outcome, each as wide as its chance.",
    why: "The band widths are the chances. The table is the only thing that sets how often each prize comes.",
    example: "Bands: 0–1 watch, 1–5 perfume, 5–100 2 Mistees. 37.2 → 2 Mistees. Ben rolls 0.4 → watch.",
  },
  { what: "Free spins, if the outcome has them: same secret, spin numbers 2 and 3, a small second table that pays Mistees only.", why: "Excitement, not value: in the sums they are more Mistee rows (section 8).", example: "Little Box: none. Timepiece: 9% of opens carry one, 2% carry two." },
  { what: "You are paid. A piece ships or is traded in for Mistees. Everything else is Mistees.", why: "A piece can leave the site. Mistees never do (section 6).", example: "Anna: 2 Mistees. Ben: ship the watch, or 400 Mistees." },
  {
    what: "The secret is revealed. It must match the seal. The table used is frozen with it.",
    why: "Anyone can redo steps 4–6 and get the same roll. It does not prove everyone got the same table (section 9).",
    example: "A friend reruns secret + anna-2026 + 1 and gets 37.2.",
  },
  { what: "A new secret is locked in for the next open. Nothing carries over.", why: "Next open: same chances, whatever happened. Ten losses do not make the eleventh more likely.", example: "Anna opens again; identical odds." },
];

export default function MistyDocsPage() {
  const tp = mistyBox("timepiece-suite");
  const m = mistyMath(tp, undefined, tp.bonus, V);
  const credits = m.perOutcome.filter((r) => r.kind !== "item").sort((a, b) => b.share - a.share);
  const pieces = m.perOutcome.filter((r) => r.kind === "item").sort((a, b) => b.share - a.share);
  const sum = (xs: MistyMath["perOutcome"], k: "costFace" | "costReal") => xs.reduce((s, r) => s + r[k], 0);
  const rolex = tp.outcomes.find((o) => o.label.startsWith("Rolex"))!;
  const rolexRow = m.perOutcome.find((r) => r.id === rolex.id)!;
  const knob = [rolexRow.percent, 0.01, 0.02, 0.1].map((p) => {
    const cost = ((rolex.valueUsd ?? 0) * p) / 100;
    const pay = m.payFace - rolexRow.costFace + cost;
    return { p, cost, pay, keeps: tp.price - pay };
  });
  const handbag = mistyBox("handbag-suite");
  const hm = mistyMath(handbag, undefined, handbag.bonus, V);
  const be = bonusEv(tp.bonus);
  const wListed = misteeWorth(m, tp.price, 1);
  const wResale = misteeWorth(m, tp.price, V.itemRealized);
  const freeCost = credits.filter((c) => c.label.toLowerCase().includes("free")).reduce((s, c) => s + c.costFace, 0);
  const rolexCross = Math.round((rolex.valueUsd ?? 0) / rolexRow.costFace);

  return (
    <div className="mx-auto max-w-6xl pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
      <div className="min-w-0 space-y-8">
        <header className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Misty · mystery boxes</div>
          <h1 className="text-3xl font-semibold">How a Misty box works</h1>
          <P>Numbers computed from the live tables captured on {CAPTURED}. Sources in section 11.</P>
        </header>

        <section className="space-y-3">
          <H2 id="in-short">In short</H2>
          <div className="max-w-[72ch] rounded-lg border-l-4 border-accent bg-accent-soft px-4 py-3 text-sm leading-6">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Price first.</b> Odds are tuned to fit under it.
              </li>
              <li>
                <b>Every prize has a chance; the chances add up to 100.</b> That list is the odds table.
              </li>
              <li>
                <b>One open = one roll.</b> It lands in one band of the table; that band is the result.
              </li>
              <li>
                <b>No memory between opens.</b> No pool runs out; no loss makes the next win more likely.
              </li>
              <li>
                <b>Most opens pay Mistees:</b> site credit that only buys more boxes, never money.
              </li>
              <li>
                <b>The check proves the roll, not the table.</b> Result not changed after payment; not that everyone has the same odds.
              </li>
            </ul>
            <p className="mt-2">
              <b>Summary:</b> an honest roll against published odds, priced so the box keeps about a third of the money on screen and about two thirds in real terms, because most of what it pays back is credit.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <H2 id="boxes">1. Box content</H2>
          <P>Live on {CAPTURED}. Names and prices are Misty&apos;s. The other columns come from each box&apos;s odds table.</P>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr>
                    <Th>Box</Th>
                    <Th right>Price</Th>
                    <Th right>A piece drops</Th>
                    <Th right>Pieces, value per open</Th>
                    <Th right>Mistees per open</Th>
                    <Th right>Pays back per open</Th>
                    <Th right>Return on screen</Th>
                    <Th right>Return really</Th>
                  </tr>
                </thead>
                <tbody>
                  {MISTY_BOXES.map((b) => {
                    const bm = mistyMath(b, undefined, b.bonus, V);
                    return (
                      <tr key={b.slug} className="border-t border-line">
                        <Td>{b.name}</Td>
                        <Td right mono>{b.price > 0 ? money(b.price) : "free"}</Td>
                        <Td right mono>{bm.pItem > 0 ? oneIn(bm.pItem) : "never"}</Td>
                        <Td right mono>{money(bm.evItems, 2)}</Td>
                        <Td right mono>{bm.evMistees.toFixed(2)}</Td>
                        <Td right mono>{money(bm.payFace, 2)}</Td>
                        <Td right mono>{b.price > 0 ? pct(bm.returnFace) : "–"}</Td>
                        <Td right mono>{b.price > 0 ? pct(bm.returnReal) : "–"}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Legend
            items={[
              ["Box, Price", "Misty's name and the price of one open."],
              ["A piece drops", <>Sum of the item rows&apos; chances, written as 1 in (100 ÷ sum). Timepiece: {fmtPct(m.pItem * 100)} = {oneIn(m.pItem)}. Purpose: how rare a real prize is.</>],
              ["Pieces, value per open", <>Σ listed value × chance over the item rows. Timepiece: {money(m.evItems, 2)}. Purpose: what the items cost the operator per open.</>],
              ["Mistees per open", <>Σ Mistees × chance over the credit rows; free spins at {be.toFixed(2)} Mistees each. Timepiece: {m.evMistees.toFixed(2)}.</>],
              ["Pays back per open", <>Pieces + Mistees × {money(V.misteeFace)}. Timepiece: {money(m.evItems, 2)} + {m.evMistees.toFixed(2)} × {money(V.misteeFace)} = {money(m.payFace, 2)}. {money(V.misteeFace)} is Misty&apos;s own figure (section 11).</>],
              ["Return on screen", <>Pays back ÷ price. Timepiece: {money(m.payFace, 2)} ÷ {money(tp.price)} = {pct(m.returnFace)} (the RTP). The box keeps the rest: {money(tp.price - m.payFace, 2)} of {money(tp.price)}.</>],
              ["Return really", <>Same sum with a Mistee at {money(V.misteeReal)} (section 6) and pieces at {pct(V.itemRealized, 0)} of listed. Timepiece: {money(m.evItems * V.itemRealized, 2)} + {m.evMistees.toFixed(2)} × {money(V.misteeReal)} = {money(m.payReal, 2)}; ÷ {money(tp.price)} = {pct(m.returnReal)}. The gap to the previous column is the Mistee valuation.</>],
            ]}
          />
          <Ul>
            <li>$10 boxes return about two thirds on screen; $25 and $50 boxes just over half.</li>
            <li>
              Handbag Suite: {pct(hm.returnFace)} on screen, a piece {oneIn(hm.pItem)}. The stingiest box.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="one-open">2. One open, step by step</H2>
          <P>Example box: the Little Box, $10. Pays a $400 watch (1%), a $50 perfume (4%) or 2 Mistees (95%). Anna opens it.</P>
          <ol className="max-w-[78ch] list-none space-y-2 pl-0 text-sm leading-6 text-ink-2">
            {STEPS.map((st, i) => (
              <li key={i} className="rounded-lg border border-line bg-paper p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 rounded-full bg-accent px-2 text-[11px] font-semibold text-white">{i + 1}</span>
                  <div className="min-w-0 space-y-0.5">
                    <div className="font-semibold text-ink">{st.what}</div>
                    <div>
                      <span className="font-semibold text-ink">Why: </span>
                      {st.why}
                    </div>
                    <div className="rounded bg-accent-soft px-2 py-0.5">
                      <span className="font-semibold text-ink">Example: </span>
                      {st.example}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <P>No pool that runs out, no counter of losses, no target the system steers toward. A hundred players are a hundred separate rolls.</P>
        </section>

        <section className="space-y-3">
          <H2 id="little-box">3. The sums</H2>
          <Card>
            <table className="w-full max-w-xl text-xs">
              <thead>
                <tr>
                  <Th>What you can get</Th>
                  <Th right>Worth</Th>
                  <Th right>Chance</Th>
                  <Th right>Band on the 0 to 100 line</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <Td>A watch</Td>
                  <Td right mono>$400</Td>
                  <Td right mono>1%</Td>
                  <Td right mono>0 to 1</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>A perfume</Td>
                  <Td right mono>$50</Td>
                  <Td right mono>4%</Td>
                  <Td right mono>1 to 5</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>2 Mistees</Td>
                  <Td right mono>$2 on screen</Td>
                  <Td right mono>95%</Td>
                  <Td right mono>5 to 100</Td>
                </tr>
              </tbody>
            </table>
          </Card>
          <Legend
            items={[
              ["What you can get", "One row per outcome. A real odds table is this list, longer."],
              ["Worth", "Listed value for a piece; Mistees × $1 for credit (Misty's figure)."],
              ["Chance", "Per 100 opens. Set by the operator. Must add up to 100: 1 + 4 + 95. 1% = 1 in 100, 4% = 1 in 25, 95% = 19 in 20."],
              ["Band", "Start at 0, give each row a stretch as wide as its chance: watch 0–1, perfume 1–5 (1 + 4), Mistees 5–100 (5 + 95). A roll falls in exactly one band: 37.2 → Mistees, 0.4 → watch."],
            ]}
          />
          <P>100 opens: most likely 1 watch, 4 perfumes, 95 × 2 Mistees. In 1 group of 3 nobody gets the watch; in 1 group of 4, two or more do.</P>
          <Card>
            <table className="w-full max-w-xl text-xs">
              <thead>
                <tr>
                  <Th>Row</Th>
                  <Th right>Worth × chance</Th>
                  <Th right>Cost per open</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <Td>Watch</Td>
                  <Td right mono>$400 × 0.01</Td>
                  <Td right mono>$4.00</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>Perfume</Td>
                  <Td right mono>$50 × 0.04</Td>
                  <Td right mono>$2.00</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>2 Mistees</Td>
                  <Td right mono>$2 × 0.95</Td>
                  <Td right mono>$1.90</Td>
                </tr>
                <tr className="border-t-2 border-ink font-semibold">
                  <Td>Total paid back per open</Td>
                  <Td right> </Td>
                  <Td right mono>$7.90</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>Price</Td>
                  <Td right> </Td>
                  <Td right mono>$10.00</Td>
                </tr>
                <tr className="border-t border-line font-semibold">
                  <Td>Owner keeps, on screen</Td>
                  <Td right> </Td>
                  <Td right mono>$2.10</Td>
                </tr>
              </tbody>
            </table>
          </Card>
          <Legend
            items={[
              ["Worth × chance", "Chance as a fraction: 1% = 0.01."],
              ["Cost per open", "What the row costs the owner per open on average. The watch costs $4.00 per open: $400 once in 100 opens."],
              ["Total, Price, Owner keeps", "Sum of the costs; the price; price − total. Return = total ÷ price = 79%."],
            ]}
          />
          <Ul>
            <li>On screen: pays back $7.90 of $10 (79%). One open never shows this; Anna got $2, Ben $400.</li>
            <li>Really: Mistees at {money(V.misteeReal)}, pieces at {pct(V.itemRealized, 0)} of listed → pays back about $4.90 (49%). Owner keeps about $5.10 of $10.</li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="timepiece">4. The Timepiece Suite</H2>
          <P>
            {tp.outcomes.length} rows, exact page chances, sum {fmtPct(m.total)}. Each row costs Misty worth × chance.
          </P>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr>
                    <Th>Outcome</Th>
                    <Th right>Worth</Th>
                    <Th right>×</Th>
                    <Th right>Chance</Th>
                    <Th right>1 in</Th>
                    <Th right>= costs Misty per open</Th>
                    <Th right>really</Th>
                  </tr>
                </thead>
                <tbody>
                  {credits.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <Td>{r.label}</Td>
                      <Td right mono>
                        {fmtMist(Math.round(r.mistees * 100) / 100)} M × {money(V.misteeFace)} = {money(r.valueFace, 2)}
                      </Td>
                      <Td right>×</Td>
                      <Td right mono>{fmtPct(r.percent)}</Td>
                      <Td right mono>{num(Math.round(1 / r.share))}</Td>
                      <Td right mono>{money(r.costFace, 2)}</Td>
                      <Td right mono>{money(r.costReal, 2)}</Td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line bg-paper font-semibold">
                    <Td>All Mistee rows</Td>
                    <Td right mono>{m.evMistees.toFixed(2)} Mistees per open</Td>
                    <Td right> </Td>
                    <Td right mono>{fmtPct((1 - m.pItem) * 100)}</Td>
                    <Td right> </Td>
                    <Td right mono>{money(sum(credits, "costFace"), 2)}</Td>
                    <Td right mono>{money(sum(credits, "costReal"), 2)}</Td>
                  </tr>
                  {pieces.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <Td>{r.label}</Td>
                      <Td right mono>{money(r.valueFace)}</Td>
                      <Td right>×</Td>
                      <Td right mono>{fmtPct(r.percent)}</Td>
                      <Td right mono>{num(Math.round(1 / r.share))}</Td>
                      <Td right mono>{money(r.costFace, 2)}</Td>
                      <Td right mono>{money(r.costReal, 2)}</Td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-line bg-paper font-semibold">
                    <Td>All pieces</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>{fmtPct(m.pItem * 100)}</Td>
                    <Td right mono>{num(Math.round(1 / m.pItem))}</Td>
                    <Td right mono>{money(sum(pieces, "costFace"), 2)}</Td>
                    <Td right mono>{money(sum(pieces, "costReal"), 2)}</Td>
                  </tr>
                  <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
                    <Td>Total: pays back per open</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>{fmtPct(m.total)}</Td>
                    <Td right> </Td>
                    <Td right mono>{money(m.payFace, 2)}</Td>
                    <Td right mono>{money(m.payReal, 2)}</Td>
                  </tr>
                  <tr className="border-t border-line">
                    <Td>Price</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>{money(tp.price, 2)}</Td>
                    <Td right mono>{money(tp.price, 2)}</Td>
                  </tr>
                  <tr className="border-t border-line font-semibold">
                    <Td>Misty keeps per open</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>
                      {money(tp.price - m.payFace, 2)} ({pct((tp.price - m.payFace) / tp.price)})
                    </Td>
                    <Td right mono>
                      {money(tp.price - m.payReal, 2)} ({pct((tp.price - m.payReal) / tp.price)})
                    </Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          <Legend
            items={[
              ["Outcome", "As the live page lists them: credit rows, then pieces from common to rare."],
              ["Worth", <>Credit: Mistees × {money(V.misteeFace)}; a free-spin row adds {be.toFixed(2)} per spin. Piece: listed value.</>],
              ["Chance, 1 in", "Exact page percent; 100 ÷ chance."],
              ["= costs Misty per open", <>Worth × chance ÷ 100. Rolex: {money(rolex.valueUsd ?? 0)} × 0.0000405 = {money(rolexRow.costFace, 2)}.</>],
              ["really", <>Mistee at {money(V.misteeReal)}, piece at {pct(V.itemRealized, 0)} of listed.</>],
              ["Last rows", "Sum of costs; price; price − sum = what Misty keeps, with the share in brackets."],
            ]}
          />
          <Ul>
            <li>
              Every piece costs {money(Math.min(...pieces.map((r) => r.costFace)), 2)} to {money(Math.max(...pieces.map((r) => r.costFace)), 2)} per open: the dearer the piece, the rarer it is made.
            </li>
            <li>
              Free spin: {tp.bonus.map((b) => `${fmtMist(b.mistees)} at ${b.weight}%`).join(", ")} = {be.toFixed(2)} Mistees on average.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="price">5. Why $10</H2>
          <Ul>
            <li>Price first, odds second. Signs: prices are round tiers ($10, $25, $50); the Mistee rows are nearly identical within a tier; only the pieces change.</li>
            <li>The rare piece is the knob. Its chance makes a big piece fit a small price.</li>
          </Ul>
          <Card>
            <table className="w-full max-w-2xl text-xs">
              <thead>
                <tr>
                  <Th>Rolex chance</Th>
                  <Th right>Rolex costs per open</Th>
                  <Th right>Box pays back per open</Th>
                  <Th right>At {money(tp.price)}</Th>
                </tr>
              </thead>
              <tbody>
                {knob.map((k, i) => (
                  <tr key={i} className="border-t border-line">
                    <Td>
                      1 in {num(Math.round(100 / k.p))}
                      {i === 0 ? " (live)" : ""}
                    </Td>
                    <Td right mono>{money(k.cost, 2)}</Td>
                    <Td right mono>{money(k.pay, 2)}</Td>
                    <Td right mono>{k.keeps >= 0 ? `keeps ${money(k.keeps, 2)}` : `loses ${money(-k.keeps, 2)}`}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Legend
            items={[
              ["Rolex chance", "The only number that changes. Row 1 is live; the rest are what-ifs."],
              ["Rolex costs per open", <>{money(rolex.valueUsd ?? 0)} × chance.</>],
              ["Box pays back per open", <>Live total {money(m.payFace, 2)} − live Rolex cost {money(rolexRow.costFace, 2)} + new Rolex cost.</>],
              [`At ${money(tp.price)}`, "Price − pays back. Negative = loss on every open."],
            ]}
          />
          <P>
            $10 is an impulse price. The Rolex is the headline; its chance is set as rare as a {money(rolex.valueUsd ?? 0)} watch needs to be to fit a $10 box.
          </P>
        </section>

        <section className="space-y-3">
          <H2 id="mistee">6. What a Mistee is worth</H2>
          <Ul>
            <li>Terms: site credit, no cash value, every box pays them, never expire, redeemable only for boxes and products. No withdrawal, transfer or exchange for money.</li>
            <li>Misty&apos;s book value: {money(V.misteeFace)}. Not written on the page; the page data stores 100 cents per Mistee and competitions sell entries from $1.</li>
            <li>To a player a Mistee only buys a slice of another open. The loop: one Mistee = pieces per open × resale share ÷ (price − Mistees per open).</li>
          </Ul>
          <Card>
            <table className="w-full max-w-xl text-xs">
              <thead>
                <tr>
                  <Th>Pieces counted at</Th>
                  <Th right>Sum</Th>
                  <Th right>One Mistee is worth</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <Td>Listed price</Td>
                  <Td right mono>
                    {money(m.evItems, 2)} ÷ ({money(tp.price)} − {m.evMistees.toFixed(2)})
                  </Td>
                  <Td right mono>{money(wListed, 2)}</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>Resale, {pct(V.itemRealized, 0)} of listed</Td>
                  <Td right mono>
                    {money(m.evItems * V.itemRealized, 2)} ÷ ({money(tp.price)} − {m.evMistees.toFixed(2)})
                  </Td>
                  <Td right mono>{money(wResale, 2)}</Td>
                </tr>
              </tbody>
            </table>
          </Card>
          <Ul>
            <li>
              &quot;2 Mistees worth $2&quot; = about {money(2 * wResale, 2)} of spin money. About half of Timepiece opens end with 1 or 2 Mistees and nothing else.
            </li>
            <li>
              Timepiece per $10: {pct(m.returnFace)} back on screen, about {pct(m.returnReal)} really. Misty keeps about {money(tp.price - m.payReal, 2)} before its own costs.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="big-prize">7. The big prize: early, late or never</H2>
          <P>
            Rolex: {fmtPct(rolexRow.percent)} per open, {oneIn(rolexRow.share)}. Small, not zero, not a schedule.
          </P>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr>
                    <Th>Opens so far</Th>
                    <Th right>No Rolex yet</Th>
                    <Th right>At least once</Th>
                    <Th right>Twice or more</Th>
                    <Th right>Expected</Th>
                    <Th right>Rolex budget collected</Th>
                  </tr>
                </thead>
                <tbody>
                  {[100, 1000, 10000, Math.round(1 / rolexRow.share), 50000, 100000].map((N) => {
                    const lam = N * rolexRow.share;
                    const none = Math.exp(N * Math.log(1 - rolexRow.share));
                    const two = 1 - Math.exp(-lam) * (1 + lam);
                    return (
                      <tr key={N} className="border-t border-line">
                        <Td mono>{num(N)}</Td>
                        <Td right mono>{pct(none)}</Td>
                        <Td right mono>{pct(1 - none)}</Td>
                        <Td right mono>{pct(two)}</Td>
                        <Td right mono>{lam.toFixed(2)}</Td>
                        <Td right mono>
                          {money(N * rolexRow.costFace)} of {money(rolex.valueUsd ?? 0)}
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
          <Legend
            items={[
              ["No Rolex yet", <>(1 − 0.0000405) to the power N. At 10,000: {pct(Math.exp(10000 * Math.log(1 - rolexRow.share)))}.</>],
              ["At least once", "100% − previous column."],
              ["Twice or more", <>Poisson, λ = N × chance: 1 − e^−λ(1 + λ). At {num(Math.round(1 / rolexRow.share))}, λ = 1: {pct(1 - Math.exp(-1) * 2)}.</>],
              ["Expected", "N × chance. An average, not a promise."],
              ["Rolex budget collected", <>N × {money(rolexRow.costFace, 2)} (its cost per open, section 4) against one Rolex. Crosses at about {num(rolexCross)} opens.</>],
            ]}
          />
          <P>
            <b>What Misty does about it: nothing, by design.</b>
          </P>
          <Ul>
            <li>
              <b>Nothing is due.</b> The recipe has three inputs: secret, seed, spin number. No &quot;opens since the last Rolex&quot;. After 10,000 dry opens the next is still {oneIn(rolexRow.share)}.
            </li>
            <li>
              <b>Nothing is gone.</b> Rolex at open 100 → open 101 has the same chance. No stock of one Rolex; Misty buys one when it is won. IcyBox drops and kuji boxes differ: fixed stock, an early win empties the box.
            </li>
            <li>
              <b>Money.</b> {money(rolexRow.costFace, 2)} of Rolex budget per open. At open 100: {money(100 * rolexRow.costFace)} collected, {money(rolex.valueUsd ?? 0)} owed. Budget crosses cost at about {num(rolexCross)} opens. Early hits are covered by the margin on everything else: about {money(tp.price - m.payReal, 2)} of every $10 in real terms. Insurance or reserves: not public.
            </li>
            <li>
              <b>For the player.</b> &quot;1 in 25,000&quot; = about one Rolex per {money(Math.round(1 / rolexRow.share) * tp.price)} taken in, spread over everybody. Your own 500 opens: {pct(1 - Math.exp(500 * Math.log(1 - rolexRow.share)))} chance, whatever came before.
            </li>
            <li>
              <b>Not visible.</b> A site could lower the chance after a win or raise it after a drought; every check still passes (the check proves the roll against the table used, not that the table is yesterday&apos;s). No evidence Misty does this. The simulator back office lets you try it.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="free-spins">8. Free spins</H2>
          <Ul>
            <li>Two Timepiece rows carry them: &quot;Free spin + 1 Mistee&quot; at 9%, &quot;2 free spins + 2 Mistees&quot; at 2%.</li>
            <li>
              A free spin: new roll, same secret, small table: {tp.bonus.map((b) => `${fmtMist(b.mistees)} M ${b.weight}%`).join(", ")}. Average {be.toFixed(2)} Mistees.
            </li>
            <li>
              Row values: 9% row ≈ {fmtMist(Math.round((1 + be) * 100) / 100)} Mistees; 2% row ≈ {fmtMist(Math.round((2 + 2 * be) * 100) / 100)}. Together {money(freeCost, 2)} per open on screen. Excitement, not value.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="proof">9. The check: what it proves, what it does not</H2>
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Proves">
              <Ul>
                <li>The secret was fixed before payment: the result was not changed after your money went in.</li>
                <li>The roll came from secret + seed + spin number: nobody chose it by hand.</li>
                <li>The roll was read against the table frozen onto your open.</li>
              </Ul>
            </Card>
            <Card title="Does not prove">
              <Ul>
                <li>That every player got the same table. Two players can hold valid proofs against two tables.</li>
                <li>That today&apos;s table is yesterday&apos;s.</li>
                <li>That a Mistee is worth a dollar.</li>
              </Ul>
            </Card>
          </div>
          <P>The simulator shows the first gap: give one player pieces at five times the odds in the back office; every proof still passes.</P>
        </section>

        <section className="space-y-3">
          <H2 id="back-office">10. Back office in the simulator</H2>
          <Ul>
            <li>
              <b>Box &amp; odds:</b> any of the 13 boxes; every percent editable; live sum, piece chance, pays back on screen and really, cost per row, keep vs price.
            </li>
            <li>
              <b>Free-spin table:</b> editable.
            </li>
            <li>
              <b>Per player:</b> segments with a traffic share; box table or own table (pieces ×0.25 to ×5, or row by row). Pick who is spinning at the top of the page.
            </li>
            <li>
              <b>Values:</b> Mistee on screen ({money(V.misteeFace)}), really ({money(V.misteeReal)}), pieces at resale ({pct(V.itemRealized, 0)}).
            </li>
            <li>
              <b>Proof:</b> Misty&apos;s recipe on or off.
            </li>
            <li>
              <b>Run:</b> thousands of opens; counts vs stated odds, returns vs table, per player, proofs recomputed.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="sources">11. Sources</H2>
          <P>All from Misty&apos;s public pages on {CAPTURED}, saved and parsed by a script. Nothing guessed.</P>
          <Card>
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Fact</Th>
                  <Th>Where</Th>
                  <Th>Saved copy</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    fact: "13 box names, prices, taglines",
                    where: (
                      <>
                        &quot;Pick a box&quot; strip on every box page, e.g. <Ext href={`${SITE}/mystery/timepiece-suite`}>/mystery/timepiece-suite</Ext>; index <Ext href={`${SITE}/mystery`}>/mystery</Ext>.
                      </>
                    ),
                    copy: <Ext href="/captures/misty-boxes-2026-10-12.json">misty-boxes-2026-10-12.json</Ext>,
                  },
                  {
                    fact: "Every outcome and its exact chance",
                    where: (
                      <>
                        Page data behind &quot;What&apos;s inside&quot;: field <code>weight</code> in percent (Rolex 0.00405, 2 Mistees 30.830…); sums to 100 per box. The page shows them rounded.
                      </>
                    ),
                    copy: "same file, field weight",
                  },
                  {
                    fact: "Piece values",
                    where: (
                      <>
                        Field <code>valueUsd</code>, shown as &quot;$65+&quot;. The home page shows higher figures from an older <code>valueCents</code> field ($70+ for the same lipstick).
                      </>
                    ),
                    copy: "same file",
                  },
                  {
                    fact: "A Mistee = $1 in Misty's data",
                    where: (
                      <>
                        Every Mistee outcome: <code>valueCents</code> = 100 × Mistees, <code>fxRate: 1</code>. Competitions: &quot;entries from $1&quot;; Vanity page: &quot;1 credit = 1 entry&quot;.
                      </>
                    ),
                    copy: <Ext href="/captures/misty-timepiece-suite-2026-10-12.json">misty-timepiece-suite-2026-10-12.json</Ext>,
                  },
                  {
                    fact: "Mistees are site credit, no cash value",
                    where: (
                      <>
                        <Ext href={`${SITE}/terms`}>/terms</Ext>: &quot;Mistees are site credit with no cash value: every box pays them, they never expire, and they are redeemable only for boxes and products on the site. They cannot be withdrawn, transferred or exchanged for money.&quot;
                      </>
                    ),
                    copy: <Ext href="/captures/misty-terms-2026-10-12.html">misty-terms-2026-10-12.html</Ext>,
                  },
                  {
                    fact: "Free-spin table",
                    where: <>&quot;What a Free Spin pays (Mistees)&quot; under each odds table; <code>bonusCards</code> data. $25 and $50 boxes have their own tables, some with fractional Mistees.</>,
                    copy: "same JSON, field bonus",
                  },
                  {
                    fact: "Trade-in",
                    where: (
                      <>
                        Page string <code>alsoCredits: &quot;Trade it in for {"{n}"} Mistees instead.&quot;</code> The per-piece n was not captured; the simulator uses listed dollars = Mistees.
                      </>
                    ),
                    copy: "same JSON",
                  },
                  {
                    fact: "How the roll is made",
                    where: (
                      <>
                        &quot;Provably fair&quot; box on each page: server seed committed before payment, client seed, nonce, seed revealed at the open, odds table frozen onto the open. The mixing recipe (HMAC-SHA256 keyed DRAW-slug-secret-seed-nonce, first 13 hex characters) is copied from the competition verifier, e.g. <Ext href={`${SITE}/verify/suite-707`}>/verify/suite-707</Ext>. The box verifier itself was not captured.
                      </>
                    ),
                    copy: "field fairness in the JSON",
                  },
                  {
                    fact: "Competitions, free postal entry",
                    where: (
                      <>
                        <Ext href={`${SITE}/#how`}>/#how</Ext>, <Ext href={`${SITE}/free-entry`}>/free-entry</Ext>, <Ext href={`${SITE}/campaigns/suite-707`}>/campaigns/suite-707</Ext>.
                      </>
                    ),
                    copy: "research/captures (workspace)",
                  },
                  { fact: "Operator", where: <>Footer: VGT Ventures Ltd, England &amp; Wales, company no. 17356642, 128 City Road, London EC1V 2NX.</>, copy: "any saved page" },
                  {
                    fact: "The sums on this page",
                    where: (
                      <>
                        Computed live by <Ext href="https://github.com/Optinet-Solutions-AI/mys_sim/blob/main/src/engine/labs/misty.ts">src/engine/labs/misty.ts</Ext> from <Ext href="https://github.com/Optinet-Solutions-AI/mys_sim/blob/main/src/engine/mistyLive.generated.ts">mistyLive.generated.ts</Ext>. <code>scripts/smoke-misty.ts</code> opens the Timepiece 50,000 times and reproduces the table within chance.
                      </>
                    ),
                    copy: "GitHub",
                  },
                ].map((r, i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <Td>
                      <b>{r.fact}</b>
                    </Td>
                    <Td>{r.where}</Td>
                    <Td>{r.copy}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <Ul>
            <li>
              <b>Not done:</b> no paid open; no real revealed seed checked against Misty&apos;s verifier.
            </li>
            <li>
              <b>Assumptions:</b> resale share {pct(V.itemRealized, 0)}; Mistee worth {money(V.misteeReal)} (section 6); trade-in rate.
            </li>
            <li>
              <b>Tables change:</b> 9 October capture had 5 to 100 credits per open (about 14), framed as entries; {CAPTURED}: 1 to 30 Mistees (2.8), framed as site credit.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="critique">12. Critique</H2>
          <P>
            <b>Confirmed, and good.</b>
          </P>
          <Ul>
            <li>Exact odds published for every outcome; they add up to 100.</li>
            <li>Secret committed before payment, player seed, reveal, frozen table. Better than IcyBox (no check); on par with the case sites.</li>
            <li>No empty open: at least 1 Mistee.</li>
            <li>Competitions have a free postal route at equal odds.</li>
          </Ul>
          <P>
            <b>Where the presentation flatters the numbers.</b>
          </P>
          <Ul>
            <li>
              Mistees look like dollars ($1 in the data, nothing says otherwise) but only buy boxes. Really {money(V.misteeReal)} to {money(wListed, 2)}. This turns a {pct(m.returnReal)} box into {pct(m.returnFace)} on screen.
            </li>
            <li>
              &quot;Every box holds at least 1 Mistee&quot;: true; about half of opens end with 1 or 2, i.e. {money(wResale, 2)} to {money(2 * wResale, 2)} of spin money for $10.
            </li>
            <li>Free spins are Mistee rows in disguise: {money(freeCost, 2)} per open on screen.</li>
            <li>
              Two valuations on the same day: home page $70+ / {money(16390)}+, box page $65+ / {money(rolex.valueUsd ?? 0)}+.
            </li>
            <li>Trade-in rate per piece not published; shown only after a win.</li>
          </Ul>
          <P>
            <b>Possible, unprovable.</b> The check covers the roll, not the table, so all of these would pass every proof. No evidence Misty does any of them.
          </P>
          <Ul>
            <li>Different tables per player segment (new sign-ups, big spenders, flagged accounts). The simulator back office shows it: every proof passes.</li>
            <li>Tables changed over time; seen between 9 and 12 October. A table stamped on one open says nothing about the next.</li>
            <li>Default seed: if the player sets none, the site supplies one and knows both inputs before showing the seal. Setting your own seed closes this; most players will not.</li>
            <li>Presentation tricks on the spin (near misses). Not visible in data; kept out of the Misty copy, available as research rigs on the generic page.</li>
            <li>
              Retention mechanics beyond the welcome box (a free box paying about {mistyMath(mistyBox("kickoff"), undefined, [], V).evMistees.toFixed(2)} Mistees).
            </li>
          </Ul>
          <P>
            <b>What could be done better.</b> Each can be tried in the simulator.
          </P>
          <Ul>
            <li>Publish the Mistee rate; show real-money return next to the on-screen one (the Glass Box page does this with three price layers).</li>
            <li>Publish the table hash before payment and a public log of every table ever used. Closes the per-player gap at no cost to an honest operator.</li>
            <li>Let credit leave: cash-out at a published rate, a floor, or an expiry refund.</li>
            <li>Independent market value next to &quot;minimum retail value&quot; (WatchCharts, eBay sold).</li>
            <li>Spend limits, cooling-off, a &quot;paid in / got back&quot; counter.</li>
            <li>A published verifier for box opens, not only competition draws.</li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="glossary">Glossary</H2>
          <dl className="grid max-w-[80ch] gap-x-6 gap-y-2 text-sm leading-6 text-ink-2 sm:grid-cols-2">
            {[
              ["Odds table", "Everything a box can pay, each with its chance. Chances add up to 100."],
              ["Band", "The slice of the 0 to 100 line that belongs to one outcome; as wide as its chance."],
              ["Roll", "The number from 0 to 100 that decides one open. Falls in exactly one band."],
              ["Cost per open", "Worth × chance: what an outcome costs the operator per open on average."],
              ["Pays back per open", "All costs per open added. ÷ price = return (RTP)."],
              ["On screen", "Mistees at $1, pieces at listed, as Misty's screens count."],
              ["Really", "Mistees at cost, pieces at resale."],
              ["Mistee", "Misty's site credit. Boxes and products only, never money."],
              ["Free spin", "A bonus roll from a small second table, Mistees only."],
              ["Secret", "Random number chosen by the site before you pay; with your seed it decides the roll. Revealed after."],
              ["Seal", "The scrambled copy of the secret shown before you pay; the secret must match it afterwards."],
              ["Seed", "A word you choose that goes into the roll."],
              ["Spin number", "1 for the box, 2 and 3 for free spins, same secret."],
              ["Frozen table", "The odds table stamped onto your open."],
              ["Back office", "Operator settings: percentages, free-spin table, values, per-player tables."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-ink">{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <div className="pt-2">
            <Badge>Version 1.2 · {CAPTURED} capture · sums computed live</Badge>
          </div>
        </section>
      </div>
      <aside className="mt-8 lg:mt-0">
        <div className="rounded-xl border border-line bg-paper p-3 text-xs lg:sticky lg:top-4">
          <Link href="/operators/misty" className="btn w-full justify-center no-underline">
            ← Back to the Misty mystery box
          </Link>
          <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-3">On this page</div>
          <ol className="space-y-1">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded px-1 py-0.5 text-ink-2 no-underline hover:bg-accent-soft hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ol>
          <Link href="/docs/misty/dev" className="mt-3 block text-accent-ink underline underline-offset-2">
            For developers →
          </Link>
          <Link href="/build" className="mt-1 block text-accent-ink underline underline-offset-2">
            Build your own box →
          </Link>
        </div>
      </aside>
    </div>
  );
}
