// Default configurations and named presets for each lab.
import { CATALOG } from "@/engine/catalog";
import { solveWeights } from "@/engine/table";
import type { AlgoConfig, BattlesConfig, BoxDef, MysteryBoxConfig, PriceLayer, RetentionConfig, SellbackConfig } from "@/engine/types";

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
export const GLASSBOX_ALGO: AlgoConfig = { scheme: "glassbox", mapping: "native", rng: "sfc32", rotation: "per-open", rotateEvery: 1, clientSeedMode: "player-set" };

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

export function makeBox(name: string, price: number, itemIds: string[], rtp: number, layer: PriceLayer, displayLayer: PriceLayer = layer): BoxDef {
  const items = itemIds.map((id) => CATALOG.find((c) => c.id === id)!).filter(Boolean);
  const solved = solveWeights(items, TICKET_TOTAL, price, rtp, layer);
  return { name, price, ticketTotal: TICKET_TOTAL, items: solved.weights, valueLayer: layer, displayLayer };
}

/** The vendor's economy: 90% RTP computed on listed (retail) values. */
export const VENDOR_BOX = makeBox("Vendor default · $50 · 90% on listed value", 50, VENDOR_ITEMS, 0.9, "retail", "retail");
/** Same items priced honestly: 90% RTP on realized value. */
export const GLASSBOX_BOX = makeBox("Glass Box · $50 · 90% on realized value", 50, VENDOR_ITEMS, 0.9, "realized", "realized");

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
};

export const PRESETS = {
  mystery: [
    { id: "vendor", name: "Vendor default: no commitment, 90% on listed value", config: DEFAULT_MYSTERY },
    { id: "standard-pf", name: "Standard provably fair (HMAC-SHA256), same box", config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO } },
    { id: "jemlit", name: "Jemlit scheme, same box", config: { ...DEFAULT_MYSTERY, algo: { ...STANDARD_PF_ALGO, scheme: "jemlit" as const } } },
    { id: "packs", name: "Packs.com scheme (per-open rotation, 32-bit ticket)", config: { ...DEFAULT_MYSTERY, algo: { ...STANDARD_PF_ALGO, scheme: "packs" as const, rotation: "per-open" as const } } },
    { id: "glassbox", name: "Glass Box: manifest, beacon, per-open rotation, realized value", config: { ...DEFAULT_MYSTERY, box: GLASSBOX_BOX, algo: GLASSBOX_ALGO } },
    { id: "swap", name: "Rigged: table swap to 70% behind a standard provably fair", config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO, rigs: { tableSwap: { hiddenRtp: 0.7 } } } },
    {
      id: "streamer",
      name: "Rigged: streamer accounts at 160% RTP",
      config: { ...DEFAULT_MYSTERY, algo: STANDARD_PF_ALGO, rigs: { perAccount: { tag: "streamer", rtp: 1.6 } }, accounts: { tags: [{ tag: "player", share: 0.9 }, { tag: "streamer", share: 0.1 }] } },
    },
  ],
};
