# Prompt for the front-end session

Paste everything below into a Claude session opened in the front-end repository.

---

You are building the player-facing front end for a mystery box product. The mechanics are already defined and proven in a research simulator. Your job is to implement the same mechanics in this repository's front end, talking to our backend API. Do not invent or change any game logic.

REFERENCES (read these first)
- Live reference of the product: https://mys-sim.vercel.app/operators/misty
- Mechanism in plain words: https://mys-sim.vercel.app/docs/misty
- Developer notes, algorithm and API sandbox: https://mys-sim.vercel.app/docs/misty/dev
- API contract (OpenAPI): https://mys-sim.vercel.app/downloads/misty-backend-kit/openapi.yaml
- Engine source, for the verify page only: https://mys-sim.vercel.app/downloads/misty-backend-kit/misty.ts and hash.ts
- Test vectors: https://mys-sim.vercel.app/downloads/misty-backend-kit/test-vectors.json
- Whole kit as a zip: https://mys-sim.vercel.app/downloads/misty-backend-kit.zip
If you cannot open a link, say so and ask me to paste the file. Do not guess its contents.

BEFORE YOU WRITE CODE
1. Inspect this repository: framework, router, styling system, state and data-fetching libraries, existing components, auth, API client, environment variables. Follow what is there. Do not add a new framework or UI library without asking.
2. Tell me in a short list what you found and your plan, then proceed.
3. If the backend is not reachable yet, build against a mock that follows openapi.yaml exactly, behind one switch, so it can be removed later.

THE MECHANIC (the server does all of this; the front end only displays it)
- A box has a price and an odds table. Every outcome has a chance in percent; the chances add up to 100.
- An outcome is either a physical item (has a value in cents) or site credit (an amount), and a credit outcome may also carry 1 or 2 free spins.
- One open is one independent roll. Nothing carries over between opens.
- Before payment the server creates the open and returns serverHash (the hash of a secret), tableHash and a nonce of 1. The player may set a client seed, only before paying.
- After payment the player spins once. The server returns the outcome, any bonus spins, credits awarded, an item award if any, and reveals serverSeed together with the digest, the roll and the tableHash.
- Free spins are resolved by the server in the same response, against a small credit-only bonus table.
- An item can be shipped or traded in for credit. Credit is site credit: it buys boxes and products and never becomes cash.

API CALLS, IN ORDER
- GET /v1/boxes and GET /v1/boxes/{slug}: boxes, ordered odds table, bonus table, tableHash, per-open maths.
- POST /v1/opens {boxSlug}: returns openId, serverHash, tableHash, priceCents, expiresAt.
- PUT /v1/opens/{openId}/client-seed {clientSeed}: optional, only before pay.
- POST /v1/opens/{openId}/pay {method: card or credit, idempotencyKey}.
- POST /v1/opens/{openId}/spin: the result and the revealed seed. Safe to retry: the server returns the stored result.
- POST /v1/awards/{awardId}/trade-in, GET /v1/me/credits.
- GET /v1/verify and GET /v1/tables/{tableHash}: public recomputation.

HARD RULES
- Never compute, predict or alter an outcome in the browser. The animation plays only after the spin response arrives and must end on exactly the outcome the server returned.
- Never show or log serverSeed before the spin response. Never send anything that could influence the roll except the client seed.
- Generate one idempotency key per pay attempt and reuse it on retry. Disable the open button while a request is in flight. A double click must never create two opens or two payments.
- Money is integer cents from the API. Format for display only. Percentages come from the API; do not round them into different odds. Show small chances with enough decimals (0.004%, not 0.00%).
- If the open expires or a call fails, show a clear message and offer to start a new open. Never reuse an open.
- Do not add near-miss effects, fake live feeds, countdowns, fake stock or any animation that suggests the player almost won. The reveal must be neutral.

SCREENS TO BUILD
1. Box list. Heading: Select a Mystery Box. One tile per box: name, price, chance of an item as 1 in N.
2. Box page.
   - Header: box name and price only.
   - Reveal: a box-opening animation (idle, shake, lid opens, the item rises out). Support reduced motion and a fast-reveal toggle.
   - One primary button: Open the box, with the price.
   - Result panel after the open: what was won, its value, free-spin results shown one after another, and for an item two actions: Ship it, or Trade in for credit.
   - Session counters: Opens, Paid, credit won, Items, RTP (returned divided by paid for this session).
   - Table titled Box Content and Odds with columns Outcome, Price, Odds, 1 in. Sorted rarest first. No scrollbars: the table shows in full and fits its container. Long names are cut with an ellipsis; hovering a name shows a tooltip with the full name, price and odds. Prices without a plus sign. Credit amounts may be abbreviated.
   - After an open, and only then, an Analysis section made of collapsed accordions: (a) the maths of this box: one row per outcome with worth times chance equals cost per open, a total row, the price, and what the operator keeps; (b) how this result was decided, step by step, in plain words: paid, roll on a 0 to 100 line, the band it fell in, free spins, what it is worth; (c) Was it fair: a short what-this-proves and what-it-does-not-prove text, a Check this open button that calls verify, and the technical values (serverHash, serverSeed, client seed, nonce, digest, roll, tableHash) hidden behind a details toggle.
3. Verify page (public). Inputs: slug, server seed, client seed, table hash. Calls GET /v1/verify and also recomputes locally with the kit functions so the player does not have to trust our server: sha256 of the seed equals the hash shown before payment; digest is HMAC-SHA256 with key DRAW-slug-serverSeed-clientSeed-nonce over an empty message; roll is the first 13 hex characters as a number divided by 2 to the power 52; the roll is read against the cumulative bands of the table in its stored order. Check your implementation against test-vectors.json.
4. Credit balance and ledger. Awards list with ship and trade-in.

COPY AND TONE
- Plain words. Short. No narration, no marketing filler, no jargon on player screens: say secret, not server seed; say check, not cryptographic verification. Technical terms appear only inside the details toggle and on the verify page.
- Explanations live in tooltips or collapsed sections, not in paragraphs on the page.
- State clearly wherever credit is shown that it buys boxes and products and cannot be withdrawn.

QUALITY BAR
- Responsive from 360 px wide. Keyboard reachable. Visible focus. Tooltips never clipped by containers or the viewport. Works in light and dark if the app has both.
- Loading, empty, error and expired states for every call.
- Tests: the open flow state machine (created, paid, resolved, expired), double-click and retry safety, the animation landing on the server outcome, formatting of small percentages and cents, and the local verifier against every entry in test-vectors.json.

DELIVER
- The screens above wired to the API (or the mock), with the tests.
- A short README section: how to run, the environment variables, where the mock switch is, and any place where the backend contract was unclear.

ASK ME BEFORE ASSUMING
- The name of the credit unit and whether it is displayed with a money value.
- The trade-in rate shown for items.
- Payment provider and whether paying with credit is in scope now.
- Brand, colours and typography if the repository has no design system.
- Which markets, languages and age or identity checks apply.
