// Default configurations and named presets for each lab.
import { CATALOG, CATALOG_BY_ID } from "@/engine/catalog";
import { CAPTURED_BOXES } from "@/engine/captured";
import { expectedValue, resolveTable, solveWeights, weightsForPool, weightsForTiers, weightsFromPercents } from "@/engine/table";
import type { AlgoConfig, BattlesConfig, BoxDef, BoxTier, CreditsConfig, MysteryBoxConfig, PriceLayer, RetentionConfig, SellbackConfig, UpgraderConfig } from "@/engine/types";

export const TICKET_TOTAL = 100_000_000;

export const VENDOR_ALGO: AlgoConfig = {
  scheme: "none",
  mapping: "native",
  rng: "sfc32",
  rotation: "on-retire",
  rotateEvery: 1000,
  clientSeedMode: "site-default",
};

export const STANDARD_PF_ALGO: AlgoConfig = { ...VENDOR_ALGO, scheme: "hmac-sha256", rotation: "on-retire" };
export const GLASSBOX_ALGO: AlgoConfig = { scheme: "glassbox", mapping: "native", rng: "sfc32", rotation: "per-open", rotateEvery: 1, clientSeedMode: "player-set", publicLog: true };
export const JEMLIT_ALGO: AlgoConfig = { ...STANDARD_PF_ALGO, scheme: "jemlit" };
export const MISTY_ALGO: AlgoConfig = { ...STANDARD_PF_ALGO, scheme: "misty", rotation: "per-open", rotateEvery: 1 };
export const CASES_ALGO: AlgoConfig = { ...STANDARD_PF_ALGO, scheme: "hmac-sha256", rotation: "every-n", rotateEvery: 1000 };
export const COURTYARD_ALGO: AlgoConfig = { ...VENDOR_ALGO, publicLog: true };

const VENDOR_ITEMS = [
  "w-montvale-sovereign-40",
  "w-omegon-seamaster",
  "w-tissotti-prx",
  "s-aireau-jordan-1",
  "s-aireau-dunk-low",
  "w-gshock-origin",
  "be-chanelle-rouge",
  "a-aireau-cap",
  "f-keychain",
  "f-credit-5",
  "f-credit-3",
  "f-credit-1",
  "f-sticker-logo",
];

export function makeBox(name: string, price: number, itemIds: string[], rtp: number, layer: PriceLayer, displayLayer: PriceLayer = layer, note?: string): BoxDef {
  const items = itemIds.map((id) => CATALOG.find((c) => c.id === id)!).filter(Boolean);
  const solved = solveWeights(items, TICKET_TOTAL, price, rtp, layer);
  return { name, price, ticketTotal: TICKET_TOTAL, items: solved.weights, valueLayer: layer, displayLayer, note };
}

/** A finite drop: copies per item; odds are copies over the total. */
export function makePoolBox(name: string, price: number, copies: Record<string, number>, layer: PriceLayer, retire: NonNullable<BoxDef["pool"]>["retire"], note?: string, lastOneItemId?: string): BoxDef {
  return { name, price, ticketTotal: TICKET_TOTAL, items: weightsForPool(copies, TICKET_TOTAL), valueLayer: layer, displayLayer: layer, model: "pool", pool: { copies, retire, lastOneItemId }, note };
}

export function makeTieredBox(name: string, price: number, tiers: BoxTier[], layer: PriceLayer, floorMultiple?: number, note?: string): BoxDef {
  return { name, price, ticketTotal: TICKET_TOTAL, items: weightsForTiers(tiers, TICKET_TOTAL), valueLayer: layer, displayLayer: layer, model: "tiered", tiers, floorMultiple, note };
}

/** Courtyard: weights first, then the price equals the expected value at the value layer divided by the target return. */
export function makeEvPricedBox(name: string, percents: { itemId: string; percent: number }[], layer: PriceLayer, rtp = 1, note?: string): BoxDef {
  const items = weightsFromPercents(percents, TICKET_TOTAL).items;
  const ev = expectedValue(resolveTable(items, TICKET_TOTAL, CATALOG_BY_ID), layer);
  const price = Math.round((ev / rtp) * 100) / 100;
  return { name: `${name} · $${price.toLocaleString()}`, price, ticketTotal: TICKET_TOTAL, items, valueLayer: layer, displayLayer: layer, note };
}

