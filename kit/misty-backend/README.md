# Misty-style mystery box: backend implementation kit

Version 1.0, 13 October 2026. For the developers of the main site (separate repo, separate front end).
This kit is the backend half of the Misty mechanism as copied in the research simulator, packaged so it can be
dropped into a Node/TypeScript service. Everything here is deterministic and covered by test vectors.

Live reference: https://mys-sim.vercel.app/operators/misty (play it), https://mys-sim.vercel.app/docs/misty
(the mechanism in plain words), https://mys-sim.vercel.app/docs/misty/dev (this document with an API sandbox).

## 1. What you are building

One product: a priced box with a published odds table. One open = one independent roll against that table.

- The server commits to a secret (its SHA-256 hash is shown) **before** the player pays.
- The player may set a client seed (before paying).
- The roll is `HMAC-SHA256(key = "DRAW-<slug>-<serverSeed>-<clientSeed>-<nonce>", message = "")`, first 13 hex
  characters divided by 2^52, read against the cumulative bands of the odds table.
- Some outcomes carry free spins: the same secret, nonce 2, 3, …, read against a small bonus table (credit only).
- The odds table used is snapshotted and hashed ("frozen onto the open"); the secret is revealed after the spin.
- Payouts are either a physical item (ship or trade in for credit) or site credit ("Mistees" on Misty; name yours).
- Credit is a liability ledger: it buys boxes and products, never cash.

Out of scope here: competitions/raffles, payments provider integration, shipping, KYC. Hooks are marked.

## 2. Files in this kit

| File | What it is |
|---|---|
| `misty.ts` | The engine: table building and hashing, the roll, bonus spins, per-player tables, an opener, a verifier, the per-open maths, a simulation runner. Pure TypeScript, no I/O. Copied verbatim from the simulator with import paths flattened. |
| `mistyLive.generated.ts` | The thirteen live boxes captured on 12 October 2026: names, prices, exact weights, bonus tables. Use as seed data or as a shape reference. |
| `types.ts` | The types the engine uses (`MistyBox`, `MistyOutcome`, `MistyConfig`, `MistySpin`, …). |
| `hash.ts` | SHA-256, HMAC-SHA256, canonical JSON, over `@noble/hashes`. |
| `rng.ts`, `metrics.ts` | Only needed by the simulation runner (`runMisty`) and the chi-square check. Not for production seeds. |
| `server-reference.ts` | A minimal production flow: create open (commit), set client seed, pay, spin (resolve + reveal), verify. Uses `crypto.randomBytes` for the server seed. Storage is an interface you implement. |
| `schema.sql` | Postgres DDL: boxes, versioned table snapshots, segments, opens, bonus spins, item awards, credit ledger, publication log. |
| `openapi.yaml` | The HTTP API: player endpoints, public verify, admin (back office). |
| `FRONTEND_PROMPT.md` | A ready prompt to paste into a Claude session in the front-end repo: mechanic, API order, hard rules, screens, copy rules, questions. |
| `test-vectors.json` | Known inputs and the exact outputs your implementation must reproduce. |
| `misty-boxes-2026-10-12.json` | The raw capture the generated data came from, with the page strings. |

Dependencies: `@noble/hashes` (^2.4). Node 20+. Nothing else.

## 3. Concepts and invariants

**Box.** `slug`, `name`, `price` (store cents), a current **table version**, a current **bonus table version**.

**Table snapshot.** An ordered list of `{ outcomeId, percent }`. Percents must sum to 100 (tolerance 1e-6; reject
otherwise in admin). Each snapshot has `tableHash = sha256(canonicalJson({ slug, price, table: [{id, percent}] }))`.
A snapshot is immutable; changing odds creates a new version. Every open stores the `tableHash` it was resolved with.

**Open lifecycle.** `created → seeded? → paid → resolved → revealed` (resolved and revealed happen in one step in
the reference flow; keep them as two timestamps).

- `created`: server seed generated (32 random bytes from a CSPRNG, hex), `serverHash = sha256(serverSeedHex)`
  returned, `tableHash` pinned, `nonceStart = 1`, expiry set (say 15 minutes). The seed is stored encrypted at rest or
  in a KMS-backed column; it must never be readable by the front end before `revealed`.
- `seeded`: client seed accepted only while status is `created` (before payment). If the player never sets one, the
  server fills a default and **records that it did** (`clientSeedSource = "server-default"`). Publish this rule.
- `paid`: money or credit taken, idempotent on an idempotency key. Price is read from the box at `created` and stored.
- `resolved`: digest, roll, outcome, bonus spins computed and stored; item award or credit ledger entry written in
  the same transaction.
