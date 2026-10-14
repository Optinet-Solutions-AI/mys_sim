/**
 * The feature and mechanic matrix across every source the simulator models. Hand-curated from the research
 * dossiers and the captures (12 and 13 October 2026). "yes" = the mechanic is there as described; "variant" = a
 * close relative; "no" = absent; "unknown" = not visible from outside. Every cell carries a note.
 */
export type Presence = "yes" | "variant" | "no" | "unknown";

export interface Source {
  id: string;
  name: string;
  kind: "operator" | "ours" | "adjacent";
  short: string;
}

export const SOURCES: Source[] = [
  { id: "evo", name: "Evo Verse", kind: "operator", short: "The B2B platform from the demo: boxes, battles, deals, retention, sell-back and cart." },
  { id: "icybox", name: "IcyBox", kind: "operator", short: "Luxury-only, finite drops, no fairness scheme, buyback on its own terms." },
  { id: "stockx", name: "StockX", kind: "operator", short: "Tiered boxes over a sneaker marketplace; items valued on its own market." },
  { id: "courtyard", name: "Courtyard", kind: "operator", short: "Collectible packs priced from their contents; sell back to the house." },
  { id: "jemlit", name: "Jemlit", kind: "operator", short: "Case site: published odds, commit-reveal, upgrader, battles." },
  { id: "cases", name: "Cases.gg", kind: "operator", short: "Case site: published odds, commit-reveal with rotation, battles, upgrader, coins." },
  { id: "misty", name: "Misty", kind: "operator", short: "Luxury boxes paying site credit; secret per open; competitions with free postal entry." },
  { id: "glassbox", name: "Glass Box (ours)", kind: "ours", short: "Our design: full manifest hash, market value shown, cash at realized value." },
  { id: "adjacent", name: "Adjacent formats", kind: "adjacent", short: "Kuji, fukubukuro, Pop Mart blind boxes, gacha, Omaze-style draws." },
];

export const FAMILIES = [
  { id: "draw", name: "Draw model" },
  { id: "proof", name: "Fairness proof" },
  { id: "money", name: "Payout and money" },
  { id: "side", name: "Side games" },
  { id: "retain", name: "Retention and marketing" },
  { id: "price", name: "Pricing and valuation" },
] as const;
export type FamilyId = (typeof FAMILIES)[number]["id"];

export interface Mechanic {
  id: string;
  name: string;
  family: FamilyId;
  plain: string;
  cells: Record<string, [Presence, string]>;
}

const M = (id: string, name: string, family: FamilyId, plain: string, cells: Record<string, [Presence, string]>): Mechanic => ({ id, name, family, plain, cells });