/** The vendor's economy: 90% RTP computed on listed (retail) values. */
export const VENDOR_BOX = makeBox("Vendor default · $50 · 90% on listed value", 50, VENDOR_ITEMS, 0.9, "retail", "retail", "The vendor's default: weights from the RTP solver at 90% of listed value.");
/** Same items priced honestly: 90% RTP on realized value. */
export const GLASSBOX_BOX = makeBox("Glass Box · $50 · 90% on realized value", 50, VENDOR_ITEMS, 0.9, "realized", "realized", "Same items as the vendor box, return computed and displayed on realized prices.");

/** IcyBox-style finite drop: 100 copies, 3 grails, retail-style values, the operator may retire it. */
export const ICYBOX_BOX = makePoolBox(
  "IcyBox-style drop · $250 · 100 copies, 3% grail",
  250,
  { "w-omegon-seamaster": 3, "w-gshock-origin": 5, "be-chanelle-no5": 10, "be-dioré-sauvage": 12, "be-chanelle-rouge": 30, "a-aireau-cap": 20, "a-raybane-case": 20 },
  "retail",
  "operator-may-retire",
  "Finite drop in the IcyBox pattern: a 3% 'grail' (a $5,900 watch) on a $250 box valued at retail, 100 copies, 'once they're gone, they're gone'; 95% return at retail, about 66% at realized. The terms allow the operator to retire the box before the grail is distributed; the early-retirement rig reproduces that.",
);

const STOCKX_TIERS: BoxTier[] = [
  { id: "t1", name: "Tier 1 · 0.5%", percent: 0.5, itemIds: ["w-tissotti-prx", "t-apfel-watch-ultra", "j-tiffano-hardwear"] },
  { id: "t2", name: "Tier 2 · 5%", percent: 5, itemIds: ["b-mkors-pochette", "b-coachman-tabby", "a-hermine-scarf"] },
  { id: "t3", name: "Tier 3 · 20.5%", percent: 20.5, itemIds: ["a-raybane-aviator", "s-aireau-jordan-1", "t-apfel-airpods-pro"] },
  { id: "t4", name: "Tier 4 · 74%", percent: 74, itemIds: ["s-aireau-dunk-low", "j-pandorra-charm", "be-chanelle-no5"] },
];
/** StockX-style: tier-first draw, every item listed at or above the price, odds per tier shown. */
export const STOCKX_BOX = makeTieredBox("StockX-style tiered box · $115 · floor at price", 115, STOCKX_TIERS, "retail", 1, "Tier-first draw with StockX's published tier odds (0.5% to 74%); every item lists at or above the box price before fees (about 147% of price at list, 110% at realized before the credit haircut); the item inside a tier is the operator's pick from inventory. StockX earns from sourcing below list and from the 10 to 25% credit haircut, not from the odds.");
export const STOCKX_FINITE_BOX = makeTieredBox(
  "StockX-style with finite inventory · $115",
  115,
  STOCKX_TIERS.map((t) => (t.id === "t1" ? { ...t, inventory: 40 } : t.id === "t2" ? { ...t, inventory: 400 } : t)),
  "retail",
  1,
  "As above, with 40 copies per item in tier 1 and 400 in tier 2; when a tier runs out the box is delisted, which ends the run.",
);

/** Courtyard-style pack: weights first, price equal to the expected value at realized prices, every pull public. */
export const COURTYARD_PACK = makeEvPricedBox(
  "Courtyard-style watch pack (price = EV at realized)",
  [
    { itemId: "w-montvale-submersible", percent: 1 },
    { itemId: "w-omegon-seamaster", percent: 6 },
    { itemId: "w-cartel-panthera", percent: 4 },
    { itemId: "w-longino-dolce", percent: 20 },
    { itemId: "w-tissotti-prx", percent: 39 },
    { itemId: "w-gshock-origin", percent: 30 },
  ],
  "realized",
  1,
  "Courtyard's pattern: the pack price equals the expected value of the pulls at fair market value, so the return is 100% before fees. The operator earns from the buyback discount, marketplace fees and vaulting instead of the odds.",
);

