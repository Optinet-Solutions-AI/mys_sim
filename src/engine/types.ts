// Shared types for the simulation engine. The engine is pure: no I/O, no DOM, no network.

export type PriceLayer = "retail" | "asking" | "realized";
export type Tier = "filler" | "common" | "rare" | "epic" | "legendary" | "grail";
export type Category = "watch" | "bag" | "jewellery" | "sneaker" | "accessory" | "beauty" | "tech" | "credit";

export interface CatalogItem {
  id: string;
  name: string;
  brand: string;
  category: Category;
  tier: Tier;
  /** prices in whole currency units (USD) */
  retail: number;
  asking: number;
  realized: number;
  confidence: "high" | "medium" | "low";
  /** icon key in src/lib/icons.generated.ts, e.g. "fluent:watch" */
  icon: string;
  /** tile colour (hex) */
  color: string;
}

/** An item inside a box with its integer weight (tickets). */
export interface BoxItem {
  itemId: string;
  weight: number;
}

export interface BoxDef {
  name: string;
  /** box price in currency units */
  price: number;
  /** total tickets; weights must sum to this exactly */
  ticketTotal: number;
  items: BoxItem[];
  /** which price layer counts as the payout value */
  valueLayer: PriceLayer;
  /** which price layer the operator displays as "value" */
  displayLayer: PriceLayer;
}

export type SchemeId =
  | "none"
  | "server-hash"
  | "hmac-sha256"
  | "jemlit"
  | "packs"
  | "misty"
  | "razed"
  | "glassbox";

export type MappingId =
  | "float-cumulative"
  | "int32-mod"
  | "int32-floor"
  | "int52-floor"
  | "int256-mod"
  | "int256-floor"
  | "rejection64";

export type RngId = "math-random" | "sfc32" | "lcg" | "csprng";
export type RotationId = "per-open" | "on-retire" | "every-n";

export interface AlgoConfig {
  scheme: SchemeId;
  /** "native" uses the scheme's own documented mapping */
  mapping: MappingId | "native";
  /** randomness source when scheme is "none" (and for simulation-side choices) */
  rng: RngId;
  rotation: RotationId;
  rotateEvery: number;
  clientSeedMode: "player-set" | "site-default";
}

export interface RigConfig {
  /** result chosen from a hidden table; honest-looking proof does not reproduce it */
  bypass?: { hiddenRtp: number };
  /** draw from a hidden table while displaying the configured one */
  tableSwap?: { hiddenRtp: number };
  /** tagged accounts draw from a table at a different RTP */
  perAccount?: { tag: string; rtp: number };
  /** pay only the two cheapest items */
  cheapestTwo?: boolean;
  /** when the honest outcome is expensive, the operator tries up to k client seeds and keeps the first cheap one */
  serverChosenClientSeed?: { attempts: number; thresholdMultiple: number };
  /** when the honest outcome is expensive, the operator tries up to k server seeds after seeing the client seed */
  commitAfterClient?: { attempts: number; thresholdMultiple: number };
  /** reroll (rotate seed) when payout exceeds a multiple of the price */
  rotationOnWins?: { thresholdMultiple: number; maxRerolls: number };
  /** displayed values multiplied; payouts unchanged */
  valuationInflation?: { factor: number };
  /** hidden drift of RTP across the run */
  dynamicOdds?: { rtpStart: number; rtpEnd: number };
  /** RTP changed at a fraction of the run */
  midRunRtpChange?: { atFraction: number; newRtp: number };
  /** battles: bots draw from a table at this RTP */
  favouredBots?: { botRtp: number };
  /** fraction of players who ever verify (informs the detector only) */
  selectiveDisclosure?: { verifyFraction: number };
  /** presentation only: losing spins shown stopping one tile from a top item; strip over-represents rare items */
  nearMiss?: { rate: number; showcase: number };
}

export interface AccountMix {
  tags: { tag: string; share: number }[];
}

export interface OpenRecord {
  idx: number;
  tag: string;
  serverSeed: string;
  serverHash: string;
  clientSeed: string;
  nonce: number;
  opening: number;
  beaconRound?: number;
  beaconValue?: string;
  manifestHash?: string;
  digest: string;
  ticket: number;
  itemId: string;
  payout: number;
  /** honest recomputation outcome */
  verified?: boolean;
  verifyReason?: string;
}

export interface ItemStat {
  itemId: string;
  stated: number; // probability
  observed: number; // count
  expected: number; // count
  payoutValue: number; // value at valueLayer
  displayValue: number; // value at displayLayer (after inflation rig)
}

export interface Histogram {
  edges: number[];
  counts: number[];
  label: string;
}

export interface ChiSquare {
  statistic: number;
  df: number;
  pValue: number;
  merged: number; // how many low-expectation cells were merged
}

export interface MysteryBoxConfig {
  box: BoxDef;
  algo: AlgoConfig;
  rigs: RigConfig;
  accounts: AccountMix;
}

export interface MysteryBoxSizes {
  opens: number;
  verifySample: number;
}

