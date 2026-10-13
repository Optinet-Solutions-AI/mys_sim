/** The brief to paste into another Claude session that builds the front end. Plain text: no backticks, no template expressions. */
export const FRONTEND_PROMPT = `You are building the player-facing front end for a mystery box product. The mechanics are already defined and proven in a research simulator. Your job is to implement the same mechanics in this repository's front end, talking to our backend API. Do not invent or change any game logic.

This prompt is self-contained. The links are for reference; everything you need to start is written below.

REFERENCES
- Live reference of the product: https://mys-sim.vercel.app/operators/misty
- Mechanism in plain words: https://mys-sim.vercel.app/docs/misty
- Developer notes, algorithm and an API sandbox that shows every request and response: https://mys-sim.vercel.app/docs/misty/dev
- API contract (OpenAPI 3.1): https://mys-sim.vercel.app/downloads/misty-backend-kit/openapi.yaml
- Test vectors (JSON): https://mys-sim.vercel.app/downloads/misty-backend-kit/test-vectors.json
- Whole kit as a zip (engine source, schema, API, vectors): https://mys-sim.vercel.app/downloads/misty-backend-kit.zip
If you cannot open a link, say so and ask me to paste or attach the file. Do not guess its contents. The reference site is a research simulator: copy its mechanics and page structure, not its code or styling.

BEFORE YOU WRITE CODE
1. Inspect this repository: framework and version, router, styling system, component library, state and data-fetching libraries, auth, existing API client, environment variables, test setup. Follow what is there. Do not add a framework or UI library without asking.
2. Tell me in a short list what you found and your plan, then proceed.
3. If the backend is not reachable yet, build against a mock that follows the API contract below exactly, behind one switch, so it can be removed later. The mock may pick outcomes at random from the odds table; real outcomes always come from the server.

THE MECHANIC (the server does all of this; the front end only displays it)
- A box has a slug, a name, a price and an ordered odds table. Every outcome has a chance in percent; the chances add up to 100.
- An outcome has a kind: item (a physical piece with a value in cents), credit (an amount of site credit), or bonus (an amount of credit plus 1 or 2 free spins).
- One open is one independent roll. Nothing carries over between opens. There is no pool, no pity counter, no streak.
- Before payment the server creates the open and returns serverHash (the hash of a secret it has already chosen), tableHash, bonusHash and nonce 1. The player may set a client seed, only before paying.
- After payment the player spins once. The server returns the outcome, any bonus spins, the credit awarded, an item award if any, and reveals serverSeed with the digest, the roll and the tableHash.
- Free spins are resolved by the server in the same spin response, against a small credit-only bonus table, with nonces 2 and 3.
- An item can be shipped or traded in for credit. Credit is site credit: it buys boxes and products and never becomes cash.

API CONTRACT
Base URL from an environment variable. Player calls carry the app's bearer token. Verify and tables are public.

GET /v1/boxes and GET /v1/boxes/{slug}
  returns: slug, name, tagline, priceCents, tableHash, bonusHash,
  outcomes [ { id, label, rarity, kind (item | credit | bonus), credits, freeSpins, valueCents (null for credit), percent } ] in stored order,
  bonus [ { credits, percent } ],
  maths { pItem, evItemsCents, evCredits, payFaceCents, returnFace }
POST /v1/opens  body { boxSlug }
  returns 201: openId, boxSlug, status "created", priceCents, serverHash, tableHash, bonusHash, nonce 1, clientSeed null, expiresAt
PUT /v1/opens/{openId}/client-seed  body { clientSeed } (1 to 64 characters)
  returns 204. Returns 409 once the open is paid.
POST /v1/opens/{openId}/pay  body { method: "card" | "credit", paymentToken (card only), idempotencyKey }
  returns 200 { status "paid", creditBalance }. 402 payment failed or not enough credit. 409 already paid, expired.
POST /v1/opens/{openId}/spin
  returns 200: everything from the create response plus status "resolved", serverSeed, digest, roll (0 to 1),
  outcome { id, label, rarity, kind, credits, freeSpins, valueCents, percent },
  bonusSpins [ { nonce, digest, roll, credits } ], creditsAwarded,
  itemAward (null or { awardId, valueCents, tradeInCredits }), verifyUrl.
  Safe to retry: the server returns the stored result, never a new roll. 409 if not paid.
GET /v1/opens/{openId}
  the open in its current state. serverSeed is present only after the spin. Use it to resume after a refresh.
POST /v1/awards/{awardId}/trade-in
  returns { credits, creditBalance }. 409 if already shipped or traded.
GET /v1/me/credits
  returns { balance, ledger [ { id, delta, reason, refType, refId, createdAt } ] }
GET /v1/verify?slug=&serverSeed=&clientSeed=&nonce=1&tableHash=&bonusHash=
  returns { ok, serverHash, digest, roll, outcomeId, bonusSpins, reason }
GET /v1/tables/{tableHash}
  returns { boxSlug, version, tableHash, priceCents, entries [ { id, percent } ] } in stored order
GET /v1/tables/log
  public list of every table activation: boxSlug, tableHash, bonusHash, segmentId, publishedAt

Open lifecycle: created, paid, resolved, expired. An open is never reused; a new attempt is a new open.
There is no shipping or address endpoint in this contract yet. Build the Ship it action as a clearly marked stub and ask me how claiming works.

HARD RULES
- Never compute, predict or alter an outcome in the browser. The animation starts only after the spin response arrives and must end on exactly the outcome the server returned.
- Never show or log serverSeed before the spin response. Send nothing that could influence the roll except the client seed.
- One idempotency key per pay attempt, reused on retry. Disable the open button while a request is in flight. A double click must never create two opens or two payments.
- On reload mid-flow, call GET /v1/opens/{openId} and continue from its status. Never start a second open silently.
- Money is integer cents from the API. Format for display only. Percentages come from the API; never round them into different odds. Show small chances with enough decimals: 0.004%, not 0.00%. Show 1 in N as 100 divided by the percent, rounded.
- If the open expires or a call fails, show a clear message and offer to start a new open.
- No near-miss effects, fake live feeds, countdowns, fake stock, or any animation suggesting the player almost won. The reveal is neutral.
- Arithmetic for display is allowed: worth times chance, totals, session RTP. Arithmetic that decides a result is not.

SCREENS TO BUILD
1. Box list. Heading: Select a Mystery Box. One tile per box: name, price, chance of an item as 1 in N (pItem from maths).
2. Box page.
   - Header: box name and price only.
   - Reveal: a box-opening animation (idle, shake, lid opens, the item rises out). Respect reduced motion. A fast-reveal toggle.
   - One primary button: Open the box, with the price. It runs create, optional seed, pay, spin in order.
   - Result panel after the open: what was won and its value; free-spin results shown one after another; for an item two actions: Ship it, or Trade in for credit (show tradeInCredits).
   - Session counters: Opens, Paid, credit won, Items, RTP. RTP is the value returned divided by the amount paid in this session.
   - A table titled Box Content and Odds with columns Outcome, Price, Odds, 1 in. Sorted rarest first. No scrollbars: the whole table shows and fits its container. Long names are cut with an ellipsis; hovering or focusing a name shows a tooltip with the full name, price and odds. Prices without a plus sign. Credit amounts may be abbreviated.
   - After an open, and only then, an Analysis section made of collapsed accordions:
     (a) The maths of this box: one row per outcome with worth times chance equals cost per open, a total row, the price, and the difference.
     (b) How this result was decided, step by step, in plain words: paid; a roll on a line from 0 to 100; the band it fell in; free spins; what it is worth.
     (c) Was it fair: two short lines, what this proves and what it does not prove; a Check this open button; the technical values (serverHash, serverSeed, client seed, nonce, digest, roll, tableHash) behind a details toggle.
     What it proves: the secret was fixed before payment and the roll comes from it, so the result was not changed afterwards. What it does not prove: that every player gets the same table.
     Ask me whether the Analysis section ships to players or stays internal. Part (a) shows the operator's margin.
3. Verify page, public. Inputs: slug, server seed, client seed, table hash (prefilled from verifyUrl). It calls GET /v1/verify and also recomputes in the browser, so the player does not have to trust our server.
4. Credit balance and ledger. Awards list with ship and trade-in.

THE VERIFIER, EXACTLY
1. serverHash = SHA-256 of the server seed string (the 64 hex characters as UTF-8 text), in hex. It must equal the serverHash shown before payment.
2. key = "DRAW-" + slug + "-" + serverSeed + "-" + clientSeed + "-" + nonce, where nonce is the plain integer 1.
3. digest = HMAC-SHA256 with that key (UTF-8) over an empty message, in hex.
4. roll = the first 13 hex characters of the digest read as an integer, divided by 2 to the power 52. A number from 0 up to but not including 1.
5. Fetch the table by tableHash. total = sum of percents. position = roll times total. Walk the entries in stored order, adding percents; the first entry whose running sum is above the position is the outcome. Never sort the entries.
6. Free spins: for each free spin, repeat steps 2 to 4 with nonce 2, then 3, and read the roll against the bonus table the same way.
7. The table hash is SHA-256 of the canonical JSON of { slug, price, table: [ { id, percent } ] } with keys sorted alphabetically and no whitespace. In the kit, price is in dollars (10), while the API gives priceCents. Confirm with the backend which one is hashed before you implement this step; until then verify steps 1 to 6 and show the table hash as given.

Reference implementation with no dependencies (Web Crypto):
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

Check it against this vector before anything else (box timepiece-suite):
  serverSeed  00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff
  serverHash  2a8abfa8cb9906290437854193ca6bca41d4d4e26d1d454bd66a35158095e737
  clientSeed  alice
  nonce 1 key DRAW-timepiece-suite-00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff-alice-1
  digest      bf741263e3469f9dff07656f0e80aa73a5fff49c5b2b2e0f73f013fd894d7e4e
  roll        0.7478648656717957
  outcome     Free Spin + 1 Mistees (band 69.8822856 to 78.8822856 on a 0 to 100 line), id d2892691-b234-45d0-a903-19e05e245cb4
  nonce 2     digest b29a82c3ba7eeb70da2e361d453aba89216455831f247b30f1f49c01be7dc1fe, roll 0.6976701476910381
More vectors, the full table in stored order and one complete open are in test-vectors.json.

COPY AND TONE
- Plain words. Short. No narration, no marketing filler. No jargon on player screens: say secret, not server seed; say check, not cryptographic verification. Technical terms appear only behind the details toggle and on the verify page.
- Explanations live in tooltips or collapsed sections, not in paragraphs on the page.
- Wherever credit is shown, state that it buys boxes and products and cannot be withdrawn.

QUALITY BAR
- Responsive from 360 px wide. Keyboard reachable. Visible focus. Tooltips never clipped by a container or the viewport. Light and dark if the app has both.
- Loading, empty, error and expired states for every call.
- Tests: the open flow (created, paid, resolved, expired); resume after reload; double-click and retry safety; the animation ends on the server outcome; formatting of small percentages and cents; the verifier against the vector above and every entry in test-vectors.json.

DELIVER
- The screens above wired to the API or the mock, with the tests.
- A short README section: how to run, the environment variables, where the mock switch is, and every place where the backend contract was unclear.

ASK ME BEFORE ASSUMING
- The name of the credit unit and whether it is shown with a money value.
- The trade-in rate shown for items, and how shipping and claiming work.
- Whether the Analysis section is shown to players.
- Payment provider, and whether paying with credit is in scope now.
- Which price unit goes into the table hash.
- Brand, colours and typography if the repository has no design system.
- Markets, languages, and age or identity checks.`;