/** Glass Box lucky bag: positive expected value at realized prices, finite supply. */
export const LUCKY_BAG = makePoolBox(
  "Glass Box lucky bag · $170 · 105% at realized · 200 copies",
  170,
  { "b-goyard-saint-louis": 2, "w-tissotti-prx": 20, "s-aireau-jordan-1": 15, "a-hermine-scarf": 10, "be-chanelle-no5": 60, "j-pandorra-charm": 93 },
  "realized",
  "must-distribute",
  "Fukubukuro pattern: a sealed bag worth more than it costs at realized prices (105%), in a finite, committed pool that cannot be retired early. Marketing cost instead of margin.",
);

/** Ichiban Kuji: finite tickets, prize tiers, the buyer of the last ticket also gets the Last One prize. */
export const KUJI_BOX = makePoolBox(
  "Kuji-style lottery · $12 · 80 tickets · Last One prize",
  12,
  { "b-mkors-pochette": 1, "j-pandorra-charm": 2, "be-chanelle-rouge": 4, "a-raybane-case": 13, "f-keychain": 25, "f-sticker-logo": 35 },
  "realized",
  "when-empty",
  "Ichiban Kuji: 80 tickets per set with prizes A to F (about 65% return at realized, as kuji sets are); whoever buys the final ticket also receives the Last One prize. Odds are exact and move as tickets sell.",
  "w-gshock-origin",
);

/** Gacha pity on the vendor box. */
export const PITY_BOX: BoxDef = { ...VENDOR_BOX, name: "Vendor box with pity · $50 · after 40 losses the next open pays at least the price", pity: { afterLosses: 40, minValueMultiple: 1 }, note: "The vendor box with a disclosed pity ceiling: after 40 consecutive drops below the price, the next open is drawn only from items worth at least the price. The vendor box loses about 92% of the time, so pity at 20 would fire constantly and lift the return above 100%; an operator funds a pity rule by thinning the base table." };

export const CAPTURED = CAPTURED_BOXES;

export const DEFAULT_MYSTERY: MysteryBoxConfig = {
  box: VENDOR_BOX,
  algo: VENDOR_ALGO,
  rigs: {},
  accounts: { tags: [{ tag: "player", share: 1 }] },
};

export const DEFAULT_SELLBACK: SellbackConfig = {
  box: VENDOR_BOX,
  algo: VENDOR_ALGO,
  rigs: {},
  sellback: { mode: "vendor", haircut: 0 },
  withdrawal: { mode: "through-items", minWithdraw: 100 },
  population: {
    agents: 2000,
    depositMean: 100,
    depositSpread: 0.8,
    sessions: 20,
    opensPerSession: 10,
    sellBelowMultiple: 4,
    shipAboveMultiple: 4,
    rebetFraction: 0.5,
    maxDeposits: 3,
    cashOutTargetMultiple: 3,
  },
};

export const DEFAULT_BATTLES: BattlesConfig = {
  boxes: [VENDOR_BOX, VENDOR_BOX, VENDOR_BOX],
  algo: VENDOR_ALGO,
  rigs: {},
  mode: "normal",
  players: 4,
  humansPerBattle: 1,
  bots: { enabled: true },
  coinflipEdge: 0.05,
};

export const DEFAULT_RETENTION: RetentionConfig = {
  box: VENDOR_BOX,
  algo: VENDOR_ALGO,
  rigs: {},
  days: 30,
  agents: 2000,
  dailyBox: { enabled: true, expiry: "24h", tierValues: [1, 2, 4, 8] },
  race: { enabled: true, cadenceDays: 7, prizes: [200, 100, 50] },
  affiliate: { enabled: true, referredShare: 0.2, freeBoxes: 3, commission: 0.05 },
  visitor: { baseVisit: 0.3, incentiveLift: 0.2, raceLift: 0.2, churnHazard: 0.05, depositPerVisit: 20, opensPerVisit: 3 },
  missions: { enabled: false, wagerTarget: 100, reward: 5 },
  freeEntry: { enabled: false, share: 0.1 },
  spendCap: { enabled: false, perDay: 50 },
};

/** Misty's two-stage economy: the Timepiece Suite pays credits; credits are tickets in a 100,000-ticket draw for a watch. */
export const DEFAULT_CREDITS: CreditsConfig = {
  box: CAPTURED_BOXES.mistyTimepiece,
  algo: MISTY_ALGO,
  rigs: {},
  raffle: {
    ticketPool: 100000,
    ticketFace: 1,
    prizeItemId: "c-misty-ph-daytona",
    drawRule: "on-schedule",
    scheduleEvery: 6000,
    freeEntryShare: 0.02,
    monthlyCap: 0,
    disclosedEv: false,
  },
  population: { agents: 3000, opensPerAgent: 12 },
};