export const MECHANICS: Mechanic[] = [
  M("weighted", "Weighted odds table, independent opens", "draw", "Every open is its own roll against a fixed table; nothing is remembered between opens.", {
    evo: ["yes", "Operator sets a target payout; the software sets the weights."],
    icybox: ["no", "Finite drops instead."],
    stockx: ["variant", "Tier first, then an item inside the tier."],
    courtyard: ["variant", "A pack of items; odds follow the pack's contents."],
    jemlit: ["yes", "Published per-item chances."],
    cases: ["yes", "Published per-item chances."],
    misty: ["yes", "Exact weights in the page data, sum 100."],
    glassbox: ["yes", "Same model, table committed in full."],
    adjacent: ["variant", "Gacha is weighted; kuji and fukubukuro are pools."],
  }),
  M("pool", "Finite pool, drawn without replacement", "draw", "A fixed stock of copies; each win removes one; the box can run out.", {
    evo: ["no", "Not in the demo."],
    icybox: ["yes", "'Once they are gone, they are gone'; 100-copy drops."],
    stockx: ["variant", "Finite editions exist alongside open ones."],
    courtyard: ["no", ""],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["no", "Misty buys the piece when it is won."],
    glassbox: ["variant", "Optional kuji-style finite drops."],
    adjacent: ["yes", "Kuji, fukubukuro: physical stock."],
  }),
  M("tiered", "Tier first, then an item inside the tier", "draw", "The roll picks a tier; the item inside comes from inventory.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["yes", "Published tier odds; floor of 1× price."],
    courtyard: ["no", ""],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["no", ""],
    glassbox: ["no", ""],
    adjacent: ["variant", "Kuji prize grades A to E."],
  }),
  M("retire", "Operator may retire a finite box early", "draw", "A pool box can be withdrawn before its top prize has been drawn.", {
    evo: ["no", "Not applicable."],
    icybox: ["yes", "Allowed by the terms; the grail may never ship."],
    stockx: ["unknown", ""],
    courtyard: ["no", ""],
    jemlit: ["no", "Not applicable."],
    cases: ["no", "Not applicable."],
    misty: ["no", "Not applicable."],
    glassbox: ["no", "Must distribute."],
    adjacent: ["variant", "Kuji sells out physically; no early retirement."],
  }),
  M("odds", "Exact odds published per outcome", "proof", "The player can see the chance of every row before paying.", {
    evo: ["variant", "The operator decides; the demo showed per-item odds."],
    icybox: ["variant", "Percent per item shown; no hash."],
    stockx: ["yes", "Tier odds published."],
    courtyard: ["variant", "Contents listed; the pack is the odds."],
    jemlit: ["yes", "Per-item chances in the page JSON."],
    cases: ["yes", "Per-item chances."],
    misty: ["yes", "Exact weights, sum 100."],
    glassbox: ["yes", "Full manifest."],
    adjacent: ["variant", "Kuji prints counts per grade; Pop Mart prints secret odds."],
  }),
  M("commit", "Secret committed before the open", "proof", "A server seed is chosen and its hash shown before payment; the seed is revealed after.", {
    evo: ["no", "None shown in the demo."],
    icybox: ["no", "No scheme."],
    stockx: ["no", "Data and a public log instead."],
    courtyard: ["no", "No cryptography."],
    jemlit: ["yes", "HMAC scheme, published example."],
    cases: ["yes", "Rotation every 1,000 opens."],
    misty: ["yes", "Per open."],
    glassbox: ["yes", "Per open, plus a beacon."],
    adjacent: ["no", "Physical or opaque."],
  }),
  M("clientseed", "Player sets a seed", "proof", "A word of the player's goes into the roll so the site cannot pick it alone.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["yes", ""],
    cases: ["yes", ""],
    misty: ["yes", ""],
    glassbox: ["yes", ""],
    adjacent: ["no", ""],
  }),
  M("rotation", "Fresh secret for every open", "proof", "The seed changes every open, so a revealed seed never explains another open.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["variant", "Rotates on request or retirement."],
    cases: ["variant", "Every 1,000 opens."],
    misty: ["yes", ""],
    glassbox: ["yes", ""],
    adjacent: ["no", ""],
  }),
  M("tablehash", "Odds table hashed and frozen onto the open", "proof", "The check shows which table the roll was read against.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["yes", "'The odds table is frozen onto your open.'"],
    glassbox: ["yes", "Manifest hash, public log of tables."],
    adjacent: ["no", ""],
  }),
  M("verifier", "Public page that recomputes an open", "proof", "Anyone can paste the seeds and get the same result.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["variant", "Public drop log, no recomputation."],
    courtyard: ["variant", "Public pack log."],
    jemlit: ["yes", ""],
    cases: ["yes", ""],
    misty: ["variant", "Competition verifier public; box verifier not captured."],
    glassbox: ["yes", ""],
    adjacent: ["no", ""],
  }),
  M("credit", "Most opens pay site credit", "money", "Losing opens hand back credit that only buys more boxes.", {
    evo: ["variant", "Sell-back lands in balance; opens pay items."],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["variant", "Small credit outcomes in the table."],
    cases: ["variant", "Coins as outcomes."],
    misty: ["yes", "About 98% of opens pay Mistees."],
    glassbox: ["no", "Cash, not credit."],
    adjacent: ["no", ""],
  }),
  M("sellback", "Sell an item back for balance", "money", "Convert a won item into balance instead of shipping it.", {
    evo: ["yes", "At displayed value, into balance."],
    icybox: ["yes", "Undisclosed buyback; forced auto-buyback in places."],
    stockx: ["variant", "Resell on the marketplace."],
    courtyard: ["yes", "Sell to Courtyard."],
    jemlit: ["yes", ""],
    cases: ["yes", ""],
    misty: ["variant", "Trade in for Mistees."],
    glassbox: ["yes", "Cash at realized value."],
    adjacent: ["no", ""],
  }),
  M("itemsonly", "Money leaves only as shipped items", "money", "No cash withdrawal; balance turns into money only by shipping an item.", {
    evo: ["yes", "Withdraw only through items."],
    icybox: ["variant", "Buyback credit; shipping."],
    stockx: ["no", "Marketplace payout."],
    courtyard: ["no", "Cash on sell-back."],
    jemlit: ["variant", ""],
    cases: ["variant", "Cash withdrawal exists."],
    misty: ["yes", "Mistees never become money."],
    glassbox: ["no", "Cash out."],
    adjacent: ["yes", "Physical goods."],
  }),
  M("freespins", "Bonus spins inside an open", "side", "Some outcomes trigger extra rolls on a small credit table.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["yes", "Free spin + 1, 2 free spins + 2."],
    glassbox: ["no", ""],
    adjacent: ["no", ""],
  }),
  M("battles", "Case battles", "side", "Several players open the same boxes; the highest total takes all.", {
    evo: ["yes", "Normal, crazy, group, terminal, jackpot."],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["yes", ""],
    cases: ["yes", "Plus coinflip and break modes."],
    misty: ["no", ""],
    glassbox: ["no", ""],
    adjacent: ["no", ""],
  }),
  M("upgrader", "Upgrader or Deals", "side", "Stake money or an item for a chance at a better item.", {
    evo: ["yes", "Deals: choose the chance, pay the price; capped at 80%."],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["yes", "Upgrader."],
    cases: ["yes", "Upgrader with a disclosed 10% edge."],
    misty: ["no", ""],
    glassbox: ["no", ""],
    adjacent: ["no", ""],
  }),
  M("crash", "Crash game", "side", "A multiplier climbs until it crashes; cash out before it does.", {
    evo: ["no", "Not in the demo."],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["yes", "House edge 8% in the page settings; max multiplier 1,000,000; max win 250,000."],
    cases: ["unknown", "Not captured."],
    misty: ["no", ""],
    glassbox: ["no", ""],
    adjacent: ["no", ""],
  }),
  M("mines", "Mines game", "side", "Reveal tiles on a grid, avoid the mines, cash out before you hit one.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["yes", "Grid, mine count and wager chosen by the player; the API also lets a win be taken as an item."],
    cases: ["unknown", "Not captured."],
    misty: ["no", ""],
    glassbox: ["no", ""],
    adjacent: ["no", ""],
  }),
  M("packs", "Collectible card packs", "side", "Boxes whose items are trading cards; the same draw as a box.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["yes", "Collectible packs are the product."],
    jemlit: ["yes", "15 collectible boxes (Pokémon, One Piece, Yu-Gi-Oh) in the collectibles listing, same mechanism as a box."],
    cases: ["no", ""],
    misty: ["no", ""],
    glassbox: ["no", ""],
    adjacent: ["variant", "Physical card packs and kuji."],
  }),
  M("borrow", "Borrowing against play", "retain", "The site lends balance to keep a player playing.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["yes", "borrow_enabled with a 90% cap in the page settings; terms not captured."],
    cases: ["unknown", ""],
    misty: ["no", ""],
    glassbox: ["no", "Never."],
    adjacent: ["no", ""],
  }),
  M("competitions", "Prize competitions with a free postal entry", "side", "Numbered entries, a draw date, a free route at equal odds.", {
    evo: ["no", ""],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["yes", "UK prize-competition format."],
    glassbox: ["no", ""],
    adjacent: ["yes", "Omaze-style draws."],
  }),
  M("retention", "Missions, streaks, free box, spend caps", "retain", "Mechanics that bring the player back or slow them down.", {
    evo: ["yes", "Retention module: missions, free entry, spend cap."],
    icybox: ["unknown", ""],
    stockx: ["no", ""],
    courtyard: ["no", ""],
    jemlit: ["variant", "Rewards and daily cases."],
    cases: ["variant", "Rewards and rakeback."],
    misty: ["variant", "Free welcome box."],
    glassbox: ["variant", "Spend caps and cooling-off."],
    adjacent: ["no", ""],
  }),
  M("evprice", "Price derived from the contents", "price", "The price is computed from what is inside, not fixed first.", {
    evo: ["no", "Price first, odds tuned to a target payout."],
    icybox: ["no", ""],
    stockx: ["no", ""],
    courtyard: ["yes", "Pack price follows the market value of the cards."],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["no", "Price first ($10, $25, $50)."],
    glassbox: ["yes", "Price from expected value, shown."],
    adjacent: ["variant", "Kuji is priced per draw against a known stock."],
  }),
  M("marketvalue", "Independent market value shown", "price", "A value next to the operator's own figure.", {
    evo: ["no", "Listed value only."],
    icybox: ["no", "Retail-style values."],
    stockx: ["variant", "Its own marketplace prices."],
    courtyard: ["variant", "Its own sales data."],
    jemlit: ["no", ""],
    cases: ["no", ""],
    misty: ["no", "'Minimum retail value', two figures on the same day."],
    glassbox: ["yes", "WatchCharts, eBay sold."],
    adjacent: ["no", ""],
  }),
];

