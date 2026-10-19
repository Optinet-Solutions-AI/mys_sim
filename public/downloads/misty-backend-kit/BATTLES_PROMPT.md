# Prompt for the main repository: battles

Paste everything below into a Claude session opened in the main project repository.

---

You are working in the main project repository: a mystery box site with an admin panel (configuration) and a player site (play). Single box opens already exist and run on the committed-seed engine from the kit. Your job is to add Battles end to end: database, backend, admin panel screens, the player lobby and battle room, live updates, verify page and tests. Do not invent game logic; it is fully specified below and in the kit.

REFERENCES
- Developer page (everything in one place): https://mys-sim.vercel.app/docs/battles/dev
- Battle rule book: https://mys-sim.vercel.app/downloads/misty-backend-kit/BATTLES.md
- Reference server flow: https://mys-sim.vercel.app/downloads/misty-backend-kit/battles-reference.ts
- Pure resolver and verifier (same code as the simulator): https://mys-sim.vercel.app/downloads/misty-backend-kit/battleKit.ts
- Schema: https://mys-sim.vercel.app/downloads/misty-backend-kit/schema-battles.sql
- API contract (paths under /v1/battles and /v1/admin/battles): https://mys-sim.vercel.app/downloads/misty-backend-kit/openapi.yaml
- Test vectors your implementation must reproduce: https://mys-sim.vercel.app/downloads/misty-backend-kit/test-vectors-battles.json
- Whole kit as a zip: https://mys-sim.vercel.app/downloads/misty-backend-kit.zip
- Playable reference: https://mys-sim.vercel.app/operators/vendor, Battles tab. It shows the lobby (rooms by simulated players, Join, Create battle, Ask bots to join), the battle room (secret hash before the seats fill, Waiting, Ongoing, Settled, every nonce, Check this battle) and the admin panel (Admin panel button). Copy its behaviour, not its styling.
- Plain-language page: https://mys-sim.vercel.app/docs/battles
If a link does not open, say so and ask for the file. Do not guess its contents.

WHERE THINGS LIVE
- Configuration is in the admin panel only: battles on or off, modes allowed, seat counts allowed, maximum rounds, eligible boxes (with their odds, set where boxes are already configured), the fee, the coinflip edge, the open-room expiry, the countdown, private rooms, bots and their names and pictures, the per-player limit of open battles, the credit face. Players never see or change any of these.
- Players use credit. They browse the lobby, create a battle inside the admin's limits, join a free seat, leave before the start, watch, and check the result. Nothing about a result is computed or predicted in the browser.
- Every battle is a row in the database with a status: open, full, in_progress, settling, finished, cancelled, expired. The row is updated at every transition with a version counter, and an events row is written. A battle that is running is in_progress in the database; when it ends it is finished, with the result columns filled and the seed revealed. Screens show plain words: open and full as Waiting, in_progress and settling as Ongoing, finished as Settled (the money has moved), cancelled and expired as their own words.
- Battles are their own module: tables prefixed battle_, one backend module, one timer job, routes under /v1/battles. They touch the rest of the system in four places only: the credit ledger, item awards, boxes and frozen tables fetched by hash, and auth. Nothing else reads battle tables, so the module can move to a separate service later. Build it after single opens, credit and the admin panel exist; it is planned for weeks 3 and 4.

THE LOBBY AND ROOMS
- A battle is a room. Creating a battle opens a room in the lobby; other players join its free seats; the room starts when every seat is taken.
- The lobby lists public battles that are open (Waiting), plus recent in_progress (Ongoing) and finished (Settled) ones. Each row shows: mode, the boxes per round with prices, entry per seat, the seats (name and picture per taken seat, bots labelled, free seats shown empty), the creator, how long ago it opened, the secret hash, and a Join button with the entry on it. Ongoing rows show rounds playing; settled rows show the winner and the pot.
- The list comes from GET /v1/battles and stays live through the lobby stream GET /v1/battles/events (room opened, seat taken, seat left, status changed, settled). The client never invents a row.
- Join takes the first free seat with POST /v1/battles/{id}/join. The hold and the seat are one transaction. A player can sit in any seat, not only seat 0. The battle room opens at once and follows GET /v1/battles/{id}/events.
- Leave before the start refunds the hold; a full room goes back to open. The creator cannot leave; they cancel while alone. After the start nobody can leave.
- Create: the player picks mode, seats and one box per round from what the admin allows, and may make the room private. The creator takes seat 0 and pays the hold; the room appears in the lobby with its hash.
- Ask bots to join: only the creator, only while the room is open, only if the admin has bots on. Every free seat gets a bot and the countdown starts.
- Private rooms are not listed; they are joined with the invite code.
- Your battles above the lobby: battles played, won, spent and took home, from GET /v1/battles?mine=true and the battle_history view.

