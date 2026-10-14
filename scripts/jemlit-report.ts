// Writes research/08-jemlit-box-mechanism.md from the generated Jemlit data, so the document and the app agree.
// Run: npx -y tsx scripts/jemlit-report.ts ../research/08-jemlit-box-mechanism.md
import { writeFileSync } from "node:fs";
import { JEMLIT_CAPTURED, JEMLIT_FEATURED, JEMLIT_SETTINGS, JEMLIT_SUMMARY } from "../src/engine/jemlitLive.generated";
import { jemlitDigest, jemlitMath, jemlitRoll } from "../src/engine/labs/jemlit";

const out = process.argv[2] ?? "jemlit-report.md";
const V = { creditFace: 1, creditReal: 0.4, itemRealized: 0.7 };
const money = (v: number, dp = 2) => "$" + v.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (v: number, dp = 1) => (v * 100).toFixed(dp) + "%";
const oneIn = (p: number) => (p > 0 ? "1 in " + Math.round(1 / p).toLocaleString("en-US") : "never");
const box = JEMLIT_FEATURED.find((b) => b.slug === "apple-ebox")!;
const m = jemlitMath(box, undefined, V);
const rows = [...m.perItem].sort((a, b) => b.share - a.share);
const n80 = JEMLIT_SUMMARY.filter((b) => b.rtpPrice != null && Math.abs(b.rtpPrice - 0.8) < 0.005).length;
const others = JEMLIT_SUMMARY.filter((b) => b.rtpPrice != null && Math.abs(b.rtpPrice - 0.8) >= 0.005);
const head = box.items.filter((i) => i.chance <= 1e-6);
const pHead = head.reduce((s, i) => s + i.chance, 0);
const headCost = head.reduce((s, i) => s + i.chance * i.price, 0);
const big = box.items.filter((i) => i.price >= box.price);
const small = box.items.filter((i) => i.price < box.price);
const evBig = big.reduce((s, i) => s + i.chance * i.price, 0);
const evSmallCash = small.reduce((s, i) => s + i.chance * i.cashback, 0);
const w = (evBig * V.itemRealized) / (box.price - evSmallCash);
const pubDigest = jemlitDigest("server seed", "your client seed", "your nonce" as unknown as number);
const S = JEMLIT_SETTINGS as Record<string, unknown>;

