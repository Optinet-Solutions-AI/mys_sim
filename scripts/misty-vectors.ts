// Generates kit/misty-backend/test-vectors.json: known inputs and the exact outputs an implementation must reproduce.
// Run: npx -y tsx scripts/misty-vectors.ts
import { writeFileSync } from "node:fs";
import { sha256Hex } from "../src/engine/hash";
import { MistyOpener, buildBonus, buildTable, liveWeights, lookup, lookupBonus, mistyBox, mistyDigest, rollOf } from "../src/engine/labs/misty";
import { mistyConfigFor } from "../src/lib/mistyPresets";

const slug = "timepiece-suite";
const box = mistyBox(slug);
const table = buildTable(box, liveWeights(box));
const bonus = buildBonus(box.bonus);

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
    return { nonce, key: ["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), digest, roll, outcomeId: e.outcome.id, outcomeLabel: e.outcome.label, bandFrom: e.from, bandTo: e.to, bonusIfFreeSpin: lookupBonus(bonus, roll).mistees };
  });
  return { serverSeed, serverHash: sha256Hex(serverSeed), clientSeed, spins };
});

// one full open from the opener, deterministic for the label "kit"
const cfg = mistyConfigFor(slug);
cfg.clientSeed = "alice";
cfg.players = [{ id: "guest", name: "Guest", share: 1 }];
cfg.activePlayerId = "guest";
const opener = new MistyOpener(cfg, "kit");
const commitment = opener.commitment;
const full = opener.spin();

const out = {
  kit: "misty-backend 1.0",
  generated: new Date().toISOString().slice(0, 10),
  recipe: {
    serverHash: "sha256(serverSeedHex)",
    key: "DRAW-<slug>-<serverSeed>-<clientSeed>-<nonce>",
    digest: "HMAC-SHA256(key, message = '')",
    roll: "parseInt(digest.slice(0, 13), 16) / 2^52",
    resolve: "position = roll × sum(percent); first band in stored order whose upper edge is above the position",
    tableHash: "sha256(canonicalJson({ slug, price, table: [{ id, percent }] })) with sorted keys and no whitespace",
  },
  box: { slug, price: box.price, tableHash: table.hash, total: table.total, entries: table.entries.map((e) => ({ id: e.outcome.id, label: e.outcome.label, percent: e.percent, from: e.from, to: e.to })), bonus: box.bonus },
  vectors,
  fullOpen: { commitmentShownBeforePayment: commitment, spin: full },
};
writeFileSync("kit/misty-backend/test-vectors.json", JSON.stringify(out, null, 2) + "\n");
console.log("wrote kit/misty-backend/test-vectors.json", { tableHash: table.hash, first: vectors[0].spins[0] });
