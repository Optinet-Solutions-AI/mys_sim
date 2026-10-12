// Drop tables reconstructed from the operators' published odds captured on 9 October 2026 (dossier 1 §2.1 to §2.3).
// The item-by-item lists were not kept, so each table below is rebuilt to reproduce the documented metrics
// (odds of the top item, share of the cheapest outcome, expected value, probability bands) and is labelled as a
// reconstruction. Realized values are assumptions stated per table.
import type { BoxDef, CatalogItem } from "./types";
import { weightsFromPercents } from "./table";

const T = 100_000_000;
const COLOR = { grail: "#1f2a44", legendary: "#5b2a86", epic: "#0f6b6b", rare: "#1e5aa8", common: "#6b7280", filler: "#9aa3ad" };

function tierFor(v: number): CatalogItem["tier"] {
  if (v >= 8000) return "grail";
  if (v >= 2000) return "legendary";
  if (v >= 400) return "epic";
  if (v >= 80) return "rare";
  if (v >= 15) return "common";
  return "filler";
}

interface Row {
  id: string;
  name: string;
  brand: string;
  category: CatalogItem["category"];
  listed: number;
  percent: number;
  icon: string;
  /** realized as a fraction of listed */
  realizedFactor: number;
  askingFactor?: number;
}

function build(operator: string, rows: Row[]): { items: CatalogItem[]; percents: { itemId: string; percent: number }[] } {
  const items = rows.map((r) => {
    const tier = tierFor(r.listed);
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      category: r.category,
      tier,
      retail: r.listed,
      asking: Math.round(r.listed * (r.askingFactor ?? 1) * 100) / 100,
      realized: Math.round(r.listed * r.realizedFactor * 100) / 100,
      confidence: "low" as const,
      icon: r.icon,
      color: COLOR[tier],
      source: "captured" as const,
      operator,
    };
  });
  return { items, percents: rows.map((r) => ({ itemId: r.id, percent: r.percent })) };
}

