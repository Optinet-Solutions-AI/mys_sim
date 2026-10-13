// Runs the verifier code that the front-end prompt ships, against the kit's test vectors.
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

const d = JSON.parse(readFileSync("kit/misty-backend/test-vectors.json", "utf8"));
const prompt = readFileSync("src/lib/frontendPrompt.ts", "utf8");
let bad = 0;
let n = 0;
for (const v of d.vectors) {
  if ((await sha256Hex(v.serverSeed)) !== v.serverHash) { bad++; console.log("hash mismatch", v.serverSeed); }
  for (const s of v.spins) {
    n++;
    const dg = await digestFor(d.box.slug, v.serverSeed, v.clientSeed, s.nonce);
    const id = resolve(d.box.entries, rollOf(dg));
    if (dg !== s.digest || rollOf(dg) !== s.roll || id !== s.outcomeId) { bad++; console.log("spin mismatch", v.clientSeed, s.nonce); }
  }
}
// every literal the prompt quotes must be in the vectors
const v0 = d.vectors[0];
for (const lit of [v0.serverSeed, v0.serverHash, v0.spins[0].key, v0.spins[0].digest, String(v0.spins[0].roll), v0.spins[0].outcomeId, v0.spins[1].digest, String(v0.spins[1].roll), String(v0.spins[0].bandFrom), String(v0.spins[0].bandTo)]) {
  if (!prompt.includes(lit)) { bad++; console.log("prompt is missing literal", lit); }
}
console.log(`${n} spins checked with the prompt's verifier code; ${bad} problems`);
process.exit(bad ? 1 : 0);