/** Upgrader at Cases.gg's disclosed 10% edge: stake $50 for a chance at a $4,300 watch. */
export const DEFAULT_UPGRADER: UpgraderConfig = {
  algo: CASES_ALGO,
  rigs: {},
  mode: "upgrader",
  edge: 0.1,
  maxChance: 0.8,
  targetItemId: "w-omegon-seamaster",
  valueLayer: "realized",
  stake: 50,
  chance: 0.25,
  population: { agents: 2000, bankroll: 200, attempts: 40, policy: "ladder" },
};

export const PRESETS = {
  mystery: [
    { id: "vendor", name: "Vendor default: no commitment, 90% on listed value", config: DEFAULT_MYSTERY },
    { id: "standard-pf", name: "Standard provably fair (HMAC-SHA256), same box", config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO } },
    { id: "jemlit", name: "Jemlit scheme, same box", config: { ...DEFAULT_MYSTERY, algo: JEMLIT_ALGO } },
    { id: "packs", name: "Packs.com scheme (per-open rotation, 32-bit ticket)", config: { ...DEFAULT_MYSTERY, algo: { ...STANDARD_PF_ALGO, scheme: "packs" as const, rotation: "per-open" as const } } },
    { id: "glassbox", name: "Glass Box: manifest, beacon, per-open rotation, realized value, public log", config: { ...DEFAULT_MYSTERY, box: GLASSBOX_BOX, algo: GLASSBOX_ALGO } },
    { id: "captured-jemlit", name: "Captured: Jemlit Apple eBox (reconstructed), Jemlit scheme", config: { ...DEFAULT_MYSTERY, box: CAPTURED_BOXES.jemlitApple, algo: JEMLIT_ALGO } },
    { id: "captured-misty-live", name: "Captured: Misty Timepiece Suite $10, live table 12 Oct 2026, Misty scheme", config: { ...DEFAULT_MYSTERY, box: CAPTURED_BOXES.mistyTimepieceLive, algo: MISTY_ALGO } },
    { id: "captured-misty-ts", name: "Captured: Misty Timepiece Suite $10 (reconstructed), Misty scheme", config: { ...DEFAULT_MYSTERY, box: CAPTURED_BOXES.mistyTimepiece, algo: MISTY_ALGO } },
    { id: "captured-misty-ph", name: "Captured: Misty Penthouse $50 (reconstructed), Misty scheme", config: { ...DEFAULT_MYSTERY, box: CAPTURED_BOXES.mistyPenthouse, algo: MISTY_ALGO } },
    { id: "captured-cases", name: "Captured: Cases.gg Pack Up $1,813 (reconstructed), rotation every 1,000", config: { ...DEFAULT_MYSTERY, box: CAPTURED_BOXES.casesPackUp, algo: CASES_ALGO } },
    { id: "icybox", name: "IcyBox-style finite drop: 100 copies, 3% grail, no commitment", config: { ...DEFAULT_MYSTERY, box: ICYBOX_BOX, algo: VENDOR_ALGO } },
    { id: "icybox-retire", name: "Rigged: IcyBox drop retired at 70% sold while the grail remains", config: { ...DEFAULT_MYSTERY, box: ICYBOX_BOX, algo: VENDOR_ALGO, rigs: { earlyRetire: { atFraction: 0.7, grailMultiple: 20 } } } },
    { id: "stockx", name: "StockX-style tiered box: tier odds shown, floor at price, no commitment", config: { ...DEFAULT_MYSTERY, box: STOCKX_BOX, algo: VENDOR_ALGO } },
    { id: "stockx-finite", name: "StockX-style with finite tier inventory (delists when a tier empties)", config: { ...DEFAULT_MYSTERY, box: STOCKX_FINITE_BOX, algo: VENDOR_ALGO } },
    { id: "courtyard", name: "Courtyard-style pack: price = EV at realized, public pull log", config: { ...DEFAULT_MYSTERY, box: COURTYARD_PACK, algo: COURTYARD_ALGO } },
    { id: "lucky-bag", name: "Glass Box lucky bag: 105% at realized, finite pool that must distribute", config: { ...DEFAULT_MYSTERY, box: LUCKY_BAG, algo: GLASSBOX_ALGO } },
    { id: "kuji", name: "Kuji-style lottery: 80 tickets, Last One prize", config: { ...DEFAULT_MYSTERY, box: KUJI_BOX, algo: GLASSBOX_ALGO } },
    { id: "pity", name: "Vendor box with a gacha pity ceiling", config: { ...DEFAULT_MYSTERY, box: PITY_BOX, algo: STANDARD_PF_ALGO } },
    { id: "swap", name: "Rigged: table swap to 70% behind a standard provably fair", config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO, rigs: { tableSwap: { hiddenRtp: 0.7 } } } },
    { id: "secret", name: "Rigged: Pop Mart secret item at 1 in 144, not on the table", config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO, rigs: { secretItem: { itemId: "a-hermine-scarf", percent: 0.69 } } } },
    {
      id: "streamer",
      name: "Rigged: streamer accounts at 160% RTP",
      config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO, rigs: { perAccount: { tag: "streamer", rtp: 1.6 } }, accounts: { tags: [{ tag: "player", share: 0.9 }, { tag: "streamer", share: 0.1 }] } },
    },
    { id: "presentation", name: "Presentation rigs: near miss, losses as wins, fake feed, tickets-away, urgency", config: { ...DEFAULT_MYSTERY, rigs: { nearMiss: { rate: 0.5, showcase: 0.6 }, ldwCelebration: true, fakeLiveFeed: { grailsPerMinute: 6 }, ticketsAwayMessage: true, urgency: { stockLeft: 12, viewers: 38, countdownMinutes: 14 }, demoOdds: { demoRtp: 1.6 } } } },
  ],
};

