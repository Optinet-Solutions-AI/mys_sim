import Link from "next/link";
import { DocsToc } from "@/components/DocsToc";
import { ICYBOX_BOXES, ICYBOX_CAPTURED, bandMax, bandMin, icyboxMath } from "@/engine/labs/icybox";
import { icyboxConfigFor } from "@/lib/icyboxPresets";
import { money, num, oneIn, pct } from "@/lib/format";
import { Badge, Card, Td, Th } from "@/components/ui";
import { CollapsibleTable } from "@/components/CollapsibleTable";

export const metadata = { title: "IcyBox, explained · Simulator" };

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
function Tag({ kind }: { kind: "known" | "reported" | "assumed" }) {
  return <Badge tone={kind === "known" ? "good" : kind === "reported" ? "warn" : "neutral"}>{kind}</Badge>;
}

const TOC = [
  ["in-short", "In short"],
  ["known", "1. What IcyBox says"],
  ["boxes", "2. The five boxes"],
  ["bands", "3. The Ruby Box, band by band"],
  ["one-open", "4. One open, step by step"],
  ["buyback", "5. The buyback loop"],
  ["drops", "6. Limited drops and the operator exit"],
  ["proof", "7. The proof that is not there"],
  ["reported", "8. Reviews and reports"],
  ["back-office", "9. Back office in the simulator"],
  ["sources", "10. Sources"],
  ["critique", "11. Critique"],
  ["glossary", "Glossary"],
] as const;

