// The hub is organised by source. Each operator has its own features, each with its own structure, presets and
// allowed settings. Nothing from one operator is mixed into another's screens.
import { applyGuarantee } from "@/engine/table";
import { DEFAULT_MISTY, mistyConfigFor } from "./mistyPresets";
import { DEFAULT_JEMLIT, DEFAULT_JEMLIT_PACKS } from "./jemlitPresets";
import { DEFAULT_ICYBOX } from "./icyboxPresets";
import { CATALOG_BY_ID } from "@/engine/catalog";
import type { AnyConfig, BattleMode, BattlesConfig, CreditsConfig, LabId, MysteryBoxConfig, RetentionConfig, SellbackConfig, UpgraderConfig } from "@/engine/types";
import {
  CAPTURED,
  CASES_ALGO,
  COURTYARD_ALGO,
  COURTYARD_PACK,
  DEFAULT_BATTLES,
  DEFAULT_CREDITS,
  DEFAULT_MYSTERY,
  DEFAULT_RETENTION,
  DEFAULT_SELLBACK,
  DEFAULT_UPGRADER,
  GLASSBOX_ALGO,
  GLASSBOX_BOX,
  ICYBOX_BOX,
  JEMLIT_ALGO,
  KUJI_BOX,
  LUCKY_BAG,
  MISTY_ALGO,
  PITY_BOX,
  SELLBACK_PRESETS,
  STANDARD_PF_ALGO,
  STOCKX_BOX,
  STOCKX_FINITE_BOX,
  TICKET_TOTAL,
  VENDOR_ALGO,
  VENDOR_BOX,
} from "./presets";

export interface FeatureDoc {
  title: string;
  short: string;
  what: string;
  configure: string[];
  read: string[];
  source: string;
}

export interface FeatureDef {
  key: string;
  lab: LabId;
  doc: FeatureDoc;
  initial: AnyConfig;
  presets?: { id: string; name: string; config: AnyConfig }[];
  /** settings sections this feature exposes; undefined = all of the lab's sections */
  sections?: string[];
  /** rigs this feature exposes; undefined = the generic research rigs */
  rigIds?: string[];
  /** box builder: the draw model is part of the operator's structure */
  lockModel?: boolean;
  /** box builder: items and odds are a captured table; unlock to experiment */
  lockItems?: boolean;
  /** upgrader: the mode is part of the structure */
  lockMode?: boolean;
  /** battles: allowed modes */
  modes?: BattleMode[];
  /** battles: offer the committed-seed engine from the backend kit next to the research engine */
  kitEngine?: boolean;
  /** sell-back: option cards shown (decision, keepFees, estimate, creditExpiry, guaranteeFloor, vault, creatorCut) */
  sellbackOptions?: string[];
  /** retention: extra cards shown (missions, freeEntry, spendCap) */
  retentionExtras?: string[];
  /** Misty-style page: no chips under the title, simulation hidden, analysis folded after the open */
  minimal?: boolean;
}

export interface OperatorDef {
  id: string;
  name: string;
  kind: "operator" | "ours" | "adjacent" | "research";
  /** features kept in the code but not shown as tabs for now */
  hiddenFeatures?: FeatureDef[];
  tagline: string;
  description: string;
  icon: string;
  sources: string;
  features: FeatureDef[];
}

/** Research rigs that apply to any operator's draw. Operator-specific rigs are added per feature. */
export const GENERIC_RIGS = ["bypass", "tableSwap", "perAccount", "cheapestTwo", "serverChosenClientSeed", "commitAfterClient", "rotationOnWins", "valuationInflation", "dynamicOdds", "midRunRtpChange", "selectiveDisclosure"];
const BATTLE_RIGS = [...GENERIC_RIGS, "favouredBots"];
const PRESENTATION_RIGS = ["nearMiss", "ldwCelebration", "fakeLiveFeed", "ticketsAwayMessage", "demoOdds", "urgency"];
const VENDOR_MODES: BattleMode[] = ["normal", "crazy", "group", "terminal", "jackpot"];

const mystery = (box: MysteryBoxConfig["box"], algo: MysteryBoxConfig["algo"], rigs: MysteryBoxConfig["rigs"] = {}, accounts = DEFAULT_MYSTERY.accounts): MysteryBoxConfig => ({ box, algo, rigs, accounts });

// Jemlit: the captured eBox with a "40% guaranteed" floor applied as a mixture
const JEMLIT_GUARANTEED = {
  ...CAPTURED.jemlitApple,
  name: CAPTURED.jemlitApple.name.replace(" · ", " · 40% guaranteed ≥ $19 · "),
  items: applyGuarantee(CAPTURED.jemlitApple.items, TICKET_TOTAL, 0.4, 19, "retail", CATALOG_BY_ID),
  guarantee: { share: 0.4, minValue: 19 },
  note: (CAPTURED.jemlitApple.note ?? "") + " With Jemlit's 'guaranteed' mix applied: 40% of opens drawn from items worth at least $19, the rest from the full table.",
};
const FUKUBUKURO_BOX = { ...LUCKY_BAG, name: "Fukubukuro lucky bag · $170 · 105% at realized · sealed, finite", pool: { ...LUCKY_BAG.pool!, retire: "when-empty" as const }, note: "The Japanese New Year lucky bag: a sealed bag worth more than it costs, sold in a finite run. The original positive-expected-value box; no secrecy about the odds because there are none to hide." };

