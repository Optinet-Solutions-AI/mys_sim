import Link from "next/link";
import { DocsToc } from "@/components/DocsToc";
import { Badge, Card, Td, Th } from "@/components/ui";
import { CopyBlock } from "@/components/CopyBlock";
import { BATTLES_PROMPT } from "@/lib/battlesPrompt";
import { BATTLE_TRANSITIONS, type BattleStatus } from "@/engine/labs/battleKit";
import VECTORS from "../../../../../kit/misty-backend/test-vectors-battles.json";

export const metadata = { title: "Battles for developers · Simulator" };

const KIT = "/downloads/misty-backend-kit";

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 text-xl font-semibold">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[78ch] text-sm leading-6 text-ink-2">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">{children}</ul>;
}
function Code({ children }: { children: string }) {
  return <pre className="max-w-full overflow-x-auto rounded-lg border border-line bg-paper p-3 text-[12px] leading-5">{children}</pre>;
}
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline underline-offset-2">
      {children}
    </a>
  );
}

const TOC = [
  ["scope", "1. What to build"],
  ["downloads", "2. Downloads"],
  ["algorithm", "3. The algorithm, exactly"],
  ["state", "4. The state machine"],
  ["api", "5. API"],
  ["data", "6. Data model"],
  ["admin", "7. Admin panel rules"],
  ["security", "8. Security checklist"],
  ["conformance", "9. Conformance and test vectors"],
  ["plan", "10. Build order"],
  ["prompt", "11. Prompt for the main repository"],
  ["evocase", "12. From the Evocase demo"],
] as const;

const ALGO = `// one secret per battle, drawn with a CSPRNG at creation; its hash is shown before any seat is taken
serverHash = sha256(serverSeedHex)

// pull order is round-major, seat-minor; the nonce is the pull's position (round and seat from 0)
nonce(round, seat, seats) = round * seats + seat + 1

// every pull is a normal open of the round's box, on the table pinned by hash at creation
key    = "DRAW-" + boxSlug + "-" + serverSeed + "-" + seatClientSeed + "-" + nonce
digest = HMAC-SHA256(key, "")
roll   = parseInt(digest.slice(0, 13), 16) / 2^52          // [0, 1)
pull   = band lookup of roll on the round's table (cumulative percents, stored order)
value  = item ? valueUsd * 100 : credits * creditFaceCents  // integer cents; free spins are not played in battles

// one extra roll when the mode needs it: tie-break, jackpot, coinflip
extraNonce  = rounds * seats + 1
extraSeed   = every seat's clientSeed joined with "|" in seat order
extraDigest = HMAC-SHA256("DRAW-battle-" + label + "-" + serverSeed + "-" + extraSeed + "-" + extraNonce, "")
tieWinner   = tied[floor(roll * tied.length)]               // tied seats in seat order
jackpot     = first seat whose cumulative total exceeds roll * sum(totals); uniform when the sum is 0
coinflip    = floor(roll * seats); pot = floor(entries * seats * (1 - edge))`;

interface VectorCase {
  name: string;
  mode: string;
  rounds: { slug: string; priceCents: number }[];
  seats: { seat: number; clientSeed: string }[];
  result: { winners: number[]; potCents: number; totals: number[]; sharesCents: number[] };
}
const loadVectors = (): { serverHash: string; cases: VectorCase[] } | null => (VECTORS as unknown as { serverHash: string; cases: VectorCase[] }) ?? null;

const cents = (c: number) => `$${(c / 100).toFixed(2)}`;

