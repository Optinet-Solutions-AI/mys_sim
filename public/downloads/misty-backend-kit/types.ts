// Types used by the Misty engine. Extracted from the simulator's types.ts (kit v1.1).
// API vocabulary differs: kind oroos -> credit (freeSpins >= 1 -> bonus), mistees -> credits, weight -> percent, valueUsd -> valueCents.

/* ---------- Misty: a copy of the live box mechanism (captured 12 October 2026) ---------- */

/** One row of a Misty odds table, as the page data holds it. */
export interface MistyOutcome {
  id: string;
  label: string;
  rarity: string;
  /** item = a physical piece; oroos = Mistees (site credit); bonus = free spins plus Mistees */
  kind: "item" | "oroos" | "bonus";
  mistees: number;
  freeSpins: number;
  /** minimum retail value shown on the page; null for credit outcomes */
  valueUsd: number | null;
  /** exact page weight, percent (the box sums to 100) */
  weight: number;
}
/** What a free spin pays: Mistees with a percent weight. */
export interface MistyBonusEntry {
  mistees: number;
  weight: number;
}
export interface MistyBox {
  slug: string;
  name: string;
  price: number;
  tagline: string;
  outcomes: MistyOutcome[];
  bonus: MistyBonusEntry[];
  fairness: string;
  /** what the credit unit is called (Mistees on Misty); builder boxes may rename it */
  creditName?: string;
}
/** A player (or player segment) in the back office: a share of the opens and, optionally, their own odds. */
export interface MistyPlayer {
  id: string;
  name: string;
  /** share of simulated opens, any positive number (normalised) */
  share: number;
  /** percent per outcome id; missing ids fall back to the box table */
  weights?: Record<string, number>;
}
export interface MistyConfig {
  boxSlug: string;
  /** back-office odds: percent per outcome id (defaults to the live weights) */
  weights: Record<string, number>;
  bonus: MistyBonusEntry[];
  /** what one Mistee counts for on screen (Misty's data says $1) and what it really costs the operator */
  misteeFace: number;
  misteeReal: number;
  /** physical items: fraction of the listed value realised */
  itemRealized: number;
  /** commit-reveal on (Misty's scheme, a seed per open) or off (plain random, nothing to check) */
  provablyFair: boolean;
  clientSeed: string;
  players: MistyPlayer[];
  /** who is spinning in live play */
  activePlayerId: string;
  run: { opens: number; verifySample: number };
  /** a box designed in the builder instead of one of the live boxes; boxSlug must equal customBox.slug */
  customBox?: MistyBox;
}
export interface MistyBonusSpin {
  nonce: number;
  digest: string;
  roll: number;
  mistees: number;
}
export interface MistySpin {
  idx: number;
  playerId: string;
  boxSlug: string;
  price: number;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  nonce: number;
  digest: string;
  /** 0..1, read from the first 13 hex characters of the digest */
  roll: number;
  /** hash of the odds table used for this open ("frozen onto the open") */
  tableHash: string;
  outcomeId: string;
  label: string;
  kind: MistyOutcome["kind"];
  rarity: string;
  mistees: number;
  freeSpins: number;
  bonus: MistyBonusSpin[];
  totalMistees: number;
  itemValue: number;
  verified?: boolean;
}
export interface MistyOutcomeStat {
  id: string;
  label: string;
  kind: MistyOutcome["kind"];
  percent: number;
  expected: number;
  actual: number;
  costPerOpen: number;
}
export interface MistyPlayerStat {
  id: string;
  name: string;
  opens: number;
  spent: number;
  items: number;
  itemValue: number;
  mistees: number;
  returnFace: number;
  expectedFace: number;
  itemChance: number;
}
export interface MistyResult {
  kind: "misty";
  boxSlug: string;
  boxName: string;
  price: number;
  opens: number;
  spent: number;
  items: number;
  itemValue: number;
  itemValueReal: number;
  mistees: number;
  freeSpins: number;
  returnFace: number;
  returnReal: number;
  expectedFace: number;
  expectedReal: number;
  pItem: number;
  expectedMistees: number;
  byOutcome: MistyOutcomeStat[];
  chi: ChiSquare;
  perPlayer: MistyPlayerStat[];
  verifier: Verifier;
  sample: MistySpin[];
  /** running return after n opens, about 200 points */
  curve?: { n: number; face: number; real: number }[];
  /** longest run of opens in a row without a physical item */
  longestDry?: number;
  elapsedMs: number;
}

