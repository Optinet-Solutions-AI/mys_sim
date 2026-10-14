import Link from "next/link";
import { DocsToc } from "@/components/DocsToc";
import { JEMLIT_CAPTURED, JEMLIT_FEATURED, JEMLIT_SETTINGS, JEMLIT_SUMMARY } from "@/engine/jemlitLive.generated";
import { jemlitCommit, jemlitDigest, jemlitMath, jemlitRoll, type JemlitMath } from "@/engine/labs/jemlit";
import { CRASH_DEFAULT, MINES_DEFAULT, UPGRADER_DEFAULT, crashProbAtLeast, minesMultiplier, minesSurvival, upgraderTarget } from "@/engine/labs/jemlitGames";
import { JEMLIT_PACKS } from "@/engine/jemlitLive.generated";
import { money, num, oneIn, pct, pctSmart } from "@/lib/format";
import { Badge, Card, Td, Th } from "@/components/ui";
import { CollapsibleTable } from "@/components/CollapsibleTable";

export const metadata = { title: "Jemlit, explained · Simulator" };

const V = { creditFace: 1, creditReal: 0.4, itemRealized: 0.7 };
const SITE = "https://jemlit.com";
const UPG_CAP = Math.floor((1 - UPGRADER_DEFAULT.fee) * 100) / 100;
const fmtPct = (p: number) => (p >= 1 ? p.toFixed(2) : p >= 0.1 ? p.toFixed(3) : p >= 0.001 ? p.toFixed(4) : p.toFixed(6)) + "%";

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
  ["sums", "3. The sums: Apple eBox"],
  ["price", "4. Why the price, and the 80% rule"],
  ["credits", "5. What a Credit is worth"],
  ["big-prize", "6. The big prize"],
  ["proof", "7. The check"],
  ["back-office", "8. Back office"],
  ["settings", "9. Platform settings seen"],
  ["games", "10. The other games"],
  ["sources", "11. Sources"],
  ["critique", "12. Critique"],
  ["developers", "For developers"],
  ["glossary", "Glossary"],
] as const;

const STEPS: { what: string; why: string; example: string }[] = [
  { what: "Top up Credits, pick a box. The price is fixed.", why: "Everything is paid in Credits ($1.12 = €1 on the deposit page). The price comes first; the chances are solved to fit it (section 4).", example: "Anna deposits and picks the Apple eBox at $8.47." },
  {
    what: "Before play the site locks in a secret (the server seed) and shows you its scrambled copy.",
    why: "The scrambled copy (a SHA-512 hash) proves the secret was fixed before you paid. Swap it later and the copy no longer matches.",
    example: "Anna's Fairness popup shows a long hash. She cannot read the secret from it.",
  },
  { what: "Your browser makes a client seed. You can change it.", why: "If you keep the browser's seed, the site generated it and knows both inputs. Change it and neither side alone decides the roll.", example: "Anna types anna-2026." },
  { what: "You pay and spin. Secret + your seed + the play count → one long number.", why: "The play count (nonce) starts at 1 and rises by one every open under the same secret, so every open mixes a different number.", example: "Anna's first open under this secret: play count 1." },
  { what: "The long number becomes a roll from 0 to 100. Every point equally likely.", why: "The method favours nothing. Only the table decides.", example: "Anna rolls 22.0231." },
  {
    what: "The roll is read against the bands: each item owns a stretch of the 0 to 100 line as wide as its chance. Wins if lower < roll ≤ upper.",
    why: "This is where the odds live. The page lists the bands under See rolls, so you can read exactly which item each number gives.",
    example: "Apple eBox bands: 0 to 6.25 screen protector, 6.25 to 12.5 carry case, 12.5 to 28.43 sticker, 28.43 to 43.79 $3.40 credit… 22.0231 → the sticker.",
  },
  { what: "You are paid. Ship the item, or exchange it for its cashback in Credits. Some rows are Credits only.", why: "Cashback is 90% of the listed price for most items, 100% for credit rows. Credits buy boxes and games and never become money.", example: "Anna's sticker is a credit-only row: $1.02 in Credits, no shipping." },
  { what: "The secret stays until you rotate it. Then it is revealed and every open under it can be rechecked.", why: "Check only after rotation, on their page or with the recipe below. Until then the same secret serves every open.", example: "After 40 opens Anna rotates the seed and recomputes roll 22.0231." },
];