// ---- Jemlit Apple eBox: 29 items, ten headline items at 1 in 1,000,000, 96.3% of opens at or below $15, EV $6.78 ----
const jemlitRows: Row[] = [
  ...[
    ["apple-watch-hermes", "Apple Watch Hermès", 2300],
    ["iphone-17-pro-max", "iPhone 17 Pro Max", 1599],
    ["macbook-pro-14", "MacBook Pro 14", 1599],
    ["iphone-17-pro", "iPhone 17 Pro", 1099],
    ["macbook-air-13", "MacBook Air 13", 999],
    ["ipad-pro-11", "iPad Pro 11", 999],
    ["iphone-17", "iPhone 17", 799],
    ["apple-watch-ultra", "Apple Watch Ultra", 799],
    ["ipad-air", "iPad Air", 599],
    ["airpods-max", "AirPods Max", 549],
  ].map(([id, name, v]) => ({ id: `c-jemlit-${id}`, name: name as string, brand: "Apple", category: "tech" as const, listed: v as number, percent: 0.0001, icon: String(id).includes("watch") ? "fluent:watch" : String(id).includes("macbook") ? "fluent:laptop" : String(id).includes("airpods") ? "fluent:headphone" : "fluent:mobile-phone", realizedFactor: 0.91 })),
  { id: "c-jemlit-airpods-pro", name: "AirPods Pro", brand: "Apple", category: "tech", listed: 249, percent: 0.12, icon: "fluent:headphone", realizedFactor: 0.91 },
  { id: "c-jemlit-watch-se", name: "Apple Watch SE", brand: "Apple", category: "tech", listed: 249, percent: 0.08, icon: "fluent:watch", realizedFactor: 0.91 },
  { id: "c-jemlit-ipad", name: "iPad", brand: "Apple", category: "tech", listed: 349, percent: 0.05, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-apple-tv", name: "Apple TV 4K", brand: "Apple", category: "tech", listed: 129, percent: 0.1, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-pencil-pro", name: "Apple Pencil Pro", brand: "Apple", category: "tech", listed: 129, percent: 0.079, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-magsafe", name: "MagSafe charger", brand: "Apple", category: "tech", listed: 19, percent: 1.2, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-airtag", name: "AirTag", brand: "Apple", category: "tech", listed: 29, percent: 0.9, icon: "fluent:package", realizedFactor: 0.91 },
  { id: "c-jemlit-charger-35w", name: "35W dual charger", brand: "Apple", category: "tech", listed: 49, percent: 0.6, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-magic-mouse", name: "Magic Mouse", brand: "Apple", category: "tech", listed: 79, percent: 0.37, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-airtag-4", name: "AirTag 4-pack", brand: "Apple", category: "tech", listed: 99, percent: 0.2, icon: "fluent:package", realizedFactor: 0.91 },
  { id: "c-jemlit-adapter", name: "USB-C adapter", brand: "Apple", category: "tech", listed: 12.5, percent: 7.0, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-cable", name: "Woven charge cable", brand: "Apple", category: "tech", listed: 9.9, percent: 5.9, icon: "fluent:mobile-phone", realizedFactor: 0.91 },
  { id: "c-jemlit-case-666", name: "Silicone case", brand: "Jemlit", category: "accessory", listed: 6.66, percent: 14.6, icon: "fluent:package", realizedFactor: 0.91 },
  { id: "c-jemlit-cover-544", name: "Clear cover", brand: "Jemlit", category: "accessory", listed: 5.44, percent: 14.9, icon: "fluent:package", realizedFactor: 0.91 },
  { id: "c-jemlit-case-407", name: "Soft case", brand: "Jemlit", category: "accessory", listed: 4.07, percent: 15.2, icon: "fluent:package", realizedFactor: 0.91 },
  { id: "c-jemlit-credit-340", name: "Credit $3.40", brand: "Jemlit", category: "credit", listed: 3.4, percent: 15.4, icon: "fluent:coin", realizedFactor: 0.91 },
  { id: "c-jemlit-sticker", name: "Apple sticker", brand: "Jemlit", category: "accessory", listed: 1.02, percent: 15.9, icon: "fluent:label", realizedFactor: 0.91 },
  { id: "c-jemlit-meb-035", name: "meb-credit $0.35", brand: "Jemlit", category: "credit", listed: 0.35, percent: 5.4, icon: "fluent:coin", realizedFactor: 0.91 },
  { id: "c-jemlit-meb-002", name: "meb-credit $0.02", brand: "Jemlit", category: "credit", listed: 0.02, percent: 2.0, icon: "fluent:coin", realizedFactor: 0.91 },
];

// ---- Misty Timepiece Suite $10: P(physical) 1.65%, EV of physical $3.77, 14 credits expected, Rolex at 0.004%, 61% smallest bundle ----
const mistyTimepieceRows: Row[] = [
  { id: "c-misty-ts-rolex-sub", name: "Submariner Date", brand: "Rolex", category: "watch", listed: 8900, percent: 0.004, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-tudor-bb", name: "Black Bay 58", brand: "Tudor", category: "watch", listed: 3500, percent: 0.008, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-omega-sm", name: "Seamaster Diver 300M", brand: "Omega", category: "watch", listed: 4500, percent: 0.006, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-tag-carrera", name: "Carrera", brand: "TAG Heuer", category: "watch", listed: 2600, percent: 0.012, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-longines", name: "Spirit 40", brand: "Longines", category: "watch", listed: 1900, percent: 0.02, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-tissot-prx", name: "PRX Powermatic", brand: "Tissot", category: "watch", listed: 600, percent: 0.1, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-seiko", name: "Presage Cocktail", brand: "Seiko", category: "watch", listed: 350, percent: 0.2, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-casio", name: "G-Shock", brand: "Casio", category: "watch", listed: 95, percent: 0.4, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-swatch", name: "Swatch", brand: "Swatch", category: "watch", listed: 60, percent: 0.9, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ts-credits-5", name: "5 credits", brand: "Misty", category: "credit", listed: 5, percent: 61.0, icon: "fluent:ticket", realizedFactor: 0.32 },
  { id: "c-misty-ts-credits-10", name: "10 credits", brand: "Misty", category: "credit", listed: 10, percent: 15.0, icon: "fluent:ticket", realizedFactor: 0.32 },
  { id: "c-misty-ts-credits-25", name: "25 credits", brand: "Misty", category: "credit", listed: 25, percent: 12.0, icon: "fluent:ticket", realizedFactor: 0.32 },
  { id: "c-misty-ts-credits-50", name: "50 credits", brand: "Misty", category: "credit", listed: 50, percent: 7.0, icon: "fluent:admission-tickets", realizedFactor: 0.32 },
  { id: "c-misty-ts-credits-100", name: "100 credits", brand: "Misty", category: "credit", listed: 100, percent: 3.35, icon: "fluent:admission-tickets", realizedFactor: 0.32 },
];

// ---- Misty Penthouse $50: P(physical) 1.59%, EV of physical $20.59, 42 credits expected, Rolex at 0.0095% ----
const mistyPenthouseRows: Row[] = [
  { id: "c-misty-ph-daytona", name: "Cosmograph Daytona", brand: "Rolex", category: "watch", listed: 28000, percent: 0.0095, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-rolex-sub", name: "Submariner Date", brand: "Rolex", category: "watch", listed: 11000, percent: 0.02, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-speedmaster", name: "Speedmaster Moonwatch", brand: "Omega", category: "watch", listed: 6500, percent: 0.04, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-tudor-bb", name: "Black Bay 58", brand: "Tudor", category: "watch", listed: 3800, percent: 0.08, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-tag-carrera", name: "Carrera", brand: "TAG Heuer", category: "watch", listed: 3000, percent: 0.1, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-longines", name: "Spirit 40", brand: "Longines", category: "watch", listed: 1900, percent: 0.15, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-tissot", name: "PRX Powermatic", brand: "Tissot", category: "watch", listed: 650, percent: 0.3, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-seiko", name: "Presage Cocktail", brand: "Seiko", category: "watch", listed: 400, percent: 0.4, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-casio", name: "G-Shock", brand: "Casio", category: "watch", listed: 110, percent: 0.4905, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-ph-credits-20", name: "20 credits", brand: "Misty", category: "credit", listed: 20, percent: 61.0, icon: "fluent:ticket", realizedFactor: 0.32 },
  { id: "c-misty-ph-credits-40", name: "40 credits", brand: "Misty", category: "credit", listed: 40, percent: 20.0, icon: "fluent:ticket", realizedFactor: 0.32 },
  { id: "c-misty-ph-credits-75", name: "75 credits", brand: "Misty", category: "credit", listed: 75, percent: 10.0, icon: "fluent:admission-tickets", realizedFactor: 0.32 },
  { id: "c-misty-ph-credits-150", name: "150 credits", brand: "Misty", category: "credit", listed: 150, percent: 5.0, icon: "fluent:admission-tickets", realizedFactor: 0.32 },
  { id: "c-misty-ph-credits-300", name: "300 credits", brand: "Misty", category: "credit", listed: 300, percent: 2.41, icon: "fluent:admission-tickets", realizedFactor: 0.32 },
];

// ---- Cases.gg Pack Up $1,813.83: 22 items, EV $1,623.38 (89.5%), P(item ≥ price) 21.25%, $71 suitcase 61.25%, LV × Tyler trunk $14,245 at 0.5% ----
const casesRows: Row[] = [
  { id: "c-cases-lv-tyler-trunk", name: "LV × Tyler, the Creator trunk", brand: "Louis Vuitton", category: "luggage", listed: 14245, percent: 0.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-goyard-trunk", name: "Bourget trunk", brand: "Goyard", category: "luggage", listed: 12500, percent: 2.0, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-rimowa-dior", name: "Rimowa × Dior cabin", brand: "Rimowa", category: "luggage", listed: 9900, percent: 2.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-hermes-travel", name: "Herbag travel", brand: "Hermès", category: "luggage", listed: 9000, percent: 2.0, icon: "fluent:handbag", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-lv-horizon", name: "Horizon 55", brand: "Louis Vuitton", category: "luggage", listed: 7800, percent: 3.0, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-globetrotter", name: "Centenary 30", brand: "Globe-Trotter", category: "luggage", listed: 6200, percent: 3.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-rimowa-original", name: "Original Cabin", brand: "Rimowa", category: "luggage", listed: 4900, percent: 4.0, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-tumi-alpha", name: "Alpha 3 expandable", brand: "Tumi", category: "luggage", listed: 2400, percent: 3.75, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-briggs", name: "Baseline carry-on", brand: "Briggs & Riley", category: "luggage", listed: 1500, percent: 0.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-rimowa-lite", name: "Essential Lite", brand: "Rimowa", category: "luggage", listed: 1200, percent: 0.75, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-tumi-voyageur", name: "Voyageur backpack", brand: "Tumi", category: "luggage", listed: 980, percent: 1.0, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-monos", name: "Hybrid carry-on", brand: "Monos", category: "luggage", listed: 850, percent: 1.25, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-samsonite", name: "Proxis spinner", brand: "Samsonite", category: "luggage", listed: 700, percent: 1.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-july", name: "Carry On Pro", brand: "July", category: "luggage", listed: 620, percent: 1.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-away-alu", name: "Aluminum carry-on", brand: "Away", category: "luggage", listed: 540, percent: 1.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-delsey", name: "Chatelet Air", brand: "Delsey", category: "luggage", listed: 450, percent: 2.0, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-beis", name: "Weekender", brand: "Béis", category: "luggage", listed: 380, percent: 2.0, icon: "fluent:handbag", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-herschel", name: "Trade carry-on", brand: "Herschel", category: "luggage", listed: 300, percent: 1.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-calpak", name: "Hue carry-on", brand: "Calpak", category: "luggage", listed: 250, percent: 1.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-basics", name: "Hardside spinner", brand: "Basics", category: "luggage", listed: 180, percent: 1.5, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-backpack", name: "Travel backpack", brand: "Generic", category: "luggage", listed: 120, percent: 1.0, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
  { id: "c-cases-suitcase-71", name: "Suitcase", brand: "Generic", category: "luggage", listed: 71, percent: 61.25, icon: "fluent:briefcase", realizedFactor: 0.75, askingFactor: 0.9 },
];

// ---- Misty Timepiece Suite, LIVE table captured 12 Oct 2026 (17 outcomes, odds sum 100.16%) ----
// Mistees are site credit with no cash value, redeemable only for boxes and products (terms). The page never states a
// dollar rate in words, but its odds-table data values every Mistee outcome at 100 cents per Mistee (valueCents, fxRate 1),
// so face is $1. The real cost to Misty is about $0.37 per Mistee if credit is re-spent on boxes (solved from this table
// with physical items at 70% of listed). Free Spin outcomes are valued at the Mistees they pay plus 1.68 Mistees per free
// spin (its own table: 1 at 70%, 2 at 22%, 5 at 6%, 10 at 2%, 20 at 0.2%); the 2% outcome gives two spins (freeSpins: 2).
const mistyLiveRows: Row[] = [
  { id: "c-misty-live-rolex-ladydatejust", name: "Lady-Datejust 28 mm", brand: "Rolex", category: "watch", listed: 16035, percent: 0.004, icon: "fluent:watch", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-lv-sunset-cherry", name: "x Murakami Sunset Cherry bag", brand: "Louis Vuitton", category: "bag", listed: 3600, percent: 0.015, icon: "fluent:handbag", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-lv-shawl", name: "x Murakami Denim Cerise shawl", brand: "Louis Vuitton", category: "accessory", listed: 920, percent: 0.053, icon: "fluent:scarf", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-lv-spell-blossom", name: "x Murakami Spell on You Cherry Blossom", brand: "Louis Vuitton", category: "beauty", listed: 420, percent: 0.11, icon: "fluent:lotion-bottle", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-lv-spell-cherry", name: "x Murakami Spell on You Cherry", brand: "Louis Vuitton", category: "beauty", listed: 410, percent: 0.11, icon: "fluent:lotion-bottle", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-tiffany-edp", name: "Rose Gold eau de parfum", brand: "Tiffany & Co.", category: "beauty", listed: 185, percent: 0.23, icon: "fluent:lotion-bottle", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-rl-romance", name: "Romance eau de parfum", brand: "Ralph Lauren", category: "beauty", listed: 70, percent: 0.55, icon: "fluent:lotion-bottle", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-chanel-rouge", name: "Rouge Coco lip colour", brand: "Chanel", category: "beauty", listed: 65, percent: 0.58, icon: "fluent:lipstick", realizedFactor: 0.7, askingFactor: 0.85 },
  { id: "c-misty-live-m30", name: "30 Mistees", brand: "Misty", category: "credit", listed: 30, percent: 0.51, icon: "fluent:admission-tickets", realizedFactor: 0.37 },
  { id: "c-misty-live-m10", name: "10 Mistees", brand: "Misty", category: "credit", listed: 10, percent: 2.6, icon: "fluent:admission-tickets", realizedFactor: 0.37 },
  { id: "c-misty-live-m5", name: "5 Mistees", brand: "Misty", category: "credit", listed: 5, percent: 6.2, icon: "fluent:ticket", realizedFactor: 0.37 },
  { id: "c-misty-live-m4", name: "4 Mistees", brand: "Misty", category: "credit", listed: 4, percent: 8.2, icon: "fluent:ticket", realizedFactor: 0.37 },
  { id: "c-misty-live-m3", name: "3 Mistees", brand: "Misty", category: "credit", listed: 3, percent: 21.0, icon: "fluent:ticket", realizedFactor: 0.37 },
  { id: "c-misty-live-fs2", name: "2 Free Spins +2 (about 5.4 Mistees)", brand: "Misty", category: "credit", listed: 5.36, percent: 2.0, icon: "fluent:sparkles", realizedFactor: 0.37 },
  { id: "c-misty-live-m2", name: "2 Mistees", brand: "Misty", category: "credit", listed: 2, percent: 31.0, icon: "fluent:ticket", realizedFactor: 0.37 },
  { id: "c-misty-live-fs1", name: "Free Spin +1 (about 2.7 Mistees)", brand: "Misty", category: "credit", listed: 2.68, percent: 9.0, icon: "fluent:sparkles", realizedFactor: 0.37 },
  { id: "c-misty-live-m1", name: "1 Mistee", brand: "Misty", category: "credit", listed: 1, percent: 18.0, icon: "fluent:ticket", realizedFactor: 0.37 },
];

const jemlit = build("Jemlit", jemlitRows);
const mistyLive = build("Misty", mistyLiveRows);
const mistyTs = build("Misty", mistyTimepieceRows);
const mistyPh = build("Misty", mistyPenthouseRows);
const cases = build("Cases.gg", casesRows);

export const CAPTURED_ITEMS: CatalogItem[] = [...jemlit.items, ...mistyLive.items, ...mistyTs.items, ...mistyPh.items, ...cases.items];

function box(name: string, price: number, percents: { itemId: string; percent: number }[], note: string): BoxDef {
  return { name, price, ticketTotal: T, items: weightsFromPercents(percents, T).items, valueLayer: "retail", displayLayer: "retail", note };
}

/** Prices and layers: retail = the operator's listed value; realized = assumption stated in the note. */
export const CAPTURED_BOXES = {
  mistyTimepieceLive: box(
    "Misty Timepiece Suite (live table, 12 Oct 2026) · $10",
    10,
    mistyLive.percents,
    "Captured from the live page on 12 October 2026, not reconstructed: 17 outcomes, odds sum 100.16%, 1.652% chance of a physical item (1 in 61), Rolex Lady-Datejust at 1 in 25,000, expected value of items $3.77 at the listed minimum retail values, about 2.8 Mistees per open including free spins. Mistees are site credit with no cash value, redeemable only for boxes and products; the page data values each Mistee at 100 cents (never stated in words), so face is $1, and the real cost to Misty is about $0.37 per Mistee if re-spent on boxes. Physical items realized at 70% of listed (assumption). Capture saved in research/captures.",
  ),
  jemlitApple: box(
    "Jemlit Apple eBox (reconstructed) · $7.50",
    7.5,
    jemlit.percents,
    "Rebuilt from the 9 Oct 2026 capture: 29 items, ten headline items at 0.0001% each, 96.3% of opens at or below $15, EV $6.78 at listed prices. The price was rendered client-side and not captured; $7.50 is assumed. Realized = cashback credits at 91% of listed (EV $6.17).",
  ),
  mistyTimepiece: box(
    "Misty Timepiece Suite (reconstructed) · $10",
    10,
    mistyTs.percents,
    "Rebuilt from the capture: 1.65% chance of any watch, EV of watches $3.77, 14 credits expected, Rolex at 0.004%, 61% of opens pay the smallest credit bundle. Credits at face = retail; realized = $0.32 per credit if the 100,000-ticket draw sells out; watches realized at 70% of listed (assumption).",
  ),
  mistyPenthouse: box(
    "Misty Penthouse (reconstructed) · $50",
    50,
    mistyPh.percents,
    "Rebuilt from the capture: 1.59% chance of any watch, EV of watches $20.59, 42 credits expected, Rolex at 0.0095%. Same valuation assumptions as the Timepiece Suite.",
  ),
  casesPackUp: box(
    "Cases.gg Pack Up (reconstructed) · $1,813.83",
    1813.83,
    cases.percents,
    "Rebuilt from the capture: 22 items, EV $1,623.38 (89.5% of price, matching the disclosed 10% edge), 21.25% chance of an item worth at least the price, the $71 suitcase 61.25% of the time, LV × Tyler trunk at 0.5%. Realized at 75% of the site's values (assumption).",
  ),
};