- `revealed`: server seed returned to the player. From here the open is publicly verifiable.

An open may never be re-resolved. A new attempt is a new open with a new seed.

**Bonus spins.** `freeSpins` on the outcome. Nonce continues: 2, 3, … Same secret, same client seed, bonus table
of the box's current bonus version (pin its hash too: `bonusHash`).

**Segments (per-player tables).** A player belongs to at most one segment. A segment may carry its own table
version for a box. The table hash stored on the open is the hash of the table actually used. Policy decision for the
main site: whether segments are allowed at all. The research position is that they are the one thing the proof
cannot reveal, so either do not build them or publish every table hash in a public log (section 7).

**Credit ledger.** Append-only. `delta` in whole credits (or cents if you price credit at a rate). Reasons:
`box-award`, `bonus-award`, `trade-in`, `box-payment`, `product-payment`, `adjustment`. Balance = sum. Never
negative. Credit has no cash-out path; say so in the terms.

**Item awards.** `awarded → shipped | traded`. Trade-in credits `tradeInCredits` (policy: listed dollars = credits
on Misty; decide yours and store the rate on the award).

## 4. The algorithm, exactly

```ts
import { sha256Hex, hmacSha256Hex, canonicalJson } from "./hash";

const TWO52 = 2 ** 52;

export const commit = (serverSeedHex: string) => sha256Hex(serverSeedHex);

export const digest = (slug: string, serverSeed: string, clientSeed: string, nonce: number) =>
  hmacSha256Hex(["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), "");

export const roll = (digestHex: string) => parseInt(digestHex.slice(0, 13), 16) / TWO52; // [0, 1)

export function tableHash(slug: string, price: number, table: { id: string; percent: number }[]) {
  return sha256Hex(canonicalJson({ slug, price, table }));
}

/** cumulative bands: position = roll × total; first band whose upper edge is above the position wins */
export function resolve(table: { id: string; percent: number }[], u: number) {
  const total = table.reduce((s, t) => s + Math.max(0, t.percent), 0);
  const pos = u * total;
  let acc = 0;
  for (const t of table) {
    if (t.percent <= 0) continue;
    acc += t.percent;
    if (pos < acc) return t.id;
  }
  return table[table.length - 1].id;
}
```

Notes that matter:

- Band order is the order of the stored snapshot. Never sort when resolving; the hash covers that order.
- `percent` is a JS number; store it as `numeric(12,8)` and format with at most 8 decimals so canonical JSON is
  stable between languages. Test vectors include a table hash so you can check your serialisation.
- The key is a dash-joined string, the HMAC message is empty. This is Misty's published competition-verifier
  convention. The box verifier itself was not captured; if the main site wants a different recipe, change it here and
  in the public verifier together, and regenerate the vectors.
- `parseInt(hex13, 16) / 2^52` gives 52 bits of uniform randomness: enough for percents with 8 decimals.

## 5. Sequence

```
front end                      API                                   DB / KMS
   |  POST /opens {slug}        |                                       |
   |--------------------------->| seed = randomBytes(32)                |
   |                            | hash = sha256(seed); pin tableHash    |
   |                            |-- insert open (seed encrypted) ------>|
   |<-- {openId, serverHash,    |                                       |
   |     tableHash, nonce:1}    |                                       |
   |  PUT /opens/:id/client-seed|                                       |
   |--------------------------->|-- update (status = created only) ---->|
   |  POST /opens/:id/pay       |                                       |
   |--------------------------->|-- charge / debit credit, idempotent ->|
   |  POST /opens/:id/spin      |                                       |
   |--------------------------->| digest, roll, band, bonus spins       |
   |                            |-- tx: resolve + award + ledger ------>|
   |<-- {outcome, bonus, item?, |                                       |
   |     credits, serverSeed,   |                                       |
   |     digest, roll, tableHash}                                       |
   |  GET /verify?...           |  (public, stateless recomputation)    |
```

## 6. API

See `openapi.yaml`. Player: `GET /v1/boxes`, `GET /v1/boxes/{slug}`, `POST /v1/opens`,
`PUT /v1/opens/{id}/client-seed`, `POST /v1/opens/{id}/pay`, `POST /v1/opens/{id}/spin`, `GET /v1/opens/{id}`,
`POST /v1/awards/{id}/trade-in`, `GET /v1/me/credits`. Public: `GET /v1/verify`, `GET /v1/tables/{hash}`.
Admin: tables (new version, activate), bonus tables, segments, publication log.