export default function JemlitDocsPage() {
  const box = JEMLIT_FEATURED.find((b) => b.slug === "apple-ebox") ?? JEMLIT_FEATURED[0];
  const m = jemlitMath(box, undefined, V);
  const rows = [...m.perItem].sort((a, b) => b.share - a.share);
  const sum = (xs: JemlitMath["perItem"], k: "costPrice" | "costCashback" | "costReal") => xs.reduce((s, r) => s + r[k], 0);
  const big = box.items.filter((i) => i.price >= box.price);
  const small = box.items.filter((i) => i.price < box.price);
  const evBig = big.reduce((s, i) => s + i.chance * i.price, 0);
  const evSmallCash = small.reduce((s, i) => s + i.chance * i.cashback, 0);
  const wResale = (evBig * V.itemRealized) / (box.price - evSmallCash);
  const wListed = evBig / (box.price - evSmallCash);
  const headline = box.items.filter((i) => i.chance <= 1e-6);
  const pHead = headline.reduce((s, i) => s + i.chance, 0);
  const headCost = headline.reduce((s, i) => s + i.chance * i.price, 0);
  const n80 = JEMLIT_SUMMARY.filter((b) => b.rtpPrice != null && Math.abs(b.rtpPrice - 0.8) < 0.005).length;
  const others = JEMLIT_SUMMARY.filter((b) => b.rtpPrice != null && Math.abs(b.rtpPrice - 0.8) >= 0.005);
  const medianBig = [...JEMLIT_SUMMARY].sort((a, b) => a.pAtOrAbovePrice - b.pAtOrAbovePrice)[Math.floor(JEMLIT_SUMMARY.length / 2)].pAtOrAbovePrice;
  const pub = { serverSeed: "server seed", clientSeed: "your client seed", nonce: "your nonce" };
  const pubDigest = jemlitDigest(pub.serverSeed, pub.clientSeed, pub.nonce as unknown as number);
  const pubRoll = jemlitRoll(pubDigest);
  const S = JEMLIT_SETTINGS as Record<string, unknown>;
  const settingRows: [string, string, string][] = [
    ["upgrader_fee", String(S.upgrader_fee), "The Upgrader keeps 15% of the fair odds: a 50% fair chance is sold as 42.5%."],
    ["upgrader_chances_options", JSON.stringify(S.upgrader_chances_options), "The chances a player can pick in the Upgrader, from 1% to 92%."],
    ["crash_house_edge", String(S.crash_house_edge), "The Crash game keeps 8%."],
    ["borrow_enabled / borrow_max_percentage", `${String(S.borrow_enabled)} / ${String(S.borrow_max_percentage)}`, "A borrow feature is switched on, up to 90% of something; what is borrowed and against what is not visible from outside."],
    ["shipment_min_deposit", String(S.shipment_min_deposit), "A deposit of at least $10 before an item can be shipped."],
    ["shipment_coupon_bonus_percent / timer", `${String(S.shipment_coupon_bonus_percent)}% / ${String(S.shipment_coupon_timer_minutes)} min`, "After a win, a 15-minute offer: 30% extra Credits instead of shipping."],
    ["user_claims_active / min amount / min deposit / fee", `${String(S.user_claims_active)} / ${String(S.user_claim_min_amount)} / ${String(S.user_claim_min_deposit)} / ${String(S.user_claim_fee)}`, "A claims feature exists with a $15 minimum, a $30 deposit history and a $5 fee, limited to crypto payers. The terms say Credits are never exchanged for money; what a claim is was not captured."],
    ["home_price_boundaries", JSON.stringify(S.home_price_boundaries), "The price bands the home page groups boxes by."],
  ];

  return (
    <div className="mx-auto flex max-w-6xl flex-col pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
      <div className="min-w-0 space-y-8">
        <header className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Jemlit · mystery boxes</div>
          <h1 className="text-3xl font-semibold">How a Jemlit box works</h1>
          <P>Numbers computed from the {JEMLIT_SUMMARY.length} live box tables captured on {JEMLIT_CAPTURED}. Sources in section 11.</P>
        </header>

        <section className="space-y-3">
          <H2 id="in-short">In short</H2>
          <div className="max-w-[72ch] rounded-lg border-l-4 border-accent bg-accent-soft px-4 py-3 text-sm leading-6">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <b>Price first, then the chances are solved to 80%.</b> {n80} of {JEMLIT_SUMMARY.length} boxes pay back exactly 80% of their price at Jemlit&apos;s listed values.
              </li>
              <li>
                <b>Every item owns a band on a 0 to 100 line.</b> The roll lands in one band; that item is the result. The bands are printed on the page.
              </li>
              <li>
                <b>One open = one roll.</b> A play count rises by one each open under the same secret; nothing else carries over.
              </li>
              <li>
                <b>Most opens pay less than the price.</b> On the Apple eBox {pct(1 - m.pAtOrAbovePrice)} of opens pay under {money(box.price)}; the ten headline items are one in a million each.
              </li>
              <li>
                <b>Credits are the cushion.</b> Exchange any win for 90% of its listed price in Credits. Credits buy boxes and games, never money, and expire after a year.
              </li>
              <li>
                <b>The check proves the roll, not the table.</b> Jemlit hashes the server seed, not the odds; the default client seed comes from the site; you can check only after rotating the seed.
              </li>
            </ul>
            <p className="mt-2">
              <b>Summary:</b> an honest, fully published roll against printed odds, priced so the box keeps 20% at Jemlit&apos;s own valuations and about {pct(1 - m.returnReal, 0)} in real terms, because most of what it pays back is cheap accessories at full price or Credits that only buy more boxes.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <H2 id="boxes">1. Box content</H2>
          <P>{JEMLIT_SUMMARY.length} boxes were live on {JEMLIT_CAPTURED}, from {money(Math.min(...JEMLIT_SUMMARY.map((b) => b.price)))} to {money(Math.max(...JEMLIT_SUMMARY.map((b) => b.price)))}. Names and prices are Jemlit&apos;s. The other columns come from each box&apos;s chances.</P>
          <Card title="Featured boxes (home page)">
            <CollapsibleTable
              head={["Box", "Price", "Items", "Worth the price or more", "Pays back per open", "Return at listed", "Return in Credits"]}
              rows={JEMLIT_FEATURED.map((b) => {
                const bm = jemlitMath(b, undefined, V);
                return [b.name, money(b.price), String(b.items.length), oneIn(bm.pAtOrAbovePrice), money(bm.evPrice, 2), pct(bm.returnPrice), pct(bm.returnCashback)];
              })}
              initial={3}
              noun="boxes"
            />
          </Card>
          <Card title={`All ${JEMLIT_SUMMARY.length} boxes`}>
            <CollapsibleTable
              head={["Box", "Price", "Items", "Worth the price or more", "Return at listed", "Return in Credits", "Top item"]}
              rows={[...JEMLIT_SUMMARY].sort((a, b) => b.price - a.price).map((b) => [b.name, money(b.price), String(b.items), b.pAtOrAbovePrice > 0 ? oneIn(b.pAtOrAbovePrice) : "never", b.rtpPrice != null ? pct(b.rtpPrice) : "–", b.rtpCashback != null ? pct(b.rtpCashback) : "–", b.top ? `${b.top.label} · ${money(b.top.price)} · ${oneIn(b.top.chance)}` : ""])}
              initial={3}
              noun="boxes"
            />
          </Card>
          <Legend
            items={[
              ["Box, Price", "Jemlit's name and the price of one open, in Credits ($1 each)."],
              ["Worth the price or more", <>Add up the chances of every item listed at the box price or above, written as 1 in. Apple eBox: {fmtPct(m.pAtOrAbovePrice * 100)} = {oneIn(m.pAtOrAbovePrice)}. Purpose: how often an open does not lose on paper.</>],
              ["Pays back per open", <>For each item, listed price × chance; add the rows up. Apple eBox: {money(m.evPrice, 2)}.</>],
              ["Return at listed", <>Pays back ÷ price. Apple eBox: {money(m.evPrice, 2)} ÷ {money(box.price)} = {pct(m.returnPrice)}. The RTP in Jemlit&apos;s own accounting.</>],
              ["Return in Credits", <>The same sum with each item at its cashback instead of its price. Apple eBox: {pct(m.returnCashback)}. What you get if you exchange everything.</>],
              ["Top item", "The dearest item in the box and its chance."],
            ]}
          />
          <Ul>
            <li>
              {n80} boxes return exactly 80.0% at listed prices. The exceptions: {others.map((b) => `${b.name} ${pct(b.rtpPrice ?? 0, 0)}`).join(", ")}.
            </li>
            <li>In the median box, an item worth the price or more drops {oneIn(medianBig)}.</li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="one-open">2. One open, step by step</H2>
          <P>Example box: the Apple eBox, {money(box.price)}, {box.items.length} items. Anna opens it. The roll in the example is the one from Jemlit&apos;s own page.</P>
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
          <H2 id="sums">3. The sums: Apple eBox</H2>
          <P>
            {box.items.length} rows, exact chances from the box API (they add up to {fmtPct(m.total * 100)}). Each row costs Jemlit its listed price × its chance.
          </P>
          <Card>
            <div className="overflow-x-auto">
              <div className="tbl"><table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th right>Price</Th>
                    <Th right>Cashback</Th>
                    <Th right>×</Th>
                    <Th right>Chance</Th>
                    <Th right>1 in</Th>
                    <Th right>= costs per open</Th>
                    <Th right>in Credits</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-line">
                      <Td>
                        {r.label}
                        {r.credit && <Badge> credit</Badge>}
                      </Td>
                      <Td right mono>{money(r.price)}</Td>
                      <Td right mono>{money(r.cashback)}</Td>
                      <Td right>×</Td>
                      <Td right mono>{fmtPct(r.chance * 100)}</Td>
                      <Td right mono>{num(Math.round(1 / r.share))}</Td>
                      <Td right mono>{money(r.costPrice, 3)}</Td>
                      <Td right mono>{money(r.costCashback, 3)}</Td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
                    <Td>Total: pays back per open</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>{fmtPct(m.total * 100)}</Td>
                    <Td right> </Td>
                    <Td right mono>{money(sum(rows, "costPrice"), 2)}</Td>
                    <Td right mono>{money(sum(rows, "costCashback"), 2)}</Td>
                  </tr>
                  <tr className="border-t border-line">
                    <Td>Price of the box</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>{money(box.price, 2)}</Td>
                    <Td right mono>{money(box.price, 2)}</Td>
                  </tr>
                  <tr className="border-t border-line font-semibold">
                    <Td>Jemlit keeps per open</Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right> </Td>
                    <Td right mono>
                      {money(box.price - m.evPrice, 2)} ({pct((box.price - m.evPrice) / box.price)})
                    </Td>
                    <Td right mono>
                      {money(box.price - m.evCashback, 2)} ({pct((box.price - m.evCashback) / box.price)})
                    </Td>
                  </tr>
                </tbody>
              </table></div>
            </div>
          </Card>
          <Legend
            items={[
              ["Item", "As the box API lists them, most common first. Credit rows pay Credits and are never shipped."],
              ["Price, Cashback", "The listed value, and the Credits you get if you exchange the item (90% of price; 100% for credit rows)."],
              ["Chance, 1 in", "The exact fraction from the page, as a percent; 100 ÷ chance."],
              ["= costs per open", <>Price × chance ÷ 100. The Hermès watch: {money(2300)} × 0.000001 = {money(0.0023, 4)}.</>],
              ["in Credits", "Cashback × chance ÷ 100: what the row costs if the player exchanges it."],
              ["Last rows", "Sum of costs; the price; price − sum = what Jemlit keeps, with the share in brackets."],
            ]}
          />
          <Ul>
            <li>
              Five rows under {money(8.2)} share {pct(rows.filter((r) => r.price < 8.2).reduce((s, r) => s + r.share, 0))} of all opens and supply {money(rows.filter((r) => r.price < 8.2).reduce((s, r) => s + r.costPrice, 0), 2)} of the {money(m.evPrice, 2)} paid back.
            </li>
            <li>
              The ten headline items together cost {money(headCost, 4)} per open: {pct(headCost / m.evPrice, 1)} of what the box pays back.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="price">4. Why the price, and the 80% rule</H2>
          <Ul>
            <li>
              <b>The 80% is a setting, not a coincidence.</b> {n80} of {JEMLIT_SUMMARY.length} boxes land on 80.00% to four decimals. A solver sets the chances so that Σ price × chance = 0.8 × price. Prices like $8.47 or $6.92 are what the solver and the item list produce, not round marketing numbers.
            </li>
            <li>
              <b>The dial is the cheap rows.</b> Generic accessories listed at $4 to $8 take most of the probability. Raise their chances and the headline items shrink; the total stays at 80%.
            </li>
            <li>
              <b>The headline items are decoration.</b> Ten items at one in a million each cost {money(headCost, 4)} per open together. Removing all ten would move the return from {pct(m.returnPrice)} to {pct((m.evPrice - headCost) / box.price)}.
            </li>
            <li>
              <b>The listed prices are Jemlit&apos;s.</b> A &quot;compatible screen protector&quot; at {money(8.16)} and a carry case at {money(8.16)} fill 12.5% of opens at almost the box price. Whether those items are worth $8.16 decides whether 80% is real.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="credits">5. What a Credit is worth</H2>
          <Ul>
            <li>Terms: Credits &quot;are not worth real money&quot;, cannot be refunded or exchanged for money, expire one year after top-up. A won item can be exchanged for Credits at its value &quot;reduced by a percentage between 0% and 30%&quot;; the live tables use 10%.</li>
            <li>On screen a Credit is $1: box prices are in Credits and the deposit page says $1.12 = €1.</li>
            <li>
              To a player a Credit only buys another open. If a player ships items worth the price or more and exchanges the rest, one Credit = pieces shipped per open × resale share ÷ (price − Credits paid back per open).
            </li>
          </Ul>
          <Card>
            <div className="tbl"><table className="w-full max-w-xl text-xs">
              <thead>
                <tr>
                  <Th>Shipped items counted at</Th>
                  <Th right>Sum</Th>
                  <Th right>One Credit is worth</Th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <Td>Listed price</Td>
                  <Td right mono>
                    {money(evBig, 2)} ÷ ({money(box.price)} − {money(evSmallCash, 2)})
                  </Td>
                  <Td right mono>{money(wListed, 2)}</Td>
                </tr>
                <tr className="border-t border-line">
                  <Td>Resale, {pct(V.itemRealized, 0)} of listed</Td>
                  <Td right mono>
                    {money(evBig * V.itemRealized, 2)} ÷ ({money(box.price)} − {money(evSmallCash, 2)})
                  </Td>
                  <Td right mono>{money(wResale, 2)}</Td>
                </tr>
              </tbody>
            </table></div>
          </Card>
          <Ul>
            <li>
              So &quot;$3.40 in Credits&quot; is about {money(3.4 * wResale, 2)} of spin money. {pct(rows.filter((r) => r.price < 5).reduce((s, r) => s + r.share, 0), 0)} of Apple eBox opens end with something listed under $5.
            </li>
            <li>
              Per {money(box.price)} open: {pct(m.returnPrice)} back at listed prices, {pct(m.returnCashback)} in Credits, about {pct(m.returnReal)} really. Jemlit keeps about {money(box.price - m.evReal, 2)} before its own costs.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="big-prize">6. The big prize: early, late or never</H2>
          <P>
            Any of the ten headline items: {fmtPct(pHead * 100)} per open, {oneIn(pHead)}. Small, not zero, not a schedule.
          </P>
          <Card>
            <div className="overflow-x-auto">
              <div className="tbl"><table className="w-full min-w-[600px] text-xs">
                <thead>
                  <tr>
                    <Th>Opens so far</Th>
                    <Th right>No headline item yet</Th>
                    <Th right>At least one</Th>
                    <Th right>Expected</Th>
                    <Th right>Headline budget collected</Th>
                  </tr>
                </thead>
                <tbody>
                  {[1000, 10000, 100000, 1000000, 5000000].map((N) => {
                    const none = Math.exp(N * Math.log(1 - pHead));
                    return (
                      <tr key={N} className="border-t border-line">
                        <Td mono>{num(N)}</Td>
                        <Td right mono>{pct(none)}</Td>
                        <Td right mono>{pct(1 - none)}</Td>
                        <Td right mono>{(N * pHead).toFixed(2)}</Td>
                        <Td right mono>
                          {money(N * headCost)} of {money(headline.reduce((s, i) => s + i.price, 0) / Math.max(1, headline.length))} average item
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            </div>
          </Card>
          <Legend
            items={[
              ["No headline item yet", <>One open misses all ten {pct(1 - pHead, 4)} of the time. For a run of opens, multiply that by itself once per open. At 100,000 opens: {pct(Math.exp(100000 * Math.log(1 - pHead)))}.</>],
              ["At least one", "100% minus the column before."],
              ["Expected", "Opens × chance. An average over many runs, not a promise."],
              ["Headline budget collected", <>Opens × {money(headCost, 4)}, the ten rows&apos; cost per open, against the average headline item ({money(headline.reduce((s, i) => s + i.price, 0) / Math.max(1, headline.length))}).</>],
            ]}
          />
          <Ul>
            <li>
              <b>Nothing is due.</b> The recipe has three inputs: secret, seed, play count. No &quot;opens since the last big win&quot;. After a million dry opens the next is still {oneIn(pHead)}.
            </li>
            <li>
              <b>Nothing is gone.</b> A headline win at open 100 leaves open 101 at the same chance. No stock; Jemlit buys the item when it is won.
            </li>
            <li>
              <b>Money.</b> At {money(headCost, 4)} per open, a $1,000 win needs about {num(Math.round(1000 / headCost))} opens of budget. Early hits are covered by the 20% kept on every open.
            </li>
            <li>
              <b>Not visible.</b> Jemlit commits the seed, not the table, so a box&apos;s chances can change between seed rotations and every check still passes.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="proof">7. The check: what it proves, what it does not</H2>
          <div className="grid gap-3 md:grid-cols-2">
            <Card title="Proves">
              <Ul>
                <li>The server seed was fixed before play: its hash was shown first.</li>
                <li>The roll came from that seed, your seed and the play count: nobody chose it by hand.</li>
                <li>Every open under a seed can be rechecked once the seed is rotated and revealed.</li>
              </Ul>
            </Card>
            <Card title="Does not prove">
              <Ul>
                <li>That the bands were the same for everyone, or the same as yesterday. Only the seed is committed; the table is not hashed.</li>
                <li>That the browser&apos;s default client seed was unknown to the site. It is generated by the site&apos;s own script.</li>
                <li>That a Credit is worth a dollar, or that a &quot;compatible screen protector&quot; is worth $8.16.</li>
                <li>Anything about an open while its seed is still in use: checking requires rotating first.</li>
              </Ul>
            </Card>
          </div>
          <P>The simulator shows the first gap: give one player the big items at five times the odds in the back office; every check still passes.</P>
        </section>

        <section className="space-y-3">
          <H2 id="back-office">8. Back office in the simulator</H2>
          <Ul>
            <li>
              <b>Box &amp; odds:</b> any of the {JEMLIT_SUMMARY.length} boxes; every chance editable; live sum, worth-the-price odds, pays back at listed, in Credits and really; Fit the big items to a target return.
            </li>
            <li>
              <b>Per player:</b> segments with a traffic share; box table or own table.
            </li>
            <li>
              <b>Values:</b> a Credit on screen ({money(V.creditFace)}) and really ({money(V.creditReal)}); shipped items at resale ({pct(V.itemRealized, 0)}).
            </li>
            <li>
              <b>Proof:</b> Jemlit&apos;s recipe on or off; the client seed.
            </li>
            <li>
              <b>Simulator:</b> open any box 200,000 times or more and get the report with charts.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="settings">9. Platform settings seen in the page</H2>
          <P>Every Jemlit page ships a block of platform settings to the browser. These are the ones that touch the money. They describe other games as well as the boxes.</P>
          <Card>
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Setting</Th>
                  <Th>Value</Th>
                  <Th>Meaning</Th>
                </tr>
              </thead>
              <tbody>
                {settingRows.map(([k, v, d]) => (
                  <tr key={k} className="border-t border-line align-top">
                    <Td mono>{k}</Td>
                    <Td mono>{v}</Td>
                    <Td>{d}</Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </section>

        <section className="space-y-3">
          <H2 id="games">10. The other games</H2>
          <P>Jemlit runs five more products on the same Credits and the same roll recipe. Each is a tab under Jemlit in the simulator. One line each, then the rule in words.</P>
          <Card>
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Game</Th>
                  <Th>What it is</Th>
                  <Th>The rule</Th>
                  <Th right>Return</Th>
                  <Th>Settings seen</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Packs", `${JEMLIT_PACKS.length} boxes of trading cards (Pokémon, One Piece, Yu-Gi-Oh) in the collectibles listing.`, "Exactly a box: table, bands, one roll, cashback at 90%.", "80% at listed", "same as boxes"],
                  ["Battles", "2 to 4 players (or teams 2v2, 3v3, 2v2v2) open the same box each round.", "Every pull is a normal open under one server seed with the play count rising. Classic: the highest total takes every item. Crazy: the lowest wins. Jackpot: the winner is drawn in proportion to totals. Final drop: only the last round counts.", "80% at listed, paid to one seat", "turn 5 s, fast 2 s, start 3 s"],
                  ["Upgrader", "Wager Credits for a chance at a dearer item.", `Prize on offer = wager × (1 − fee) ÷ chance. A roll below the chance wins. Fee ${pct(UPGRADER_DEFAULT.fee, 0)} caps the chance at ${pct(UPG_CAP, 0)}.`, pct(1 - UPGRADER_DEFAULT.fee, 0), `upgrader_fee ${UPGRADER_DEFAULT.fee}; options ${UPGRADER_DEFAULT.chanceOptions.map((o) => pct(o, 0)).join(", ")}`],
                  ["Mines", `${MINES_DEFAULT.totalTiles} tiles; choose the mines and a wager; reveal tiles; cash out before a mine.`, "Mines placed by a Fisher–Yates shuffle fed by the roll recipe, one step per tile. Multiplier = fair survival odds × (1 − edge).", "1 − edge (edge not visible; 8% assumed)", "wager 1 to 1,000; max win 25,000"],
                  ["Crash", "A multiplier climbs; cash out before it crashes.", `Crash point = (1 − ${CRASH_DEFAULT.houseEdge}) ÷ (1 − roll), never below 1.00, capped at ${num(CRASH_DEFAULT.maxMultiplier)}. Seeds form a chain published ahead.`, pct(1 - CRASH_DEFAULT.houseEdge, 0), `crash_house_edge ${CRASH_DEFAULT.houseEdge}; max win ${num(CRASH_DEFAULT.maxWinnable)}`],
                ].map(([g, w, r, ret, st]) => (
                  <tr key={g} className="border-t border-line align-top">
                    <Td>
                      <b>{g}</b>
                    </Td>
                    <Td>{w}</Td>
                    <Td>{r}</Td>
                    <Td right mono>
                      {ret}
                    </Td>
                    <Td mono>{st}</Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
          <Legend
            items={[
              ["The rule", "The sum the site does, in words, taken from its own pages and client code (sources below)."],
              ["Return", "What a player gets back per Credit wagered, on average, over many plays. For boxes and battles it is at listed prices; in Credits it is 90% of that."],
              ["Settings seen", "Values read from the settings block every Jemlit page sends to the browser."],
            ]}
          />
          <P>
            <b>Why the return never changes with how you play.</b> In Mines and Crash the multiplier is the fair odds times (1 − edge), so chance × multiplier is always 1 − edge. Cash out early and often or late and rarely; the average is the same, only the swing differs. In the Upgrader chance × prize is always wager × (1 − fee). In a battle the house keeps the box&apos;s 20% on every open and the players only move the rest between themselves.
          </P>
          <Card title="Mines: the multiplier with 3 mines on 25 tiles">
            <div className="tbl"><table className="w-full max-w-lg text-xs">
              <thead>
                <tr>
                  <Th right>Safe tiles</Th>
                  <Th right>Chance to get there</Th>
                  <Th right>Multiplier</Th>
                  <Th right>Chance × multiplier</Th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 5, 8, 12].map((k) => (
                  <tr key={k} className="border-t border-line">
                    <Td right mono>
                      {k}
                    </Td>
                    <Td right mono>
                      {pctSmart(minesSurvival(25, 3, k))}
                    </Td>
                    <Td right mono>
                      ×{minesMultiplier(25, 3, k, MINES_DEFAULT.houseEdge).toFixed(2)}
                    </Td>
                    <Td right mono>
                      {(minesSurvival(25, 3, k) * minesMultiplier(25, 3, k, MINES_DEFAULT.houseEdge)).toFixed(2)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <P>First tile: 22 safe out of 25, so the fair multiplier is 25 ÷ 22 = ×1.136; less 8% it is ×{minesMultiplier(25, 3, 1, MINES_DEFAULT.houseEdge).toFixed(3)}. Each further tile multiplies by (tiles left ÷ safe tiles left).</P>
          </Card>
          <Card title="Crash: how often a round reaches a target">
            <div className="tbl"><table className="w-full max-w-lg text-xs">
              <thead>
                <tr>
                  <Th right>Cash out at</Th>
                  <Th right>Chance the round gets there</Th>
                  <Th right>1 in</Th>
                  <Th right>Chance × multiplier</Th>
                </tr>
              </thead>
              <tbody>
                {[1.5, 2, 5, 10, 100].map((t) => (
                  <tr key={t} className="border-t border-line">
                    <Td right mono>
                      ×{t.toFixed(2)}
                    </Td>
                    <Td right mono>
                      {pct(crashProbAtLeast(t, CRASH_DEFAULT.houseEdge))}
                    </Td>
                    <Td right mono>
                      {num(Math.round(1 / crashProbAtLeast(t, CRASH_DEFAULT.houseEdge)))}
                    </Td>
                    <Td right mono>
                      {(crashProbAtLeast(t, CRASH_DEFAULT.houseEdge) * t).toFixed(2)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <P>The chance of reaching ×m is (1 − 0.08) ÷ m. The round shows ×1.00 and takes everything 8% of the time.</P>
          </Card>
          <Card title="Upgrader: what $10 buys at each chance">
            <div className="tbl"><table className="w-full max-w-lg text-xs">
              <thead>
                <tr>
                  <Th right>Chance</Th>
                  <Th right>Item worth</Th>
                  <Th right>Chance × worth</Th>
                </tr>
              </thead>
              <tbody>
                {UPGRADER_DEFAULT.chanceOptions.map((o) => Math.min(o, UPG_CAP)).map((o) => (
                  <tr key={o} className="border-t border-line">
                    <Td right mono>
                      {pct(o, 0)}
                    </Td>
                    <Td right mono>
                      {money(upgraderTarget(10, o, UPGRADER_DEFAULT))}
                    </Td>
                    <Td right mono>
                      {money(o * upgraderTarget(10, o, UPGRADER_DEFAULT))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <P>Whatever the chance, chance × worth = $10 × 0.85 = $8.50. The 92% option is clipped to 85% because the cap is 1 − fee.</P>
          </Card>
          <Ul>
            <li>
              <b>Not visible from outside:</b> the Mines house edge (the client multiplies by 1 − house_edge but the value comes from the server), the battle alliance mode, the exact prize lists the Upgrader and Crash offer, and the borrow and claims terms.
            </li>
            <li>
              <b>Simulator tabs:</b>{" "}
              <Link href="/operators/jemlit" className="text-accent-ink underline underline-offset-2">
                Packs, Battles, Upgrader, Mines and Crash
              </Link>
              , each with the maths, the step-by-step decision and the check after a play.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="sources">11. Sources</H2>
          <P>All from Jemlit&apos;s public pages and its front API on {JEMLIT_CAPTURED}, saved and parsed by a script. Nothing guessed.</P>
          <Card>
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Fact</Th>
                  <Th>Where</Th>
                  <Th>Saved copy</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  { fact: `${JEMLIT_SUMMARY.length} boxes, names and prices`, where: <>The box listing API, <code>front/api/en/pages/all-boxes</code>, linked from <Ext href={`${SITE}/en/boxes`}>/en/boxes</Ext>.</>, copy: <Ext href="/captures/jemlit-all-boxes-2026-10-14.json">jemlit-all-boxes-2026-10-14.json</Ext> },
                  { fact: "Every item, its chance, its band, price and cashback", where: <>The box API <code>front/api/en/box/&lt;slug&gt;</code>, the same data the box page embeds as <code>window.jemlit.spaPageData</code>: fields <code>chance</code>, <code>outcome_from</code>, <code>outcome_to</code>, <code>price</code>, <code>cashback</code>, <code>is_auto_cashback</code>, <code>is_shippable</code>.</>, copy: <><Ext href="/captures/jemlit/apple-ebox.json">apple-ebox.json</Ext>, one file per box under /captures/jemlit/</> },
                  { fact: "The recipe", where: <><Ext href={`${SITE}/en/provably-fair/algorithm`}>/en/provably-fair/algorithm</Ext>: SHA-512 hash of the server seed; HMAC-SHA512/256 with the server seed as key over &quot;clientSeed-nonce&quot;; hexdec ÷ 16^64 × 100; wins if higher than the lower bound and lower or equal to the upper. Worked example on the page: hash 38611068…, roll 22.0231.</>, copy: <Ext href="/captures/jemlit-provably-fair-algorithm-2026-10-14.html">jemlit-provably-fair-algorithm-2026-10-14.html</Ext> },
                  { fact: "Credits and exchange", where: <><Ext href={`${SITE}/en/terms-and-conditions`}>/en/terms-and-conditions</Ext>: &quot;the credits received are not worth real money&quot;; &quot;valid for one year&quot;; exchange &quot;reduced by a percentage between 0% and 30%&quot;; no cash refund. <Ext href={`${SITE}/en/faqs`}>/en/faqs</Ext>: &quot;No, it&apos;s not possible to exchange Jemlit Credits for real money.&quot;</>, copy: <Ext href="/captures/jemlit-terms-2026-10-14.html">jemlit-terms-2026-10-14.html</Ext> },
                  { fact: "Deposit rate, free boxes, levels", where: <><Ext href={`${SITE}/en/how-it-works`}>/en/how-it-works</Ext> ($1.12 = €1); <Ext href={`${SITE}/en/free-mystery-box`}>/en/free-mystery-box</Ext> (one free box a day, levels from 2,500 XP).</>, copy: "research/captures (workspace)" },
                  { fact: "Platform settings", where: <>The <code>window.jemlit</code> settings block in every page.</>, copy: "section 9, from the saved box page" },
                  { fact: "Operator", where: <>JLT Digital Media Ltd, Nicosia, Cyprus; terms &quot;subject to the laws of the United Kingdom&quot; (dossier 1 §2.2).</>, copy: "terms page" },
                  { fact: "The sums on this page", where: <>Computed live by <Ext href="https://github.com/Optinet-Solutions-AI/mys_sim/blob/main/src/engine/labs/jemlit.ts">src/engine/labs/jemlit.ts</Ext> from <code>jemlitLive.generated.ts</code>. The engine reproduces Jemlit&apos;s published example exactly (section For developers).</>, copy: "GitHub" },
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
            </table></div>
          </Card>
          <Ul>
            <li>
              <b>Not done:</b> no paid open; no real seed rotated and checked on Jemlit&apos;s page; the account area, the Upgrader, Battles, Crash, borrow and claims were not captured.
            </li>
            <li>
              <b>Assumptions:</b> resale share {pct(V.itemRealized, 0)}; a Credit worth {money(V.creditReal)} (section 5); that listed prices are retail prices.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="critique">12. Critique</H2>
          <P>
            <b>Confirmed, and good.</b>
          </P>
          <Ul>
            <li>The recipe is published in full, with a worked example, and it reproduces. The bands are printed on every box page.</li>
            <li>Exact chances are in the page data and they add up to 1.</li>
            <li>Cashback per item is printed. The 10% exchange haircut is visible before you play.</li>
            <li>The 80% target is consistent across {n80} boxes: a stated policy in all but name.</li>
          </Ul>
          <P>
            <b>Where the presentation flatters the numbers.</b>
          </P>
          <Ul>
            <li>80% is at Jemlit&apos;s listed prices. Generic accessories at $4 to $12 carry most of the return; at resale they are worth a fraction, and most will be exchanged for Credits anyway.</li>
            <li>Credits look like dollars (box prices are in Credits) but only buy more boxes and expire after a year. Really about {money(wResale, 2)} each.</li>
            <li>Ten headline items at one in a million each are the poster; together they are {pct(headCost / m.evPrice, 1)} of the payout.</li>
            <li>Sign-up offers (&quot;up to 10 free boxes + a 50% bonus&quot;), daily free boxes by XP level, deposit coupons and a 15-minute &quot;30% more Credits instead of shipping&quot; offer are retention mechanics on top of the box.</li>
          </Ul>
          <P>
            <b>Possible, unprovable.</b> No evidence Jemlit does any of these; the check could not show it.
          </P>
          <Ul>
            <li>Different bands for different players or over time: only the seed is committed.</li>
            <li>The default client seed is made by the site&apos;s own script; a player who never changes it trusts the site with both inputs.</li>
            <li>A seed can serve for hundreds of opens; nothing can be checked until the player rotates it, and nothing forces a rotation.</li>
            <li>A borrow feature up to 90% and a claims feature with fees appear in the settings; what they do is not public.</li>
          </Ul>
          <P>
            <b>What could be done better.</b>
          </P>
          <Ul>
            <li>Commit the table: hash the bands into the open, as Misty does, and publish a log of table versions.</li>
            <li>Rotate the seed every open, or at least publish the next hash on every open, so a check never waits.</li>
            <li>Let the player set the client seed before the server seed is shown, and say so.</li>
            <li>Show an independent market value next to the listed price, and the return in Credits next to the return at listed prices.</li>
            <li>No loans to players.</li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="developers">For developers</H2>
          <Ul>
            <li>
              <b>Commitment:</b> SHA-512 of the server seed, hex.
            </li>
            <li>
              <b>Digest:</b> HMAC-SHA512/256 with the server seed as key over the UTF-8 string &quot;clientSeed-nonce&quot;.
            </li>
            <li>
              <b>Roll:</b> the 64-hex digest as an integer ÷ 2^256 × 100. Use big integers; a double loses the low bits.
            </li>
            <li>
              <b>Resolve:</b> bands are the running sum of the chances in stored order, on a 0 to 100 line; the item with lower &lt; roll ≤ upper wins.
            </li>
            <li>
              <b>Published vector:</b> key &quot;{pub.serverSeed}&quot;, data &quot;{pub.clientSeed}-{pub.nonce}&quot; → <code className="break-all">{pubDigest}</code>, roll {pubRoll.toFixed(4)}. Jemlit&apos;s page shows 38611068f6936027c4657138536fb5bb8f82a6cb2d883f1acb47cb24013f9e93 and 22.0231.
            </li>
            <li>
              <b>Commitment of &quot;server seed&quot;:</b> <code className="break-all">{jemlitCommit(pub.serverSeed)}</code>
            </li>
            <li>
              Engine: <Ext href="https://github.com/Optinet-Solutions-AI/mys_sim/blob/main/src/engine/labs/jemlit.ts">src/engine/labs/jemlit.ts</Ext>; data: <code>src/engine/jemlitLive.generated.ts</code>; the Misty developer page and kit apply with the recipe swapped.
            </li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="glossary">Glossary</H2>
          <dl className="grid max-w-[80ch] gap-x-6 gap-y-2 text-sm leading-6 text-ink-2 sm:grid-cols-2">
            {[
              ["Chance", "An item's share of opens, as a fraction. A box's chances add up to 1."],
              ["Band", "An item's stretch of the 0 to 100 line, printed on the page under See rolls."],
              ["Roll", "The number from 0 to 100 that decides one open."],
              ["Cost per open", "Price × chance: what an item costs the operator per open on average."],
              ["Pays back per open", "All costs per open added. ÷ price = return (RTP)."],
              ["At listed", "Items at Jemlit's listed prices, Credits at $1."],
              ["In Credits", "Items at their cashback: what you get if you exchange everything."],
              ["Really", "Credits at what they cost the operator, shipped items at resale."],
              ["Credit", "Jemlit's site balance. Buys boxes and games, never money, expires after a year."],
              ["Cashback", "The Credits an item exchanges for: 90% of its listed price on the live tables."],
              ["Server seed", "The site's secret for a run of opens. Hashed and shown first; revealed when rotated."],
              ["Client seed", "A string from your browser that you can change; goes into every roll."],
              ["Nonce", "The play count under one server seed: 1, 2, 3…"],
              ["Rotate", "Ask for a new server seed; the old one is revealed so its opens can be checked."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-ink">{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
          <div className="pt-2">
            <Badge>Version 1.0 · {JEMLIT_CAPTURED} capture · sums computed live</Badge>
          </div>
        </section>
      </div>
      <DocsToc toc={TOC} back={{ href: "/operators/jemlit", label: "← Back to the Jemlit mystery box" }} links={[{ href: "/docs/misty", label: "Misty, explained →" }, { href: "/simulate?src=jemlit", label: "Simulator →" }]} />
    </div>
  );
}
