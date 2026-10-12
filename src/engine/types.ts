// Shared types for the simulation engine. The engine is pure: no I/O, no DOM, no network.

export type PriceLayer = "retail" | "asking" | "realized";
export type Tier = "filler" | "common" | "rare" | "epic" | "legendary" | "grail";
export type Category = "watch" | "bag" | "jewellery" | "sneaker" | "accessory" | "beauty" | "tech" | "credit" | "luggage" | "nothing";

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
  /** fictional catalogue item, or reconstructed from an operator's captured drop table */
  source?: "fictional" | "captured";
  operator?: string;
}

/** An item inside a box with its integer weight (tickets). */
export interface BoxItem {
  itemId: string;
  weight: number;
}

export type BoxModel = "weighted" | "pool" | "tiered";

export interface BoxTier {
  id: string;
  name: string;
  /** stated odds of the tier, percent */
  percent: number;
  itemIds: string[];
  /** finite copies per item in this tier; undefined = unlimited */
  inventory?: number;
}

export interface BoxDef {
  name: string;
  /** box price in currency units */
  price: number;
  /** total tickets; weights must sum to this exactly (weighted model) */
  ticketTotal: number;
  items: BoxItem[];
  /** which price layer counts as the payout value */
  valueLayer: PriceLayer;
  /** which price layer the operator displays as "value" */
  displayLayer: PriceLayer;
  /** draw model; default weighted */
  model?: BoxModel;
  /** finite drop (IcyBox, kuji): copies per item drawn without replacement */
  pool?: {
    copies: Record<string, number>;
    /** when-empty: a new identical drop starts; operator-may-retire: the early-retirement rig can end it; must-distribute: remaining top items are awarded at retirement */
    retire: "when-empty" | "operator-may-retire" | "must-distribute";
    /** kuji "Last One": the buyer of the final copy also receives this item */
    lastOneItemId?: string;
  };
  /** tier-first draw (StockX): odds per tier, item picked inside the tier from inventory */
  tiers?: BoxTier[];
  /** StockX floor: every item worth at least this multiple of the price (builder filters below it) */
  floorMultiple?: number;
  /** Jemlit "guaranteed" mix applied into the weights: share of opens drawn from items at or above minValue */
  guarantee?: { share: number; minValue: number };
  /** gacha pity: after this many consecutive losses the next open is drawn from items at or above the multiple of price */
  pity?: { afterLosses: number; minValueMultiple: number };
  /** where the odds came from */
  note?: string;
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
  /** Courtyard: every pull appended to a public ledger, so outsiders can audit observed odds over all opens */
  publicLog?: boolean;
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
  /** presentation only: losing spins shown stopping beside a valuable item; strip over-represents rare items */
  nearMiss?: { rate: number; showcase: number };
  /** IcyBox: a finite drop is retired once this fraction is sold if any item worth at least grailMultiple × price remains */
  earlyRetire?: { atFraction: number; grailMultiple: number };
  /** Pop Mart: an undisclosed item takes a share of tickets from the most common item; proofs fail on secret draws */
  secretItem?: { itemId: string; percent: number };
  /** presentation: every drop below the price celebrated like a win (loss disguised as a win) */
  ldwCelebration?: boolean;
  /** presentation: a live-drops ticker of bots winning top items at this rate */
  fakeLiveFeed?: { grailsPerMinute: number };
  /** presentation: after a loss, tell the player how many tickets away the nearest big item was */
  ticketsAwayMessage?: boolean;
  /** presentation: demo spins drawn from a table at this RTP instead of the real one */
  demoOdds?: { demoRtp: number };
  /** presentation: scarcity and social-proof cues */
  urgency?: { stockLeft: number; viewers: number; countdownMinutes: number };
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
  /** pool model: remaining total and copies before this draw, so the open can be recomputed */
  poolT?: number;
  poolCounts?: number[];
  /** tiered model: the tier the proof resolves to */
  tierId?: string;
  /** pity rule applied to this open */
  pityApplied?: boolean;
  /** kuji Last One or retirement award attached to this open */
  bonusItemId?: string;
  bonusPayout?: number;
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

export interface Verifier {
  sampled: number;
  passed: number;
  failed: number;
  reasons: Record<string, number>;
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
  verifier: Verifier;
  sample: OpenRecord[];
  /** pool and tiered models */
  drops?: number;
  retirements?: number;
  retirementAwards?: { itemId: string; payout: number }[];
  lastOneAwards?: number;
  pityApplied?: number;
  secretDraws?: number;
  stoppedEarly?: string;
  /** Merkle root over the sampled records (Glass Box daily root) */
  ledgerRoot?: string;
  publicLog?: boolean;
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
  /** IcyBox and StockX: a decision window; inattentive agents get the automatic action */
  decision?: { windowMinutes: number; inattention: number; autoAction: "sell" | "ship" };
  /** IcyBox: costs of keeping an item */
  keepFees?: { taxRate: number; shipping: number; insuranceRate: number };
  /** IcyBox: buyback at an undisclosed operator estimate of realized value */
  estimate?: { factor: number; disclosed: boolean };
  /** StockX: site credit expires after this many sessions unused */
  creditExpiry?: { sessions: number };
  /** Courtyard: guaranteed-value code, buyback never below this amount */
  guaranteeFloor?: number;
  /** Cases.gg: a share of every deposit locked in a vault, out of reach of re-betting until cash-out */
  vault?: { enabled: boolean; lockFraction: number };
  /** PackDraw Forge, Cases.gg custom boxes: share of each box price paid to the box creator */
  creatorCut?: number;
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
  /** options */
  autoActions?: number;
  keepFeesPaid?: number;
  expiredCredit?: number;
  floorTopUps?: number;
  vaultLocked?: number;
  creatorPaid?: number;
  elapsedMs: number;
}

export type BattleMode = "normal" | "crazy" | "group" | "terminal" | "jackpot" | "coinflip" | "break";

export interface BattlesConfig {
  boxes: BoxDef[];
  algo: AlgoConfig;
  rigs: RigConfig;
  mode: BattleMode;
  players: number;
  humansPerBattle: number; // rest filled by bots when bots enabled
  bots: { enabled: boolean };
  /** Cases.gg coinflip: house edge taken from the pot */
  coinflipEdge?: number;
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
  /** Cases.gg missions: a reward for reaching a daily wager target */
  missions?: { enabled: boolean; wagerTarget: number; reward: number };
  /** sweepstakes free route: a share of visitors never deposit and get one free open per visit at equal odds */
  freeEntry?: { enabled: boolean; share: number };
  /** Glass Box: daily spend cap per visitor */
  spendCap?: { enabled: boolean; perDay: number };
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
  missionCost?: number;
  freeEntryCost?: number;
  capBlockedDeposits?: number;
  elapsedMs: number;
}

/** Misty's two-stage economy: the box pays credits, credits are tickets in a draw with a fixed pool. */
export interface CreditsConfig {
  box: BoxDef;
  algo: AlgoConfig;
  rigs: RigConfig;
  raffle: {
    ticketPool: number; // tickets in one draw
    ticketFace: number; // face value of one credit, in currency
    prizeItemId: string; // the prize of the draw
    drawRule: "when-sold-out" | "on-schedule"; // draw when the pool fills, or every scheduleEvery paid opens regardless of sell-through
    scheduleEvery: number;
    freeEntryShare: number; // free (postal) tickets per paid ticket, Misty's equal-odds free route
    monthlyCap: number; // Omaze-style cap on spend per agent per 30 opens; 0 = none
    disclosedEv: boolean; // Glass Box: show the expected value of a ticket
  };
  population: { agents: number; opensPerAgent: number };
}

export interface CreditsResult {
  kind: "credits";
  agents: number;
  opens: number;
  spent: number;
  physicalPaidDisplay: number;
  physicalPaidRealized: number;
  creditsIssued: number;
  creditFaceValue: number;
  ticketsPaid: number;
  ticketsFree: number;
  raffles: number;
  prizesPaidTotal: number;
  prizesToPaid: number;
  prizesToFree: number;
  prizePerTicket: number; // real expected value of one ticket
  nominalRtp: number; // (physical at display + credits at face) / spent
  endToEndRtp: number; // (physical at realized + prizes to paid players) / spent
  hold: number;
  unsoldShareAtDraw: number;
  capBlockedOpens: number;
  verifier: Verifier;
  elapsedMs: number;
}

/** Upgrader (Jemlit, Cases.gg) and the vendor's Deals: stake money or an item for a chance at a better item. */
export interface UpgraderConfig {
  algo: AlgoConfig;
  rigs: RigConfig;
  mode: "upgrader" | "deals";
  edge: number; // stated house edge
  maxChance: number; // the vendor caps Deals at 80%
  targetItemId: string;
  valueLayer: PriceLayer;
  stake: number; // upgrader: amount staked per attempt
  chance: number; // deals: chosen chance of winning
  population: { agents: number; bankroll: number; attempts: number; policy: "single" | "ladder" };
}

export interface UpgraderResult {
  kind: "upgrader";
  mode: "upgrader" | "deals";
  attempts: number;
  wins: number;
  winRate: number;
  statedChance: number;
  pricePerAttempt: number;
  targetValue: number;
  wagered: number;
  paid: number;
  realizedEdge: number;
  statedEdge: number;
  agents: number;
  ruined: number;
  ruinFraction: number;
  medianAttemptsToRuin: number | null;
  reachedTarget: number;
  verifier: Verifier;
  sample: OpenRecord[];
  elapsedMs: number;
}

export type LabId = "mystery-box" | "sellback" | "battles" | "retention" | "credits" | "upgrader";

export type AnyConfig = MysteryBoxConfig | SellbackConfig | BattlesConfig | RetentionConfig | CreditsConfig | UpgraderConfig;
export type AnyResult = MysteryBoxResult | SellbackResult | BattlesResult | RetentionResult | CreditsResult | UpgraderResult;

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