/* ---------- Jemlit: a copy of the live box mechanism (captured 14 October 2026) ---------- */

/** One row of a Jemlit box, as the site's box API lists it. */
export interface JemlitItem {
  id: string;
  label: string;
  /** listed price, the value shown on the page */
  price: number;
  /** Credits paid if the item is exchanged instead of shipped (mostly 90% of price) */
  cashback: number;
  /** chance as a fraction; the box sums to 1 */
  chance: number;
  /** roll band on a 0 to 1 line: wins if from < roll/100 <= to */
  from: number;
  to: number;
  /** credit rows: converted to Credits automatically, never shipped */
  autoCashback: boolean;
  shippable: boolean;
}
export interface JemlitBox {
  slug: string;
  name: string;
  price: number;
  basePrice?: number;
  riskLevel?: number | null;
  items: JemlitItem[];
}
export interface JemlitBoxSummary {
  slug: string;
  name: string;
  price: number;
  items: number;
  rtpPrice: number | null;
  rtpCashback: number | null;
  pAtOrAbovePrice: number;
  pShippableItem: number;
  top: { label: string; price: number; chance: number } | null;
  riskLevel?: number | null;
}
export interface JemlitPlayer {
  id: string;
  name: string;
  share: number;
  /** chance per item id; missing ids fall back to the box table */
  chances?: Record<string, number>;
}
export interface JemlitConfig {
  boxSlug: string;
  /** the loaded or built box; the featured boxes are also embedded */
  box?: JemlitBox;
  /** back-office odds: chance per item id (fractions, sum 1) */
  chances: Record<string, number>;
  creditFace: number;
  creditReal: number;
  itemRealized: number;
  provablyFair: boolean;
  clientSeed: string;
  players: JemlitPlayer[];
  activePlayerId: string;
  run: { opens: number; verifySample: number };
}
export interface JemlitSpin {
  idx: number;
  playerId: string;
  boxSlug: string;
  price: number;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  nonce: number;
  digest: string;
  /** 0 to 100 */
  roll: number;
  tableHash: string;
  itemId: string;
  label: string;
  itemPrice: number;
  cashback: number;
  /** credit row: paid as Credits, never shipped */
  credit: boolean;
  lower: number;
  upper: number;
  verified?: boolean;
}
export interface JemlitItemStat {
  id: string;
  label: string;
  credit: boolean;
  chance: number;
  price: number;
  cashback: number;
  expected: number;
  actual: number;
  costPerOpen: number;
}
export interface JemlitPlayerStat {
  id: string;
  name: string;
  opens: number;
  spent: number;
  items: number;
  itemValue: number;
  credits: number;
  returnPrice: number;
  expectedPrice: number;
  bigChance: number;
}
export interface JemlitResult {
  kind: "jemlit";
  boxSlug: string;
  boxName: string;
  price: number;
  opens: number;
  spent: number;
  items: number;
  itemValue: number;
  itemValueReal: number;
  credits: number;
  creditOpens: number;
  bigWins: number;
  returnPrice: number;
  returnReal: number;
  expectedPrice: number;
  expectedCashback: number;
  expectedReal: number;
  pBig: number;
  byItem: JemlitItemStat[];
  chi: ChiSquare;
  perPlayer: JemlitPlayerStat[];
  verifier: Verifier;
  sample: JemlitSpin[];
  curve: { n: number; price: number; real: number }[];
  longestDry: number;
  elapsedMs: number;
}