export const OPERATORS: OperatorDef[] = [
  {
    id: "vendor",
    name: "Evo Verse",
    kind: "operator",
    tagline: "",
    description: "What the vendor sells: boxes with a 90% return knob on listed values and no commitment, sell-back into balance with withdrawal only through items, battles against bots, a retention system of daily boxes, races and affiliates, and Deals.",
    icon: "fluent:briefcase",
    sources: "Dossier 2 §3.5; vendor-feature-inventory.md",
    features: [
      {
        key: "vendor-boxes",
        minimal: true,
        lab: "mystery-box",
        lockModel: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Mystery Boxes",
          short: "The 90% RTP knob on listed values, no commitment.",
          what: "The vendor's box: weights from the RTP solver at 90% of listed value, no commitment published. The research toggles let you ask what changes if a commitment scheme is added or a rig is switched on.",
          configure: ["Items and the RTP knob (weighted odds only, as the vendor builds them).", "Algorithm (research: the vendor publishes none).", "Rigs and account mix (research)."],
          read: ["Stated against realized return at listed, asking and realized prices; chi-square; proofs when a scheme is on; the detector."],
          source: "Vendor demo (dossier 2 §3.5): 'RTP is defaulted to 90%'.",
        },
        initial: DEFAULT_MYSTERY,
        presets: [
          { id: "vendor", name: "Vendor default: no commitment, 90% on listed value", config: DEFAULT_MYSTERY },
          { id: "vendor-pf", name: "Research: the same box with a standard provably-fair scheme", config: mystery(VENDOR_BOX, STANDARD_PF_ALGO) },
          { id: "vendor-swap", name: "Research: table swap to 70% behind a standard provably fair", config: mystery(VENDOR_BOX, STANDARD_PF_ALGO, { tableSwap: { hiddenRtp: 0.7 } }) },
          { id: "vendor-streamer", name: "Research: streamer accounts at 160% RTP", config: mystery(VENDOR_BOX, STANDARD_PF_ALGO, { perAccount: { tag: "streamer", rtp: 1.6 } }, { tags: [{ tag: "player", share: 0.9 }, { tag: "streamer", share: 0.1 }] }) },
        ],
      },
      {
        key: "vendor-sellback",
        minimal: true,
        lab: "sellback",
        sellbackOptions: [],
        sections: ["economy", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Sell-back & Cart",
          short: "Credit at displayed value, withdraw only through items.",
          what: "The vendor's economy: items are sold back into site balance at their displayed value and re-bet; balance can only leave the system by winning and shipping an item. The vendor says 99.9% of items are sold back and hold runs at 15 to 30% of deposits.",
          configure: ["Haircut and withdrawal rule as the vendor configures them.", "Agent population (assumptions).", "Box, algorithm and rigs (research)."],
          read: ["Hold, GGR, sell-back and ship rates, ruin, bankroll percentiles, extra wagering forced by withdraw-through-items."],
          source: "Vendor demo (dossier 2 §3.5).",
        },
        initial: SELLBACK_PRESETS.vendor,
        presets: [{ id: "vendor", name: "Vendor: credit at listed value, withdraw only through items", config: SELLBACK_PRESETS.vendor }],
      },
      {
        key: "vendor-battles",
        minimal: true,
        kitEngine: true,
        lab: "battles",
        modes: VENDOR_MODES,
        rigIds: BATTLE_RIGS,
        doc: {
          title: "Battles",
          short: "Multi-box battles with bots as the house; 90% of wagering.",
          what: "Several players open the same boxes and a mode decides who takes the pot. Bots fill empty seats and 'play against the house'. The vendor says battles are 90% of all wagering because the bet is the sum of all boxes.",
          configure: ["Engine: Kit (the committed-seed logic from the backend kit, with the database statuses) or Research (one shared random stream with rigs).", "Mode (normal, crazy, group, terminal, jackpot), players, bots, boxes per round.", "Algorithm and rigs (research engine only), including favoured bots."],
          read: ["Wager multiplier, realized house edge, human win rate against the fair rate, pot distribution."],
          source: "Vendor demo (dossier 2 §3.5).",
        },
        initial: DEFAULT_BATTLES,
      },
      {
        key: "vendor-retention",
        minimal: true,
        lab: "retention",
        retentionExtras: [],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Retention",
          short: "Daily boxes with 24-hour expiry, wager races, affiliate codes.",
          what: "The vendor's reward system: tiered daily free boxes that expire after 24 hours and do not stack, wager races with prize ladders, and affiliate codes with free boxes and commission. A control run with everything off measures the uplift and its cost.",
          configure: ["Daily box tiers and expiry, races, affiliate.", "Visitor model (assumptions).", "Box, algorithm and rigs (research)."],
          read: ["Retention against control, bonus cost, incremental wager per bonus dollar, LTV, hold after bonuses."],
          source: "Vendor demo (dossier 2 §3.5).",
        },
        initial: { ...DEFAULT_RETENTION, missions: undefined, freeEntry: undefined, spendCap: undefined } as RetentionConfig,
      },
      {
        key: "vendor-deals",
        minimal: true,
        lab: "upgrader",
        lockMode: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Deals",
          short: "Pick an item, choose a chance up to 80%, the price scales.",
          what: "The vendor's Deals: the player picks an item and a chance of winning it up to 80%; the price is the chance times the listed value plus the edge. The same two-outcome box as an Upgrader seen from the other side.",
          configure: ["Target item, chosen chance, chance cap, stated edge (listed values, no commitment, as the vendor runs it).", "Agents and ladder policy."],
          read: ["Win rate against the chosen chance, realized edge, ruin."],
          source: "Vendor demo (dossier 2 §3.5).",
        },
        initial: { ...DEFAULT_UPGRADER, mode: "deals", algo: VENDOR_ALGO, edge: 0.1, chance: 0.5, maxChance: 0.8, valueLayer: "retail", targetItemId: "s-aireau-jordan-1", population: { ...DEFAULT_UPGRADER.population, bankroll: 1000 } } as UpgraderConfig,
      },
    ],
  },
  {
    id: "icybox",
    name: "IcyBox",
    kind: "operator",
    tagline: "",
    description: "The iOS luxury app, reconstructed from public sources (terms, App Store, icybox.io, press releases, reviews): five boxes from $50 to $1,000, six rarity bands with a chance and a value range each, a buyback set by IcyBox, an auto sell-back window, fees to keep, limited drops the terms let IcyBox end early, and no proof of any kind.",
    icon: "fluent:watch",
    sources: "research/09-icybox-mechanism.md; captures of 14 October 2026",
    features: [
      {
        key: "icybox-boxes",
        lab: "icybox",
        minimal: true,
        doc: {
          title: "Mystery boxes",
          short: "Five boxes, six bands, a buyback instead of a proof.",
          what: "IcyBox as its public sources describe it: Bronze, Silver, Ruby, Gold and Icy boxes at $50, $100, $250, $500 and $1,000; six rarity bands from Common to Grail with a chance and a value range shown before buying; every open pays a watch or a bag; sell it back at an offer IcyBox sets (about 90% of the listed value, reviews say) or keep it and pay shipping and tax; miss the window and it is sold back automatically; limited-edition boxes are finite and may be ended before the grail goes out; no seed, hash or verifier. The bands, items and chances here are reconstructed (fitted to 85% at listed values) because the app is iOS-only and its odds modal was not captured.",
          configure: ["Box; the chance per band (edit or fit to a target return); limited drop and the retirement rule; buyback rate, window, fees, cash-out; resale share."],
          read: ["Return at listed values, if sold back, and really; grail odds; the drop status; the simulator's 200,000-open report."],
          source: "icybox.io (home, terms, support, privacy), App Store listing and reviews, press releases of 2 September and 1 October 2026, review sites; captured 14 October 2026.",
        },
        initial: DEFAULT_ICYBOX,
      },
    ],
    hiddenFeatures: [
      {
        key: "icybox-drops",
        lab: "mystery-box",
        lockModel: true,
        rigIds: [...GENERIC_RIGS, "earlyRetire"],
        doc: {
          title: "Drops",
          short: "Finite pools: once they are gone, they are gone.",
          what: "A drop is a finite pool of copies drawn without replacement, so the odds move with every open. IcyBox publishes no seed or hash. Its terms allow the box to be 'terminated or removed at any time even before all Assets... are distributed (including any grail)', which the early-retirement rig reproduces.",
          configure: ["Copies per item and the retirement rule (the pool model is fixed).", "Early-retirement rig; research rigs; an algorithm, if you want to ask what a commitment would add."],
          read: ["Return per drop at retail and realized; drops completed against retired; proofs (none, by default)."],
          source: "IcyBox terms and App Store listing (dossier 1 §2.4).",
        },
        initial: mystery(ICYBOX_BOX, VENDOR_ALGO),
        presets: [
          { id: "drop", name: "Drop: 100 copies, 3% grail, retail values, no commitment", config: mystery(ICYBOX_BOX, VENDOR_ALGO) },
          { id: "retired", name: "Drop retired at 70% sold while the grail remains", config: mystery(ICYBOX_BOX, VENDOR_ALGO, { earlyRetire: { atFraction: 0.7, grailMultiple: 20 } }) },
        ],
      },
      {
        key: "icybox-buyback",
        lab: "sellback",
        sellbackOptions: ["decision", "keepFees", "estimate"],
        sections: ["economy", "options", "population", "box", "algo", "rigs"],
        rigIds: [...GENERIC_RIGS, "earlyRetire"],
        doc: {
          title: "Buyback",
          short: "Undisclosed estimate, auto-sellback window, fees to keep.",
          what: "Keep or sell within a buyback period, or the item is sold back automatically at an estimate IcyBox sets and does not explain. Keeping costs sales tax, insurance and premium shipping. The lab measures how much of the drop's value ever leaves as goods.",
          configure: ["Estimate factor and whether it is disclosed, the buyback window and the share of agents who miss it, keep fees.", "Agent population; the drop; research rigs."],
          read: ["Hold, items shipped against sold back, fees paid, decisions missed, money that left the system."],
          source: "IcyBox terms and reviews (dossier 1 §2.4; dossier 2 §3.4).",
        },
        initial: SELLBACK_PRESETS.icybox,
        presets: [{ id: "icybox", name: "IcyBox: estimate at 70% of realized, 48-hour window then auto-sold, fees to keep", config: SELLBACK_PRESETS.icybox }],
      },
    ],
  },
  {
    id: "stockx",
    name: "StockX Mystery Boxes",
    kind: "operator",
    tagline: "Tier odds shown, every item worth at least the price, credit back",
    description: "A random selection 'from a specific value tier' with odds fixed per tier and identical for everyone, every item listed at or above the box price before fees, a five-minute decision window after which you are charged and shipped, and sell-back for 75 to 90% of list as StockX Credit valid one year.",
    icon: "fluent:running-shoe",
    sources: "Dossier 1 §2.4; dossier 2 §3.4",
    features: [
      {
        key: "stockx-box",
        lab: "mystery-box",
        lockModel: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Tiered box",
          short: "Tier-first draw with a value floor; item picked from inventory.",
          what: "The draw fixes a tier at stated odds; the item inside comes from available inventory, chosen by StockX. Every item lists at or above the price. If a tier runs out the box is delisted. No cryptography; trust is StockX's data.",
          configure: ["Tiers, their odds, items and inventory (the tier-first model is fixed).", "Research rigs; an algorithm, if you want to ask what a commitment would add."],
          read: ["Return at list and realized; how early a finite tier delists the box; tier-level proofs."],
          source: "StockX help centre (dossier 1 §2.4).",
        },
        initial: mystery(STOCKX_BOX, VENDOR_ALGO),
        presets: [
          { id: "tiered", name: "Tiered box: tier odds 0.5% to 74%, floor at price, unlimited inventory", config: mystery(STOCKX_BOX, VENDOR_ALGO) },
          { id: "finite", name: "Tiered box with finite inventory in the top tiers (delists when a tier empties)", config: mystery(STOCKX_FINITE_BOX, VENDOR_ALGO) },
        ],
      },
      {
        key: "stockx-credit",
        lab: "sellback",
        sellbackOptions: ["decision", "creditExpiry"],
        sections: ["economy", "options", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Credit sell-back",
          short: "75 to 90% of list as expiring credit; five minutes to decide.",
          what: "Sell back instantly for up to 90% of list value as StockX Credit, which cannot be withdrawn and expires after a year; or keep it, with five minutes to decide before you are charged and shipped. The lab measures breakage from expiring credit and what the short window does.",
          configure: ["Credit haircut, expiry, the five-minute window and the share of agents who miss it.", "Agent population; the tiered box; research rigs."],
          read: ["Hold, credit expired, decisions missed, ship rate, money that left the system."],
          source: "StockX help centre (dossier 1 §2.4).",
        },
        initial: SELLBACK_PRESETS.stockx,
        presets: [{ id: "stockx", name: "StockX: 85% of list as credit, expires, 5-minute window then charged and shipped", config: SELLBACK_PRESETS.stockx }],
      },
    ],
  },
  {
    id: "courtyard",
    name: "Courtyard",
    kind: "operator",
    tagline: "Price equals expected value, every pull public, FMV buyback",
    description: "Packs priced at the average expected value of the pulls, exact odds per item, every pull recorded publicly, buyback at fair market value with seven days to accept, guaranteed-value codes as a floor, a free vault and a peer marketplace at 0% fees. No cryptography: data and a public log instead.",
    icon: "fluent:ticket",
    sources: "Dossier 1 §2.4; dossier 2 §3.4",
    features: [
      {
        key: "courtyard-pack",
        lab: "mystery-box",
        lockModel: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "EV-priced pack",
          short: "Weights first, price equal to expected value, public pull log.",
          what: "The pack price equals the expected value of the pulls at fair market value, so the return is 100% before fees; the operator earns from the buyback discount, marketplace fees and vaulting. Every pull is appended to a public log, so outsiders can audit observed odds over all opens.",
          configure: ["Weights and the price-from-EV button (the model is fixed).", "Research rigs; the public log is on."],
          read: ["Return against 100%; the public ledger root; what an outsider can audit."],
          source: "Courtyard help centre and PullValue (dossier 1 §2.4).",
        },
        initial: mystery(COURTYARD_PACK, COURTYARD_ALGO),
        presets: [{ id: "pack", name: "Watch pack priced at expected value at realized, public pull log", config: mystery(COURTYARD_PACK, COURTYARD_ALGO) }],
      },
      {
        key: "courtyard-buyback",
        lab: "sellback",
        sellbackOptions: ["decision", "guaranteeFloor"],
        sections: ["economy", "options", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "FMV buyback",
          short: "Cash at fair market value, seven days to accept, guaranteed-value floor.",
          what: "Buyback at fair market value that 'ignores what you paid', seven days to accept, and guaranteed-value codes that set a floor on the offer. The lab measures hold under an honest cash buyback with a long window.",
          configure: ["Buyback discount, the seven-day window, the guaranteed floor.", "Agent population; the EV-priced pack; research rigs."],
          read: ["Hold, floor top-ups paid, ship rate, money that left the system."],
          source: "Courtyard help centre (dossier 1 §2.4).",
        },
        initial: SELLBACK_PRESETS.courtyard,
        presets: [{ id: "courtyard", name: "Courtyard: cash at 95% of FMV, 7-day window, $300 guaranteed-value floor", config: SELLBACK_PRESETS.courtyard }],
      },
    ],
  },
  {
    id: "jemlit",
    name: "Jemlit",
    kind: "operator",
    tagline: "",
    description: "A fully published provably-fair scheme (HMAC-SHA512/256 with lower and upper ranges), drop tables embedded in the page, headline items at one in a million, items exchangeable for credits at a 0 to 30% haircut that are 'not worth real money' and expire after a year, 'guaranteed' tiers, and an Upgrader.",
    icon: "fluent:mobile-phone",
    sources: "Dossier 1 §1.3, §2.2",
    features: [
      {
        key: "jemlit-boxes-live",
        lab: "jemlit",
        minimal: true,
        doc: {
          title: "Mystery boxes",
          short: "All 333 live boxes with their real names, prices and page chances, opened the way the site does it.",
          what: "A copy of Jemlit's box mechanism as captured from the live site on 14 October 2026: every box with its exact chances and roll bands from the box API, the cashback per item, Credits as the only payout for most opens, and the published proof (SHA-512 hash of a server seed shown before play, a browser-generated client seed the player can change, a play count, HMAC-SHA512/256, a roll from 0 to 100 read against the bands). Below the box the decision of every spin is written out step by step. The cog is the back office.",
          configure: ["Box & odds: pick any captured box; edit any chance; fit the big items to a target return.", "Per player: give a player their own odds.", "What things are worth: a Credit on screen and really; shipped items at resale.", "The proof: on (Jemlit's recipe) or off."],
          read: ["Return at listed prices, in Credits and really; the bands; the check."],
          source: "Live box API, algorithm page, terms and FAQ captured 14 October 2026 (research/captures); dossier 1 §1.3 and §2.2.",
        },
        initial: DEFAULT_JEMLIT,
      },
      {
        key: "jemlit-packs",
        lab: "jemlit",
        minimal: true,
        doc: {
          title: "Packs",
          short: "Collectible card packs: the same draw as a box, on Pokémon, One Piece and Yu-Gi-Oh cards.",
          what: "Jemlit's collectibles listing holds 15 boxes of trading cards, captured 14 October 2026. They run on exactly the box mechanism: a table of items with chances that sum to 1, a roll from 0 to 100, bands, cashback at 90%. The only difference is the goods.",
          configure: ["Pick a pack; edit any chance; the same back office as the boxes."],
          read: ["Return at listed, in Credits and really; the bands; the check."],
          source: "front/api/en/boxes/collectibles and the box API, 14 October 2026.",
        },
        initial: DEFAULT_JEMLIT_PACKS,
      },
      {
        key: "jemlit-battles",
        lab: "jemlit-games",
        minimal: true,
        doc: {
          title: "Battles",
          short: "Several players open the same box in turn; the highest total takes everything.",
          what: "Jemlit's battles as its pages describe them: solo for 2, 3 or 4 players or teams (2v2, 3v3, 2v2v2); each round every seat opens the same box; styles classic (highest total wins), crazy (lowest wins), jackpot (the winner is drawn in proportion to totals) and final drop (the last round alone decides). Every pull is a normal box open under one server seed with the play count rising; the house keeps the box's 20% on each open.",
          configure: ["Box, players or teams, rounds, style; the proof on or off."],
          read: ["The pot, what it is worth, your chance, the result; 400 battles at a time for the odds."],
          source: "Battle pages and client code captured 14 October 2026; settings block (turn timing).",
        },
        initial: DEFAULT_JEMLIT,
      },
      {
        key: "jemlit-upgrader-live",
        lab: "jemlit-games",
        minimal: true,
        doc: {
          title: "Upgrader",
          short: "Pick a chance and a wager; the prize on offer is worth the wager less 15%, divided by the chance.",
          what: "Jemlit's Upgrader as its settings and client state it: upgrader_fee 0.15 caps the chance selector at 85%; the chance options are 1%, 10%, 25%, 50%, 75% and 92% (clipped); the server offers prizes near wager × (1 − fee) ÷ chance; a roll below the chance wins the item, which can be upgraded again or exchanged for Credits.",
          configure: ["Wager, chance, your seed; the fee in the back office."],
          read: ["What each chance buys, the roll against the win zone, the 85% return."],
          source: "Settings block and the Upgrader client code captured 14 October 2026.",
        },
        initial: DEFAULT_JEMLIT,
      },
      {
        key: "jemlit-mines",
        lab: "jemlit-games",
        minimal: true,
        doc: {
          title: "Mines",
          short: "Reveal tiles, avoid the mines, cash out before you hit one.",
          what: "Jemlit's Mines as its own fairness text describes it: the mine layout is a Fisher–Yates shuffle driven by HMAC-SHA512/256 of your seed and the step number, keyed by a server seed committed by its SHA-512 hash; the cash-out multiplier is the fair survival odds times one minus the house edge. The edge itself is set by the server and was not visible; the Crash edge of 8% is used as a placeholder.",
          configure: ["Tiles, mines, wager, your seed; the edge in the back office."],
          read: ["The multiplier table, the shuffle step by step, the check."],
          source: "Mines client code and its provably-fair text, captured 14 October 2026.",
        },
        initial: DEFAULT_JEMLIT,
      },
      {
        key: "jemlit-crash",
        lab: "jemlit-games",
        minimal: true,
        doc: {
          title: "Crash",
          short: "A multiplier climbs until it crashes; cash out before it does.",
          what: "Jemlit's Crash as its client code states it: the crash point is (1 − edge) ÷ (1 − roll) with the roll from the server seed and your seed, capped at 1,000,000 and never below 1.00; the edge is 8% (crash_house_edge); seeds form a hash chain published ahead; a win can be taken as a prize item.",
          configure: ["Wager, auto cash-out, your seed; edge and caps in the back office."],
          read: ["How often the round reaches each multiplier, the 92% return, the check."],
          source: "Settings block and the Crash client code captured 14 October 2026.",
        },
        initial: DEFAULT_JEMLIT,
      },
    ],
    hiddenFeatures: [
      {
        key: "jemlit-ebox",
        lab: "mystery-box",
        lockModel: true,
        lockItems: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Apple eBox",
          short: "The captured table: ten headline items at 1 in 1,000,000.",
          what: "Jemlit's Apple eBox as captured on 9 October 2026, rebuilt to its documented metrics: 29 items, ten headline items at 0.0001% each, 96.3% of opens at or below $15, expected value $6.78 at listed prices. Drawn with Jemlit's own scheme. The 'guaranteed' variant applies the 40% mix.",
          configure: ["The table is the captured one (unlock to experiment); Jemlit's scheme by default.", "Research rigs."],
          read: ["Return at listed and cashback values; proofs against Jemlit's published algorithm; the detector."],
          source: "Jemlit box page HTML and provably-fair page (dossier 1 §1.3, §2.2).",
        },
        initial: mystery(CAPTURED.jemlitApple, JEMLIT_ALGO),
        presets: [
          { id: "ebox", name: "Apple eBox (reconstructed), Jemlit scheme", config: mystery(CAPTURED.jemlitApple, JEMLIT_ALGO) },
          { id: "guaranteed", name: "Apple eBox with the '40% guaranteed' mix (items ≥ $19)", config: mystery(JEMLIT_GUARANTEED, JEMLIT_ALGO) },
        ],
      },
      {
        key: "jemlit-cashback",
        lab: "sellback",
        sellbackOptions: ["creditExpiry"],
        sections: ["economy", "options", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Cashback credits",
          short: "Items become credits at a 0 to 30% haircut; credits are never cash and expire.",
          what: "Items can be exchanged for credits at the item value less 0 to 30%. Credits 'are not worth real money', cannot be withdrawn and expire after one year; the only way out is shipping an item. The lab measures hold and breakage under those rules.",
          configure: ["Haircut, credit expiry; withdrawal only through items.", "Agent population; the eBox; research rigs."],
          read: ["Hold, credit expired, ship rate, money that left the system."],
          source: "Jemlit terms (dossier 1 §2.2).",
        },
        initial: { ...DEFAULT_SELLBACK, box: CAPTURED.jemlitApple, algo: JEMLIT_ALGO, sellback: { mode: "vendor", haircut: 0.15 }, withdrawal: { mode: "through-items", minWithdraw: 0 }, creditExpiry: { sessions: 12 }, population: { ...DEFAULT_SELLBACK.population, depositMean: 30, opensPerSession: 5, shipAboveMultiple: 3 } } as SellbackConfig,
      },
      {
        key: "jemlit-upgrader",
        lab: "upgrader",
        lockMode: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Upgrader",
          short: "Stake balance for a chance at a better item, Jemlit scheme.",
          what: "Stake an amount for a chance at an item at proportional odds minus the edge, drawn with Jemlit's scheme. Agents follow a ladder policy; the lab measures the realized edge and the ruin rate.",
          configure: ["Stake, target item, stated edge.", "Agents and ladder policy; research rigs (a table swap is a hidden edge)."],
          read: ["Win rate against the stated chance, realized against stated edge, ruin, proofs."],
          source: "Dossier 1 §2.2.",
        },
        initial: { ...DEFAULT_UPGRADER, algo: JEMLIT_ALGO, edge: 0.1 } as UpgraderConfig,
      },
    ],
  },
  {
    id: "cases",
    name: "Cases.gg",
    kind: "operator",
    tagline: "Disclosed 10% edge, rotation every 1,000 bets, Upgrader, Coinflip, Vault, Missions",
    description: "A disclosed house edge of 10% on cases, battles and the Upgrader, automatic seed rotation every 1,000 bets, Coinflip at 0 to 10%, a Vault, Missions and a weekly race, a free-to-play sweepstakes route, custom boxes and demo spins. The function from seed to item is not published.",
    icon: "fluent:game-die",
    sources: "Dossier 1 §2.3",
    features: [
      {
        key: "cases-packup",
        lab: "mystery-box",
        lockModel: true,
        lockItems: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Pack Up box",
          short: "The captured $1,813 box: 89.5% of price, the $71 suitcase 61% of the time.",
          what: "Cases.gg's Pack Up box as captured on 9 October 2026, rebuilt to its documented metrics: 22 items, expected value 89.5% of price (matching the disclosed 10% edge), a 21% chance of an item worth at least the price, the $71 suitcase 61% of the time. Seeds rotate every 1,000 bets.",
          configure: ["The table is the captured one (unlock to experiment); HMAC-SHA256 with rotation every 1,000.", "Research rigs."],
          read: ["Return at the site's values and at realized; proofs; the detector."],
          source: "Cases.gg box page and FAQ (dossier 1 §2.3).",
        },
        initial: mystery(CAPTURED.casesPackUp, CASES_ALGO),
        presets: [{ id: "packup", name: "Pack Up (reconstructed), rotation every 1,000 bets", config: mystery(CAPTURED.casesPackUp, CASES_ALGO) }],
      },
      {
        key: "cases-upgrader",
        lab: "upgrader",
        lockMode: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Upgrader",
          short: "Disclosed 10% edge, rotation every 1,000.",
          what: "Cases.gg's Upgrader at its disclosed 10% edge. Agents follow a ladder policy; the lab measures the realized edge against the disclosed one and the ruin rate.",
          configure: ["Stake, target item, stated edge.", "Agents and ladder policy; research rigs."],
          read: ["Win rate against the stated chance, realized against stated edge, ruin, proofs."],
          source: "Cases.gg FAQ (dossier 1 §2.3).",
        },
        initial: DEFAULT_UPGRADER,
      },
      {
        key: "cases-coinflip",
        lab: "battles",
        modes: ["coinflip"],
        sections: ["battle", "algo", "rigs"],
        rigIds: BATTLE_RIGS,
        doc: {
          title: "Coinflip",
          short: "Two seats, equal odds, 0 to 10% from the pot.",
          what: "Two players stake the same amount; a fair coin picks the seat and the house takes its disclosed edge from the pot. The lab measures the realized edge and the win rate against a bot.",
          configure: ["Edge, stake (the box price stands in for the stake).", "Algorithm and research rigs."],
          read: ["Realized edge, human win rate against 50%."],
          source: "Cases.gg FAQ (dossier 1 §2.3).",
        },
        initial: { ...DEFAULT_BATTLES, mode: "coinflip", boxes: [VENDOR_BOX], players: 2, humansPerBattle: 1, algo: CASES_ALGO, coinflipEdge: 0.05 } as BattlesConfig,
      },
      {
        key: "cases-battles",
        lab: "battles",
        modes: VENDOR_MODES,
        rigIds: BATTLE_RIGS,
        doc: {
          title: "Battles",
          short: "Case battles at the disclosed 10% edge.",
          what: "Case battles with the standard modes, at Cases.gg's disclosed 10% edge and seed rotation every 1,000 bets.",
          configure: ["Mode, players, bots, boxes per round.", "Algorithm and research rigs."],
          read: ["Wager multiplier, realized edge, human win rate, pot distribution."],
          source: "Cases.gg FAQ (dossier 1 §2.3).",
        },
        initial: { ...DEFAULT_BATTLES, algo: CASES_ALGO } as BattlesConfig,
      },
      {
        key: "cases-vault",
        lab: "sellback",
        sellbackOptions: ["vault"],
        sections: ["economy", "options", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Vault",
          short: "Lock part of the balance out of play.",
          what: "A share of each deposit is locked in a vault, out of reach of re-betting until cash-out. A self-limiting tool: the lab measures what it does to wagering, ruin and hold.",
          configure: ["Locked share of each deposit.", "Agent population; box; algorithm; research rigs."],
          read: ["Hold, ruin, money locked, money that left the system."],
          source: "Cases.gg site (dossier 1 §2.3).",
        },
        initial: { ...SELLBACK_PRESETS.casesVault, algo: CASES_ALGO } as SellbackConfig,
        presets: [{ id: "vault", name: "Half of every deposit locked in the vault", config: { ...SELLBACK_PRESETS.casesVault, algo: CASES_ALGO } as SellbackConfig }],
      },
      {
        key: "cases-missions",
        lab: "retention",
        retentionExtras: ["missions", "freeEntry"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Missions, race & free route",
          short: "Daily missions, the weekly race, and the no-purchase route.",
          what: "Cases.gg's engagement system: daily missions with wager targets, a weekly race, daily free cases, and the sweepstakes free-to-play route that must give equal odds. A control run with incentives off measures the uplift and its cost, including what free entrants win.",
          configure: ["Missions, race, daily cases, affiliate, the free route share.", "Visitor model (assumptions); box; algorithm; research rigs."],
          read: ["Retention against control, bonus and mission cost, free-route cost, LTV, hold after bonuses."],
          source: "Cases.gg site and FAQ (dossier 1 §2.3).",
        },
        initial: { ...DEFAULT_RETENTION, algo: CASES_ALGO, missions: { enabled: true, wagerTarget: 100, reward: 5 }, freeEntry: { enabled: true, share: 0.05 }, spendCap: undefined } as RetentionConfig,
      },
    ],
  },
  {
    id: "misty",
    name: "Misty",
    kind: "operator",
    tagline: "",
    description: "Luxury boxes with exact published odds and a seed committed before you pay, revealed at the open, with the odds table frozen onto each open. One open in 61 pays a physical item; the rest pay Mistees, which the terms define as site credit with no cash value, redeemable only for boxes and products. Beside the boxes run skill-question prize competitions with a fixed pool of entry numbers, a guaranteed draw date and a free postal route at equal odds. The published numbers are true; the valuation of a Mistee is the trick. Live table captured 12 October 2026; the 9 October reconstruction is kept as a second preset.",
    icon: "fluent:admission-tickets",
    sources: "Dossier 1 §2.1",
    features: [
      {
        key: "misty-boxes",
        lab: "misty",
        doc: {
          title: "Mystery boxes",
          short: "The thirteen live boxes, their names, prices and exact odds, opened the way the site does it.",
          what: "A copy of Misty's box mechanism as captured from the live site on 12 October 2026: all thirteen boxes with their real names, prices and page weights, the free-spin table, Mistees as site credit, the trade-in of a piece for Mistees, and the proof (a secret committed before payment, your own seed, a spin number, the odds table frozen onto the open, the secret revealed after). Below the box the decision of every spin is written out step by step. The cog is the back office: every outcome's percentage, the free-spin table, what a Mistee is worth, and a table of their own for any player.",
          configure: ["Box & odds: pick a box; edit any outcome's percent; the free-spin table.", "Per player: give a player their own odds (a multiplier on the pieces, or every outcome by hand) and a share of the traffic.", "What things are worth: a Mistee on screen ($1 in the page data) and really (about 37 cents); items at resale.", "The proof: on (Misty's recipe) or off."],
          read: ["Return at face against real; counts per outcome against the stated odds; per-player returns; proofs recomputed."],
          source: "Live box pages, terms and verifier text captured 12 October 2026 (research/captures/misty-boxes-2026-10-12.json); research/06-misty-box-mechanism.md.",
        },
        initial: DEFAULT_MISTY,
        presets: [
          { id: "timepiece", name: "The Timepiece Suite · $10", config: mistyConfigFor("timepiece-suite") },
          { id: "handbag", name: "The Handbag Suite · $10", config: mistyConfigFor("handbag-suite") },
          { id: "vanity", name: "The Vanity · $10", config: mistyConfigFor("vanity") },
          { id: "glam", name: "The Glam Room · $25", config: mistyConfigFor("glam-room") },
          { id: "penthouse", name: "The Penthouse · $50", config: mistyConfigFor("penthouse") },
          { id: "parisian", name: "The Parisian Suite · $50", config: mistyConfigFor("parisian-suite") },
        ],
      },
    ],
    hiddenFeatures: [
      {
        key: "misty-boxes-generic",
        lab: "mystery-box",
        lockModel: true,
        lockItems: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Research view",
          short: "The Timepiece Suite inside the common research lab: schemes, mappings, rigs, detector.",
          what: "The same live Timepiece Suite table run through the shared research engine, so Misty can be compared with the other sources on one footing: swap the commit-reveal scheme, the mapping, switch on research rigs, and read the detector. The 9 October reconstruction and the Penthouse are kept as presets.",
          configure: ["The table is the live capture (unlock to experiment); Misty's scheme with a seed per open.", "Research rigs."],
          read: ["Return with Mistees at face against what they cost Misty; proofs; the detector."],
          source: "Live page and terms captured 12 October 2026 (research/captures); dossier 1 §2.1 for the 9 October capture.",
        },
        initial: mystery(CAPTURED.mistyTimepieceLive, MISTY_ALGO),
        presets: [
          { id: "timepiece-live", name: "Timepiece Suite $10, live table (12 Oct 2026), Misty scheme", config: mystery(CAPTURED.mistyTimepieceLive, MISTY_ALGO) },
          { id: "timepiece", name: "Timepiece Suite $10 as reconstructed from the 9 Oct capture", config: mystery(CAPTURED.mistyTimepiece, MISTY_ALGO) },
          { id: "penthouse", name: "Penthouse $50 (reconstructed from the 9 Oct capture)", config: mystery(CAPTURED.mistyPenthouse, MISTY_ALGO) },
        ],
      },
      {
        key: "misty-mistees",
        lab: "sellback",
        sellbackOptions: [],
        sections: ["economy", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Mistees economy",
          short: "Site credit that can only buy more boxes: what it costs Misty and what it holds.",
          what: "Mistees are paid by almost every open and can only be spent on boxes and products; they never become money. So a $10 open hands back credit that buys more opens, each of which hands back more credit. This tab runs that loop with simulated players: Mistees are credited at face and re-spent on the live Timepiece table, only physical items ever leave, and the lab measures the hold and how little ever ships.",
          configure: ["The live table and Misty's scheme.", "Agents: deposits, visits, when they ship an item (assumptions)."],
          read: ["Hold, ship rate, ruin, money that left the system, extra opens funded by credit."],
          source: "Terms (Mistees clause) and the live box page, 12 October 2026.",
        },
        initial: { ...DEFAULT_SELLBACK, box: CAPTURED.mistyTimepieceLive, algo: MISTY_ALGO, sellback: { mode: "vendor", haircut: 0 }, withdrawal: { mode: "through-items", minWithdraw: 0 }, population: { ...DEFAULT_SELLBACK.population, depositMean: 20, opensPerSession: 3, shipAboveMultiple: 2, maxDeposits: 4 } } as SellbackConfig,
      },
      {
        key: "misty-credits",
        lab: "credits",
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Competitions & draws",
          short: "The prize draws: a fixed pool of numbers, a draw date, a free postal route.",
          what: "Misty's prize competitions, modelled as the two-stage economy captured on 9 October: box credits as entry numbers in a draw with a fixed pool, drawn on the date regardless of sell-through, with the free postal route at equal odds. By 12 October the terms describe Mistees as site credit for boxes rather than entries, so treat this tab as the competition mechanic itself (welcome-box credits and paid entries) and the Mistees tab as the box economy. The lab reports the nominal return with entries at face and the real return after the draw.",
          configure: ["Ticket pool, face value, prize, draw rule, free-entry share.", "Agents and opens; the box; research rigs."],
          read: ["Nominal against end-to-end return, real value of a credit, prizes to free entrants, hold, unsold share at draw."],
          source: "Misty terms and competition pages (dossier 1 §2.1).",
        },
        initial: DEFAULT_CREDITS,
        presets: [
          { id: "timepiece", name: "Timepiece Suite → 100,000-ticket draw, drawn on the date", config: DEFAULT_CREDITS },
          { id: "penthouse", name: "Penthouse $50 → 100,000-ticket draw", config: { ...DEFAULT_CREDITS, box: CAPTURED.mistyPenthouse, raffle: { ...DEFAULT_CREDITS.raffle, scheduleEvery: 2500 } } as CreditsConfig },
        ],
      },
    ],
  },
  {
    id: "glassbox",
    name: "Glass Box (ours)",
    kind: "ours",
    tagline: "Commit the whole box, value at realized, cash out, no exits",
    description: "Our design: the manifest (items, odds, prices, cash-out) committed with the seed, an external beacon and a fresh seed per open, a public ledger root, values shown and paid at realized prices, cash buyback with free withdrawal, pools that must distribute, a pity ceiling, spend caps, lucky bags, group opens and pooled draws with disclosed expected value.",
    icon: "fluent:shield",
    sources: "Dossier 2 §4; dossier 4",
    features: [
      {
        key: "glass-box",
        lab: "mystery-box",
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Glass Box",
          short: "Manifest, beacon, per-open rotation, ledger, realized value.",
          what: "The vendor's items with the whole box committed, an external beacon, a fresh seed per open, a public ledger root, and the return computed and displayed on realized prices.",
          configure: ["Items and odds; the Glass Box scheme; research rigs to show which ones it defeats."],
          read: ["Return at realized; proofs over everything; the detector."],
          source: "Dossier 2 §4; dossier 4 §2.",
        },
        initial: mystery(GLASSBOX_BOX, GLASSBOX_ALGO),
        presets: [{ id: "glass", name: "Glass Box: 90% on realized value, manifest, beacon, per-open rotation, public log", config: mystery(GLASSBOX_BOX, GLASSBOX_ALGO) }],
      },
      {
        key: "glass-buyback",
        lab: "sellback",
        sellbackOptions: [],
        sections: ["economy", "population", "box", "algo", "rigs"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Cash buyback",
          short: "Cash at realized value, withdraw freely.",
          what: "Items sold back for cash at realized value; balance can be withdrawn at any time. The honest end of the spectrum, for comparison with the vendor's economy.",
          configure: ["Haircut (zero by default).", "Agent population; box; research rigs."],
          read: ["Hold, ship rate, ruin, money that left the system."],
          source: "Dossier 2 §4.",
        },
        initial: SELLBACK_PRESETS.glassbox,
      },
      {
        key: "glass-luckybag",
        lab: "mystery-box",
        lockModel: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Lucky bag",
          short: "105% at realized, finite, must distribute.",
          what: "A positive-expected-value box in a finite, committed pool that cannot be retired early: a marketing cost instead of a margin.",
          configure: ["Copies per item; the pool model and must-distribute rule are fixed."],
          read: ["Return at realized above 100%; drops completed."],
          source: "Dossier 2 §4 (lucky bags).",
        },
        initial: mystery(LUCKY_BAG, GLASSBOX_ALGO),
      },
      {
        key: "glass-pity",
        lab: "mystery-box",
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Pity ceiling",
          short: "After N losses the next open pays at least the price.",
          what: "A disclosed, verifiable pity rule in the manifest. The lab shows how often it fires and what it costs.",
          configure: ["Losses before pity and the floor; items and odds."],
          read: ["Pity applications, return, proofs against the pity subset."],
          source: "Dossier 4 §2.5.",
        },
        initial: mystery(PITY_BOX, GLASSBOX_ALGO),
      },
      {
        key: "glass-group",
        lab: "battles",
        modes: ["break"],
        rigIds: BATTLE_RIGS,
        doc: {
          title: "Group opens",
          short: "Open together, keep your own pulls; no pot.",
          what: "Several people open the same committed boxes together and each keeps what they pull. The social side of battles without a pot or a loser.",
          configure: ["Players, boxes per round; the Glass Box scheme."],
          read: ["Return per seat; how many seats took home at least their entry."],
          source: "Dossier 2 §4 (group opens and sealed breaks).",
        },
        initial: { ...DEFAULT_BATTLES, mode: "break", boxes: [GLASSBOX_BOX, GLASSBOX_BOX, GLASSBOX_BOX], algo: GLASSBOX_ALGO } as BattlesConfig,
      },
      {
        key: "glass-pooled",
        lab: "credits",
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Pooled draw, EV disclosed",
          short: "Tickets with their expected value printed on them.",
          what: "A pooled draw where the expected value of a ticket (prize over pool) is disclosed next to the face value and the draw happens only when the pool sells out.",
          configure: ["Pool, prize, free share; disclosure is on."],
          read: ["Nominal against end-to-end return; the gap should be small."],
          source: "Dossier 2 §4.",
        },
        initial: { ...DEFAULT_CREDITS, box: GLASSBOX_BOX, algo: GLASSBOX_ALGO, raffle: { ...DEFAULT_CREDITS.raffle, disclosedEv: true, drawRule: "when-sold-out" } } as CreditsConfig,
      },
      {
        key: "glass-spendcap",
        lab: "retention",
        retentionExtras: ["spendCap"],
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Spend cap",
          short: "A daily deposit cap per visitor, costed.",
          what: "The vendor's retention system with a daily deposit cap added. The lab reports retention and what the cap costs the operator.",
          configure: ["Cap per day; incentives; visitor model."],
          read: ["Retention against control, deposits blocked, hold after bonuses."],
          source: "Dossier 4 §2.5.",
        },
        initial: { ...DEFAULT_RETENTION, algo: GLASSBOX_ALGO, box: GLASSBOX_BOX, spendCap: { enabled: true, perDay: 50 }, missions: undefined, freeEntry: undefined } as RetentionConfig,
      },
    ],
  },
  {
    id: "adjacent",
    name: "Adjacent models",
    kind: "adjacent",
    tagline: "Kuji, Pop Mart, fukubukuro, breaks, Omaze, gacha",
    description: "Chance-based retail formats outside the case-site world, each with a mechanic worth testing on the same agents and catalogue.",
    icon: "fluent:wrapped-gift",
    sources: "Dossier 2 §3.2",
    features: [
      {
        key: "kuji",
        lab: "mystery-box",
        lockModel: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Ichiban Kuji",
          short: "80 tickets, prizes A to F, the Last One prize.",
          what: "A finite lottery: 80 tickets per set with prize tiers; whoever buys the final ticket also receives the Last One prize. Odds are exact and move as tickets sell.",
          configure: ["Copies per prize tier; the Last One item."],
          read: ["Return per set; Last One awards."],
          source: "Dossier 2 §3.2.",
        },
        initial: mystery(KUJI_BOX, VENDOR_ALGO),
      },
      {
        key: "popmart",
        lab: "mystery-box",
        lockModel: true,
        rigIds: [...GENERIC_RIGS, "secretItem"],
        doc: {
          title: "Pop Mart secret",
          short: "A secret edition at 1 in 144, not on the table.",
          what: "A blind box with an undisclosed 'secret' slot. Here it is modelled on the vendor box: a secret item takes a slice of the most common item's tickets. Disclosed, it is a chase; undisclosed, it is a table swap.",
          configure: ["The secret item and its share (the secret-item rig)."],
          read: ["Secret draws, proof failures on them, return."],
          source: "Dossier 2 §3.2.",
        },
        initial: mystery(VENDOR_BOX, STANDARD_PF_ALGO, { secretItem: { itemId: "a-hermine-scarf", percent: 0.69 } }),
      },
      {
        key: "fukubukuro",
        lab: "mystery-box",
        lockModel: true,
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Fukubukuro",
          short: "The sealed lucky bag worth more than it costs.",
          what: "The Japanese New Year lucky bag: positive expected value, sold in a finite run, no odds to hide.",
          configure: ["Copies per item."],
          read: ["Return above 100% at realized."],
          source: "Dossier 2 §3.2.",
        },
        initial: mystery(FUKUBUKURO_BOX, VENDOR_ALGO),
      },
      {
        key: "breaks",
        lab: "battles",
        modes: ["break"],
        rigIds: BATTLE_RIGS,
        doc: {
          title: "Breaks",
          short: "Everyone keeps what they pull.",
          what: "A sealed break in the Whatnot style: participants each receive their own pulls from the same boxes. No pot, no winner.",
          configure: ["Players and boxes per round."],
          read: ["Return per seat; seats that took home at least their entry."],
          source: "Dossier 2 §3.2.",
        },
        initial: { ...DEFAULT_BATTLES, mode: "break" } as BattlesConfig,
      },
      {
        key: "omaze",
        lab: "credits",
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Omaze-style draw",
          short: "A prize draw with a free route and a monthly cap.",
          what: "A draw with a free entry route at equal odds and a cap on spend per entrant, drawn when the pool sells out.",
          configure: ["Pool, prize, free share, spend cap."],
          read: ["Prizes to free entrants, blocked entries, return."],
          source: "Dossier 2 §3.2.",
        },
        initial: { ...DEFAULT_CREDITS, raffle: { ...DEFAULT_CREDITS.raffle, drawRule: "when-sold-out", freeEntryShare: 0.1, monthlyCap: 120 } } as CreditsConfig,
      },
      {
        key: "gacha",
        lab: "mystery-box",
        rigIds: GENERIC_RIGS,
        doc: {
          title: "Gacha pity",
          short: "A pity ceiling on a standard provably-fair box.",
          what: "The gacha pity mechanic applied to the vendor box with a standard provably-fair scheme.",
          configure: ["Losses before pity and the floor."],
          read: ["Pity applications and what they cost."],
          source: "Dossier 2 §3.2.",
        },
        initial: mystery(PITY_BOX, STANDARD_PF_ALGO),
      },
    ],
  },
  {
    id: "presentation",
    name: "Presentation layer",
    kind: "research",
    tagline: "What the player sees, with the draw untouched",
    description: "Manipulations that live entirely in the presentation: near-miss reels, losses celebrated as wins, fabricated live-drop feeds, 'tickets away' messages, demo spins at different odds, urgency cues. Documented from slot-machine research and case-site practice. None of them changes odds, payouts or proofs, which is the point.",
    icon: "fluent:slot-machine",
    sources: "Dossier 1 §3; near-miss and LDW literature",
    features: [
      {
        key: "presentation-rigs",
        lab: "mystery-box",
        lockModel: true,
        rigIds: PRESENTATION_RIGS,
        doc: {
          title: "Presentation rigs",
          short: "Near miss, losses as wins, fake feed, tickets away, demo odds, urgency.",
          what: "The vendor box with the presentation rigs switched on. Open packs and watch what the player would see; the session tally and the detector show that nothing in the outcome data changes.",
          configure: ["Each presentation rig and its parameters."],
          read: ["Staged near misses over losses, demo against paid return, and a detector that finds nothing in the outcomes."],
          source: "Dossier 1 §3; Reid 1986; Clark et al. 2009; Dixon et al. 2010.",
        },
        initial: mystery(VENDOR_BOX, VENDOR_ALGO, { nearMiss: { rate: 0.5, showcase: 0.6 }, ldwCelebration: true, fakeLiveFeed: { grailsPerMinute: 6 }, ticketsAwayMessage: true, urgency: { stockLeft: 12, viewers: 38, countdownMinutes: 14 }, demoOdds: { demoRtp: 1.6 } }),
        presets: [
          { id: "all", name: "All presentation rigs on", config: mystery(VENDOR_BOX, VENDOR_ALGO, { nearMiss: { rate: 0.5, showcase: 0.6 }, ldwCelebration: true, fakeLiveFeed: { grailsPerMinute: 6 }, ticketsAwayMessage: true, urgency: { stockLeft: 12, viewers: 38, countdownMinutes: 14 }, demoOdds: { demoRtp: 1.6 } }) },
          { id: "near-miss", name: "Near-miss reel only", config: mystery(VENDOR_BOX, VENDOR_ALGO, { nearMiss: { rate: 0.5, showcase: 0.6 } }) },
          { id: "honest", name: "Honest presentation (nothing on)", config: mystery(VENDOR_BOX, VENDOR_ALGO) },
        ],
      },
    ],
  },
];

export const OPERATOR_BY_ID = new Map(OPERATORS.map((o) => [o.id, o]));
export const OPERATOR_IDS = OPERATORS.map((o) => o.id);