export default function BattlesDevPage() {
  const vectors = loadVectors();
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Battles for developers</h1>
          <Badge tone="accent">kit 1.2 · 19 October 2026</Badge>
        </div>
        <P>
          Everything the main project needs to build battles on the committed-seed engine: the exact algorithm, the state machine the database carries, the API, the tables, the admin rules, the security list, the test vectors and a prompt to paste into the Claude session in the main repository. The plain-language version is <Link href="/docs/battles">Battles, explained</Link>; the logic is playable on the <Link href="/operators/vendor">Evo Verse page</Link>, Battles tab.
        </P>
      </header>

      <DocsToc toc={TOC} back={{ href: "/operators/vendor", label: "← Back to Evo Verse" }} links={[{ href: "/docs/battles", label: "Battles, explained →" }, { href: "/docs/misty/dev", label: "Misty for developers →" }]} />

      <section className="space-y-3">
        <H2 id="scope">1. What to build</H2>
        <Ul>
          <li>A battles module in the main repository: migration, backend, admin settings screens, player lobby and room, live updates, verify page, tests. Its own tables (prefix battle_), one timer job, routes under /v1/battles.</li>
          <li>It touches the rest of the system in four places only: the credit ledger (holds, refunds, wins, sponsor entries), item awards (what the winner takes home), boxes and frozen tables fetched by hash, and auth. Nothing else reads battle tables, so it can move to a separate service later.</li>
          <li>Configuration lives in the admin panel only. Players create, join, leave before the start, watch, and verify, with credit. Nothing about a result is computed in the browser.</li>
          <li>Build it after single opens, credit and the admin panel exist; it is planned for weeks 3 and 4.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="downloads">2. Downloads</H2>
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <a href="/downloads/misty-backend-kit.zip" className="btn btn-primary no-underline" download>
              misty-backend-kit.zip (1.2.0)
            </a>
            <span className="text-xs text-ink-3">the whole kit: single opens plus battles</span>
          </div>
          <div className="tbl mt-3">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>File</Th>
                  <Th>What it is</Th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["BATTLES.md", "The rule book: mechanic, modes, payout, bots, sponsored battles, state machine, admin settings, API summary, security, data, history and reports, conformance."],
                    ["battleKit.ts", "The pure resolver and verifier, the same code the simulator runs. Deterministic; no I/O."],
                    ["battles-reference.ts", "The server flow: create, join, leave, cancel, ask bots, the timer, start and resolve, settle, reveal, all through a Store interface and the status-and-version guard."],
                    ["schema-battles.sql", "Postgres: battle_settings, battle_bots, battles, battle_seats, battle_pulls, battle_events, the report and history views, the ledger reasons."],
                    ["openapi.yaml", "The API contract; thirteen battle paths under /v1/battles and /v1/admin/battles."],
                    ["test-vectors-battles.json", "Seven battles your implementation must reproduce byte for byte."],
                    ["BATTLES_PROMPT.md", "Section 11 below, as a file."],
                  ] as const
                ).map(([f, d]) => (
                  <tr key={f} className="border-t border-line align-top">
                    <Td mono>
                      <Ext href={`${KIT}/${f}`}>{f}</Ext>
                    </Td>
                    <Td>{d}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <H2 id="algorithm">3. The algorithm, exactly</H2>
        <P>Battles reuse the single-open recipe of kit 1.1. The only additions are the nonce map, the one secret per battle, and the extra roll.</P>
        <Code>{ALGO}</Code>
        <Ul>
          <li>Values are integer cents. Items count at their listed value; credit rows at the credit face (100 cents per credit by default). Bonus rows pay their credits; free spins are not played in battles.</li>
          <li>Modes: normal (highest total), crazy (lowest), terminal (highest last-round pull), jackpot (drawn in proportion to totals), group (split equally, odd cents to seat 0), break (everyone keeps their own pulls), coinflip (no boxes).</li>
          <li>The fee, when set, is added on top of the box prices and kept by the house; it is never part of the pot.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="state">4. The state machine</H2>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>On screen</Th>
                <Th>Meaning</Th>
                <Th>Allowed next</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["open", "Waiting", "created, seats free, credit held for taken seats"],
                  ["full", "Waiting · starting", "every seat taken; the countdown runs on the server"],
                  ["in_progress", "Ongoing", "the server resolves every round from the committed inputs and writes the pulls"],
                  ["settling", "Ongoing · settling", "awards and ledger entries being committed"],
                  ["finished", "Settled", "paid; seed revealed; verifiable; never edited again"],
                  ["cancelled", "Cancelled", "creator while alone, or admin, before the start; holds refunded"],
                  ["expired", "Expired", "never filled within the admin's window; holds refunded"],
                ] as [BattleStatus, string, string][]
              ).map(([st, word, meaning]) => (
                <tr key={st} className="border-t border-line align-top">
                  <Td mono>{st}</Td>
                  <Td>{word}</Td>
                  <Td>{meaning}</Td>
                  <Td mono>{BATTLE_TRANSITIONS[st].join(", ") || "none"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Ul>
          <li>Every transition is one UPDATE guarded by the current status and a version counter: WHERE id = ? AND status = ? AND version = ?. Zero rows updated means another writer moved first; re-read and retry, or return the stored state. Never write a status without the guard.</li>
          <li>Start is not an endpoint. A server timer moves full battles to in_progress when the countdown ends, resolves every round, writes battle_pulls, moves to settling, writes awards and ledger entries, moves to finished and reveals the seed.</li>
          <li>The resolution is deterministic, so a crash anywhere in that chain is resumed by running the same function again. Nothing is re-rolled and nothing is paid twice; writes to battle_pulls and the settlement are idempotent on the battle id.</li>
          <li>Expiry of open battles is the same timer. Clients never run timers that decide anything.</li>
          <li>Every transition, pull and payout writes a battle_events row: actor, event, from, to, time, data. The live feed and the audit log read the same rows.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="api">5. API</H2>
        <P>
          Contract in <Ext href={`${KIT}/openapi.yaml`}>openapi.yaml</Ext>. Errors are {"{ code, message, details? }"} like the rest of the API.
        </P>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Method</Th>
                <Th>Path</Th>
                <Th>Does</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["GET", "/v1/battles", "public battles and the caller's own; filter by status"],
                  ["POST", "/v1/battles", "create within the admin limits; seat 0 taken by the creator with a hold; returns the server hash"],
                  ["GET", "/v1/battles/{id}", "the battle as it stands; pulls appear as rounds resolve; serverSeed only when finished"],
                  ["POST", "/v1/battles/{id}/join", "take a seat with a client seed; the hold is taken in the same transaction; idempotent on a key"],
                  ["POST", "/v1/battles/{id}/leave", "before the start; releases the hold; a full battle goes back to open"],
                  ["POST", "/v1/battles/{id}/cancel", "creator while alone, or admin; every hold refunded"],
                  ["POST", "/v1/battles/{id}/bots", "the creator asks bots to fill the free seats (admin bots on); the battle becomes full"],
                  ["GET", "/v1/battles/{id}/events", "server-sent events: joined, left, full, countdown, started, round, finished, cancelled, expired, revealed"],
                  ["GET", "/v1/battles/{id}/verify", "public recomputation; one boolean per claim: serverHash, winners, totals, pulls"],
                  ["GET, PUT", "/v1/admin/battles/settings", "the admin settings; changes apply to new battles only"],
                  ["GET, PUT", "/v1/admin/battles/bots", "the bot list: name and picture"],
                  ["POST", "/v1/admin/battles/sponsored", "create a sponsored battle; the house pays the entries"],
                  ["GET", "/v1/admin/battles/report", "battles played and GGR per day and mode, for a date range"],
                  ["POST", "/v1/admin/battles/{id}/cancel", "admin cancel with a reason; refunds; audited"],
                ] as const
              ).map(([m, p, d]) => (
                <tr key={p + m} className="border-t border-line align-top">
                  <Td mono>{m}</Td>
                  <Td mono>{p}</Td>
                  <Td>{d}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <H2 id="data">6. Data model</H2>
        <P>
          DDL in <Ext href={`${KIT}/schema-battles.sql`}>schema-battles.sql</Ext>; it extends the kit&apos;s schema.sql. Money in cents, credit in whole units, timestamps UTC.
        </P>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Table</Th>
                <Th>Holds</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["battle_settings", "one row per site: enabled, modes and seats allowed, rounds max, eligible boxes, fee, coinflip edge, expiry, countdown, private, bots, concurrency, credit face"],
                  ["battle_bots", "the admin's bot list: name, picture, enabled; nothing else"],
                  ["battles", "status, version, mode, seats, rounds as JSON with slug, tableHash, bonusHash and priceCents, entry, fee, sponsored flag and sponsor, the encrypted server seed and its hash, the result columns, one timestamp per transition"],
                  ["battle_seats", "seat number, player or bot, client seed and its source (player, server-default, bot), the hold's ledger id, idempotency key, joined and left times; one seat per player per battle"],
                  ["battle_pulls", "round, seat, nonce, digest, roll, outcome, kind, value cents, credits, and the award id set at settling"],
                  ["battle_events", "the audit log and the live feed: actor, event, from, to, time, data"],
                  ["battle_daily_report (view)", "per day and mode: battles, sponsored, with bots, player entries, credit paid, items paid, GGR"],
                  ["battle_history (view)", "a player's battles for the game-history screen"],
                  ["credit_ledger, item_awards", "the existing tables with new reasons (battle-entry, battle-refund, battle-win, battle-fee, battle-sponsor) and a battle_id on awards"],
                ] as const
              ).map(([t, d]) => (
                <tr key={t} className="border-t border-line align-top">
                  <Td mono>{t}</Td>
                  <Td>{d}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <H2 id="admin">7. Admin panel rules</H2>
        <Ul>
          <li>Three screens: Battle settings (the list above, validated: modes a subset, seats a subset, rounds 1 to 50, fee 0 to 20, coinflip edge 0 to 10%); Eligible boxes (pick from the catalogue, show each box&apos;s table hash and return); Battles (filter by status, open one to see seats, pulls, result, events, hash and seed after finished; admin cancel with a reason).</li>
          <li>Plus the bot list (names and pictures, on or off), a Create sponsored battle form, the report, and the player screen&apos;s Boxes opened and Battles played counters.</li>
          <li>A change never touches an existing battle: the battle pinned its boxes&apos; table hashes, its mode, its fee and its seats at creation. Show &quot;changes apply to new battles only&quot;.</li>
          <li>Bots: a name and a picture. There is no odds setting for bots and there must not be one.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="security">8. Security checklist</H2>
        <Ul>
          <li>Server seed from a CSPRNG per battle; encrypted at rest; decrypted only inside resolution; revealed only at finished.</li>
          <li>Commit before pay: the hash is in the create response and on the page before any seat is taken.</li>
          <li>Client seeds fixed at join and rejected after full; the server fills and records the default when none is set.</li>
          <li>Nonce map fixed by position; no client input after the start influences any roll.</li>
          <li>One seat per player per battle (unique constraint); a bot seat is never a player&apos;s.</li>
          <li>Holds, not optimistic balances: join debits the hold inside the transaction that takes the seat; insufficient credit fails the join, never the battle.</li>
          <li>Idempotency keys on create, join, leave and cancel; a retried join returns the same seat.</li>
          <li>Status guard plus version on every transition; deterministic resolution so a crash resumes without re-rolling.</li>
          <li>Awards and ledger entries written before finished; the seed revealed only after they are committed.</li>
          <li>Rate limits on create and join; the admin&apos;s concurrent-battles-per-player limit enforced.</li>
          <li>Ownership checks on leave and cancel; admin actions carry a reason and an audit row.</li>
          <li>Private battles by invite code, random, 10 characters or more.</li>
          <li>Live updates come from the events table, never from client messages; the animation starts after the pull records arrive and ends on exactly what they say.</li>
          <li>Logs carry the battle id and never a secret.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="conformance">9. Conformance and test vectors</H2>
        <P>
          Run <Ext href={`${KIT}/test-vectors-battles.json`}>test-vectors-battles.json</Ext> first: for each case recompute every pull, the totals, the winners, the shares and the extra roll; all must match byte for byte. The tables for the two boxes used are inside the file.
        </P>
        {vectors ? (
          <div className="tbl">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Case</Th>
                  <Th>Mode</Th>
                  <Th right>Seats</Th>
                  <Th right>Rounds</Th>
                  <Th>Seat seeds</Th>
                  <Th>Winners</Th>
                  <Th right>Pot</Th>
                </tr>
              </thead>
              <tbody>
                {vectors.cases.map((c) => (
                  <tr key={c.name} className="border-t border-line align-top">
                    <Td>{c.name}</Td>
                    <Td mono>{c.mode}</Td>
                    <Td right mono>{c.seats.length}</Td>
                    <Td right mono>{c.rounds.length}</Td>
                    <Td mono>{c.seats.map((x) => x.clientSeed).join(", ")}</Td>
                    <Td mono>{c.result.winners.join(", ")}</Td>
                    <Td right mono>{cents(c.result.potCents)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">Server seed 00112233…eeff for every case; server hash {vectors.serverHash.slice(0, 16)}…</p>
          </div>
        ) : (
          <P>The vector file was not found at build time; download it from the kit.</P>
        )}
        <Ul>
          <li>Property test: 10,000 two-seat normal battles; each seat wins 50% ± 2 points; the pot equals the sum of pulls every time.</li>
          <li>Concurrency: 50 parallel joins to one 2-seat battle; exactly one seat each; every other hold released; no duplicate seats; an idempotent retry returns the same seat.</li>
          <li>Crash: kill the process between in_progress and finished; the sweeper completes the battle with identical digests and exactly one payout.</li>
          <li>State machine: every forbidden transition is rejected; every transition writes an event.</li>
          <li>Bots: a battle won by a bot writes no award and no ledger row; a player who beats bots is paid in full; the report counts only the player&apos;s entry.</li>
          <li>Sponsored: no hold from any player, one battle-sponsor entry, the winner paid as usual, the report shows zero player entries.</li>
          <li>Front end: the animation ends on the server&apos;s outcome; a reload mid-battle resumes from GET /v1/battles/{"{id}"}; the verify page passes on real data and fails on a tampered seed.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="plan">10. Build order</H2>
        <Ul>
          <li>Inspect the repository first: how the admin panel stores settings, how credit and the ledger work, how single opens call the engine, how realtime (if any) is done. Reuse those.</li>
          <li>Schema, then the resolver (reuse battleKit.ts), then the state machine and the timer, then the API, then admin settings, then the lobby and room, then the verify page, then the tests.</li>
          <li>Where the kit is unclear or conflicts with the repository, write it down in the README section; do not guess.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="prompt">11. Prompt for the main repository</H2>
        <P>Paste this into the Claude session opened in the main project repository. It carries the mechanic, the state machine, the admin settings, the player screens, the security rules and the tests, and points at the files above.</P>
        <CopyBlock text={BATTLES_PROMPT} filename="battles-prompt.txt" />
      </section>

      <section className="space-y-3">
        <H2 id="evocase">12. From the Evocase demo</H2>
        <P>Facts from the vendor&apos;s 15 October demo that the kit adopts, so the product matches what the market shows:</P>
        <Ul>
          <li>Bots are &quot;just names and images, no higher configuration&quot;, and a player can &quot;ask bots to join&quot; when nobody else does. The kit: a bot list of names and pictures, an ask-bots endpoint, same odds, winnings back to the house.</li>
          <li>A battle shows &quot;ongoing&quot; and then &quot;settled&quot; once the money has moved. The kit: in_progress and finished in the database, Ongoing and Settled on screen.</li>
          <li>Sponsored battles exist as a flag. The kit: admin-created battles whose entries the house pays, labelled.</li>
          <li>Game history lists battles next to single opens, and the player screen counts battles participated. The kit: the battle_history view and the counters.</li>
          <li>The dashboard shows GGR by game mode. The kit: the battle_daily_report view and the report endpoint.</li>
          <li>Promo codes can give a free battle. The kit: a credit voucher limited to battle entries, in the promo module.</li>
        </Ul>
      </section>
    </div>
  );
}
