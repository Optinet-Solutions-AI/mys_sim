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

const TOC = [
  ["one-sentence", "In one sentence"],
  ["boxes", "1. The thirteen boxes"],
  ["one-open", "2. One open, step by step"],
  ["little-box", "3. A very simple example"],
  ["timepiece", "4. The real thing: the Timepiece Suite"],
  ["price", "5. Why the box costs $10"],
  ["mistee", "6. What a Mistee is worth"],
  ["free-spins", "7. Free spins"],
  ["proof", "8. What the check proves, and what it does not"],
  ["back-office", "9. The back office in the simulator"],
  ["sources", "10. Sources: where every number comes from"],
  ["critique", "11. Analysis and critique"],
  ["glossary", "Glossary"],
] as const;

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
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Misty · mystery boxes</div>
        <h1 className="text-3xl font-semibold">How a Misty box works, in plain words</h1>
        <P>
          Written for anyone on the team, no maths background needed. Every number on this page is computed live from the odds tables captured from themistybox.com on {CAPTURED}; section 10 lists where each fact comes from, with links. The{" "}
          <Link href="/operators/misty" className="text-accent-ink underline underline-offset-2">
            Misty page of the simulator
          </Link>{" "}
          copies the mechanism one to one and lets you change every number in its back office.
        </P>
        <nav className="flex flex-wrap gap-1 pt-1 text-xs">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="chip no-underline">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <section className="space-y-3">
        <H2 id="one-sentence">In one sentence</H2>
        <Callout>
          Misty fixes the price of a box first, gives every possible prize a chance so that all the chances add up to 100, and pays out whatever the roll lands on. Each open is its own roll, nothing is remembered between opens, and most opens pay Mistees, a site credit that only buys more boxes.
        </Callout>
      </section>

      <section className="space-y-3">
        <H2 id="boxes">1. The thirteen boxes</H2>
        <P>These were live on {CAPTURED}. The names and prices are Misty&apos;s own. The other columns are worked out from the exact odds in the page data, with a Mistee counted at {money(V.misteeFace)} (how Misty&apos;s own data counts it) and pieces at their listed value.</P>
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
        <P>
          Two things stand out. The $10 boxes pay back about two thirds of the price on screen; the $25 and $50 boxes a little over half. <b>The Handbag Suite</b>, the one with a Hermès Kelly and a Chanel Classic Flap at the top, is the stingiest box on the site: on screen it returns {pct(hm.returnFace)} of the price, and a piece drops only {oneIn(hm.pItem)}.
        </P>
        <P>&quot;On screen&quot; means Mistees counted at {money(V.misteeFace)} each. &quot;Really&quot; means Mistees at about {money(V.misteeReal)} and pieces at {pct(V.itemRealized, 0)} of listed; section 6 explains why.</P>
      </section>

      <section className="space-y-3">
        <H2 id="one-open">2. One open, step by step</H2>
        <ol className="max-w-[72ch] list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>You pick a box and see the price.</b> Say the Timepiece Suite at {money(tp.price)}.
          </li>
          <li>
            <b>Before you pay, the site locks in a secret number for your open.</b> It shows you a scrambled copy of it. The secret cannot be changed later without the copy giving it away.
          </li>
          <li>
            <b>You can type a seed of your own.</b> Any word. It goes into the roll, so the site cannot pick the roll alone.
          </li>
          <li>
            <b>You pay and tap to spin.</b> The secret, your seed and the spin number (1 for the box) are mixed by a fixed recipe into one long number.
          </li>
          <li>
            <b>The long number becomes a roll between 0 and 100.</b> Every point on that line is equally likely.
          </li>
          <li>
            <b>The roll is read against the odds table.</b> Think of the 0 to 100 line cut into bands, one per outcome, each as wide as that outcome&apos;s chance. The roll falls in one band. That band is what you get.
          </li>
          <li>
            <b>If the outcome carries free spins, they run now.</b> Same secret, spin numbers 2 and 3, read against a small second table that only pays Mistees.
          </li>
          <li>
            <b>You are paid.</b> A physical piece can be shipped or traded in for Mistees. Everything else is Mistees, added to your balance.
          </li>
          <li>
            <b>The secret is revealed.</b> It must match the scrambled copy from step 2, and with it anyone can redo steps 4 to 7 and get the same result. The odds table used for your open is frozen with it.
          </li>
          <li>
            <b>A new secret is locked in for your next open.</b> Nothing from this open carries over.
          </li>
        </ol>
        <P>That is the whole mechanism. There is no pool of prizes that runs out, no counter of losses that makes a win more likely, and no target the system steers toward.</P>
      </section>

      <section className="space-y-3">
        <H2 id="little-box">3. A very simple example</H2>
        <P>Imagine a box called the Little Box. It costs $10. Its odds table has three rows:</P>
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
        <P>The chances add up to 100. Now two players open it.</P>
        <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Anna&apos;s roll is 37.2.</b> That falls in the band from 5 to 100. Anna gets 2 Mistees.
          </li>
          <li>
            <b>Ben&apos;s roll is 0.4.</b> That falls in the band from 0 to 1. Ben gets the watch.
          </li>
        </ul>
        <P>Neither roll had anything to do with the other. If a hundred people open the Little Box, the box does not owe anyone a watch. The most likely picture is one watch, four perfumes and ninety-five people with 2 Mistees, but in about one group of three nobody gets the watch at all, and in about one group of four two or more people do.</P>
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
        <H2 id="free-spins">7. Free spins</H2>
        <P>
          Two rows of the Timepiece Suite carry free spins: &quot;Free spin + 1 Mistee&quot; at 9% and &quot;2 free spins + 2 Mistees&quot; at 2%. A free spin is a new roll from the same secret, read against a small table that only pays Mistees: {tp.bonus.map((b) => `${fmtMist(b.mistees)} Mistees ${b.weight}% of the time`).join(", ")}. On average a free spin pays {be.toFixed(2)} Mistees, so the 9% row is worth about {fmtMist(Math.round((1 + be) * 100) / 100)} Mistees and the 2% row about {fmtMist(Math.round((2 + 2 * be) * 100) / 100)}. Free spins feel like a bonus; in the sum they are just two more Mistee rows, and they cost Misty {money(credits.filter((c) => c.label.toLowerCase().includes("free")).reduce((s, c) => s + c.costFace, 0), 2)} per open on screen.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="proof">8. What the check proves, and what it does not</H2>
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
        <H2 id="back-office">9. The back office in the simulator</H2>
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
        <H2 id="sources">10. Sources: where every number comes from</H2>
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
        <H2 id="critique">11. Analysis and critique</H2>
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
  );
}