export default function IcyboxDocsPage() {
  const ruby = ICYBOX_BOXES.find((b) => b.slug === "ruby") ?? ICYBOX_BOXES[0];
  const rcfg = icyboxConfigFor(ruby);
  const rm = icyboxMath(ruby, rcfg.chances, rcfg);
  const rows = ICYBOX_BOXES.map((b) => {
    const cfg = icyboxConfigFor(b);
    const m = icyboxMath(b, cfg.chances, cfg);
    return { b, m };
  });
  const sellBackReturn = 0.85 * rcfg.buybackPercent;

  return (
    <div className="mx-auto flex max-w-6xl flex-col pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
      <div className="min-w-0 space-y-8">
        <header className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">IcyBox · mystery boxes</div>
          <h1 className="text-3xl font-semibold">How an IcyBox box works</h1>
          <P>
            IcyBox is an iOS-only app with no web catalogue, so this is built from public sources captured on {ICYBOX_CAPTURED}: the website, the terms, the App Store listing and reviews, two press releases and review sites. Every number carries a tag: <Tag kind="known" /> the operator&apos;s own words, <Tag kind="reported" /> users and reviewers, <Tag kind="assumed" /> our reconstruction, editable in the simulator. Sources in section 10.
          </P>
        </header>

        <section className="space-y-3">
          <H2 id="in-short">In short</H2>
          <Ul>
            <li>
              <Tag kind="known" /> Five boxes from $50 to $1,000. Six rarity bands from Grail down to Common. A chance and a value range per band shown before buying. Every box pays a watch or a bag.
            </li>
            <li>
              <Tag kind="known" /> Sell it back or keep it. The buyback offer is &quot;determined solely by IcyBox&quot;, not negotiable, formula not disclosed. Miss the buyback period and it is sold back automatically. Keeping costs shipping and tax and takes 15 to 20 business days. Cash-out minimum $6, fees by method.
            </li>
            <li>
              <Tag kind="known" /> No server seed, no hash, no client seed, no verifier. A box &quot;may be terminated or removed at any time even before all Assets included in the Icebox are distributed&quot;.
            </li>
            <li>
              <Tag kind="reported" /> Buyback about 90% of the listed value. Grail odds roughly 0.4% to 3% by box. Shipping about $30 to $32 with tax. Listed values above resale. The grail band runs from a $140 Seiko to a $7,000 Cartier.
            </li>
            <li>
              <Tag kind="assumed" /> The band chances (fitted so each box returns 85% at listed values), the items in each band, a 72-hour window, and how players split between keeping and selling back.
            </li>
          </Ul>
          <P>
            <b>In one sentence:</b> a buyback loop. Most wins become balance, balance buys the next box, and money leaves only when a player withdraws or pays to ship.
          </P>
        </section>

        <section className="space-y-3">
          <H2 id="known">1. What IcyBox says about itself</H2>
          <Card>
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th>Words</Th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["icybox.io home", "“Boxes from $50 to $1,000. Every one holds real watches and bags from the world's leading brands.” “Keep it, sell it, ship it. Have it delivered, or sell it back to IcyBox instantly and put the balance into your next box.” “Limited edition boxes, once they're gone, they're gone.” Stats on the page: 4.3 rating, 75K+ grails pulled, 3,500+ product catalog."],
                  ["icybox.io FAQ", "“Every box purchase includes a watch. Tap a box to see its pull odds and item value range before buying.” “Tap any box to view the pull odds modal showing the probability and value range for each rarity tier before buying.” Three actions: keep, sell, ship. “Orders typically take 15-20 business days to ship from our fulfillment center.” “Minimum withdrawal is $6. Fees vary by method.”"],
                  ["Terms, 3 March 2026, §3", "“The Asset included in an Icebox and the probability of receiving a specific Asset is made available on the Platform.” “Any Icebox may be terminated or removed at any time even before all Assets included in the Icebox are distributed.” “The purchase of an Icebox is a FINAL SALE.”"],
                  ["Terms §4 and §5", "“Any Buyback Offer made is determined solely by IcyBox and is not subject to negotiation or debate.” “We do not disclose how we calculate the Buyback Price.” “The Asset will be automatically sold back to us if you fail to ship the Asset within the time period specified on the Platform.” “No reversal, refunds, or other changes will be permitted after the Buyback Period expires.”"],
                  ["Terms §8 and §12", "Stripe is the payment processor. Prices exclude sales tax and shipping. Third-party pricing data is not warranted. Delaware law. InfiniteEdge Inc., 251 Little Falls Drive, Wilmington, DE 19808."],
                  ["App Store", "Shopping category, 18+, “Contains: Loot Boxes”, 7.1K ratings at 4.3. Open digital boxes to reveal luxury items; sell back or ship; keep unshipped items in a collection for a limited time; “transparent odds”; items may not be new. Versions: limited drop boxes (June), Amber & Tanzanite Box (July), v3 with rarity tiers and collecting (August)."],
                  ["Press releases, 2 Sep and 1 Oct 2026", "Launched April 2026; hundreds of thousands of U.S. downloads; “five tiers, from Bronze up to the flagship Icy box, with minimum and maximum values disclosed upfront”; “six bands, from Grail down to Common”; prizes from Swatch and Citizen to Rolex, Patek Philippe and Audemars Piguet, some over $100,000; a live public feed of pulls; a leaderboard; handbags added; Android in preparation."],
                ].map(([s, w]) => (
                  <tr key={s} className="border-t border-line align-top">
                    <Td>
                      <b>{s}</b>
                    </Td>
                    <Td>{w}</Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
        </section>

        <section className="space-y-3">
          <H2 id="boxes">2. The five boxes</H2>
          <P>
            <Tag kind="known" /> Prices and tier names. <Tag kind="known" /> The six values per tier come from the website&apos;s box carousel and are used as the grail band. <Tag kind="assumed" /> Everything else in the table: the band chances are fitted so each box returns 85% of its price at listed values; the app&apos;s odds modal is the source of truth.
          </P>
          <Card>
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Box</Th>
                  <Th right>Price</Th>
                  <Th right>Grail</Th>
                  <Th right>Worth the price or more</Th>
                  <Th right>Pays back per open</Th>
                  <Th right>RTP listed</Th>
                  <Th right>If sold back</Th>
                  <Th right>Really</Th>
                  <Th>Carousel values</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ b, m }) => (
                  <tr key={b.slug} className="border-t border-line">
                    <Td>
                      <b>{b.name}</b>
                    </Td>
                    <Td right mono>{money(b.price)}</Td>
                    <Td right mono>{oneIn(m.pGrail)}</Td>
                    <Td right mono>{oneIn(m.pAtOrAbovePrice)}</Td>
                    <Td right mono>{money(m.evListed, 2)}</Td>
                    <Td right mono>{pct(m.returnListed)}</Td>
                    <Td right mono>{pct(m.returnBuyback)}</Td>
                    <Td right mono>{pct(m.returnReal)}</Td>
                    <Td mono>{b.showcase.map((v) => money(v)).join(", ")}</Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
          <Legend
            items={[
              ["Grail", "The fitted chance of the top band, as 1 in N."],
              ["Worth the price or more", "The chance of any item listed at or above the box price."],
              ["Pays back per open", "Value × chance for every band, added up: what the box hands out per open at the values the app lists."],
              ["RTP listed", "Pays back per open divided by the price. Fitted to 85%; the app's real figure is unknown."],
              ["If sold back", "The same at the buyback rate (90% reported): what a player who sells everything back gets per dollar."],
              ["Really", "Kept winners at 60% resale minus shipping and tax, everything else sold back. Assumptions."],
              ["Carousel values", "The six item values the website shows for this tier (captured)."],
            ]}
          />
        </section>

        <section className="space-y-3">
          <H2 id="bands">3. The Ruby Box, band by band</H2>
          <P>
            <Tag kind="assumed" /> Example items are named from the site&apos;s own ticker where the values match and from reviews otherwise; the chances are fitted. The shape is what the app shows: six bands, a chance and a value range each.
          </P>
          <Card>
            <div className="tbl"><table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Band</Th>
                  <Th right>Chance</Th>
                  <Th right>1 in</Th>
                  <Th right>Value range</Th>
                  <Th>Example items</Th>
                  <Th right>Costs per open</Th>
                </tr>
              </thead>
              <tbody>
                {[...rm.perBand].reverse().map((pb) => {
                  const band = ruby.bands.find((x) => x.id === pb.id)!;
                  return (
                    <tr key={pb.id} className="border-t border-line align-top">
                      <Td>
                        <span className={`misty-rarity misty-${pb.id}`}>{pb.label}</span>
                      </Td>
                      <Td right mono>{pct(pb.share, 3)}</Td>
                      <Td right mono>{pb.share > 0 ? num(Math.round(1 / pb.share)) : "never"}</Td>
                      <Td right mono>
                        {money(bandMin(band))} to {money(bandMax(band))}
                      </Td>
                      <Td>{band.items.map((i) => `${i.label} (${money(i.value)})`).join(", ")}</Td>
                      <Td right mono>{money(pb.costPerOpen, 2)}</Td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-ink bg-accent-soft font-semibold">
                  <Td>Total</Td>
                  <Td right mono>100%</Td>
                  <Td right> </Td>
                  <Td right> </Td>
                  <Td>
                    against a price of {money(ruby.price)}: IcyBox keeps {money(ruby.price - rm.evListed, 2)} per open at listed values, {money(ruby.price - rm.evBuyback, 2)} if everything is sold back
                  </Td>
                  <Td right mono>{money(rm.evListed, 2)}</Td>
                </tr>
              </tbody>
            </table></div>
          </Card>
        </section>

        <section className="space-y-3">
          <H2 id="one-open">4. One open, step by step</H2>
          <ol className="max-w-[72ch] list-decimal space-y-2 pl-5 text-sm leading-6 text-ink-2">
            <li>
              Deposit (Stripe), pick a box. Tap it: a modal shows the chance and the value range for each of six bands. <Tag kind="known" />
            </li>
            <li>
              Pay and swipe. The app&apos;s server picks a band and an item. There is no hash before and no seed after; nobody outside can see how. <Tag kind="known" />
            </li>
            <li>
              The item appears with a listed value. It is IcyBox&apos;s figure. <Tag kind="reported" /> It runs above resale.
            </li>
            <li>
              Choose: sell back at the offer IcyBox sets (<Tag kind="reported" /> about 90% of the listed value), keep it in the collection for a limited window, or ship it and pay shipping, insurance and tax (<Tag kind="reported" /> about $30 to $32; <Tag kind="known" /> 15 to 20 business days).
            </li>
            <li>
              Say nothing until the buyback period ends and it is sold back for you. Final. <Tag kind="known" /> The length of the period is not published. <Tag kind="assumed" /> 72 hours in the simulator.
            </li>
            <li>
              Balance buys the next box, or is withdrawn: <Tag kind="known" /> minimum $6, fees by method; <Tag kind="reported" /> $2, to bank or Venmo.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <H2 id="buyback">5. The buyback loop</H2>
          <P>The buyback is the engine. On a box that pays back 85% at listed values, a player who sells everything back at 90% gets {pct(sellBackReturn)} of the price back per open: 15 points kept by the box, 8.5 more by the buyback. A player who keeps a winner pays shipping and tax for an item that sells for less than its listed value. Either way the listed figures never turn into that much money, and every sell-back leaves the balance inside the app, where the next box is one tap away.</P>
          <Card>
            <div className="tbl"><table className="w-full max-w-xl text-xs">
              <tbody>
                {[
                  ["Ruby Box pays back per open at listed", money(rm.evListed, 2)],
                  ["Sold back at 90%", `${money(rm.evBuyback, 2)} (${pct(rm.returnBuyback)} of ${money(ruby.price)})`],
                  ["IcyBox keeps per open if everything is sold back", money(ruby.price - rm.evBuyback, 2)],
                  ["Really, with 30% of winners kept at 60% resale minus fees", `${money(rm.evReal, 2)} (${pct(rm.returnReal)})`],
                ].map(([k, v]) => (
                  <tr key={k} className="border-t border-line">
                    <Td>{k}</Td>
                    <Td right mono>{v}</Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
          <P>
            Reviews describe it in the same words: &quot;the sell-back loop keeps money inside the platform&quot;; &quot;like slot machines&quot;; &quot;fun, hard to stop&quot;. <Tag kind="reported" />
          </P>
        </section>

        <section className="space-y-3">
          <H2 id="drops">6. Limited drops and the operator exit</H2>
          <P>
            <Tag kind="known" /> &quot;Limited edition boxes, once they&apos;re gone, they&apos;re gone&quot;: a finite stock drawn without replacement, so the odds move as the drop sells, and the odds shown at the start describe the stock, not any one open. <Tag kind="known" /> The terms allow IcyBox to end a box before all its items are distributed, grail included.
          </P>
          <P>In the simulator a drop of 1,000 copies retired at 70% sold leaves about a third of its grail copies unshipped, and no player can tell from outside whether the grail was still inside when the box vanished. This is the one mechanic that no amount of published odds can make honest; only a public commitment to the stock, and a rule that the grail must be distributed, would.</P>
        </section>

        <section className="space-y-3">
          <H2 id="proof">7. The proof that is not there</H2>
          <P>Misty commits a secret per open and reveals it; Jemlit commits one per session and rotates it; both let a player recompute an open. IcyBox offers the odds modal and nothing else. What a player can do is count: over many opens the share of each band should match the modal. One player cannot; a thousand comparing notes could.</P>
          <P>An operator that publishes odds but no commitment asks to be trusted on the one point that matters.</P>
        </section>

        <section className="space-y-3">
          <H2 id="reported">8. Reviews and reports</H2>
          <P>
            <Tag kind="reported" /> None of this is verified. It is what users and reviewers wrote, kept because it is the only view inside the app.
          </P>
          <CollapsibleTable
            head={["Topic", "What was reported", "Where"]}
            rows={[
              ["Buyback", "$275 → $247.50 and $315 → $283.50 (90.0%); $55 → $49 (89%)", "MyMillennialGuide; App Store review"],
              ["Grail odds", "roughly 0.4% to 3% by box; 3% on the $250 box; 2.4% cited for one pull; grail includes $500 watches while marketing shows $10k to $15k pieces", "review sites; App Store reviews"],
              ["Typical values", "$50 box $40 to $60; $100 box $60 to $500; $250 box $100 to $500 with occasional $10k+; $500 box $200 to $600", "Tuned & Groomed (buyer reports)"],
              ["Spend and outcome", "$950 in, $300 down; $3,000 for three grails on $100 boxes; under $300 in, over $1,000 out and cashed out; $500 in, watches worth 10 to 25% of box price; 13 watches shipped (common $22, uncommons $49 and $67, rares $59 and $90, epic $155)", "App Store and aggregator reviews"],
              ["Fees and timing", "shipping $31.95 with tax; about $30 per item; 3 to 4 days (one), a week or two (others); $2 withdrawal fee; SSN and date of birth asked at withdrawal (one)", "reviews"],
              ["Trust", "App Store 4.3 from 7.1K ratings; an aggregator's review-text score 33.3/100; a scam-detector score of 24.2/100 for icybox.io", "App Store; JustUseApp; Bynudge"],
              ["Problems", "address rejected; funds stuck after a withdrawal request; a different watch delivered than the one won; a cheaper watch substituted", "reviews"],
            ]}
            initial={3}
            noun="topics"
          />
        </section>

        <section className="space-y-3">
          <H2 id="back-office">9. Back office in the simulator</H2>
          <P>
            The <Link href="/operators/icybox" className="text-accent-ink underline underline-offset-2">IcyBox page</Link> plays the reconstruction in the same format as Misty and Jemlit. The cog opens the back office: the chance per band with a fit-to-target button; the limited drop (copies, retire at a share sold); buyback rate, window, miss rate, keep rate, shipping, tax, withdrawal minimum and fee, resale share; and a proof tab that says, correctly, that there is nothing to switch on. The{" "}
            <Link href="/simulate?src=icybox" className="text-accent-ink underline underline-offset-2">simulator</Link> opens 200,000 boxes in plain or drop mode and reports the return at listed, if sold back and really, the grail rate, the band counts against the stated odds, and in drop mode the grails left behind by early retirement.
          </P>
        </section>

        <section className="space-y-3">
          <H2 id="sources">10. Sources</H2>
          <Ul>
            <li>
              <Ext href="https://www.icybox.io/">icybox.io</Ext> (home, FAQ, stats, item ticker, carousel values in the client bundle), <Ext href="https://www.icybox.io/terms">terms</Ext> (3 March 2026), <Ext href="https://www.icybox.io/privacy">privacy</Ext>, <Ext href="https://www.icybox.io/support">support</Ext> (article titles only; the articles open in the app). Saved under research/captures as icybox-home, icybox-home-client, icybox-terms (html and txt), icybox-privacy, icybox-support, all dated {ICYBOX_CAPTURED}.
            </li>
            <li>
              <Ext href="https://apps.apple.com/us/app/icybox/id6758816716">App Store listing</Ext> and its <Ext href="https://apps.apple.com/us/app/icybox/id6758816716?see-all=reviews&platform=iphone">reviews</Ext>.
            </li>
            <li>
              Press: <Ext href="https://www.webdisclosure.com/press-release/icybox-expands-watch-collecting-with-digital-mystery-boxes-Y88nZSlbN1z">2 September 2026</Ext>; <Ext href="https://www.manilatimes.net/2026/10/01/tmt-newswire/globenewswire/icybox-expands-from-luxury-watches-into-handbags/2437185">1 October 2026</Ext> (also on <Ext href="https://fortune.com/press-releases/icybox-expands-into-luxury-handbags-following-app-store-growth-2026-10-01/">Fortune</Ext>); <Ext href="https://chainwire.org/2026/07/29/icybox-expands-luxury-watch-mystery-box-platform-into-web3/">29 July 2026, Web3</Ext> (not retrievable on the day).
            </li>
            <li>
              Reviews: <Ext href="https://www.mymillennialguide.com/icybox-review/">MyMillennialGuide</Ext> (affiliate), <Ext href="https://www.tunedandgroomed.com/article-icybox-review.html">Tuned &amp; Groomed</Ext> (partner), <Ext href="https://bynudge.com/is/icybox-legit">Bynudge</Ext>, <Ext href="https://justuseapp.com/en/app/6758816716/icybox/reviews">JustUseApp</Ext>, <Ext href="https://x.com/icyboxapp">@icyboxapp on X</Ext>, <Ext href="https://www.tiktok.com/@icyboxapp">TikTok</Ext> (not retrievable).
            </li>
            <li>Earlier: dossier 1 §2.4 (second-wave audit), dossier 2 §3.4. The research document is research/09-icybox-mechanism.md.</li>
            <li>Not done: no account, no purchase, no capture of the in-app odds modal or of a drop&apos;s stock. If the odds screen is ever captured, replace the fitted chances in the engine and regenerate.</li>
          </Ul>
        </section>

        <section className="space-y-3">
          <H2 id="critique">11. Critique</H2>
          <P>
            <b>Confirmed and good:</b> odds and value ranges per band before purchase; every box pays an item; a physical fulfilment path with tracking; a public catalogue of real brands; terms that are explicit about the buyback and the operator exit.
          </P>
          <P>
            <b>Weak:</b> no commitment of any kind, so the published odds are a claim, not a proof; a buyback rate the operator sets and will not explain, applied automatically when a player goes quiet; listed values that reviews say run above resale, which inflates both the odds screen and the buyback base; a grail band wide enough to make the headline odds misleading; finite drops that can be ended with the grail inside; fees to keep that push most wins back into balance; a wallet whose credit and withdrawable parts are explained only inside the app.
          </P>
          <P>
            <b>What a better version would do:</b> publish the stock of every limited drop and commit to it; promise that a retired drop&apos;s grail is drawn among its buyers; publish the buyback formula and a market reference next to the listed value; disclose the fulfilment time on the odds screen; add a per-open commitment, which costs nothing and would end the trust argument.
          </P>
        </section>

        <section className="space-y-3">
          <H2 id="glossary">Glossary</H2>
          <dl className="grid max-w-[78ch] gap-x-6 gap-y-2 text-sm leading-6 text-ink-2 md:grid-cols-2">
            {[
              ["Band", "One of six rarity groups, Common to Grail; the app shows a chance and a value range per band."],
              ["Buyback", "IcyBox's offer to take a won item back for balance; set by IcyBox, undisclosed, reported around 90% of the listed value."],
              ["Buyback period", "The time to decide; after it the item is sold back automatically. Length not published."],
              ["Drop", "A limited-edition box with a finite stock; once sold out it is gone, and the terms let IcyBox end it earlier."],
              ["Listed value", "The dollar figure the app shows for an item; IcyBox's own, not a market price."],
              ["Reconstructed", "Numbers we set because the app's own were not captured: band chances, items, the window, keep and sell behaviour. All editable in the simulator."],
            ].map(([t, d]) => (
              <div key={t}>
                <dt className="font-semibold text-ink">{t}</dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <DocsToc toc={TOC} back={{ href: "/operators/icybox", label: "← Back to IcyBox mystery boxes" }} />
    </div>
  );
}