export const EXTERNAL = SOURCES.filter((s) => s.kind === "operator").map((s) => s.id);

export function presence(m: Mechanic, sourceId: string): Presence {
  return m.cells[sourceId]?.[0] ?? "unknown";
}

/** How many external operators have the mechanic (yes), or a close relative (variant). */
export function adoption(m: Mechanic): { yes: number; variant: number; sources: { id: string; p: Presence }[] } {
  const sources = EXTERNAL.map((id) => ({ id, p: presence(m, id) }));
  return { yes: sources.filter((s) => s.p === "yes").length, variant: sources.filter((s) => s.p === "variant").length, sources };
}

export type Spread = "same" | "similar" | "unique";
/** Same: at least three operators have it as described. Similar: at least two have it or a relative. Unique: one operator only. */
export function spread(m: Mechanic): Spread {
  const a = adoption(m);
  if (a.yes >= 3) return "same";
  if (a.yes + a.variant >= 2) return "similar";
  return "unique";
}

/** Per source: how many of its mechanics are shared, similar or unique across the operators. */
export function sourceProfile(sourceId: string): { same: number; similar: number; unique: number; byFamily: Record<FamilyId, number>; has: Mechanic[] } {
  const has = MECHANICS.filter((m) => ["yes", "variant"].includes(presence(m, sourceId)));
  const byFamily = Object.fromEntries(FAMILIES.map((f) => [f.id, has.filter((m) => m.family === f.id).length])) as Record<FamilyId, number>;
  const counts = { same: 0, similar: 0, unique: 0 };
  for (const m of has) counts[spread(m)]++;
  return { ...counts, byFamily, has };
}
