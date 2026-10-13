// Types used by the Misty engine. Extracted from the simulator's types.ts (kit v1.0).

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
