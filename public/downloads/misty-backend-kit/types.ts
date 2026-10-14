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
