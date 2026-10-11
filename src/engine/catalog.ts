// Starter catalogue: 48 fictional but realistic luxury items with three price layers.
// Brands are invented. Prices are illustrative and shaped like the research: realized < asking < retail for most,
// with a few rationed bags where realized exceeds retail.
import type { CatalogItem } from "./types";

const C = {
  grail: "#1f2a44",
  legendary: "#5b2a86",
  epic: "#0f6b6b",
  rare: "#1e5aa8",
  common: "#6b7280",
  filler: "#9aa3ad",
};

function it(
  id: string,
  name: string,
  brand: string,
  category: CatalogItem["category"],
  tier: CatalogItem["tier"],
  retail: number,
  asking: number,
  realized: number,
  icon: string,
  confidence: CatalogItem["confidence"] = "medium",
): CatalogItem {
  return { id, name, brand, category, tier, retail, asking, realized, confidence, icon, color: C[tier] };
}

export const CATALOG: CatalogItem[] = [
  // ---- grails (watches and rationed bags) ----
  it("w-montvale-sovereign-40", "Sovereign 40 Steel, black dial", "Montvale", "watch", "grail", 16400, 19950, 16480, "fluent:watch", "high"),
  it("w-montvale-voyager-gmt", "Voyager GMT, two-tone bezel", "Montvale", "watch", "grail", 11200, 24500, 18900, "fluent:watch", "high"),
  it("w-halden-nautique-5711", "Nautique Reference 5711, blue dial", "Halden & Cie", "watch", "grail", 35000, 92000, 78000, "fluent:watch", "medium"),
  it("w-aubert-royal-41", "Royal Octagon 41, slate dial", "Aubert Piguet", "watch", "grail", 27500, 64000, 52000, "fluent:watch", "medium"),
  it("b-arlet-birkin-30", "Grand Sac 30, Epsom leather, gold hardware", "Maison Arlet", "bag", "grail", 14900, 24000, 20500, "fluent:handbag", "high"),
  it("b-arlet-kelly-28", "Sellier 28, Epsom leather, palladium", "Maison Arlet", "bag", "grail", 13200, 34500, 28000, "fluent:handbag", "medium"),
  it("b-arlet-mini-kelly", "Mini Sellier II, chèvre leather", "Maison Arlet", "bag", "grail", 9800, 30000, 26000, "fluent:clutch-bag", "medium"),
  it("j-vallore-riviere", "Rivière diamond necklace, 12 ct", "Vallore", "jewellery", "grail", 48000, 39000, 31000, "fluent:gem-stone", "low"),
  // ---- legendary ----
  it("w-montvale-submersible", "Submersible Date, blue and gold", "Montvale", "watch", "legendary", 17800, 19800, 16900, "fluent:watch", "high"),
  it("w-halden-aquanaut", "Aquanaut Sport, rubber strap", "Halden & Cie", "watch", "legendary", 24000, 80000, 64000, "fluent:watch", "medium"),
  it("w-cartel-panthera", "Panthera small model, steel", "Cartel & Fils", "watch", "legendary", 5500, 5900, 4700, "fluent:watch", "high"),
  it("b-chanelle-classic-flap", "Classic Flap medium, caviar, gold", "Chanelle", "bag", "legendary", 11300, 9900, 8500, "fluent:handbag", "high"),
  it("b-goyard-saint-louis", "Saint-Louis tote PM, green", "Goyette", "bag", "legendary", 1900, 2600, 2500, "fluent:handbag", "high"),
  it("b-dioré-lady-mini", "Lady Mini, exotic leather", "Dioré", "bag", "legendary", 30000, 32000, 26000, "fluent:handbag", "low"),
  it("j-vallore-alhambra", "Alhambra bracelet, five motifs", "Vallore", "jewellery", "legendary", 4900, 5600, 5400, "fluent:ring", "high"),
  it("w-hublotte-fusion", "Classic Fusion titanium, pavé", "Hublotte", "watch", "legendary", 24100, 18500, 14500, "fluent:watch", "medium"),
  // ---- epic ----
  it("w-omegon-seamaster", "Seamaster 300, wave dial", "Omegon", "watch", "epic", 5900, 5200, 4300, "fluent:watch", "high"),
  it("w-tissotti-prx", "PRX 35 automatic, ice-blue", "Tissotti", "watch", "epic", 775, 690, 470, "fluent:watch", "high"),
  it("w-longino-dolce", "Dolce Vita quartz, steel", "Longino", "watch", "epic", 1700, 1500, 1050, "fluent:watch", "high"),
  it("b-vuitte-neverfull", "Neverfull MM, monogram canvas", "Vuitte", "bag", "epic", 2030, 1700, 1450, "fluent:handbag", "high"),
  it("b-pradore-reedition", "Re-Edition nylon shoulder bag", "Pradore", "bag", "epic", 1550, 1100, 850, "fluent:purse", "high"),
  it("b-gucchi-marmont", "Marmont small matelassé", "Gucchi", "bag", "epic", 2650, 1500, 1150, "fluent:handbag", "high"),
  it("s-aireau-jordan-1", "Court One High, retro colourway", "Aireau", "sneaker", "epic", 180, 420, 360, "fluent:running-shoe", "high"),
  it("j-tiffano-hardwear", "HardWear link bracelet, silver", "Tiffano", "jewellery", "epic", 1250, 900, 720, "fluent:ring", "high"),
  it("a-raybane-aviator", "Aviator Classic, gold frame", "Raybane", "accessory", "epic", 185, 160, 110, "fluent:sunglasses", "high"),
  it("t-apfel-watch-ultra", "Smartwatch Ultra, titanium", "Apfel", "tech", "epic", 799, 720, 560, "fluent:watch", "high"),
  // ---- rare ----
  it("w-gshock-origin", "Origin 5600, resin", "Kasio", "watch", "rare", 99, 90, 60, "fluent:watch", "high"),
  it("b-coachman-tabby", "Tabby shoulder bag 26", "Coachman", "bag", "rare", 450, 320, 240, "fluent:purse", "high"),
  it("b-mkors-pochette", "Pochette crossbody, saffiano", "M. Kors", "bag", "rare", 298, 180, 120, "fluent:purse", "high"),
  it("s-aireau-dunk-low", "Dunk Low, panda", "Aireau", "sneaker", "rare", 115, 130, 105, "fluent:running-shoe", "high"),
  it("a-hermine-scarf", "Silk carré 90, equestrian print", "Maison Arlet", "accessory", "rare", 520, 450, 380, "fluent:scarf", "high"),
  it("j-pandorra-charm", "Charm bracelet, sterling", "Pandorra", "jewellery", "rare", 130, 95, 60, "fluent:ring", "high"),
  it("t-apfel-airpods-pro", "Earbuds Pro, 2nd gen", "Apfel", "tech", "rare", 249, 220, 180, "fluent:headphone", "high"),
  it("be-chanelle-no5", "No. 5 eau de parfum, 100 ml", "Chanelle", "beauty", "rare", 165, 150, 110, "fluent:lotion-bottle", "high"),
  // ---- common ----
  it("be-chanelle-rouge", "Rouge Coco lipstick", "Chanelle", "beauty", "common", 48, 45, 30, "fluent:lipstick", "high"),
  it("be-dioré-sauvage", "Sauvage eau de toilette, 60 ml", "Dioré", "beauty", "common", 95, 85, 65, "fluent:lotion-bottle", "high"),
  it("a-raybane-case", "Branded sunglasses case", "Raybane", "accessory", "common", 35, 25, 12, "fluent:briefcase", "medium"),
  it("a-aireau-cap", "Logo cap, cotton", "Aireau", "accessory", "common", 32, 28, 15, "fluent:top-hat", "high"),
  it("t-apfel-cable", "Woven charging cable", "Apfel", "tech", "common", 29, 25, 14, "fluent:mobile-phone", "high"),
  it("a-swatchi-strap", "Silicone watch strap", "Swatchi", "accessory", "common", 25, 20, 9, "fluent:watch", "high"),
  // ---- fillers ----
  it("f-sticker-logo", "Brand logo sticker", "Montvale", "accessory", "filler", 2, 1.5, 1, "fluent:label", "high"),
  it("f-keychain", "Enamel keychain", "Vuitte", "accessory", "filler", 8, 6, 3, "fluent:key", "high"),
  it("f-screen-protector", "Smartwatch screen protector", "Generic", "tech", "filler", 9, 8, 4, "fluent:shield", "high"),
  it("f-airtag-case", "Tracker tag case", "Generic", "accessory", "filler", 11, 9, 5, "fluent:package", "high"),
  it("f-credit-1", "Site credit $1", "Site", "credit", "filler", 1, 1, 0.3, "fluent:coin", "high"),
  it("f-credit-3", "Site credit $3", "Site", "credit", "filler", 3, 3, 1, "fluent:coin", "high"),
  it("f-credit-5", "Site credit $5", "Site", "credit", "filler", 5, 5, 1.6, "fluent:dollar-banknote", "high"),
  it("f-penny", "One cent voucher", "Site", "credit", "filler", 0.01, 0.01, 0.01, "fluent:coin", "high"),
];

export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export const TIER_ORDER: CatalogItem["tier"][] = ["grail", "legendary", "epic", "rare", "common", "filler"];
export const TIER_LABEL: Record<CatalogItem["tier"], string> = {
  grail: "Grail",
  legendary: "Legendary",
  epic: "Epic",
  rare: "Rare",
  common: "Common",
  filler: "Filler",
};