THE MECHANIC (the server does all of this)
- N seats open the same box each round. Entry per seat = sum of the round prices plus the admin's fee on top (the fee is the house's and never part of the pot), paid in credit as a hold when the seat is taken, refunded on leave, cancel or expiry.
- One server seed per battle, generated with a CSPRNG at creation, stored encrypted, its SHA-256 hash returned in the create response and shown in the lobby and the room before any other seat is taken.
- The server generates a random client seed for each seat when the seat is taken (CSPRNG) and stores it. Players never enter or see a seed field; there is no endpoint that sets or changes a seed. Nothing that feeds a roll changes after the start.
- Pull order is round-major, seat-minor. nonce = round x seats + seat + 1 (round and seat from 0). Each pull is a normal open: key = "DRAW-" + boxSlug + "-" + serverSeed + "-" + seatClientSeed + "-" + nonce, digest = HMAC-SHA256(key, ""), roll = first 13 hex / 2^52, band lookup on the round's table pinned by hash at creation. Battles use the main table only: a bonus row pays its credits; free spins are not played.
- Values in integer cents: items at listed value, credit rows at the credit face (100 cents per credit by default).
- Modes: normal (highest total wins the pot), crazy (lowest total), terminal (highest last-round pull), jackpot (winner drawn in proportion to totals with one extra roll), group (pot split equally, odd cents to seat 0), break (everyone keeps their own pulls), coinflip (no boxes; one fair extra roll; pot = stakes x seats x (1 - disclosed edge)).
- The extra roll uses nonce = rounds x seats + 1, slug "battle-tiebreak" or "battle-jackpot" or "battle-coinflip", and a client seed made of every seat's client seed joined with "|" in seat order. Tie-break: winner = tied[floor(roll x tied.length)]. Jackpot: position = roll x sum(totals), first seat whose cumulative total exceeds it; uniform when all totals are 0.
- Payout: the winner receives the actual pulled items as item awards (ship or trade in, as a single open) and the credits as a ledger entry; group pays value as credit; break gives each seat its own pulls. The house keeps nothing extra except the disclosed fee.
- Bots: off unless the admin enables them. A bot is a name and a picture, nothing more. It plays the same tables with the same secret, gets a server-generated seed recorded as a bot's, holds no credit, and what it wins stays with the house (no award, no ledger row). Bot seats are labelled on every screen, in the lobby and in game history. Bots never get different odds and there must be no setting that could give them any.

STATE MACHINE AND CONCURRENCY (non-negotiable)
- Transitions: open -> full | cancelled | expired; full -> in_progress | open (a seat left) | cancelled; in_progress -> settling; settling -> finished. No other transition exists.
- Every transition is one UPDATE guarded by current status and version (WHERE id = ? AND status = ? AND version = ?). Zero rows updated means another writer moved first: re-read and retry, or return the stored state. Never write a status without the guard.
- Join takes the seat and the credit hold in one transaction; a player with insufficient credit fails the join, never the battle. One seat per player per battle (unique constraint).
- Create, join, leave and cancel take an idempotency key; a retried join returns the same seat.
- Start is not an endpoint. A server timer moves full battles to in_progress when the countdown ends, resolves every round from the committed inputs, writes battle_pulls, moves to settling, writes awards and ledger entries, moves to finished and reveals the seed. The resolution is deterministic, so a crash anywhere in that chain is resumed by running the same function again; nothing is ever re-rolled and nothing is paid twice.
- Expiry of open rooms is the same server timer, with refunds. Clients never run timers that decide anything.
- Every transition, pull and payout writes a battle_events row with actor, event, from, to, time. The room stream and the lobby stream read these rows.

API (contract in openapi.yaml)
GET /v1/battles?status=&mine=      the lobby (public battles); mine=true for the caller's own
GET /v1/battles/events             lobby stream: room opened, seat taken, seat left, status changed, settled
POST /v1/battles                   { mode, seats, boxSlugs[], isPrivate, idempotencyKey } -> 201 battle with serverHash, seat 0 taken, hold shown
GET /v1/battles/{id}               the battle as it stands; pulls appear as rounds resolve; serverSeed only when finished
POST /v1/battles/{id}/join         { idempotencyKey, inviteCode? } -> seat; 409 battle_not_open | battle_full | already_seated; 402 insufficient_credit
POST /v1/battles/{id}/leave        before the start; 409 battle_started | creator_must_cancel
POST /v1/battles/{id}/cancel       creator while alone, or admin; refunds all holds
POST /v1/battles/{id}/bots         creator asks bots to fill the free seats; 409 bots_disabled | battle_not_open | battle_full; 403 not_creator
GET /v1/battles/{id}/events        room stream: joined, left, full, countdown, started, round, finished, cancelled, expired, revealed
GET /v1/battles/{id}/verify        public recomputation: ok plus checks { serverHash, winners, totals, pulls }
GET/PUT /v1/admin/battles/settings the admin settings; changes never touch existing battles
GET/PUT /v1/admin/battles/bots     the bot list (name, picture, on or off)
POST /v1/admin/battles/{id}/cancel admin cancel with a reason; refunds; audited
GET /v1/admin/battles/report       battles and GGR per day and mode, from and to dates
Errors are { code, message, details? } like the rest of the API.

