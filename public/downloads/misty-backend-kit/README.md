# Misty-style mystery box: backend implementation kit

Version 1.2, 19 October 2026 (1.2 adds battles; 1.1 answered the front end). For the developers of the main site (separate repo, separate front end).
This kit is the backend half of the Misty mechanism as copied in the research simulator, packaged so it can be
dropped into a Node/TypeScript service. Everything here is deterministic and covered by test vectors.

Live reference: https://mys-sim.vercel.app/operators/misty (play it), https://mys-sim.vercel.app/docs/misty
(the mechanism in plain words), https://mys-sim.vercel.app/docs/misty/dev (this document with an API sandbox).

## 0. What changed in 1.1 (answers to the front end, 14 October 2026)

The front end runs kit 1.0 end to end against a browser mock (https://mysterybox-seven.vercel.app) and sent a list
of gaps. Every point was checked against the kit; these are the decisions. Nothing about the roll changed; every
1.0 vector still passes.

| Front-end point | Decision in 1.1 |
|---|---|
| Table hash only matches with the price in dollars and the raw float percents; rounding to 8 decimals changes it | Correct. The hash input is `{ slug, price (dollars, as listed), table: [{ id, percent }] }` with the percents exactly as stored. The DB stores the hashed JSON as is (`entries jsonb`); it is never re-serialised through a numeric column. The 1.0 note about `numeric(12,8)` was wrong and is gone. `test-vectors.json` now carries `tableHashInput`, the exact string that was hashed. |
| `bonusHash` has no recipe | Adopted the front end's placeholder as the recipe: `sha256(canonicalJson({ slug, bonus: [{ credits, percent }] }))`, bonus rows in stored order. In the engine: `bonusHash(slug, entries)`. Vectors carry `bonusHash` and `bonusHashInput`. |
| Outcome kinds: openapi says item, credit, bonus; vectors say oroos, mistees, weight | The API vocabulary is the contract: `kind: item \| credit \| bonus` (bonus = credit plus free spins), `credits`, `percent`, `valueCents`. The engine keeps Misty's words internally; the mapping is in section 3. Vectors now carry an `api` block in API vocabulary next to the engine block. The sandbox on the dev page was fixed to send free-spin rows as `bonus`. |
| Outcomes have no image, brand, category; the box response lacks rarity, tagline, bonusHash, maths | Added `imageUrl`, `brand`, `category` (optional) to `Outcome`; `Box` carries `tagline`, `bonusHash`, `maths`, `tradeInPercent`; outcomes carry `rarity`. The sandbox now returns them. |
| No endpoint to list awards or opens; no shipping endpoint | Added `GET /v1/me/awards`, `GET /v1/me/opens`, `POST /v1/awards/{id}/ship` (address in, award goes to `shipping`), and `award_shipments` in the schema. |
| `GET /v1/tables/{hash}` returns only the main table; the public check also needs the bonus table | Added `GET /v1/bonus-tables/{bonusHash}`; `GET /v1/opens/{id}` returns both hashes; `verifyUrl` carries both. |
| The browser also checks the outcome, each free spin's credits and the bonus hash; `/v1/verify` does not | `GET /v1/verify` now accepts `outcomeId`, `bonusCredits` (comma-separated, per free spin in nonce order) and `bonusHash`, and answers `ok` plus a `checks` object with one boolean per claim. |
| Every open pins a full copy of the table and spin/verify use that copy | Same invariant here. `server-reference.ts` now loads the pinned snapshot by hash instead of refusing when the current table moved. |
| Credits are whole numbers on the front end; the $25 and $50 Misty bonus tables have fractional values | Decided: `credits` is a whole number in the contract (integer). 1 credit shows as $1 on the main site. The Misty capture (`mistyLive.generated.ts`) keeps its fractional bonus rows as reference data and is not to be seeded on the main site. |
| Trade-in 90% of listed value (Misty: 100%), default client seed `grailnoir-default`, unpaid opens expire after 15 minutes | Recorded as the main site's policy. `tradeInPercent` is a box-level setting returned by the API and stored on every award at award time; the reference server reads the three values from one `CONFIG` object. |
| The catalogue is the main site's own 8 boxes (percent = weight ÷ 1000), with their own free-spin tables; the API must serve that, not the Misty capture | Agreed. `POST /v1/admin/boxes` upserts a box with its outcomes and bonus table from the main site's catalogue export; the Misty data stays a shape reference. |
| Who issues the bearer token | The main site's auth issues it (Supabase Auth is the plan of record; any JWT works). The box API verifies the signature, reads `sub` and maps it to `players.external_id`, creating the player on first call. The mock accepts any token. |
| Error body shape | `{ code, message, details? }` at the top level, HTTP status as today. Codes are listed in section 6. |

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

Out of scope here: competitions/raffles, payments provider integration, KYC. Shipping has an endpoint and a table
but no carrier integration. Hooks are marked.

## 2. Files in this kit

| File | What it is |
|---|---|
| `misty.ts` | The engine: table building and hashing, the bonus hash, the roll, bonus spins, per-player tables, an opener, a verifier, the per-open maths, a simulation runner. Pure TypeScript, no I/O. Copied verbatim from the simulator with import paths flattened. |
| `mistyLive.generated.ts` | The thirteen live boxes captured on 12 October 2026: names, prices, exact weights, bonus tables. A shape reference and research data; not the main site's catalogue. |
| `types.ts` | The types the engine uses (`MistyBox`, `MistyOutcome`, `MistyConfig`, `MistySpin`, …). |
| `hash.ts` | SHA-256, HMAC-SHA256, canonical JSON, over `@noble/hashes`. |
| `rng.ts`, `metrics.ts` | Only needed by the simulation runner (`runMisty`) and the chi-square check. Not for production seeds. |
| `server-reference.ts` | A minimal production flow: create open (commit), set client seed, pay, spin (resolve from the pinned snapshot + reveal), verify with per-claim checks. Uses `crypto.randomBytes` for the server seed. Storage is an interface you implement. |
| `schema.sql` | Postgres DDL: boxes, versioned table snapshots, bonus snapshots, segments, opens, bonus spins, item awards, shipments, credit ledger, publication log. |
| `openapi.yaml` | The HTTP API: player endpoints, public verify, admin (back office), errors. |
| `FRONTEND_PROMPT.md` | A ready prompt to paste into a Claude session in the front-end repo: mechanic, API order, hard rules, screens, copy rules, questions. |
| `test-vectors.json` | Known inputs and the exact outputs your implementation must reproduce, in engine and API vocabulary, with the exact strings that were hashed. |
| `BATTLES.md`, `battleKit.ts`, `battles-reference.ts`, `schema-battles.sql`, `test-vectors-battles.json`, `BATTLES_PROMPT.md` | Battles: rule book, pure resolver, server flow with the state machine, tables, vectors, and the prompt for the main repository. |
| `misty-boxes-2026-10-12.json` | The raw capture the generated data came from, with the page strings. |

Dependencies: `@noble/hashes` (^2.4). Node 20+. Nothing else.

## 3. Concepts and invariants

**Box.** `slug`, `name`, `tagline`, `price` (dollars as listed; the API also returns `priceCents` for display), a
current **table version**, a current **bonus table version**, `tradeInPercent`.

**Table snapshot.** An ordered list of `{ id, percent }`. Percents must sum to 100 (tolerance 1e-6; reject
otherwise in admin). Each snapshot has `tableHash = sha256(canonicalJson({ slug, price, table: [{ id, percent }] }))`
where `price` is the dollar price (10, not 1000) and every `percent` is the number exactly as stored. A snapshot is
immutable; changing odds creates a new version. Every open stores the `tableHash` it was resolved with. **What the
database stores is what was hashed:** keep the entries as the JSON array that went into the hash; never round, never
re-serialise through a decimal column; canonical JSON prints numbers the way `JSON.stringify` does (shortest
round-trip), so 30.83042011764706 stays 30.83042011764706.

**Bonus table snapshot.** An ordered list of `{ credits, percent }`. `bonusHash = sha256(canonicalJson({ slug,
bonus: [{ credits, percent }] }))`. Pinned on the open next to the table hash; public at
`GET /v1/bonus-tables/{bonusHash}`.

**Vocabulary.** The engine keeps Misty's words; the API uses the contract's. Map at the boundary:

| Engine (`misty.ts`, `types.ts`) | API (`openapi.yaml`) |
|---|---|
| `kind: "oroos"` with `freeSpins: 0` (credit only) | `kind: "credit"` |
| `kind: "oroos"` with `freeSpins ≥ 1` (the Misty capture marks free-spin rows this way) | `kind: "bonus"` |
| `kind: "item"` | `kind: "item"` |
| `mistees` | `credits` (whole number) |
| `weight` (percent) | `percent` |
| `valueUsd` | `valueCents` |
| bonus entry `{ mistees, weight }` | `{ credits, percent }` |

**Credits** are whole numbers in the contract. The main site shows 1 credit as $1. Ledger deltas are integers.

**Open lifecycle.** `created → seeded? → paid → resolved → revealed` (resolved and revealed happen in one step in
the reference flow; keep them as two timestamps).

- `created`: server seed generated (32 random bytes from a CSPRNG, hex), `serverHash = sha256(serverSeedHex)`
  returned, `tableHash` and `bonusHash` pinned, `nonceStart = 1`, expiry set (15 minutes on the main site). The seed
  is stored encrypted at rest or in a KMS-backed column; it must never be readable by the front end before `revealed`.
- `seeded`: client seed accepted only while status is `created` (before payment). If the player never sets one, the
  server fills the published default (`grailnoir-default` on the main site) and **records that it did**
  (`clientSeedSource = "server-default"`).
- `paid`: money or credit taken, idempotent on an idempotency key. Price is read from the box at `created` and stored.
- `resolved`: digest, roll, outcome, bonus spins computed from the **pinned snapshots** and stored; item award or
  credit ledger entry written in the same transaction.
- `revealed`: server seed returned to the player. From here the open is publicly verifiable.

An open may never be re-resolved. A new attempt is a new open with a new seed.

**Bonus spins.** `freeSpins` on the outcome. Nonce continues: 2, 3, … Same secret, same client seed, the bonus
snapshot pinned on the open.

**Segments (per-player tables).** A player belongs to at most one segment. A segment may carry its own table
version for a box. The table hash stored on the open is the hash of the table actually used. Policy decision for the
main site: whether segments are allowed at all. The research position is that they are the one thing the proof
cannot reveal, so either do not build them or publish every table hash in a public log (section 7).

**Credit ledger.** Append-only. `delta` in whole credits. Reasons: `box-award`, `bonus-award`, `trade-in`,
`box-payment`, `product-payment`, `welcome`, `adjustment`. Balance = sum. Never negative. Credit has no cash-out
path; say so in the terms.

**Item awards.** `awarded → shipping → shipped | traded`. Trade-in pays `round(valueCents × tradeInPercent ÷ 100
÷ 100)` whole credits (90% on the main site; Misty pays 100%); the percent and the credits are stored on the award
when it is created, so a later policy change never touches an existing award.

## 4. The algorithm, exactly

```ts
import { sha256Hex, hmacSha256Hex, canonicalJson } from "./hash";

const TWO52 = 2 ** 52;

export const commit = (serverSeedHex: string) => sha256Hex(serverSeedHex);

export const digest = (slug: string, serverSeed: string, clientSeed: string, nonce: number) =>
  hmacSha256Hex(["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), "");

export const roll = (digestHex: string) => parseInt(digestHex.slice(0, 13), 16) / TWO52; // [0, 1)

/** price in dollars as listed; percents exactly as stored, in stored order */
export function tableHash(slug: string, price: number, table: { id: string; percent: number }[]) {
  return sha256Hex(canonicalJson({ slug, price, table }));
}

/** bonus rows in stored order */
export function bonusHash(slug: string, bonus: { credits: number; percent: number }[]) {
  return sha256Hex(canonicalJson({ slug, bonus }));
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
- `canonicalJson` = keys sorted alphabetically at every level, no whitespace, numbers as `JSON.stringify` prints
  them. The vectors carry the exact input strings (`tableHashInput`, `bonusHashInput`) so you can diff bytes.
- The key is a dash-joined string, the HMAC message is empty. This is Misty's published competition-verifier
  convention. The box verifier itself was not captured; if the main site wants a different recipe, change it here and
  in the public verifier together, and regenerate the vectors.
- `parseInt(hex13, 16) / 2^52` gives 52 bits of uniform randomness: enough for percents with 8 decimals.

## 5. Sequence

```
front end                      API                                   DB / KMS
   |  POST /opens {slug}        |                                       |
   |--------------------------->| seed = randomBytes(32)                |
   |                            | hash = sha256(seed); pin tableHash,   |
   |                            | bonusHash, price                      |
   |                            |-- insert open (seed encrypted) ------>|
   |<-- {openId, serverHash,    |                                       |
   |     tableHash, bonusHash,  |                                       |
   |     nonce:1}               |                                       |
   |  PUT /opens/:id/client-seed|                                       |
   |--------------------------->|-- update (status = created only) ---->|
   |  POST /opens/:id/pay       |                                       |
   |--------------------------->|-- charge / debit credit, idempotent ->|
   |  POST /opens/:id/spin      |                                       |
   |--------------------------->| load pinned snapshots by hash         |
   |                            | digest, roll, band, bonus spins       |
   |                            |-- tx: resolve + award + ledger ------>|
   |<-- {outcome, bonus, item?, |                                       |
   |     credits, serverSeed,   |                                       |
   |     digest, roll, hashes}  |                                       |
   |  GET /verify?...           |  (public, stateless recomputation)    |
```

## 6. API

See `openapi.yaml` (1.1.0). Player: `GET /v1/boxes`, `GET /v1/boxes/{slug}`, `POST /v1/opens`,
`PUT /v1/opens/{id}/client-seed`, `POST /v1/opens/{id}/pay`, `POST /v1/opens/{id}/spin`, `GET /v1/opens/{id}`,
`GET /v1/me/opens`, `GET /v1/me/awards`, `POST /v1/awards/{id}/trade-in`, `POST /v1/awards/{id}/ship`,
`GET /v1/me/credits`. Public: `GET /v1/verify`, `GET /v1/tables/{hash}`, `GET /v1/bonus-tables/{hash}`,
`GET /v1/tables/log`. Admin: boxes (upsert from the catalogue), tables (new version, activate), bonus tables,
segments, publication log.

Rules the API must enforce: client seed only before `paid`; spin only once and only when `paid`; the response of
`spin` is the only place the server seed appears; `GET /opens/{id}` returns the seed only after `revealed`.

**Auth.** Player calls carry `Authorization: Bearer <jwt>` issued by the main site's auth (Supabase Auth in the plan
of record). The API verifies the signature with the project's JWT secret or JWKS, takes `sub` as
`players.external_id` and creates the player row on first sight. Admin calls carry a separate admin token. The
front end's mock accepts any token.

**Errors.** Every 4xx/5xx body is `{ "code": "...", "message": "...", "details": {...}? }`. Codes:

| Code | Status | When |
|---|---|---|
| `unknown_box` | 404 | slug not found or inactive |
| `unknown_open`, `unknown_award`, `unknown_table` | 404 | id or hash not found (or not the caller's) |
| `open_expired` | 409 | unpaid open past `expiresAt` |
| `seed_locked` | 409 | client seed after payment |
| `open_not_payable` | 409 | pay on an open that is not `created` |
| `open_not_paid` | 409 | spin before payment |
| `payment_failed` | 402 | provider declined |
| `insufficient_credit` | 402 | credit payment with too little balance |
| `award_not_tradeable`, `award_not_shippable` | 409 | wrong award status |
| `invalid_seed` | 422 | empty or longer than 64 characters |
| `validation_failed` | 422 | admin table rejected (details say why) |
| `unauthenticated`, `forbidden` | 401, 403 | token missing, invalid, or not admin |
| `rate_limited` | 429 | too many opens |
| `internal` | 500 | anything else |

## 7. Back office rules

- Odds edits create a new table version; nothing is edited in place. Store who, when, why.
- Validation: every outcome present, percents ≥ 0, sum = 100 ± 1e-6, every item outcome has a value, free-spin
  outcomes have `freeSpins ≥ 1`, credits are whole numbers.
- Show the per-open maths on save: value × percent for every row, added up, on screen and real, against the price (the simulator's
  "The maths of this box" table is the reference).
- Publish every activated table hash and bonus hash with its activation time to a public, append-only log
  (`table_publication_log`, exposed at `GET /v1/tables/log`). A player can then check that the hash on their open was
  the public one at that moment. This is the cheapest honest answer to "did everyone get the same odds".
- Segments, if built at all, publish too.
- The catalogue is loaded with `POST /v1/admin/boxes` from the main site's export (slug, name, tagline, price,
  tradeInPercent, outcomes with ids, bonus table). The first table and bonus versions are created and activated in
  the same call.

## 8. Security checklist

- Server seed from `crypto.randomBytes(32)` (or KMS GenerateRandom). Never a PRNG, never derived from time or ids.
- Generate and hash the seed **before** accepting a client seed, and make the commit response the first thing the
  front end shows. Order is the whole proof.
- Store the seed encrypted; decrypt only inside the spin transaction; reveal only in the spin response and
  afterwards.
- One open, one seed. Expire unpaid opens; never reuse a seed for another open.
- Idempotency keys on pay and spin; a retried spin returns the stored result, never a new roll.
- Freeze `price`, `tableHash`, `bonusHash` at `created`; resolve with the frozen snapshots even if admin changed the
  table meanwhile. Load them by hash; never by "current".
- Log every open with digest, roll, outcome, hashes; make `verify` a pure function over that record.
- Rate-limit `POST /opens`; cap bonus-spin depth (the captured tables never chain spins; enforce `maxBonusDepth = 1`).
- Do not let the front end send anything that influences the roll other than the client seed.

## 9. Conformance

1. Run the vectors: for each entry in `test-vectors.json` recompute `serverHash`, `digest`, `roll`, `outcomeId`,
   bonus spins, `tableHash` and `bonusHash`; all must match byte for byte. If a hash differs, diff your canonical
   string against `tableHashInput` / `bonusHashInput`.
2. Property test: 1,000,000 synthetic opens on the Timepiece table; per-outcome counts within chi-square p > 0.01
   of the stated odds (`metrics.ts` has `chiSquare`).
3. Replay: for 1,000 stored opens, `verify` must reproduce every field from the stored seed, client seed, nonce and
   pinned snapshots.
4. Cross-language: the HMAC key is a UTF-8 string; make sure `nonce` is formatted as a plain integer (`"1"`, not
   `"1.0"`), and that your JSON number formatting matches `JSON.stringify` (no trailing zeros, no exponent for these
   magnitudes).

The simulator runs these in `scripts/smoke-misty.ts` (50,000 opens: return within chance of the table, 500/500
proofs, a tampered seed fails) and `scripts/check-prompt.mjs` (the front-end verifier code against every vector).

## 10. Implementation plan

1. **Data and admin.** Migrate `schema.sql`; load the main site's catalogue through `POST /v1/admin/boxes`; admin
   endpoints for table versions with validation and the maths preview.
2. **Open flow.** `POST /opens` with commit; client seed; pay (stub the provider); spin with the engine functions
   over the pinned snapshots; ledger and awards in one transaction; reveal.
3. **Public verify.** Stateless `GET /v1/verify` with per-claim checks, `GET /v1/tables/{hash}` and
   `GET /v1/bonus-tables/{hash}`; the front end's `/provably-fair` page calls them.
4. **Credit and awards.** Ledger, balance, pay-with-credit path, trade-in at `tradeInPercent`, awards and opens
   listings, ship request.
5. **Publication log and segments** (if the product decision is yes).
6. **Conformance** (section 9) in CI.

## 11. Sandboxes

- Hosted: https://mys-sim.vercel.app/docs/misty/dev has an API sandbox that runs this exact engine in the browser
  and shows each request and response.
- The front end's mock of this API, in the browser: https://mysterybox-seven.vercel.app (switch to the real server
  with `NEXT_PUBLIC_BACKEND=api` and `NEXT_PUBLIC_BOX_API_URL`).
- Repo in the browser: https://stackblitz.com/github/Optinet-Solutions-AI/mys_sim (may be slow; Next 16 in
  WebContainers) or https://codesandbox.io/p/github/Optinet-Solutions-AI/mys_sim/main.
- Local: `git clone https://github.com/Optinet-Solutions-AI/mys_sim.git && cd mys_sim && npm install && npm run dev`,
  then `npx tsx scripts/smoke-misty.ts` for the headless check.

## 12. Decisions

Decided (14 October 2026, with the front end):

- Credit unit: whole credits, shown as $1 each on the main site; never withdrawable.
- Trade-in: 90% of listed value, stored on the award.
- Default client seed when the player sets none: `grailnoir-default`, recorded as `server-default`.
- Unpaid opens expire after 15 minutes.
- Table hash over the dollar price and the raw percents; bonus hash as in section 4.
- Outcome kinds `item | credit | bonus`; bonus means credit plus free spins.
- Catalogue: the main site's own boxes, loaded through admin; the Misty capture is reference only.
- Errors `{ code, message, details? }`; bearer token from the main site's auth.

Still open for the main site:

- Whether segments exist; if yes, the publication log is mandatory.
- Spend limits, cooling-off, and a plain "paid in / got back" counter per player.
- Whether to publish the table hash in the box page before payment (recommended: yes).
- Shipping: carrier, fee policy, address validation, insurance. The endpoint takes the request; fulfilment is yours.
- Whether the Analysis section (the box's own maths) is shown to players.

## 13. Battles (1.2)

Battles run on the same engine: one committed server seed per battle, a client seed per seat, every pull a normal
open with a nonce fixed by its position (`round × seats + seat + 1`), one extra roll for ties, jackpot and coinflip.
The rule book is `BATTLES.md`; the state machine (`open → full → in_progress → settling → finished`, plus
`cancelled` and `expired`) is enforced with a status-and-version guard on every transition; the reference flow is
`battles-reference.ts`; the tables are `schema-battles.sql`; the API is under `/v1/battles` in `openapi.yaml`.
Configuration (modes, seats, rounds, eligible boxes, fee, bots, timers) lives in the admin panel; players only create,
join, watch, ask bots to join when the admin allows it, and verify. Sponsored battles (the house pays the entries),
game history and the GGR-per-mode report are in the rule book too. Reproduce `test-vectors-battles.json` before
anything else. Developer page with everything in one place: https://mys-sim.vercel.app/docs/battles/dev.