export interface MysteryBoxResult {
  kind: "mystery-box";
  opens: number;
  items: ItemStat[];
  chi: ChiSquare;
  statedRtp: Record<PriceLayer, number>;
  realizedRtp: Record<PriceLayer, number>;
  /** standard error of realized RTP at the value layer */
  rtpSe: number;
  displayedRtp: number;
  ev: Record<PriceLayer, number>;
  pAtLeastPrice: number;
  payoutHistogram: Histogram;
  ticketRegions: { bins: number; counts: number[] };
  byTag: Record<string, { opens: number; paid: number; rtp: number }>;
  rotations: number;
  rerolls: number;
  grinds: number;
  fallthroughs: number;
  verifier: { sampled: number; passed: number; failed: number; reasons: Record<string, number> };
  sample: OpenRecord[];
  elapsedMs: number;
}

export interface SellbackConfig {
  box: BoxDef;
  algo: AlgoConfig;
  rigs: RigConfig;
  sellback:
    | { mode: "vendor"; haircut: number } // credited at displayLayer value × (1 − haircut), stays as balance
    | { mode: "cash"; layer: PriceLayer; haircut: number }; // paid out, leaves the system
  withdrawal: { mode: "cash" | "through-items"; minWithdraw: number };
  population: {
    agents: number;
    depositMean: number;
    depositSpread: number; // lognormal sigma
    sessions: number;
    opensPerSession: number;
    sellBelowMultiple: number; // sell if value < multiple × price
    shipAboveMultiple: number; // ship if value ≥ multiple × price
    rebetFraction: number; // fraction of balance re-bet per session
    maxDeposits: number; // lifetime number of deposits; after that, a busted agent stops
    cashOutTargetMultiple: number; // try to withdraw when balance ≥ multiple × deposit
  };
}

export interface SellbackResult {
  kind: "sellback";
  agents: number;
  deposits: number;
  wagered: number;
  creditedValue: number; // value credited to balance on sell-back (vendor) or paid (cash)
  shippedCount: number;
  shippedValue: number;
  withdrawnCash: number;
  ggr: number;
  hold: number; // (deposits − cash out) / deposits
  sellbackRate: number;
  shipRate: number;
  ruined: number;
  ruinFraction: number;
  medianSessionsToRuin: number | null;
  balancePercentiles: Record<string, number>;
  moneyLeftSystem: number;
  extraWagerForWithdrawal: number;
  bankrollCurve: { session: number; p10: number; p50: number; p90: number }[];
  elapsedMs: number;
}

export type BattleMode = "normal" | "crazy" | "group" | "terminal" | "jackpot";

export interface BattlesConfig {
  boxes: BoxDef[];
  algo: AlgoConfig;
  rigs: RigConfig;
  mode: BattleMode;
  players: number;
  humansPerBattle: number; // rest filled by bots when bots enabled
  bots: { enabled: boolean };
}

export interface BattlesResult {
  kind: "battles";
  battles: number;
  mode: BattleMode;
  entryPerPlayer: number;
  avgWagerPerBattle: number;
  avgSingleOpenPrice: number;
  wagerMultiplier: number;
  totalWagered: number;
  totalPaid: number;
  realizedEdge: number;
  humanWins: number;
  botWins: number;
  humanWinRate: number;
  expectedHumanWinRate: number;
  ties: number;
  payoutMultipleHistogram: Histogram;
  topPotMultiple: number;
  elapsedMs: number;
}

export interface RetentionConfig {
  box: BoxDef;
  algo: AlgoConfig;
  rigs: RigConfig;
  days: number;
  agents: number;
  dailyBox: { enabled: boolean; expiry: "24h" | "stack"; tierValues: number[] }; // value of the daily box drop by level
  race: { enabled: boolean; cadenceDays: number; prizes: number[] }; // prizes to top wagerers
  affiliate: { enabled: boolean; referredShare: number; freeBoxes: number; commission: number };
  visitor: {
    baseVisit: number; // daily visit probability
    incentiveLift: number; // added probability when a free box is available
    raceLift: number; // added probability when in top band of a race
    churnHazard: number; // daily chance to leave after a losing day
    depositPerVisit: number;
    opensPerVisit: number;
  };
}

export interface RetentionResult {
  kind: "retention";
  agents: number;
  days: number;
  dau: number[];
  retention: { d1: number; d7: number; d30: number };
  controlRetention: { d1: number; d7: number; d30: number };
  deposits: number;
  wagered: number;
  ggr: number;
  bonusCost: number;
  ngr: number;
  ltv: number;
  holdAfterBonuses: number;
  incrementalWager: number;
  incrementalWagerPerBonusDollar: number;
  raceWagerConcentrationTop10: number;
  elapsedMs: number;
}

export type LabId = "mystery-box" | "sellback" | "battles" | "retention";

export type AnyConfig = MysteryBoxConfig | SellbackConfig | BattlesConfig | RetentionConfig;
export type AnyResult = MysteryBoxResult | SellbackResult | BattlesResult | RetentionResult;

export interface RunRecord {
  id: string;
  lab: LabId;
  name: string;
  createdAt: string;
  seed: number;
  engineVersion: string;
  config: AnyConfig;
  sizes: Record<string, number>;
  catalogSnapshot: CatalogItem[];
  result: AnyResult;
}

export type Progress = (done: number, total: number) => void;