HISTORY AND REPORTS
- Game history: a player's history lists their battles (mode, seat, pulls, result, what they took home) next to their single opens; the admin's player screen shows Boxes opened and Battles played counters. Use the view battle_history.
- Reports: the admin dashboard shows battles played per day and per mode and the gross gaming revenue (GGR) per game mode: player entries kept minus what players took home (credit paid plus listed value of item awards). Bot seats are not player money. Use the view battle_daily_report; GET /v1/admin/battles/report returns it for a date range.

SECURITY (all required)
- Server seed from a CSPRNG; encrypted at rest; decrypted only inside resolution; revealed only at finished.
- Commit before pay: the hash is in the create response, in the lobby row and in the room before any other seat is taken.
- Seat seeds generated by the server at join and stored before the start; no endpoint sets or changes one.
- No client input after the start can influence a roll; the nonce map is fixed by position.
- Ownership checks on leave, cancel and ask-bots; admin actions carry a reason and an audit row.
- Rate limits on create and join; the admin's open-battles-per-player limit enforced.
- Private rooms by invite code, random, 10 characters or more; never listed in the lobby or the lobby stream.
- Live updates come from the events table, never from client messages. The animation starts after the server's pull records arrive and ends on exactly what they say.
- Logs carry the battle id and never a secret.

ADMIN PANEL SCREENS
1. Battle settings: battles on or off, modes allowed, seat counts allowed, rounds max (1 to 50), fee (0 to 20 percent), coinflip edge (0 to 10 percent), open-room expiry, countdown, private rooms, open battles per player, credit face. Validate every field. Show "changes apply to new battles only".
2. Eligible boxes: pick from the catalogue; show each box's current table hash and what it pays back, so the admin knows what the pot pays back.
3. Bots: the list of names and pictures, on or off per bot; the master switch sits in settings.
4. Battles: every battle with status, mode, seats, creator, winner, pot, times; filter by status; open one to see seats, pulls, result, events, the hash, and the seed after finished; admin cancel with a reason.
5. Report: battles per day and per mode, battles with bots, player entries, credit paid, items paid, GGR; a date range; the dashboard's GGR-by-game-mode chart reads the same view.
6. Player screen: Boxes opened and Battles played counters and the battle rows in the game history.

PLAYER SCREENS
1. Battles lobby: as described under THE LOBBY AND ROOMS, with Your battles above it, Create battle, Join on every open room, and private rooms by code.
2. Create battle: mode, seats and boxes per round, offering only what the admin allows; the entry (prices plus fee) shown before confirming; private toggle when allowed.
3. Battle room: the seats with names and pictures (bots labelled, free seats empty), Waiting with seats taken out of total, the boxes per round, the secret hash, Ask bots to join for the creator, Leave before the start, the countdown from the server, then the rounds playing back from the pull records (one reveal per seat per round), totals per seat updating, the winner, the pot, what each seat takes home, Ship or Trade in for item awards, Back to the lobby.
4. Result and check: the seed revealed, every seat's seed, the nonce of every pull, the table hashes, and a Check this battle button that recomputes in the browser and calls GET /v1/battles/{id}/verify; one line per check.
5. Copy: plain words. Say secret for server seed, check for verification. Technical values behind a details toggle. No seed input anywhere.

TESTS (must exist before you say done)
- Vectors: every case in test-vectors-battles.json reproduces pulls, totals, winners, shares and the extra roll.
- Property: 10,000 two-seat normal battles; each seat wins 50% +/- 2 points; pot equals the sum of pulls every time.
- Concurrency: 50 parallel joins to one 2-seat battle; exactly one seat each; all other holds released; no duplicate seats; idempotent retry returns the same seat.
- Crash: kill between in_progress and finished; the sweeper completes with identical digests and exactly one payout.
- State machine: every forbidden transition is rejected; every transition writes an event.
- Lobby: a room appears in every open lobby within a second of being created; a seat taken in one browser shows in the others; a full room loses its Join button; a private room never appears; leave before the start refunds; leave after the start is refused.
- Bots: a battle won by a bot writes no award and no ledger row; a player who beats bots is paid in full; the report counts only the player's entry.
- Report: for a seeded set of finished battles, battle_daily_report equals the hand-computed GGR.
- Front end: the animation ends on the server's outcome; a reload mid-battle resumes from GET /v1/battles/{id}; the check passes on real data and fails on a tampered seed.

BEFORE YOU WRITE CODE
1. Inspect the repository: how the admin panel stores settings, how boxes and odds are configured, how credit and the ledger work, how single opens call the engine, how realtime (if any) is done. Reuse those. Do not add a framework or a UI library without asking.
2. Tell me in a short list what you found and your plan, then build in this order: schema, resolver (reuse battleKit), state machine and timer, API with both streams, admin panel screens, lobby, create, battle room, check page, tests.
3. If anything in the kit is unclear or conflicts with the repository, say so in the README section you write; do not guess.

DELIVER
- Migration, backend module, timer job, admin panel screens, lobby, create dialog, battle room, both event streams, check page, tests, and a README section: how battles run, the timer, the settings, and every place where the kit was unclear.
