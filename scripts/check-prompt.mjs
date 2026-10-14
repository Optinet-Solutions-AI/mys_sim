// Runs the verifier code that the front-end prompt ships, against the kit's test vectors (kit 1.1: also the
// table hash and the bonus hash from the exact canonical strings, and the resolved open per vector).
// Run: node scripts/check-prompt.mjs
import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
const crypto = globalThis.crypto ?? webcrypto;

const enc = new TextEncoder();
const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
async function sha256Hex(text) { return hex(await crypto.subtle.digest("SHA-256", enc.encode(text))); }
async function hmacSha256Hex(key, message) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}
const digestFor = (slug, serverSeed, clientSeed, nonce) => hmacSha256Hex(["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), "");
const rollOf = (digestHex) => parseInt(digestHex.slice(0, 13), 16) / 2 ** 52;
function resolve(entries, roll) {
  const total = entries.reduce((s, e) => s + Math.max(0, e.percent), 0);
  const pos = roll * total;
  let acc = 0;
  for (const e of entries) { if (e.percent <= 0) continue; acc += e.percent; if (pos < acc) return e.id; }
  return entries[entries.length - 1].id;
}
// canonical JSON exactly as the prompt describes it
function canonical(v) {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonical(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

const d = JSON.parse(readFileSync("kit/misty-backend/test-vectors.json", "utf8"));
const prompt = readFileSync("src/lib/frontendPrompt.ts", "utf8");
let bad = 0;
let n = 0;
// hashes from the canonical strings and from the data
const tIn = canonical({ slug: d.box.slug, price: d.box.price, table: d.box.entries.map((e) => ({ id: e.id, percent: e.percent })) });
if (tIn !== d.box.tableHashInput) { bad++; console.log("tableHashInput differs from canonical()"); }
if ((await sha256Hex(tIn)) !== d.box.tableHash) { bad++; console.log("tableHash mismatch"); }
const bIn = canonical({ slug: d.box.slug, bonus: d.api.box.bonus });
if (bIn !== d.box.bonusHashInput) { bad++; console.log("bonusHashInput differs from canonical()"); }
if ((await sha256Hex(bIn)) !== d.box.bonusHash) { bad++; console.log("bonusHash mismatch"); }
const bonusEntries = d.api.box.bonus.map((b) => ({ id: String(b.credits), percent: b.percent }));
for (const v of d.vectors) {
  if ((await sha256Hex(v.serverSeed)) !== v.serverHash) { bad++; console.log("hash mismatch", v.serverSeed); }
  for (const s of v.spins) {
    n++;
    const dg = await digestFor(d.box.slug, v.serverSeed, v.clientSeed, s.nonce);
    const id = resolve(d.box.entries, rollOf(dg));
    if (dg !== s.digest || rollOf(dg) !== s.roll || id !== s.outcomeId) { bad++; console.log("spin mismatch", v.clientSeed, s.nonce); }
    if (Number(resolve(bonusEntries, rollOf(dg))) !== s.bonusIfFreeSpin) { bad++; console.log("bonus band mismatch", v.clientSeed, s.nonce); }
  }
  // the resolved open: outcome from nonce 1, free spins at 2, 3 with the bonus table
  const o = d.api.box.outcomes.find((x) => x.id === v.resolved.outcomeId);
  if (!o || o.kind !== v.resolved.kind || o.freeSpins !== v.resolved.bonusSpins.length) { bad++; console.log("resolved open mismatch", v.clientSeed); }
  const credits = o.credits + v.resolved.bonusSpins.reduce((s, b) => s + b.credits, 0);
  if (credits !== v.resolved.creditsAwarded) { bad++; console.log("creditsAwarded mismatch", v.clientSeed); }
}
// every literal the prompt quotes must be in the vectors
const v0 = d.vectors[0];
for (const lit of [v0.serverSeed, v0.serverHash, v0.spins[0].key, v0.spins[0].digest, String(v0.spins[0].roll), v0.spins[0].outcomeId, v0.spins[1].digest, String(v0.spins[1].roll), String(v0.spins[0].bandFrom), String(v0.spins[0].bandTo), d.box.tableHash, d.box.bonusHash]) {
  if (!prompt.includes(lit)) { bad++; console.log("prompt is missing literal", lit); }
}
console.log(`${n} spins checked with the prompt's verifier code, plus table and bonus hashes and ${d.vectors.length} resolved opens; ${bad} problems`);
process.exit(bad ? 1 : 0);