export const SELLBACK_PRESETS = {
  vendor: DEFAULT_SELLBACK,
  glassbox: { ...DEFAULT_SELLBACK, box: GLASSBOX_BOX, algo: GLASSBOX_ALGO, sellback: { mode: "cash" as const, layer: "realized" as const, haircut: 0 }, withdrawal: { mode: "cash" as const, minWithdraw: 0 } },
  icybox: {
    ...DEFAULT_SELLBACK,
    box: ICYBOX_BOX,
    algo: VENDOR_ALGO,
    sellback: { mode: "cash" as const, layer: "realized" as const, haircut: 0 },
    withdrawal: { mode: "cash" as const, minWithdraw: 0 },
    estimate: { factor: 0.7, disclosed: false },
    decision: { windowMinutes: 2880, inattention: 0.15, autoAction: "sell" as const },
    keepFees: { taxRate: 0.08, shipping: 45, insuranceRate: 0.01 },
    population: { ...DEFAULT_SELLBACK.population, depositMean: 250, opensPerSession: 2, shipAboveMultiple: 1.5 },
  },
  stockx: {
    ...DEFAULT_SELLBACK,
    box: STOCKX_BOX,
    algo: VENDOR_ALGO,
    sellback: { mode: "vendor" as const, haircut: 0.15 },
    withdrawal: { mode: "through-items" as const, minWithdraw: 0 },
    decision: { windowMinutes: 5, inattention: 0.25, autoAction: "ship" as const },
    creditExpiry: { sessions: 12 },
    population: { ...DEFAULT_SELLBACK.population, depositMean: 115, opensPerSession: 3, shipAboveMultiple: 1.5 },
  },
  courtyard: {
    ...DEFAULT_SELLBACK,
    box: COURTYARD_PACK,
    algo: COURTYARD_ALGO,
    sellback: { mode: "cash" as const, layer: "realized" as const, haircut: 0.05 },
    withdrawal: { mode: "cash" as const, minWithdraw: 0 },
    decision: { windowMinutes: 10080, inattention: 0.02, autoAction: "ship" as const },
    guaranteeFloor: 300,
    population: { ...DEFAULT_SELLBACK.population, depositMean: 600, opensPerSession: 1, shipAboveMultiple: 1.3 },
  },
  casesVault: { ...DEFAULT_SELLBACK, withdrawal: { mode: "cash" as const, minWithdraw: 0 }, vault: { enabled: true, lockFraction: 0.5 } },
  creator: { ...DEFAULT_SELLBACK, creatorCut: 0.05 },
};