/* ---------- IcyBox: a reconstruction of the iOS app's box from public sources (terms, App Store, site, press, reviews). No API was captured. ---------- */
export type IcyboxBandId = "common" | "uncommon" | "rare" | "epic" | "legendary" | "grail";
export interface IcyboxItem {
  id: string;
  label: string;
  brand: string;
  /** the value the app lists for the item (reported as retail-style) */
  value: number;
  category: "watch" | "bag";
  /** relative chance inside the band (reconstructed): the cheap end of a wide band is common, the showcase end rare */
  weight: number;
}
/** A rarity band: the app shows a chance and a value range per band, not per item. */
export interface IcyboxBand {
  id: IcyboxBandId;
  label: string;
  /** reconstructed chance, 0..1; the five boxes are fitted to a target return at listed values */
  chance: number;
  items: IcyboxItem[];
}
export interface IcyboxBox {
  slug: string;
  name: string;
  tier: "bronze" | "silver" | "ruby" | "gold" | "icy";
  price: number;
  bands: IcyboxBand[];
  /** the six values the website's box carousel shows for this tier (captured) */
  showcase: number[];
  note: string;
}
export interface IcyboxConfig {
  boxSlug: string;
  /** chance per band id, 0..1, sums to 1 */
  chances: Record<string, number>;
  /** buyback offer as a share of the listed value (reported about 0.9) */
  buybackPercent: number;
  /** hours to decide before the item is sold back automatically (length not published; an assumption) */
  buybackWindowHours: number;
  /** share of players who miss the window (auto-sold) */
  missWindowRate: number;
  /** share of wins worth the price or more that are kept and shipped */
  keepRate: number;
  /** cost of keeping: shipping fee per item and sales tax on the value */
  shippingFee: number;
  taxRate: number;
  /** cashing out: minimum and fee (site: $6 minimum; reviews: $2 fee) */
  withdrawMin: number;
  withdrawFee: number;
  /** resale share of the listed value for kept items */
  itemRealized: number;
  /** finite drop: a fixed stock of copies; 0 copies or disabled = plain odds */
  drop: { enabled: boolean; copies: number; retireAt: number };
  run: { opens: number };
}
export interface IcyboxSpin {
  idx: number;
  boxSlug: string;
  price: number;
  /** the simulator's own roll, 0..1; IcyBox publishes nothing of the kind */
  roll: number;
  bandId: IcyboxBandId;
  bandFrom: number;
  bandTo: number;
  item: IcyboxItem;
  buyback: number;
  keepCost: number;
  /** drop mode: copies left after this open and whether the drop was retired by this open */
  copiesLeft?: number;
  retired?: boolean;
}
export interface IcyboxBandStat {
  id: IcyboxBandId;
  label: string;
  chance: number;
  expected: number;
  actual: number;
  meanValue: number;
  costPerOpen: number;
}
export interface IcyboxResult {
  kind: "icybox";
  boxSlug: string;
  boxName: string;
  price: number;
  opens: number;
  spent: number;
  listedValue: number;
  buybackPaid: number;
  soldBack: number;
  autoSold: number;
  itemsKept: number;
  keptValue: number;
  keptReal: number;
  feesPaid: number;
  grails: number;
  pGrail: number;
  bigWins: number;
  pBig: number;
  returnListed: number;
  returnBuyback: number;
  returnReal: number;
  expectedListed: number;
  expectedBuyback: number;
  expectedReal: number;
  byBand: IcyboxBandStat[];
  chi: ChiSquare;
  curve: { n: number; listed: number; buyback: number }[];
  longestDry: number;
  drop: { enabled: boolean; copies: number; retireAt: number; drops: number; retired: number; grailsShipped: number; grailsLeftBehind: number; opensPerDrop: number } | null;
  verifier: Verifier;
  sample: IcyboxSpin[];
}


export interface ChiSquare {
  statistic: number;
  df: number;
  pValue: number;
  merged: number; // how many low-expectation cells were merged
}

export interface Verifier {
  sampled: number;
  passed: number;
  failed: number;
  reasons: Record<string, number>;
}

export type Progress = (done: number, total: number) => void;

export interface Histogram {
  edges: number[];
  counts: number[];
  label: string;
}

export type RngId = "math-random" | "sfc32" | "lcg" | "csprng";