Rules the API must enforce: client seed only before `paid`; spin only once and only when `paid`; the response of
`spin` is the only place the server seed appears; `GET /opens/{id}` returns the seed only after `revealed`.

## 7. Back office rules

- Odds edits create a new table version; nothing is edited in place. Store who, when, why.
- Validation: every outcome present, percents ≥ 0, sum = 100 ± 1e-6, every item outcome has a value, free-spin
  outcomes have `freeSpins ≥ 1`.
- Show the per-open maths on save: value × percent for every row, added up, on screen and real, against the price (the simulator's
  "The maths of this box" table is the reference).
- Publish every activated table hash with its activation time to a public, append-only log (`table_publication_log`,
  exposed at `GET /v1/tables/log`). A player can then check that the hash on their open was the public one at that
  moment. This is the cheapest honest answer to "did everyone get the same odds".
- Segments, if built at all, publish too.

## 8. Security checklist

- Server seed from `crypto.randomBytes(32)` (or KMS GenerateRandom). Never a PRNG, never derived from time or ids.
- Generate and hash the seed **before** accepting a client seed, and make the commit response the first thing the
  front end shows. Order is the whole proof.
- Store the seed encrypted; decrypt only inside the spin transaction; reveal only in the spin response and
  afterwards.
- One open, one seed. Expire unpaid opens; never reuse a seed for another open.
- Idempotency keys on pay and spin; a retried spin returns the stored result, never a new roll.
- Freeze `price`, `tableHash`, `bonusHash` at `created`; resolve with the frozen snapshot even if admin changed the
  table meanwhile.
- Log every open with digest, roll, outcome, hashes; make `verify` a pure function over that record.
- Rate-limit `POST /opens`; cap bonus-spin depth (the captured tables never chain spins; enforce `maxBonusDepth = 1`).
- Do not let the front end send anything that influences the roll other than the client seed.

## 9. Conformance

1. Run the vectors: for each entry in `test-vectors.json` recompute `serverHash`, `digest`, `roll`, `outcomeId`,
   bonus spins and `tableHash`; all must match byte for byte.
2. Property test: 1,000,000 synthetic opens on the Timepiece table; per-outcome counts within chi-square p > 0.01
   of the stated odds (`metrics.ts` has `chiSquare`).
3. Replay: for 1,000 stored opens, `verify` must reproduce every field from the stored seed, client seed, nonce and
   table snapshot.
4. Cross-language: the HMAC key is a UTF-8 string; make sure `nonce` is formatted as a plain integer (`"1"`, not
   `"1.0"`).

The simulator runs these in `scripts/smoke-misty.ts` (50,000 opens: return within chance of the table, 500/500
proofs, a tampered seed fails).

## 10. Implementation plan

1. **Data and admin.** Migrate `schema.sql`; import `mistyLive.generated.ts` as seed data (or your own boxes);
   admin endpoints for table versions with validation and the maths preview.
2. **Open flow.** `POST /opens` with commit; client seed; pay (stub the provider); spin with the engine functions;
   ledger and awards in one transaction; reveal.
3. **Public verify.** Stateless `GET /v1/verify` and `GET /v1/tables/{hash}`; a public page in the front end that
   calls them.
4. **Credit.** Ledger, balance, pay-with-credit path, trade-in.
5. **Publication log and segments** (if the product decision is yes).
6. **Conformance** (section 9) in CI.

## 11. Sandboxes

- Hosted: https://mys-sim.vercel.app/docs/misty/dev has an API sandbox that runs this exact engine in the browser
  and shows each request and response.
- Repo in the browser: https://stackblitz.com/github/Optinet-Solutions-AI/mys_sim (may be slow; Next 16 in
  WebContainers) or https://codesandbox.io/p/github/Optinet-Solutions-AI/mys_sim/main.
- Local: `git clone https://github.com/Optinet-Solutions-AI/mys_sim.git && cd mys_sim && npm install && npm run dev`,
  then `npx tsx scripts/smoke-misty.ts` for the headless check.

## 12. Decisions the main site still has to make

- The credit unit's name and its on-screen dollar rate; whether it is displayed as money at all.
- The trade-in rate for items (Misty: listed dollars = credits; the per-item number is only shown after a win).
- Default client seed policy when the player sets none (publish it).
- Whether segments exist; if yes, the publication log is mandatory.
- Spend limits, cooling-off, and a plain "paid in / got back" counter per player.
- Whether to publish the table hash in the box page before payment (recommended: yes).
