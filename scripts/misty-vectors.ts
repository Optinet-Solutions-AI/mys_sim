// Generates kit/misty-backend/test-vectors.json: known inputs and the exact outputs an implementation must reproduce.
// Kit 1.1: every 1.0 field is kept; added bonusHash, the exact strings that were hashed, and an `api` block in the
// contract's vocabulary (kind item | credit | bonus, credits, percent, valueCents).
// Run: npx -y tsx scripts/misty-vectors.ts
import { writeFileSync } from "node:fs";
import { canonicalJson, sha256Hex } from "../src/engine/hash";
import { MistyOpener, bonusHash, buildBonus, buildTable, liveWeights, lookup, lookupBonus, mistyBox, mistyDigest, rollOf } from "../src/engine/labs/misty";
import type { MistyOutcome } from "../src/engine/types";
import { mistyConfigFor } from "../src/lib/mistyPresets";

const slug = "timepiece-suite";
const box = mistyBox(slug);
const table = buildTable(box, liveWeights(box));
const bonus = buildBonus(box.bonus);
const apiBonus = box.bonus.map((b) => ({ credits: b.mistees, percent: b.weight }));
const bHash = bonusHash(slug, apiBonus);

/** engine → API vocabulary */
export const apiKind = (o: MistyOutcome): "item" | "credit" | "bonus" => (o.kind === "item" ? "item" : o.freeSpins > 0 ? "bonus" : "credit");

const seeds = [
  { serverSeed: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", clientSeed: "alice" },
  { serverSeed: "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100", clientSeed: "my-lucky-seed" },
  { serverSeed: "0000000000000000000000000000000000000000000000000000000000000000", clientSeed: "" },
];

const vectors = seeds.map(({ serverSeed, clientSeed }) => {
  const spins = [1, 2, 3, 4, 5].map((nonce) => {
    const digest = mistyDigest(slug, serverSeed, clientSeed, nonce);
    const roll = rollOf(digest);
    const e = lookup(table, roll);
    return { nonce, key: ["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), digest, roll, outcomeId: e.outcome.id, outcomeLabel: e.outcome.label, outcomeKind: apiKind(e.outcome), bandFrom: e.from, bandTo: e.to, bonusIfFreeSpin: lookupBonus(bonus, roll).mistees };
  });
  // the open as the API would resolve it from nonce 1: free spins at nonces 2, 3
  const first = spins[0];
  const o = box.outcomes.find((x) => x.id === first.outcomeId)!;
  const bonusSpins = spins.slice(1, 1 + o.freeSpins).map((s) => ({ nonce: s.nonce, digest: s.digest, roll: s.roll, credits: s.bonusIfFreeSpin }));
  const resolved = { outcomeId: o.id, kind: apiKind(o), credits: o.mistees, freeSpins: o.freeSpins, bonusSpins, creditsAwarded: o.mistees + bonusSpins.reduce((s, b) => s + b.credits, 0), bonusCreditsParam: bonusSpins.map((b) => b.credits).join(",") };
  return { serverSeed, serverHash: sha256Hex(serverSeed), clientSeed, spins, resolved };
});

// one full open from the opener, deterministic for the label "kit"
const cfg = mistyConfigFor(slug);
cfg.clientSeed = "alice";
cfg.players = [{ id: "guest", name: "Guest", share: 1 }];
cfg.activePlayerId = "guest";
const opener = new MistyOpener(cfg, "kit");
const commitment = opener.commitment;
const full = opener.spin();

const tableHashInput = canonicalJson({ slug: box.slug, price: box.price, table: table.entries.map((e) => ({ id: e.outcome.id, percent: e.percent })) });
const bonusHashInput = canonicalJson({ slug, bonus: apiBonus });

const out = {
  kit: "misty-backend 1.1",
  generated: new Date().toISOString().slice(0, 10),
  recipe: {
    serverHash: "sha256(serverSeedHex)",
    key: "DRAW-<slug>-<serverSeed>-<clientSeed>-<nonce>",
    digest: "HMAC-SHA256(key, message = '')",
    roll: "parseInt(digest.slice(0, 13), 16) / 2^52",
    resolve: "position = roll × sum(percent); first band in stored order whose upper edge is above the position",
    tableHash: "sha256(canonicalJson({ slug, price, table: [{ id, percent }] })) with sorted keys and no whitespace; price in dollars; percents exactly as stored",
    bonusHash: "sha256(canonicalJson({ slug, bonus: [{ credits, percent }] })) with sorted keys and no whitespace; rows in stored order",
    canonicalJson: "keys sorted alphabetically at every level, no whitespace, numbers as JSON.stringify prints them",
    kinds: "API kind: item | credit | bonus (bonus = credit plus free spins). Engine: item | oroos (credit); a row with freeSpins ≥ 1 is bonus.",
  },
  box: {
    slug,
    price: box.price,
    priceCents: Math.round(box.price * 100),
    tableHash: table.hash,
    tableHashInput,
    bonusHash: bHash,
    bonusHashInput,
    total: table.total,
    entries: table.entries.map((e) => ({ id: e.outcome.id, label: e.outcome.label, percent: e.percent, from: e.from, to: e.to })),
    bonus: box.bonus,
  },
  api: {
    box: {
      slug,
      name: box.name,
      tagline: box.tagline,
      price: box.price,
      priceCents: Math.round(box.price * 100),
      tradeInPercent: 90,
      tableHash: table.hash,
      bonusHash: bHash,
      outcomes: table.entries.map((e) => ({ id: e.outcome.id, label: e.outcome.label, rarity: e.outcome.rarity, kind: apiKind(e.outcome), credits: e.outcome.mistees, freeSpins: e.outcome.freeSpins, valueCents: e.outcome.valueUsd == null ? null : Math.round(e.outcome.valueUsd * 100), percent: e.percent })),
      bonus: apiBonus,
    },
    note: "Misty's own bonus tables for the $25 and $50 boxes carry fractional credits (reference data); the main site's contract uses whole credits.",
  },
  vectors,
  fullOpen: { commitmentShownBeforePayment: commitment, bonusHash: bHash, spin: full },
};
writeFileSync("kit/misty-backend/test-vectors.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote kit/misty-backend/test-vectors.json", { tableHash: table.hash, bonusHash: bHash, first: vectors[0].spins[0], resolved: vectors[0].resolved });
