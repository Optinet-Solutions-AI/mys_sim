import Link from "next/link";
import { MISTY_BOXES, bonusEv, mistyBox, mistyMath, type MistyMath } from "@/engine/labs/misty";
import { money, num, oneIn, pct } from "@/lib/format";
import { Badge, Card, Td, Th } from "@/components/ui";

export const metadata = { title: "Misty, explained · Simulator" };

/** The values every sum on this page uses. The same three knobs sit in the Misty back office. */
const V = { misteeFace: 1, misteeReal: 0.37, itemRealized: 0.7 };
const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p.toFixed(4)) + "%";
const fmtMist = (n: number) => (n % 1 ? n.toFixed(2) : String(n));
/** One Mistee can only buy a slice of another open; solve the loop v = (items × r + mistees × v) ÷ price. */
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
function Callout({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[72ch] rounded-lg border-l-4 border-accent bg-accent-soft px-4 py-3 text-sm leading-6">{children}</div>;
}
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">
      {children}
    </a>
  );
}

function Legend({ title = "What each column means", items }: { title?: string; items: [string, React.ReactNode][] }) {
  return (
    <div className="max-w-[78ch] rounded-lg border border-line bg-paper p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{title}</div>
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
  ["one-sentence", "In short"],
  ["boxes", "1. Box content"],
  ["one-open", "2. One open, step by step"],
  ["little-box", "3. A very simple example"],
  ["timepiece", "4. The real thing: the Timepiece Suite"],
  ["price", "5. Why the box costs $10"],
  ["mistee", "6. What a Mistee is worth"],
  ["big-prize", "7. The big prize: early, late or never"],
  ["free-spins", "8. Free spins"],
  ["proof", "9. What the check proves, and what it does not"],
  ["back-office", "10. The back office in the simulator"],
  ["sources", "11. Sources: where every number comes from"],
  ["critique", "12. Analysis and critique"],
  ["glossary", "Glossary"],
] as const;

const STEPS: { what: string; detail?: string; why: string; example: string }[] = [
  {
    what: "You pick a box and see the price.",
    why: "The price is fixed first. Everything that follows is tuned to fit under it with profit to spare (section 5).",
    example: "Anna picks the Little Box at $10.",
  },
  {
    what: "Before you pay, the site locks in a secret number for your open and shows you a scrambled copy of it.",
    detail: "The secret is a long random number only the site knows. The scrambled copy is like a sealed envelope: you can see it is sealed and you can keep it, but you cannot read what is inside. If the site later tried to swap the secret, the seal would no longer match.",
    why: "It is the site's promise that the result was decided before your money went in. Without it, a site could look at who is paying and pick the result afterwards, and you could never tell.",
    example: "Anna's screen shows the seal of her secret, a string like 9f3c2a… She cannot read the secret, only the seal.",
  },
  {
    what: "You can type a seed of your own. Any word. It goes into the roll.",
    detail: "Your word is mixed into the result together with the site's secret. Neither side alone decides the roll.",
    why: "Even a site that chose its secret cleverly cannot know your word in advance, so it cannot pre-arrange the roll. If you type nothing, the site uses a default word, and then this protection is weaker.",
    example: "Anna types anna-2026.",
  },
  {
    what: "You pay and tap to spin. The secret, your seed and the spin number are mixed by a fixed recipe into one long number.",
    detail: "The spin number is 1 for the box itself. The recipe is a standard one-way mixing function: the same three inputs always give the same long number, and nobody can steer the output by choosing inputs cleverly.",
    why: "This is what makes the result reproducible. Anyone with the same three inputs gets the same long number, which is the basis of the check in step 9.",
    example: "The recipe turns Anna's secret, anna-2026 and the number 1 into one long number.",
  },
  {
    what: "The long number becomes a roll between 0 and 100.",
    detail: "Only the first part of the long number is used, and it is scaled onto a line from 0 to 100. Every point on that line is equally likely.",
    why: "A roll is something you can read against a table. Because every point is equally likely, the method itself favours no outcome; only the table decides.",
    example: "Anna's roll is 37.2.",
  },
  {
    what: "The roll is read against the odds table.",
    detail: "Think of the 0 to 100 line cut into bands, one per outcome, each as wide as that outcome's chance. The roll falls in exactly one band. That band is what you get.",
    why: "This is where the odds live. The band widths are the chances, so the table is the only thing that decides how often each prize comes. Change a width and you change the box; the roll never cared.",
    example: "Little Box bands: 0 to 1 is the watch, 1 to 5 the perfume, 5 to 100 the 2 Mistees. Anna's 37.2 falls in 5 to 100: she gets 2 Mistees. Ben, opening after her, rolls 0.4 and gets the watch.",
  },
  {
    what: "If the outcome carries free spins, they run now.",
    detail: "Same secret, same seed, spin numbers 2 and 3, read against a small second table that only pays Mistees.",
    why: "Free spins add excitement, not value. In the sums they are just more Mistee rows (section 8). Knowing that keeps a bonus from looking like a win.",
    example: "The Little Box has no free spins. On the Timepiece Suite, 9 opens in 100 carry one free spin and 2 in 100 carry two.",
  },
  {
    what: "You are paid.",
    detail: "A physical piece can be shipped or traded in for Mistees. Everything else is Mistees, added to your balance.",
    why: "Notice what can and cannot leave the site. A piece can leave. Mistees never do: they only buy more boxes or products. That difference is where the margin lives (section 6).",
    example: "Anna's balance shows 2 Mistees. Ben can have the watch shipped, or trade it for 400 Mistees and keep spinning.",
  },
  {
    what: "The secret is revealed. It must match the sealed copy from step 2.",
    detail: "With the secret in the open, anyone can redo steps 4 to 6 and must get the same roll and the same band. The odds table used for your open is frozen with it, so the check also shows which table your roll was read against.",
    why: "This is the proof. If the site had changed the secret after you paid, the seal would not match; if it had used a different table, the frozen copy would show it. It does not prove that every player gets the same table (section 9).",
    example: "Anna's screen now shows the secret. A friend types the secret, anna-2026 and 1 into the recipe and gets 37.2 again, in the band for 2 Mistees.",
  },
  {
    what: "A new secret is locked in for your next open.",
    detail: "Nothing from this open carries over: no memory, no counter, no pool that got smaller.",
    why: "Your next open has exactly the same chances as this one, whatever happened. Losing ten times in a row does not make the eleventh any more likely to win.",
    example: "Anna opens again. The odds are identical; her 2 Mistees changed nothing.",
  },
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

  return (
    <div className="mx-auto max-w-6xl pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
      <div className="min-w-0 space-y-8">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Misty · mystery boxes</div>
        <h1 className="text-3xl font-semibold">How a Misty box works, in plain words</h1>
      </header>

      <section className="space-y-3">
        <H2 id="one-sentence">In short</H2>
        <Callout>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <b>Price first.</b> Misty fixes the price of a box, then tunes the odds to fit under it.
            </li>
            <li>
              <b>Every prize has a chance, and the chances add up to 100.</b> That list is the odds table.
            </li>
            <li>
              <b>One open is one roll.</b> The roll lands in one band of the table, and that band is what you get.
            </li>
            <li>
              <b>Nothing is remembered between opens.</b> No pool runs out, no loss makes the next win more likely.
            </li>
            <li>
              <b>Most opens pay Mistees.</b> Site credit that only buys more boxes and never becomes money.
            </li>
            <li>
              <b>The check proves the roll, not the table.</b> A secret locked in before you pay shows the result was not changed; it does not show everyone got the same odds.
            </li>
          </ul>
          <p className="mt-2">
            <b>Summary:</b> a Misty box is an honest roll against published odds, priced so the box keeps about a third of the money on screen and about two thirds in real terms, because what it pays back is mostly credit that can only be spent on more boxes.
          </p>
        </Callout>
      </section>

      <section className="space-y-3">
        <H2 id="boxes">1. Box content</H2>
        <P>These were live on {CAPTURED}. The names and prices are Misty&apos;s own. Every other column is worked out from the odds table of that box; the list under the table says how.</P>
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
                      <Td>
                        <Link href="/operators/misty" className="text-ink no-underline hover:underline">
                          {b.name}
                        </Link>
                      </Td>
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
        <Card title="What each column means, how it is computed, and why it is there">
          <dl className="grid gap-x-6 gap-y-3 text-sm leading-6 text-ink-2 md:grid-cols-2">
            <div>
              <dt className="font-semibold text-ink">Box, Price</dt>
              <dd>Misty&apos;s own name and the price of one open, as printed on the site.</dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">A piece drops</dt>
              <dd>
                The chance that one open pays a physical item. <b>How:</b> add up the chances of every item row in the box&apos;s odds table, then write it as &quot;1 in&quot; (100 ÷ that sum). Timepiece: the eight item rows add up to {fmtPct(m.pItem * 100)}, so {oneIn(m.pItem)}. <b>Why:</b> it tells you how rare a real prize is; everything else is credit.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Pieces, value per open</dt>
              <dd>
                <b>How:</b> for each item row, listed value × chance; add the rows up. Timepiece: {money(m.evItems, 2)}. <b>Why:</b> it is what the items cost the operator on average every time the box is opened, and the item half of what an open gives back. The full row-by-row sum is in section 4.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Mistees per open</dt>
              <dd>
                <b>How:</b> for each credit row, Mistees × chance; add the rows up; free spins count at the {be.toFixed(2)} Mistees a spin pays on average. Timepiece: {m.evMistees.toFixed(2)}. <b>Why:</b> it is how much credit an open hands back on average, which is most of what a box pays.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Pays back per open</dt>
              <dd>
                <b>How:</b> pieces value per open + Mistees per open × {money(V.misteeFace)}. Timepiece: {money(m.evItems, 2)} + {m.evMistees.toFixed(2)} × {money(V.misteeFace)} = {money(m.payFace, 2)}. The {money(V.misteeFace)} is Misty&apos;s own figure for a Mistee (section 11 shows where it is in their data). <b>Why:</b> it is the total an open returns on average, in Misty&apos;s own accounting, and the number to hold against the price.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Return on screen</dt>
              <dd>
                <b>How:</b> pays back per open ÷ price. Timepiece: {money(m.payFace, 2)} ÷ {money(tp.price)} = {pct(m.returnFace)}. <b>Why:</b> it is the box&apos;s payout percentage as Misty&apos;s numbers imply it (casinos call this RTP). Below 100% means the box keeps the difference: here {money(tp.price - m.payFace, 2)} of every {money(tp.price)}.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-ink">Return really</dt>
              <dd>
                <b>How:</b> the same sum with a Mistee counted at what it is really worth, about {money(V.misteeReal)} (section 6 works it out), and pieces at {pct(V.itemRealized, 0)} of their listed value (what they fetch when sold on). Timepiece: {money(m.evItems * V.itemRealized, 2)} + {m.evMistees.toFixed(2)} × {money(V.misteeReal)} = {money(m.payReal, 2)}; ÷ {money(tp.price)} = {pct(m.returnReal)}. <b>Why:</b> it is what an open gives back in money terms. The gap between this column and the one before it is the Mistee valuation.
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="space-y-3">
        <H2 id="one-open">2. One open, step by step, with an example</H2>
        <P>Every step below says what happens, why it is there, and what it looks like for one player. The example box is the Little Box: it costs $10 and can pay a $400 watch (1% chance), a $50 perfume (4%) or 2 Mistees (95%). Anna opens it.</P>
        <ol className="max-w-[78ch] list-none space-y-3 pl-0 text-sm leading-6 text-ink-2">
          {STEPS.map((st, i) => (
            <li key={i} className="rounded-lg border border-line bg-paper p-3">
              <div className="flex items-start gap-2">
                <span className="mt-0.5 rounded-full bg-accent px-2 text-[11px] font-semibold text-white">{i + 1}</span>
                <div className="min-w-0 space-y-1">
                  <div className="font-semibold text-ink">{st.what}</div>
                  {st.detail && <div>{st.detail}</div>}
                  <div>
                    <span className="font-semibold text-ink">Why it matters: </span>
                    {st.why}
                  </div>
                  <div className="rounded bg-accent-soft px-2 py-1">
                    <span className="font-semibold text-ink">Example: </span>
                    {st.example}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <P>That is the whole mechanism. There is no pool of prizes that runs out, no counter of losses that makes a win more likely, and no target the system steers toward. A hundred players opening the same box are a hundred separate rolls; the box does not owe anyone a watch.</P>
      </section>

      <section className="space-y-3">
        <H2 id="little-box">3. The sums behind the example</H2>
        <P>The Little Box again, with its three rows. The chances add up to 100, and each row cuts its own band out of the 0 to 100 line.</P>
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
            ["What you can get", "One row per thing the box can pay. A box's odds table is just this list, longer."],
            ["Worth", <>What the row is worth if it is the one you get. For a piece, its listed value. For Mistees, the number of Mistees × $1, which is the figure Misty's own screens use (section 6 says what a Mistee is really worth).</>],
            ["Chance", <>How often the row comes up, out of 100 opens. The operator sets these numbers in the back office; the three must add up to 100 (1 + 4 + 95 = 100). Another way to read them: 1% is 1 in 100, 4% is 1 in 25, 95% is 19 opens in 20.</>],
            ["Band on the 0 to 100 line", <>Where the row sits on the line the roll lands on. <b>How:</b> start at 0 and give each row a stretch as wide as its chance, one after the other: the watch takes 0 to 1 (width 1), the perfume 1 to 5 (1 + 4), the Mistees 5 to 100 (5 + 95). <b>Why:</b> this is how a roll becomes a result. Anna&apos;s 37.2 is between 5 and 100, so it is the Mistee row; Ben&apos;s 0.4 is between 0 and 1, the watch.</>],
          ]}
        />
        <P>If a hundred people open the Little Box, the most likely picture is one watch, four perfumes and ninety-five people with 2 Mistees. But in about one group of three nobody gets the watch at all, and in about one group of four two or more people do. Luck decides each open; only the sums below are fixed.</P>
        <P>
          <b>What the Little Box costs its owner, per open.</b> Take each row&apos;s worth, multiply by its chance, add up.
        </P>
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
                <Td right mono>$400 × 1%</Td>
                <Td right mono>$4.00</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Perfume</Td>
                <Td right mono>$50 × 4%</Td>
                <Td right mono>$2.00</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>2 Mistees</Td>
                <Td right mono>$2 × 95%</Td>
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
            ["Row", "The same three outcomes as above."],
            ["Worth × chance", <>The row&apos;s worth multiplied by how often it comes up, with the chance written as a fraction: 1% is 0.01, so $400 × 0.01; 4% is 0.04, so $50 × 0.04; 95% is 0.95, so $2 × 0.95.</>],
            ["Cost per open", <>The result of that multiplication: what the row costs the owner on average every time someone opens the box. The watch costs $4.00 per open even though it only appears once in 100 opens, because when it does appear it costs $400, and $400 ÷ 100 = $4.00.</>],
            ["Total paid back per open", "The three costs added together. This is what the box gives back per open, on average, in Misty's own accounting."],
            ["Price", "What the player pays for one open."],
            ["Owner keeps", <>Price − total paid back. The owner&apos;s margin per open on screen. Divide the total by the price instead and you get the return: $7.90 ÷ $10 = 79%.</>],
          ]}
        />
        <P>So the Little Box pays back 79% of its price on screen. Nothing about a single open tells you that: Anna got $2 back and Ben got $400. The 79% only appears when you add up thousands of opens.</P>
        <P>
          <b>The same sum in real money.</b> Mistees only buy more boxes, so they cost the owner far less than $1 (section 6 says about {money(V.misteeReal)}). The watch and the perfume can be bought in for roughly {pct(V.itemRealized, 0)} of their listed price. Redo the table with those numbers and the box pays back about $4.90, which is 49%. The owner keeps about $5.10 of every $10.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="timepiece">4. The real thing: the Timepiece Suite</H2>
        <P>The live table has {tp.outcomes.length} rows. The chances are the exact values from the page data; they add up to {fmtPct(m.total)}. Each row costs Misty its worth multiplied by its chance. Read the pieces from the bottom up.</P>
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
                  <Td>All the Mistee rows together</Td>
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
                  <Td>All the pieces together</Td>
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
                  <Td>Price of the box</Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td right mono>{money(tp.price, 2)}</Td>
                  <Td right mono>{money(tp.price, 2)}</Td>
                </tr>
                <tr className="border-t border-line font-semibold">
                  <Td>Misty keeps per open (price − pays back)</Td>
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
            ["Outcome", "One row per thing the box can pay, exactly as the live page lists them: credit rows first, then the pieces from the most common to the rarest."],
            ["Worth", <>For a credit row: the Mistees it pays × {money(V.misteeFace)}. A row with free spins counts its own Mistees plus {be.toFixed(2)} per spin, the average a free spin pays. For a piece: the listed value shown on the page.</>],
            ["Chance", "The exact percent from the page data (the page shows it rounded). All the rows add up to 100."],
            ["1 in", "The same chance written as odds: 100 ÷ chance. 0.004% is 1 in 24,691."],
            ["= costs Misty per open", <>Worth × chance ÷ 100. The {money(rolex.valueUsd ?? 0)} Rolex at 0.00405% costs {money(rolexRow.costFace, 2)} per open: {money(rolex.valueUsd ?? 0)} × 0.0000405.</>],
            ["really", <>The same multiplication with a Mistee at {money(V.misteeReal)} instead of {money(V.misteeFace)}, and a piece at {pct(V.itemRealized, 0)} of its listed value. Section 6 explains both numbers.</>],
            ["The last three rows", <>Total = all the costs added up, the figure to hold against the price. Then the price itself. Then price − total: what Misty keeps per open, with the same figure as a share of the price in brackets.</>],
          ]}
        />
        <P>
          Every piece, from a $65 lipstick to a {money(rolex.valueUsd ?? 0)} watch, costs Misty between {money(Math.min(...pieces.map((r) => r.costFace)), 2)} and {money(Math.max(...pieces.map((r) => r.costFace)), 2)} per open, because the dearer the piece, the rarer it is made. The Mistee rows together cost a little less than all the pieces together. A free spin pays {be.toFixed(2)} Mistees on average ({tp.bonus.map((b) => `${fmtMist(b.mistees)} at ${b.weight}%`).join(", ")}); the two free-spin rows are valued with that included.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="price">5. Why the box costs $10</H2>
        <P>The price is not worked out from the contents. The price comes first, and the chances are tuned until the contents fit under it with profit to spare. Three signs point that way:</P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Prices are round tiers.</b> Every box is $10, $25 or $50. A price computed from the contents would land on odd numbers.
          </li>
          <li>
            <b>The Mistee rows are almost the same in every box of a tier.</b> The Vanity, also $10, uses nearly the same Mistee chances as the Timepiece Suite. Only the pieces on top change.
          </li>
          <li>
            <b>The rare piece is the adjustable part.</b> Its chance is the knob that makes a big headline piece fit a small price.
          </li>
        </ul>
        <P>Here is the knob on the Timepiece Suite. Only the Rolex&apos;s chance changes; everything else stays as it is.</P>
        <Card>
          <table className="w-full max-w-2xl text-xs">
            <thead>
              <tr>
                <Th>Rolex chance</Th>
                <Th right>Rolex costs per open</Th>
                <Th right>Whole box pays back per open</Th>
                <Th right>At a {money(tp.price)} price</Th>
              </tr>
            </thead>
            <tbody>
              {knob.map((k, i) => (
                <tr key={i} className="border-t border-line">
                  <Td>
                    1 in {num(Math.round(100 / k.p))}
                    {i === 0 ? " (as live)" : ""}
                  </Td>
                  <Td right mono>{money(k.cost, 2)}</Td>
                  <Td right mono>{money(k.pay, 2)}</Td>
                  <Td right mono>{k.keeps >= 0 ? `Misty keeps ${money(k.keeps, 2)}` : `Misty loses ${money(-k.keeps, 2)} per open`}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Legend
          items={[
            ["Rolex chance", "The only number that changes from row to row. The first row is the live value; the others are what-ifs."],
            ["Rolex costs per open", <>{money(rolex.valueUsd ?? 0)} × the chance. At 1 in 25,000 that is {money(rolex.valueUsd ?? 0)} ÷ 25,000.</>],
            ["Whole box pays back per open", <>The live total ({money(m.payFace, 2)}) with the live Rolex cost ({money(rolexRow.costFace, 2)}) taken out and the new Rolex cost put in. Every other row stays as it is.</>],
            [`At a ${money(tp.price)} price`, "Price − pays back. Positive means the box keeps money per open on average; negative means it loses money on every open."],
          ]}
        />
        <P>
          So why $10? Because it is a price people tap without thinking, and tap again. The Rolex is the headline, and its chance is set exactly as rare as a {money(rolex.valueUsd ?? 0)} watch needs to be to live inside a $10 box.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="mistee">6. What a Mistee is worth</H2>
        <P>
          Misty&apos;s terms say Mistees are site credit with no cash value, that every box pays them, that they never expire, and that they can only be spent on boxes and products on the site. They cannot be withdrawn, transferred or exchanged for money. The page never says in words what one Mistee is worth, but the data behind the page stores every Mistee outcome at 100 cents per Mistee, and the competitions sell entries from $1. So Misty&apos;s own book value is {money(V.misteeFace)} per Mistee.
        </P>
        <P>
          What a Mistee is worth to a player is a different question. A Mistee can only buy another spin. Ten Mistees buy one $10 open, which pays back {money(m.evItems, 2)} of pieces and {m.evMistees.toFixed(2)} more Mistees on average, and those Mistees buy more spins, and so on. Work the loop through (one Mistee = pieces per open × resale share ÷ (price − Mistees per open)) and one Mistee comes out at:
        </P>
        <Card>
          <table className="w-full max-w-xl text-xs">
            <thead>
              <tr>
                <Th>How you count the pieces</Th>
                <Th right>The sum</Th>
                <Th right>One Mistee is really worth</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <Td>At listed prices</Td>
                <Td right mono>
                  {money(m.evItems, 2)} ÷ ({money(tp.price)} − {m.evMistees.toFixed(2)})
                </Td>
                <Td right mono>{money(wListed, 2)}</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>At resale prices, {pct(V.itemRealized, 0)} of listed</Td>
                <Td right mono>
                  {money(m.evItems * V.itemRealized, 2)} ÷ ({money(tp.price)} − {m.evMistees.toFixed(2)})
                </Td>
                <Td right mono>{money(wResale, 2)}</Td>
              </tr>
            </tbody>
          </table>
        </Card>
        <P>
          So when the screen credits you 2 Mistees &quot;worth $2&quot;, you have been handed about {money(2 * wResale, 2)} of spin money. About half of all opens on the Timepiece Suite end exactly like that: 1 or 2 Mistees and nothing else. For a full open: on screen the Timepiece Suite pays back {pct(m.returnFace)} of your $10; in real terms about {pct(m.returnReal)}, so Misty keeps about {money(tp.price - m.payReal, 2)} of every $10 before its own costs.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="big-prize">7. The big prize: early, late or never</H2>
        <P>
          The Rolex has a chance of {fmtPct(rolexRow.percent)} per open, {oneIn(rolexRow.share)}. Small is not zero, and it is not a schedule either. Two questions come up every time: what if 10,000 opens go by and nobody has had it, and what if it drops in the first 100? The table says how likely each is; the list under it says what Misty does about it.
        </P>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr>
                  <Th>Opens so far</Th>
                  <Th right>Chance nobody has had the Rolex yet</Th>
                  <Th right>Chance it has dropped at least once</Th>
                  <Th right>Chance it has dropped twice or more</Th>
                  <Th right>Rolexes expected by then</Th>
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
            ["Opens so far", "How many times the box has been opened, by everyone together. The fourth row is the 1-in number itself."],
            ["Chance nobody has had the Rolex yet", <>Every open misses the Rolex with chance 1 − {fmtPct(rolexRow.percent)}. For N opens in a row, multiply that N times: (1 − 0.0000405) to the power N. At 10,000 opens that is {pct(Math.exp(10000 * Math.log(1 - rolexRow.share)))}: in two stretches out of three, ten thousand opens contain no Rolex at all.</>],
            ["Chance it has dropped at least once", "100% minus the previous column."],
            ["Chance it has dropped twice or more", <>Rare events in a long run follow the Poisson rule: with λ = N × chance, the chance of two or more is 1 − e^−λ × (1 + λ). At {num(Math.round(1 / rolexRow.share))} opens, λ = 1 and that is {pct(1 - Math.exp(-1) * 2)}.</>],
            ["Rolexes expected by then", "N × chance: the average number, not a promise. At 24,691 opens it is exactly 1; the previous columns say how far reality strays from it."],
            ["Rolex budget collected", <>Each open contributes the Rolex&apos;s cost per open ({money(rolexRow.costFace, 2)}, from section 4) to a notional kitty. The column shows the kitty against the price of one Rolex: it crosses at about {num(Math.round((rolex.valueUsd ?? 0) / rolexRow.costFace))} opens.</>],
          ]}
        />
        <P>
          <b>What Misty does about it: nothing, and that is the whole design.</b>
        </P>
        <ul className="max-w-[78ch] list-disc space-y-2 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Nothing is ever &quot;due&quot;.</b> The recipe in step 4 has three inputs, the secret, your seed and the spin number. There is no input for &quot;how many opens since the last Rolex&quot;. After 10,000 dry opens the next one is still {oneIn(rolexRow.share)}. The simulator&apos;s 50,000-open run shows stretches far longer than 25,000 without a Rolex, and the check passes on every one of them.
          </li>
          <li>
            <b>Nothing is ever &quot;gone&quot; either.</b> If the Rolex drops at open 100, open 101 has the same {oneIn(rolexRow.share)}. There is no stock of one Rolex: &quot;the piece that ships is this or better&quot; means Misty buys one when it is won. This is the difference from IcyBox-style drops and kuji boxes, where there is a fixed stock and an early win really does empty the box.
          </li>
          <li>
            <b>The money side.</b> Misty collects about {money(rolexRow.costFace, 2)} of Rolex budget per open. After 100 opens it has {money(100 * rolexRow.costFace)} in the kitty and owes a {money(rolex.valueUsd ?? 0)} watch: a loss on that box, for now. After about {num(Math.round((rolex.valueUsd ?? 0) / rolexRow.costFace))} opens the kitty crosses the cost, and over many boxes and many months the average holds. What covers an early hit in the meantime is the margin on everything else: about {money(tp.price - m.payReal, 2)} of every $10 in real terms, across all thirteen boxes. That is what the margin is for. Whether Misty also insures or reserves for big wins is not public.
          </li>
          <li>
            <b>What the player should read into &quot;1 in 25,000&quot;.</b> Not &quot;by my 25,000th open&quot;. It means about one Rolex per {money(Math.round(1 / rolexRow.share) * tp.price)} taken in, spread over everybody, with no pattern. Your own 500 opens have a {pct(1 - Math.exp(500 * Math.log(1 - rolexRow.share)))} chance of containing it, whatever happened before you.
          </li>
          <li>
            <b>What we cannot see.</b> A site could lower the Rolex&apos;s chance after a big win, or raise it after a long drought to make a story. Every check would still pass, because the check proves the roll against the table that was used, not that the table is the same as yesterday&apos;s. Only a player comparing table hashes across days would notice. We have no evidence Misty does this; the simulator&apos;s back office lets you try it and watch the proofs pass.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="free-spins">8. Free spins</H2>
        <P>
          Two rows of the Timepiece Suite carry free spins: &quot;Free spin + 1 Mistee&quot; at 9% and &quot;2 free spins + 2 Mistees&quot; at 2%. A free spin is a new roll from the same secret, read against a small table that only pays Mistees: {tp.bonus.map((b) => `${fmtMist(b.mistees)} Mistees ${b.weight}% of the time`).join(", ")}. On average a free spin pays {be.toFixed(2)} Mistees, so the 9% row is worth about {fmtMist(Math.round((1 + be) * 100) / 100)} Mistees and the 2% row about {fmtMist(Math.round((2 + 2 * be) * 100) / 100)}. Free spins feel like a bonus; in the sum they are just two more Mistee rows, and they cost Misty {money(credits.filter((c) => c.label.toLowerCase().includes("free")).reduce((s, c) => s + c.costFace, 0), 2)} per open on screen.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="proof">9. What the check proves, and what it does not</H2>
        <P>The locked-in secret, your seed and the reveal are real, and the sum can be rerun by anyone. Together they prove three things:</P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>the secret was fixed before you paid, so the result was not changed after your money went in;</li>
          <li>the roll was computed from that secret, your seed and the spin number, so nobody chose it by hand;</li>
          <li>the roll was read against the table that was frozen onto your open.</li>
        </ul>
        <P>They do not prove:</P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>that every player was given the same table (two players can each hold a valid proof against two different tables);</li>
          <li>that the table today is the table of yesterday;</li>
          <li>that a Mistee is worth a dollar.</li>
        </ul>
        <P>The simulator shows the first gap directly. In its back office you can hand one player a private table with the pieces five times as likely, and every proof still passes for every player.</P>
      </section>

      <section className="space-y-3">
        <H2 id="back-office">10. The back office in the simulator</H2>
        <ul className="max-w-[72ch] list-disc space-y-2 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Box &amp; odds.</b> Pick any of the thirteen boxes. Every outcome has a percentage you can change. As you type, the page shows the new sum, the chance of a piece, what the box pays back per open on screen and really, what each row costs per open, and what the operator keeps against the price.
          </li>
          <li>
            <b>What a free spin pays.</b> The small second table, editable the same way.
          </li>
          <li>
            <b>Per player.</b> Add players or segments and give each a share of the traffic. A player either uses the box&apos;s table or their own: a quick knob (pieces ×0.25 to ×5) or a row-by-row editor. At the top of the page you choose who is spinning.
          </li>
          <li>
            <b>What things are worth.</b> One Mistee on screen ({money(V.misteeFace)}), one Mistee really ({money(V.misteeReal)}), pieces at resale ({pct(V.itemRealized, 0)}). All the returns are computed from these three.
          </li>
          <li>
            <b>The proof.</b> Misty&apos;s recipe on, or a plain random number with nothing to check.
          </li>
          <li>
            <b>Run.</b> Opens the box thousands of times across the players and reports counts per outcome against the stated odds, return on screen and really against what the table says, each player&apos;s return against their own table, and a recomputation of the proofs.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="sources">11. Sources: where every number comes from</H2>
        <P>Everything above was taken from Misty&apos;s public pages on {CAPTURED}, saved as files, and parsed by a script. Nothing was guessed. Below, each fact and where it was read.</P>
        <Card>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Fact</Th>
                <Th>Where it was read</Th>
                <Th>Saved copy</Th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  fact: "The thirteen box names, prices and taglines",
                  where: (
                    <>
                      The &quot;Pick a box&quot; strip on every box page, e.g. <Ext href={`${SITE}/mystery/timepiece-suite`}>/mystery/timepiece-suite</Ext>, and the box index <Ext href={`${SITE}/mystery`}>/mystery</Ext>.
                    </>
                  ),
                  copy: <Ext href="/captures/misty-boxes-2026-10-12.json">misty-boxes-2026-10-12.json</Ext>,
                },
                {
                  fact: "Every outcome and its exact chance (the weights)",
                  where: (
                    <>
                      The data behind each box page&apos;s &quot;What&apos;s inside&quot; section: each outcome carries a <code>weight</code> field in percent (the Rolex is 0.00405, the 2 Mistees row 30.830…), and the weights of a box add up to 100. The page shows the same numbers rounded.
                    </>
                  ),
                  copy: <Ext href="/captures/misty-boxes-2026-10-12.json">same file, field &quot;weight&quot;</Ext>,
                },
                {
                  fact: "Piece values (&quot;minimum retail value&quot;)",
                  where: (
                    <>
                      The <code>valueUsd</code> field of each item, shown on the box page as &quot;$65+&quot;. The home page shows slightly higher figures from an older <code>valueCents</code> field ($70+ for the same lipstick).
                    </>
                  ),
                  copy: "same file",
                },
                {
                  fact: "A Mistee is counted as $1 in Misty's data",
                  where: (
                    <>
                      Every Mistee outcome carries <code>valueCents</code> = 100 × Mistees (1 Mistee = 100, 30 Mistees = 3000) with <code>fxRate: 1</code>; competitions sell &quot;entries from $1&quot; and the Vanity page says &quot;1 credit = 1 entry&quot;.
                    </>
                  ),
                  copy: <Ext href="/captures/misty-timepiece-suite-2026-10-12.json">misty-timepiece-suite-2026-10-12.json</Ext>,
                },
                {
                  fact: "Mistees are site credit with no cash value",
                  where: (
                    <>
                      <Ext href={`${SITE}/terms`}>/terms</Ext>: &quot;Mistees are site credit with no cash value: every box pays them, they never expire, and they are redeemable only for boxes and products on the site. They cannot be withdrawn, transferred or exchanged for money.&quot;
                    </>
                  ),
                  copy: <Ext href="/captures/misty-terms-2026-10-12.html">misty-terms-2026-10-12.html</Ext>,
                },
                {
                  fact: "What a free spin pays",
                  where: (
                    <>
                      The line &quot;What a Free Spin pays (Mistees)&quot; under the odds table of each box page, and the <code>bonusCards</code> data. The $25 and $50 boxes have their own free-spin tables, some with fractional Mistees (0.60, 2.40).
                    </>
                  ),
                  copy: "same JSON, field \"bonus\"",
                },
                {
                  fact: "Trade-in of a piece for Mistees",
                  where: (
                    <>
                      The page string <code>alsoCredits: &quot;Trade it in for {"{n}"} Mistees instead.&quot;</code> on every box page. The rate used in the simulator (listed dollars = Mistees) is our reading of it; the live number per piece was not captured.
                    </>
                  ),
                  copy: "same JSON",
                },
                {
                  fact: "How the roll is made (secret, seed, spin number, frozen table)",
                  where: (
                    <>
                      The &quot;Provably fair&quot; box on each box page: &quot;Every open is resolved from three inputs: a server seed we commit to before you pay (its hash is below), a client seed you can set yourself, and a nonce. The seed is revealed the moment your box opens, and the odds table is frozen onto your open.&quot; The exact mixing recipe in the simulator (HMAC-SHA256 keyed by DRAW-slug-secret-seed-nonce, first 13 hex characters) is copied from Misty&apos;s published competition verifier, e.g. <Ext href={`${SITE}/verify/suite-707`}>/verify/suite-707</Ext>. Misty&apos;s box verifier itself was not captured, so that step is the one documented part of their scheme applied to boxes.
                    </>
                  ),
                  copy: "field \"fairness\" in the JSON",
                },
                {
                  fact: "Competitions, free postal entry, same odds",
                  where: (
                    <>
                      <Ext href={`${SITE}/#how`}>/#how</Ext> (&quot;Entries from $1&hellip; A free postal entry route is always available, same draw, same odds&quot;), <Ext href={`${SITE}/free-entry`}>/free-entry</Ext>, and a live competition page <Ext href={`${SITE}/campaigns/suite-707`}>/campaigns/suite-707</Ext>.
                    </>
                  ),
                  copy: "research/captures (workspace)",
                },
                {
                  fact: "Who runs it",
                  where: <>The site footer: VGT Ventures Ltd, registered in England &amp; Wales, company no. 17356642, 128 City Road, London EC1V 2NX.</>,
                  copy: "any saved page",
                },
                {
                  fact: "The sums on this page",
                  where: (
                    <>
                      Computed live by the simulator&apos;s engine from the saved weights: <Ext href="https://github.com/Optinet-Solutions-AI/mys_sim/blob/main/src/engine/labs/misty.ts">src/engine/labs/misty.ts</Ext>, data in <Ext href="https://github.com/Optinet-Solutions-AI/mys_sim/blob/main/src/engine/mistyLive.generated.ts">src/engine/mistyLive.generated.ts</Ext>. A headless check (<code>scripts/smoke-misty.ts</code>) opens the Timepiece Suite 50,000 times and reproduces the table within chance.
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
        <P>
          <b>What was not done.</b> No paid open was made and no real revealed seed was checked against Misty&apos;s verifier; the three assumptions on this page are the resale share of pieces ({pct(V.itemRealized, 0)}), the real worth of a Mistee ({money(V.misteeReal)}, derived in section 6) and the trade-in rate. An earlier capture on 9 October 2026 showed different credit bundles (5 to 100 credits, about 14 per open, framed as competition entries); by {CAPTURED} the same box paid 1 to 30 Mistees framed as site credit. Tables change.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="critique">12. Analysis and critique</H2>
        <P>
          <b>What Misty does well, and what we can confirm.</b>
        </P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>Exact odds are published for every outcome, and they add up to 100. Most mystery-box sites publish nothing of the kind.</li>
          <li>The secret is locked in before payment, the player can add a seed, the secret is revealed afterwards, and the table is stamped onto the open. That is a real check, better than IcyBox (no check at all) and at least as good as the case sites.</li>
          <li>No open pays nothing. Every open pays at least 1 Mistee.</li>
          <li>Competitions have a free postal route at equal odds, as UK prize-competition law requires.</li>
        </ul>
        <P>
          <b>Where the presentation flatters the numbers.</b>
        </P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Mistees look like dollars.</b> They are counted at $1 in the data and nothing on the page says otherwise, yet they only buy more boxes. In real terms a Mistee is worth about {money(V.misteeReal)} to {money(wListed, 2)}. This single choice turns a {pct(m.returnReal)} box into a {pct(m.returnFace)} box on screen.
          </li>
          <li>
            <b>&quot;Every box holds at least 1 Mistee&quot;</b> is true and means almost nothing: about half of opens end with 1 or 2 Mistees, which is {money(wResale, 2)} to {money(2 * wResale, 2)} of spin money for a $10 payment.
          </li>
          <li>
            <b>Free spins are Mistee rows in disguise.</b> They add excitement, not value: together they are worth {money(credits.filter((c) => c.label.toLowerCase().includes("free")).reduce((s, c) => s + c.costFace, 0), 2)} per open on screen.
          </li>
          <li>
            <b>Two valuations at once.</b> The home page showed higher &quot;minimum retail&quot; values than the box page for the same pieces on the same day ($70+ against $65+, $16,390+ against {money(rolex.valueUsd ?? 0)}+). Which one is the minimum?
          </li>
          <li>
            <b>The trade-in rate is not published per piece.</b> &quot;Trade it in for n Mistees&quot; is shown, but n is only visible after a win.
          </li>
        </ul>
        <P>
          <b>What Misty may be doing that we cannot see or prove.</b> The check covers the roll, not the table, so the following would pass every proof. We have no evidence that Misty does any of them; the point is that the proof could not tell us.
        </P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Different tables for different players.</b> New sign-ups, big spenders, flagged accounts. The simulator&apos;s per-player back office shows how this would look: every player&apos;s proof passes.
          </li>
          <li>
            <b>Tables that change over time.</b> We saw the credit bundles change between 9 and 12 October. A table stamped onto one open proves nothing about the next.
          </li>
          <li>
            <b>The default seed.</b> If a player never sets a seed, the site supplies one. A site that knows both seeds before showing the scrambled secret could, in principle, pick a secret it likes. Setting your own seed after the commitment closes that door; most players will not.
          </li>
          <li>
            <b>Presentation tricks on the spin.</b> Near misses, the strip slowing beside the Rolex, and so on cannot be seen in the data. The simulator has these as research rigs on the generic page, deliberately not on the Misty copy, because there is no proof Misty uses them.
          </li>
          <li>
            <b>Retention mechanics.</b> The welcome box, emails, streaks, missions. Only the welcome box (a free box that pays about {mistyMath(mistyBox("kickoff"), undefined, [], V).evMistees.toFixed(2)} Mistees) was visible.
          </li>
        </ul>
        <P>
          <b>What could be done better, and is not in Misty.</b> Each of these can be tried in the simulator.
        </P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Publish the Mistee rate</b> and show the return in real money next to the return on screen. Our Glass Box page does this with three price layers.
          </li>
          <li>
            <b>Publish the table hash before payment, and a public log of every table ever used.</b> Then a player can see whether their table is the same as everyone else&apos;s and the same as yesterday&apos;s. That closes the per-player gap at no cost to an honest operator.
          </li>
          <li>
            <b>Let Mistees leave.</b> A cash-out at a published rate, or a floor price, or an expiry refund. Credit that can never leave is the whole margin.
          </li>
          <li>
            <b>An independent market value next to the operator&apos;s value</b> (WatchCharts, eBay sold prices), so &quot;minimum retail value&quot; is not the only number.
          </li>
          <li>
            <b>Spend limits, cooling-off, a plain &quot;you have put in $X and got back $Y&quot; counter.</b> Nothing like it is on the page.
          </li>
          <li>
            <b>A verifier that recomputes the box open, not only the competition draw,</b> published with the recipe, so the mixing step is no longer our reading of their competition verifier.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="glossary">Glossary</H2>
        <dl className="grid max-w-[80ch] gap-x-6 gap-y-2 text-sm leading-6 text-ink-2 sm:grid-cols-2">
          {[
            ["Odds table", "The list of everything a box can pay, each with its chance. The chances add up to 100."],
            ["Band", "The slice of the 0 to 100 line that belongs to one outcome; as wide as its chance."],
            ["Roll", "The number between 0 and 100 that decides one open. It falls in exactly one band."],
            ["Cost per open", "An outcome's worth multiplied by its chance: what that outcome costs the operator on average every time the box is opened."],
            ["Pays back per open", "All the costs per open added together. Divided by the price it is the return, often called RTP."],
            ["On screen", "Counting Mistees at $1 and pieces at listed price, the way Misty's screens do."],
            ["Really", "Counting Mistees at what they cost the operator and pieces at resale."],
            ["Mistee", "Misty's site credit. Paid by nearly every open, redeemable only for boxes and products, never for money."],
            ["Free spin", "A bonus roll from a small second table that pays Mistees only."],
            ["Secret", "A random number the site chooses before you pay; together with your seed it decides the roll. Revealed after the open."],
            ["Seed", "A word you choose that goes into the roll alongside the secret."],
            ["Spin number", "1 for the box spin, 2 and 3 for free spins, all under the same secret."],
            ["Frozen table", "The odds table, stamped onto your open so the check shows which table your roll was read against."],
            ["Back office", "The operator's settings: the percentages, the free-spin table, the values, and per-player tables."],
          ].map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold text-ink">{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <div className="pt-2">
          <Badge>Version 1.0 · {CAPTURED} capture · sums computed live</Badge>
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
            For developers: how to build it →
          </Link>
        </div>
      </aside>
    </div>
  );
}
