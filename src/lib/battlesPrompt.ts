/** The brief to paste into the Claude session that works in the main project repository: backend battles plus the front end. Plain text: no backticks, no template expressions. */
export const BATTLES_PROMPT = `You are working in the main project repository: a mystery box site with an admin panel (configuration) and a player site (play). Single box opens already exist and run on the committed-seed engine from the kit. Your job is to add Battles end to end: database, backend, admin settings, player UI, live updates, verify page and tests. Do not invent game logic; it is fully specified below and in the kit.

REFERENCES
- Battle rule book: https://mys-sim.vercel.app/downloads/misty-backend-kit/BATTLES.md
- Reference server flow: https://mys-sim.vercel.app/downloads/misty-backend-kit/battles-reference.ts
- Pure resolver (same code as the simulator): https://mys-sim.vercel.app/downloads/misty-backend-kit/battleKit.ts
- Schema: https://mys-sim.vercel.app/downloads/misty-backend-kit/schema-battles.sql
- API contract (paths under /v1/battles): https://mys-sim.vercel.app/downloads/misty-backend-kit/openapi.yaml
- Test vectors your implementation must reproduce: https://mys-sim.vercel.app/downloads/misty-backend-kit/test-vectors-battles.json
- Live reference of the mechanic: https://mys-sim.vercel.app/operators/jemlit (Battles tab) and https://mys-sim.vercel.app/operators/vendor (Battles tab)
If a link does not open, say so and ask for the file. Do not guess its contents.

WHERE THINGS LIVE
- Configuration is in the admin panel only: whether battles are on, which modes, which seat counts, the maximum rounds, which boxes are eligible, the fee, the coinflip edge, expiry and countdown, private battles, bots, concurrency limit, credit face. Players never set any of these.
- Players use credit. They list, create (within the admin limits), join, leave before the start, watch, verify. Nothing about a result is computed or predicted in the browser.
- Every battle has a status in the database: open, full, in_progress, settling, finished, cancelled, expired. The row is updated at each transition with a version counter, and an events row is written. A battle that is running is in_progress in the database; when it ends it is finished with the result columns filled and the seed revealed. Screens show plain words: open and full as Waiting, in_progress and settling as Ongoing, finished as Settled (the money has moved), cancelled and expired as their own words.
- Battles are their own module: tables prefixed battle_, one backend module, one timer job, routes under /v1/battles. They touch the rest of the system in four places only: the ledger, item awards, boxes and frozen tables fetched by hash, and auth. Nothing else reads battle tables, so the module can move to a separate service later. Build it after single opens, credit and the admin panel exist; it is planned for weeks 3 and 4.

THE MECHANIC (the server does all of this)
- N seats open the same box each round. Entry per seat = sum of the round prices, paid in credit as a hold when the seat is taken, refunded on cancel or expiry.
- One server seed per battle, generated with a CSPRNG at creation, stored encrypted, its SHA-256 hash returned in the create response and shown before any seat is taken. Each seat fixes a client seed at join (or the published default is recorded). Nothing that feeds a roll changes after the start.
- Pull order is round-major, seat-minor. nonce = round x seats + seat + 1 (round and seat from 0). Each pull is a normal open: key = "DRAW-" + boxSlug + "-" + serverSeed + "-" + seatClientSeed + "-" + nonce, digest = HMAC-SHA256(key, ""), roll = first 13 hex / 2^52, band lookup on the round's table pinned by hash at creation. Battles use the main table only: a bonus row pays its credits; free spins are not played.
- Values in integer cents: items at listed value, credit rows at the credit face (100 cents per credit by default).
- Modes: normal (highest total wins the pot), crazy (lowest total), terminal (highest last-round pull), jackpot (winner drawn in proportion to totals with one extra roll), group (pot split equally, odd cents to seat 0), break (everyone keeps their own pulls), coinflip (no boxes; one fair extra roll; pot = entries x seats x (1 - disclosed edge)).
- The extra roll uses nonce = rounds x seats + 1, slug "battle-tiebreak" or "battle-jackpot" or "battle-coinflip", and a client seed made of every seat's client seed joined with "|" in seat order. Tie-break: winner = tied[floor(roll x tied.length)]. Jackpot: position = roll x sum(totals), first seat whose cumulative total exceeds it; uniform when all totals are 0.
- Payout: the winner receives the actual pulled items as item awards (ship or trade in, as a single open) and the credits as a ledger entry; group pays value as credit; break gives each seat its own pulls. The house keeps nothing extra unless the admin set a fee, which is disclosed on the battle page.
- Bots: off unless the admin enables them. When they are on, the creator of an open battle nobody joins can press Ask bots to join (POST /v1/battles/{id}/bots): the server fills every free seat with a bot from the admin's list, the battle becomes full and the countdown starts. A bot is a name and a picture, nothing more. It plays with the same tables and seed, gets a server-generated client seed recorded as "bot", holds no credit, and what it wins stays with the house (no award, no ledger row). Bot seats are labelled on every screen and in game history. Bots never get different odds.

SPONSORED BATTLES, HISTORY AND REPORTS
- Sponsored battle: the admin creates it (POST /v1/admin/battles/sponsored) with a sponsor name; players join free; the house ledger takes one battle-sponsor entry for the whole cost; the pot is real and the winner is paid as usual; the page shows Sponsored by <name>. A promo code that gives a free battle is a credit voucher restricted to battle entries; that belongs to the promo module, not here.
- Game history: a player's history lists their battles (mode, seat, pulls, result, what they took home) next to their single opens; the admin's player screen shows Boxes opened and Battles played counters. Use the view battle_history.
- Reports: the admin dashboard shows battles played per day and per mode and the gross gaming revenue (GGR) per game mode: player entries kept minus what players took home (credit paid plus listed value of item awards). Bot seats and sponsored seats are not player money. Use the view battle_daily_report; GET /v1/admin/battles/report returns it for a date range.

STATE MACHINE AND CONCURRENCY (non-negotiable)
- Transitions: open -> full | cancelled | expired; full -> in_progress | open (a seat left) | cancelled; in_progress -> settling; settling -> finished. No other transition exists.
- Every transition is one UPDATE guarded by current status and version (WHERE id = ? AND status = ? AND version = ?). Zero rows updated means another writer moved first: re-read and retry or return the stored state. Never write a status without the guard.
- Join takes the seat and the credit hold in one transaction; a player with insufficient credit fails the join, never the battle. One seat per player per battle (unique constraint).
- Create, join, leave and cancel take an idempotency key; a retried join returns the same seat.
- Start is not an endpoint. A server timer moves full battles to in_progress when the countdown ends, resolves every round from the committed inputs, writes battle_pulls, moves to settling, writes awards and ledger entries, moves to finished and reveals the seed. The resolution is deterministic, so a crash anywhere in that chain is resumed by running the same function again; nothing is ever re-rolled and nothing is paid twice.
- Expiry of open battles is the same server timer. Clients never run timers that decide anything.
- Every transition, pull and payout writes a battle_events row with actor, event, from, to, time.

API (contract in openapi.yaml)
GET /v1/battles?status=            public battles and the caller's own
POST /v1/battles                   { mode, seats, boxSlugs[], isPrivate, clientSeed?, idempotencyKey } -> 201 battle with serverHash, seat 0 taken, hold shown
GET /v1/battles/{id}               the battle as it stands; pulls appear as rounds resolve; serverSeed only when finished
POST /v1/battles/{id}/join         { clientSeed?, idempotencyKey, inviteCode? } -> seat; 409 battle_not_open | battle_full | already_seated; 402 insufficient_credit
POST /v1/battles/{id}/leave        before the start; 409 battle_started | creator_must_cancel
POST /v1/battles/{id}/cancel       creator while alone, or admin; refunds all holds
POST /v1/battles/{id}/bots         creator asks bots to fill the free seats; 409 bots_disabled | battle_not_open | battle_full; 403 not_creator
GET /v1/battles/{id}/events        server-sent events: joined, left, full, countdown, started, round, finished, cancelled, expired
GET /v1/battles/{id}/verify        public recomputation: ok plus checks { serverHash, winners, totals, pulls }
GET/PUT /v1/admin/battles/settings the admin settings; changes never touch existing battles
POST /v1/admin/battles/{id}/cancel admin cancel with a reason
GET/PUT /v1/admin/battles/bots     the bot list (name, picture)
POST /v1/admin/battles/sponsored   create a sponsored battle
GET /v1/admin/battles/report       battles and GGR per day and mode, from and to dates
Errors are { code, message, details? } like the rest of the API.

SECURITY (all required)
- Server seed from a CSPRNG; encrypted at rest; decrypted only inside resolution; revealed only at finished.
- Commit before pay: the hash is in the create response and on the page before any seat is taken.
- Client seeds rejected after full. Server fills and records the default when none is set.
- No client input after the start can influence a roll; the nonce map is fixed by position.
- Ownership checks on leave and cancel; admin actions carry a reason and an audit row.
- Rate limits on create and join; the admin's concurrent-battles-per-player limit enforced.
- Private battles by invite code, random, 10 characters or more.
- Live updates come from the events table, never from client messages. The animation starts after the server's pull records arrive and ends on exactly what they say.
- Logs carry the battle id and never a secret.

ADMIN PANEL SCREENS
1. Battle settings: the list above with validation (modes subset, seats subset, rounds max 1 to 50, fee 0 to 20, coinflip edge 0 to 10%, expiry, countdown, private, bots and label, concurrency, credit face). Show "changes apply to new battles only".
2. Eligible boxes: pick from the catalogue; show each box's current table hash and return so the admin knows what the pot will pay back.
3. Battles list: filter by status; open a battle to see seats, pulls, result, events, seed hash and seed after finished; admin cancel with reason.
4. Bots: the list of names and pictures, on or off per bot, and the master switch in settings.
5. Sponsored battle: a form to create one (mode, seats, boxes, sponsor name, public or private); the cost is shown before confirming.
6. Report: battles per day and per mode, sponsored and with-bots counts, player entries, credit paid, items paid, GGR; a date range; the dashboard's GGR-by-game-mode chart reads the same view.
7. Player screen: Boxes opened and Battles played counters and the battle rows in the game history.

PLAYER SCREENS
1. Battles lobby: open public battles with mode, seats taken, entry, boxes, server hash, Sponsored label when the house pays; Create battle (mode, seats, boxes from the eligible list, private toggle); Join. Private battles by code. On the creator's own waiting battle, an Ask bots to join button when the admin has bots on.
2. Battle room: seats with names (bots labelled), the boxes per round, the server hash, the countdown from the server, then rounds playing back from the pull records (one reveal per seat per round), totals per seat updating, the winner, the pot, what each seat takes home, Ship or Trade in for item awards.
3. Result and verify: the seed revealed, the client seeds, the nonce of every pull, the table hashes, and a Check this battle button that recomputes in the browser and calls GET /v1/battles/{id}/verify; one line per check.
4. Copy: plain words. Say secret for server seed, check for verification. Technical values behind a details toggle.

TESTS (must exist before you say done)
- Vectors: every case in test-vectors-battles.json reproduces pulls, totals, winners, shares and the extra roll.
- Property: 10,000 two-seat normal battles; each seat wins 50% +/- 2 points; pot equals the sum of pulls every time.
- Concurrency: 50 parallel joins to one 2-seat battle; exactly one seat each; all other holds released; no duplicate seats; idempotent retry returns the same seat.
- Crash: kill between in_progress and finished; the sweeper completes with identical digests and exactly one payout.
- State machine: every forbidden transition is rejected; every transition writes an event.
- Bots: a battle won by a bot writes no award and no ledger row; a player who beats bots is paid in full; the report counts only the player's entry.
- Sponsored: no hold is taken from any player, one battle-sponsor entry exists, the winner is paid as usual, the report shows the battle as sponsored with zero player entries.
- Report: for a seeded set of finished battles, battle_daily_report equals the hand-computed GGR.
- Front end: the animation ends on the server's outcome; a reload mid-battle resumes from GET /v1/battles/{id}; the verify page passes on real data and fails on a tampered seed.

BEFORE YOU WRITE CODE
1. Inspect the repository: how the admin panel stores settings, how credit and the ledger work, how single opens call the engine, how realtime (if any) is done. Reuse those. Do not add a framework or a UI library without asking.
2. Tell me in a short list what you found and your plan, then build in this order: schema, resolver (reuse battleKit), state machine and timer, API, admin settings, lobby and room, verify page, tests.
3. If anything in the kit is unclear or conflicts with the repository, say so in the README section you write, do not guess.

DELIVER
- Migration, backend module, admin screens, player screens, events stream, verify page, tests, and a README section: how battles run, the timer, the settings, and every place where the kit was unclear.`;