const L: string[] = [];
L.push("# Jemlit's mystery box, explained simply", "");
L.push("<!-- links: Simulator (Jemlit)|https://mys-sim.vercel.app/operators/jemlit; Explanation page with live sums|https://mys-sim.vercel.app/docs/jemlit; Tracker|00-tracker.html -->", "");
L.push(`Version 1.0, 14 October 2026. Generated from the ${JEMLIT_SUMMARY.length} live box tables captured on ${JEMLIT_CAPTURED} by \`simulator/scripts/jemlit-report.ts\`; the same data drives the Jemlit pages of the simulator. Plain words; sources at the end.`, "");
L.push("## In short", "");
L.push(`- Price first, then the chances are solved to 80%: ${n80} of ${JEMLIT_SUMMARY.length} boxes pay back exactly 80% of their price at Jemlit's listed values.`);
L.push("- Every item owns a band on a 0 to 100 line, printed on the page under See rolls. The roll lands in one band; that item is the result.");
L.push("- One open is one roll. A play count rises by one each open under the same secret; nothing else carries over.");
L.push(`- Most opens pay less than the price: on the Apple eBox ${pct(1 - m.pAtOrAbovePrice)} of opens pay under ${money(box.price)}; the ten headline items are one in a million each.`);
L.push("- Credits are the cushion: exchange any win for 90% of its listed price in Credits. Credits buy boxes and games, never money, and expire after a year.");
L.push("- The check proves the roll, not the table: Jemlit hashes the server seed, not the odds; the default client seed comes from the site; you can check only after rotating the seed.", "");
L.push("## 1. Box content", "", `${JEMLIT_SUMMARY.length} boxes from ${money(Math.min(...JEMLIT_SUMMARY.map((b) => b.price)))} to ${money(Math.max(...JEMLIT_SUMMARY.map((b) => b.price)))}. Featured boxes:`, "");
L.push("| Box | Price | Items | Worth the price or more | Pays back per open | Return at listed | Return in Credits |", "|---|---|---|---|---|---|---|");
for (const b of JEMLIT_FEATURED) {
  const bm = jemlitMath(b, undefined, V);
  L.push(`| ${b.name} | ${money(b.price)} | ${b.items.length} | ${oneIn(bm.pAtOrAbovePrice)} | ${money(bm.evPrice)} | ${pct(bm.returnPrice)} | ${pct(bm.returnCashback)} |`);
}
L.push("", `All ${JEMLIT_SUMMARY.length} boxes are in the simulator and in \`research/captures/jemlit-boxes-2026-10-14.json\`. ${n80} return exactly 80.0% at listed prices; the exceptions are ${others.map((b) => `${b.name} ${pct(b.rtpPrice ?? 0, 0)}`).join(", ")}.`, "");
L.push("Columns: worth the price or more = the chances of every item listed at the box price or above, added up; pays back per open = price × chance added over the rows; return at listed = pays back ÷ price; return in Credits = the same with each item at its cashback.", "");
L.push("## 2. One open, step by step", "");
const steps = [
  ["Top up Credits, pick a box. The price is fixed.", "Everything is paid in Credits ($1.12 = €1). The price comes first; the chances are solved to fit it.", "Anna picks the Apple eBox at $8.47."],
  ["Before play the site locks in a secret (the server seed) and shows its scrambled copy (a SHA-512 hash).", "Proves the secret was fixed before you paid.", "Anna's Fairness popup shows a long hash."],
  ["Your browser makes a client seed. You can change it.", "Keep the browser's seed and the site knows both inputs. Change it and neither side alone decides the roll.", "Anna types anna-2026."],
  ["You pay and spin. Secret + your seed + the play count are mixed into one long number.", "The play count starts at 1 and rises by one every open under the same secret.", "Play count 1."],
  ["The long number becomes a roll from 0 to 100.", "Every point equally likely; only the table decides.", "Anna rolls 22.0231, the number from Jemlit's own example."],
  ["The roll is read against the bands: wins if lower < roll ≤ upper.", "The bands are printed on the page under See rolls.", "0 to 6.25 screen protector, 6.25 to 12.5 carry case, 12.5 to 28.43 sticker… 22.0231 → the sticker."],
  ["You are paid: ship the item or exchange it for its cashback in Credits. Some rows are Credits only.", "Cashback is 90% of the listed price; Credits never become money.", "The sticker is a credit-only row: $1.02 in Credits."],
  ["The secret stays until you rotate it; then it is revealed and every open under it can be rechecked.", "Nothing can be checked while the seed is in use.", "After 40 opens Anna rotates and recomputes 22.0231."],
];
steps.forEach((s, i) => L.push(`${i + 1}. **${s[0]}** Why: ${s[1]} Example: ${s[2]}`));
L.push("", "No pool that runs out, no counter of losses, no target the system steers toward.", "");
L.push("## 3. The sums: Apple eBox", "", `${box.items.length} rows, exact chances from the box API. Each row costs Jemlit its listed price × its chance.`, "");
L.push("| Item | Price | Cashback | Chance | 1 in | Costs per open | In Credits |", "|---|---|---|---|---|---|---|");
for (const r of rows) L.push(`| ${r.label}${r.credit ? " (credit)" : ""} | ${money(r.price)} | ${money(r.cashback)} | ${(r.chance * 100).toFixed(r.chance < 0.001 ? 6 : 3)}% | ${Math.round(1 / r.share).toLocaleString("en-US")} | ${money(r.costPrice, 3)} | ${money(r.costCashback, 3)} |`);
L.push(`| **Total: pays back per open** | | | ${pct(m.total, 2)} | | **${money(m.evPrice)}** | **${money(m.evCashback)}** |`);
L.push(`| Price of the box | | | | | ${money(box.price)} | ${money(box.price)} |`);
L.push(`| **Jemlit keeps per open** | | | | | **${money(box.price - m.evPrice)} (${pct((box.price - m.evPrice) / box.price)})** | **${money(box.price - m.evCashback)} (${pct((box.price - m.evCashback) / box.price)})** |`, "");
L.push(`The ten headline items together cost ${money(headCost, 4)} per open: ${pct(headCost / m.evPrice)} of what the box pays back. Five rows under ${money(8.2)} share ${pct(rows.filter((r) => r.price < 8.2).reduce((s, r) => s + r.share, 0))} of all opens.`, "");
L.push("## 4. Why the price, and the 80% rule", "");
L.push(`- The 80% is a setting: ${n80} boxes land on 80.00% to four decimals. A solver sets the chances so that the sum of price × chance equals 0.8 × price. Prices like $8.47 are what the solver produces, not round marketing numbers.`);
L.push("- The dial is the cheap rows: generic accessories listed at $4 to $8 take most of the probability.");
L.push(`- The headline items are decoration: removing all ten moves the return from ${pct(m.returnPrice)} to ${pct((m.evPrice - headCost) / box.price)}.`);
L.push("- The listed prices are Jemlit's: a compatible screen protector at $8.16 fills 6.25% of opens at almost the box price. Whether it is worth $8.16 decides whether 80% is real.", "");
L.push("## 5. What a Credit is worth", "");
L.push("- Terms: Credits are not worth real money, cannot be refunded or exchanged for money, expire one year after top-up. Exchange reduces an item's value by 0% to 30%; the live tables use 10%.");
L.push("- On screen a Credit is $1 (box prices are in Credits; $1.12 = €1 on deposit).");
L.push(`- If a player ships items worth the price or more and exchanges the rest: one Credit = ${money(evBig)} × ${V.itemRealized} ÷ (${money(box.price)} − ${money(evSmallCash)}) = **${money(w)}**. At listed prices instead of resale: ${money(evBig / (box.price - evSmallCash))}.`);
L.push(`- Per ${money(box.price)} open: ${pct(m.returnPrice)} back at listed prices, ${pct(m.returnCashback)} in Credits, about ${pct(m.returnReal)} really.`, "");
L.push("## 6. The big prize", "", `Any of the ten headline items: ${(pHead * 100).toFixed(4)}% per open, ${oneIn(pHead)}.`, "", "| Opens so far | No headline item yet | At least one | Expected | Headline budget collected |", "|---|---|---|---|---|");
for (const N of [1000, 10000, 100000, 1000000, 5000000]) {
  const none = Math.exp(N * Math.log(1 - pHead));
  L.push(`| ${N.toLocaleString("en-US")} | ${pct(none)} | ${pct(1 - none)} | ${(N * pHead).toFixed(2)} | ${money(N * headCost)} |`);
}
L.push("", "One open misses all ten 99.999% of the time; for a run, multiply that by itself once per open. Nothing is due, nothing is gone; Jemlit buys the item when it is won. Only the seed is committed, so a box's chances can change between rotations and every check still passes.", "");
L.push("## 7. The check", "", "**Proves:** the server seed was fixed before play (its hash was shown first); the roll came from that seed, your seed and the play count; every open under a seed can be rechecked once it is rotated.", "", "**Does not prove:** that the bands were the same for everyone or the same as yesterday (the table is not hashed); that the browser's default client seed was unknown to the site (it is made by the site's script); that a Credit is worth a dollar; anything about an open while its seed is still in use.", "");
L.push("## 8. Platform settings seen in the page", "", "| Setting | Value | Meaning |", "|---|---|---|");
L.push(`| upgrader_fee | ${String(S.upgrader_fee)} | The Upgrader keeps 15% of the fair odds. |`, `| crash_house_edge | ${String(S.crash_house_edge)} | The Crash game keeps 8%. |`, `| borrow_enabled / max | ${String(S.borrow_enabled)} / ${String(S.borrow_max_percentage)} | A borrow feature up to 90%; what is borrowed is not visible. |`, `| shipment_min_deposit | ${String(S.shipment_min_deposit)} | $10 deposited before an item ships. |`, `| shipment coupon | ${String(S.shipment_coupon_bonus_percent)}% for ${String(S.shipment_coupon_timer_minutes)} min | 30% extra Credits instead of shipping, offered for 15 minutes. |`, `| user claims | min ${String(S.user_claim_min_amount)}, deposit ${String(S.user_claim_min_deposit)}, fee ${String(S.user_claim_fee)} | A claims feature for crypto payers; the terms say Credits never become money. |`, "");
L.push("## 9. Sources", "");
L.push("- Box listing: https://jemlit.com/front/api/en/pages/all-boxes (linked from https://jemlit.com/en/boxes). Saved: `research/captures/jemlit-all-boxes-2026-10-14.json`.");
L.push("- Every box: https://jemlit.com/front/api/en/box/<slug>, the same data the box page embeds as window.jemlit.spaPageData (chance, outcome_from, outcome_to, price, cashback, is_auto_cashback, is_shippable). Saved: `research/captures/jemlit-boxes-2026-10-14.json` and one JSON per box in the simulator under public/captures/jemlit/.");
L.push("- The recipe: https://jemlit.com/en/provably-fair/algorithm. Saved: `research/captures/jemlit-provably-fair-algorithm-2026-10-14.html`.");
L.push("- Credits and exchange: https://jemlit.com/en/terms-and-conditions and https://jemlit.com/en/faqs. Saved: `research/captures/jemlit-terms-2026-10-14.html`, `jemlit-faqs-2026-10-14.html`.");
L.push("- Deposit rate and free boxes: https://jemlit.com/en/how-it-works, https://jemlit.com/en/free-mystery-box. Saved alongside.");
L.push("- Operator: JLT Digital Media Ltd, Nicosia, Cyprus (dossier 1 §2.2).");
L.push(`- The engine reproduces Jemlit's published example: HMAC-SHA512/256("server seed", "your client seed-your nonce") = ${pubDigest}, roll ${jemlitRoll(pubDigest).toFixed(4)} (page: 38611068…, 22.0231).`);
L.push("- Not done: no paid open; no real seed rotated and checked on Jemlit's page; account area, Upgrader, Battles, Crash, borrow and claims not captured. Assumptions: resale share 70%; a Credit worth $0.40; listed prices taken as retail.", "");
L.push("## 10. Critique", "");
L.push("Confirmed and good: the recipe is published in full with a worked example and it reproduces; the bands are printed on every box page; exact chances sum to 1; cashback per item is printed; the 80% target is consistent across the catalogue.", "");
L.push("Where the presentation flatters the numbers: 80% is at Jemlit's listed prices, carried by generic accessories; Credits look like dollars but only buy more boxes and expire; ten one-in-a-million items are the poster and a fraction of a percent of the payout; sign-up boxes, daily free boxes by XP level, deposit coupons and a 15-minute 30% exchange bonus sit on top.", "");
L.push("Possible, unprovable: different bands per player or over time (only the seed is committed); the site-made default client seed; seeds that serve hundreds of opens with no forced rotation; borrow and claims features whose rules are not public.", "");
L.push("What could be done better: commit the table into the open and publish a log of versions; rotate or re-commit every open; let the player set the seed before the server hash is shown; show an independent market value and the return in Credits next to the return at listed prices; no loans to players.", "");
L.push("## Glossary", "");
L.push("* **Chance.** An item's share of opens, as a fraction; a box's chances add up to 1.");
L.push("* **Band.** An item's stretch of the 0 to 100 line, printed under See rolls.");
L.push("* **Roll.** The number from 0 to 100 that decides one open.");
L.push("* **Cost per open.** Price × chance: what an item costs the operator per open on average.");
L.push("* **Pays back per open.** All costs per open added; divided by the price it is the return, or RTP.");
L.push("* **Credit.** Jemlit's site balance: buys boxes and games, never money, expires after a year.");
L.push("* **Cashback.** The Credits an item exchanges for, 90% of its listed price on the live tables.");
L.push("* **Server seed.** The site's secret for a run of opens; hashed and shown first, revealed when rotated.");
L.push("* **Client seed.** A string from your browser that you can change; goes into every roll.");
L.push("* **Nonce.** The play count under one server seed.");
writeFileSync(out, L.join("\n") + "\n");
console.log("wrote", out, L.length, "lines");
