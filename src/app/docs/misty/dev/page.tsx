import Link from "next/link";
import { buildTable, liveWeights, mistyBox, mistyDigest, rollOf, lookup } from "@/engine/labs/misty";
import { sha256Hex } from "@/engine/hash";
import { Badge, Card, Td, Th } from "@/components/ui";
import { DevSandbox } from "@/components/DevSandbox";
import { CopyBlock } from "@/components/CopyBlock";
import { FRONTEND_PROMPT } from "@/lib/frontendPrompt";

export const metadata = { title: "Misty for developers · Simulator" };

const REPO = "https://github.com/Optinet-Solutions-AI/mys_sim";
const RAW = `${REPO}/blob/main`;

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
  ["downloads", "2. Downloads and sandboxes"],
  ["algorithm", "3. The algorithm, exactly"],
  ["flow", "4. The open, end to end"],
  ["api", "5. API"],
  ["data", "6. Data model"],
  ["backoffice", "7. Back office rules"],
  ["security", "8. Security checklist"],
  ["conformance", "9. Conformance and test vectors"],
  ["plan", "10. Implementation plan"],
  ["decisions", "11. Decisions for the main site"],
  ["frontend-prompt", "12. Prompt for the front end"],
  ["changes", "13. What changed in 1.1"],
  ["sandbox", "API sandbox"],
] as const;

const ALGO = `import { sha256Hex, hmacSha256Hex, canonicalJson } from "./hash";

const TWO52 = 2 ** 52;

// shown to the player BEFORE payment
export const commit = (serverSeedHex: string) => sha256Hex(serverSeedHex);

// the mix: secret + player's seed + spin number -> one long number
export const digest = (slug: string, serverSeed: string, clientSeed: string, nonce: number) =>
  hmacSha256Hex(["DRAW", slug, serverSeed, clientSeed, String(nonce)].join("-"), "");

// 52 bits -> a roll in [0, 1)
export const roll = (digestHex: string) => parseInt(digestHex.slice(0, 13), 16) / TWO52;

// the odds table is hashed in its stored order; this hash is pinned on every open
export const tableHash = (slug: string, price: number, table: { id: string; percent: number }[]) =>
  sha256Hex(canonicalJson({ slug, price, table }));

// cumulative bands in stored order; position = roll x total
export function resolve(table: { id: string; percent: number }[], u: number): string {
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

// free spins: same secret and client seed, nonce 2, 3, ... against the bonus table (credit only)`;

const SEQ = `front end                      API                                   DB / KMS
   |  POST /opens {slug}        |                                       |
   |--------------------------->| seed = randomBytes(32)                |
   |                            | hash = sha256(seed); pin tableHash    |
   |                            |-- insert open (seed encrypted) ------>|
   |<-- {openId, serverHash,    |                                       |
   |     tableHash, nonce: 1}   |                                       |
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
   |  GET /verify?...           |  (public, stateless recomputation)    |`;

const ENDPOINTS: [string, string, string][] = [
  ["GET", "/v1/boxes", "Active boxes with the current ordered table, bonus table and hashes."],
  ["GET", "/v1/boxes/{slug}", "One box: ordered table, bonus table, both hashes, the dollar price that was hashed, tradeInPercent, and the per-open maths so the front end can show pays-back honestly."],
  ["POST", "/v1/opens", "Create the open: CSPRNG seed, store encrypted, return sha256(seed), pin price and hashes, set expiry."],
  ["PUT", "/v1/opens/{id}/client-seed", "Player seed. Allowed only while status is created (before payment)."],
  ["POST", "/v1/opens/{id}/pay", "Card or credit. Idempotent on a key. Fills the published default seed if none was set and records that."],
  ["POST", "/v1/opens/{id}/spin", "Resolve once from the snapshots pinned at create time, write award + ledger in one transaction, reveal the seed. Retries return the stored result."],
  ["GET", "/v1/opens/{id}", "Read an open. The seed appears only after reveal."],
  ["GET", "/v1/me/opens", "The caller's opens, newest first (1.1)."],
  ["GET", "/v1/me/awards", "The caller's item awards with status and shipment (1.1)."],
  ["POST", "/v1/awards/{id}/trade-in", "Item to credit at the rate stored on the award (90% on the main site)."],
  ["POST", "/v1/awards/{id}/ship", "Address in; the award moves to shipping; fee, carrier and tracking on the shipment (1.1)."],
  ["GET", "/v1/me/credits", "Balance and ledger."],
  ["GET", "/v1/verify", "Public, stateless: recompute hash, digest, roll, band, bonus spins; one boolean per claim (seed hash, table hash, bonus hash, outcome, free spins) (1.1)."],
  ["GET", "/v1/tables/{hash}", "The frozen table for a hash, with the dollar price and the exact numbers hashed."],
  ["GET", "/v1/bonus-tables/{hash}", "The frozen free-spin table for a hash (1.1)."],
  ["GET", "/v1/tables/log", "Public append-only log of every table activation (box, hash, segment, time)."],
  ["POST", "/v1/admin/boxes", "Upsert a box with its outcomes and bonus table from the main site's catalogue export; creates and activates version 1 of both (1.1)."],
  ["POST", "/v1/admin/boxes/{slug}/tables", "New table version: validated (sum 100, all outcomes), with the maths preview. Never edit in place."],
  ["POST", "/v1/admin/boxes/{slug}/tables/{id}/activate", "Make current; publishes the hash to the log."],
  ["PUT", "/v1/admin/segments/{id}/tables/{slug}", "Point a segment at a table version (publishes too). Build only if the product says yes."],
];

const TABLES: [string, string][] = [
  ["boxes", "slug, name, price_cents, current_table_id, current_bonus_id"],
  ["outcomes", "per box: label, rarity, kind (item | credit | bonus), credits (whole), free_spins, value_cents, brand, category, image_url. Ids survive table versions."],
  ["box_tables", "immutable versions: ordered entries [{id, percent}] stored exactly as hashed (dollar price in the hash), percent_sum = 100, table_hash unique, activated_at"],
  ["bonus_tables", "immutable versions of the free-spin table, bonus_hash"],
  ["table_publication_log", "every activation: box, table_hash, bonus_hash, segment, time. Public."],
  ["segments, segment_tables, players", "optional per-segment table overrides; a player is in at most one segment"],
  ["opens", "player, box, pinned table_hash and bonus_hash, price, status, server_seed_enc, server_hash, client_seed + source, nonce_start, payment, digest, roll, outcome_id, credits_awarded, resolved_at, revealed_at, expires_at"],
  ["bonus_spins", "per open: nonce, digest, roll, credits"],
  ["item_awards", "per open: value_cents, status (awarded | shipping | shipped | traded), trade_in_percent and trade_in_credits fixed at award time"],
  ["award_shipments", "one per ship request: address, fee_cents, carrier, tracking, status (1.1)"],
  ["credit_ledger", "append-only deltas with reasons; balance = sum; never negative; no cash-out path"],
  ["admin_audit", "who changed what, before and after"],
];

export default function MistyDevPage() {
  const box = mistyBox("timepiece-suite");
  const table = buildTable(box, liveWeights(box));
  const v = { serverSeed: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff", clientSeed: "alice" };
  const d1 = mistyDigest(box.slug, v.serverSeed, v.clientSeed, 1);
  const r1 = rollOf(d1);
  const e1 = lookup(table, r1);

  return (
    <div className="mx-auto max-w-6xl pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
      <div className="min-w-0 space-y-8">
      <header className="space-y-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">Misty · for developers</div>
        <h1 className="text-3xl font-semibold">Implementing the Misty mystery box backend on the main site</h1>
        <P>For the team building the official site in its own repo: the notes, the exact algorithm, the data model and the API, a downloadable kit with the engine code and test vectors, and a sandbox that runs the flow in the browser.</P>
      </header>

      <section className="space-y-3">
        <H2 id="scope">1. What to build</H2>
        <P>One product: a priced box with a published odds table. One open is one independent roll against that table. The parts, in order of the player&apos;s experience:</P>
        <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>The server commits to a secret (its SHA-256 hash is shown) before the player pays.</li>
          <li>The player may set a client seed, before paying.</li>
          <li>The roll is an HMAC of secret, seed and spin number, read against the cumulative bands of the table.</li>
          <li>Some outcomes carry free spins: same secret, nonce 2 and 3, read against a small credit-only table.</li>
          <li>The table used is snapshotted and hashed (&quot;frozen onto the open&quot;); the secret is revealed after the spin.</li>
          <li>Payout is a physical item (ship or trade in for credit) or site credit, which lives in an append-only ledger and never becomes cash.</li>
        </ul>
        <P>Out of scope here: competitions, the payments provider, KYC. Shipping has an endpoint and a table, not a carrier. The kit marks the hooks.</P>
      </section>

      <section className="space-y-3">
        <H2 id="downloads">2. Downloads and sandboxes</H2>
        <Card>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-sm font-semibold">The kit (zip)</div>
              <a href="/downloads/misty-backend-kit.zip" className="btn btn-primary no-underline" download>
                Download misty-backend-kit.zip
              </a>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-ink-2">
                <li>
                  <code>misty.ts</code> the engine (tables, hash, roll, bonus, per-player tables, opener, verifier, maths)
                </li>
                <li>
                  <code>mistyLive.generated.ts</code> the 13 live boxes as seed data
                </li>
                <li>
                  <code>types.ts</code>, <code>hash.ts</code>, <code>rng.ts</code>, <code>metrics.ts</code>
                </li>
                <li>
                  <code>server-reference.ts</code> create → seed → pay → spin → verify over a storage interface
                </li>
                <li>
                  <code>schema.sql</code> Postgres DDL, <code>openapi.yaml</code> the API, <code>test-vectors.json</code>
                </li>
                <li>
                  <code>README.md</code> these notes, <code>misty-boxes-2026-10-12.json</code> the raw capture
                </li>
              </ul>
            </div>
            <div>
              <div className="mb-1 text-sm font-semibold">Read online</div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-2">
                <li>
                  <Ext href="/downloads/misty-backend-kit/README.md">README.md</Ext> · <Ext href="/downloads/misty-backend-kit/schema.sql">schema.sql</Ext> · <Ext href="/downloads/misty-backend-kit/openapi.yaml">openapi.yaml</Ext> · <Ext href="/downloads/misty-backend-kit/test-vectors.json">test-vectors.json</Ext>
                </li>
                <li>
                  <Ext href="/downloads/misty-backend-kit/server-reference.ts">server-reference.ts</Ext> · <Ext href="/downloads/misty-backend-kit/misty.ts">misty.ts</Ext> · <Ext href="/downloads/misty-backend-kit/types.ts">types.ts</Ext>
                </li>
                <li>
                  Source of truth in the simulator repo: <Ext href={`${RAW}/src/engine/labs/misty.ts`}>src/engine/labs/misty.ts</Ext>, <Ext href={`${RAW}/kit/misty-backend`}>kit/misty-backend</Ext>
                </li>
              </ul>
              <div className="mb-1 mt-3 text-sm font-semibold">Sandboxes</div>
              <ul className="list-disc space-y-0.5 pl-5 text-xs text-ink-2">
                <li>
                  <a href="#sandbox" className="text-accent-ink underline underline-offset-2">
                    API sandbox on this page
                  </a>
                  : the flow with real hashes, in the browser.
                </li>
                <li>
                  <Link href="/operators/misty" className="text-accent-ink underline underline-offset-2">
                    The Misty page
                  </Link>
                  : the product as the player sees it, with the back office behind the cog.
                </li>
                <li>
                  Repo in the browser: <Ext href="https://stackblitz.com/github/Optinet-Solutions-AI/mys_sim">StackBlitz</Ext> or <Ext href="https://codesandbox.io/p/github/Optinet-Solutions-AI/mys_sim/main">CodeSandbox</Ext> (Next 16 in a web container can be slow; local is the reliable path).
                </li>
                <li>
                  Local: <code>git clone {REPO}.git</code>, <code>npm install</code>, <code>npm run dev</code>; headless check <code>npx tsx scripts/smoke-misty.ts</code>; regenerate vectors <code>npx tsx scripts/misty-vectors.ts</code>.
                </li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Dependencies of the kit: <code>@noble/hashes</code> ^2.4 and Node 20+. Nothing else. The kit is MIT-style internal code from this research project; the data file is a capture of a third party&apos;s public page for reference, not for reuse as our catalogue.
          </p>
        </Card>
      </section>

      <section className="space-y-3">
        <H2 id="algorithm">3. The algorithm, exactly</H2>
        <Code>{ALGO}</Code>
        <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>Band order is the stored order of the snapshot. Never sort when resolving; the hash covers that order.</li>
          <li>
            Store <code>percent</code> as <code>numeric(12,8)</code> and serialise with at most 8 decimals so the canonical JSON, and therefore the table hash, is stable across languages. The vectors include the hash of the live Timepiece table to check your serialisation.
          </li>
          <li>The HMAC key is a dash-joined UTF-8 string and the message is empty. This is Misty&apos;s published competition-verifier convention; their box verifier was not captured. If the main site wants another recipe, change it here and in the public verifier together and regenerate the vectors.</li>
          <li>52 bits of uniform randomness is enough for percents with 8 decimals (1 part in 10 billion).</li>
          <li>Free spins never chain in the captured tables; enforce a maximum depth of 1.</li>
        </ul>
        <Card title="A worked vector (from test-vectors.json)">
          <div className="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <div>
              <div className="text-ink-3">serverSeed</div>
              <code className="block break-all">{v.serverSeed}</code>
            </div>
            <div>
              <div className="text-ink-3">serverHash = sha256(serverSeed)</div>
              <code className="block break-all">{sha256Hex(v.serverSeed)}</code>
            </div>
            <div>
              <div className="text-ink-3">key for nonce 1</div>
              <code className="block break-all">{["DRAW", box.slug, v.serverSeed, v.clientSeed, "1"].join("-")}</code>
            </div>
            <div>
              <div className="text-ink-3">digest = HMAC-SHA256(key, &quot;&quot;)</div>
              <code className="block break-all">{d1}</code>
            </div>
            <div>
              <div className="text-ink-3">roll = parseInt(digest[0:13], 16) / 2^52</div>
              <code className="block">{r1}</code>
            </div>
            <div>
              <div className="text-ink-3">band and outcome</div>
              <code className="block">
                {e1.from.toFixed(6)} to {e1.to.toFixed(6)} → {e1.outcome.label}
              </code>
            </div>
            <div className="sm:col-span-2">
              <div className="text-ink-3">tableHash of the live Timepiece Suite</div>
              <code className="block break-all">{table.hash}</code>
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <H2 id="flow">4. The open, end to end</H2>
        <Code>{SEQ}</Code>
        <P>
          Lifecycle: <code>created → paid → resolved</code> (plus <code>expired</code> for unpaid opens). Reveal happens inside the spin response; keep <code>resolved_at</code> and <code>revealed_at</code> as two timestamps. An open is never re-resolved; a new attempt is a new open with a new seed. If the player never sets a seed, the server fills a published default and records <code>client_seed_source = server-default</code>.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="api">5. API</H2>
        <P>
          Full spec in <Ext href="/downloads/misty-backend-kit/openapi.yaml">openapi.yaml</Ext>. The rules the API enforces: client seed only before pay; spin only once and only when paid; the spin response is the only place the seed first appears; reads return the seed only after reveal.
        </P>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr>
                  <Th>Method</Th>
                  <Th>Path</Th>
                  <Th>Does</Th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map(([m, p, d]) => (
                  <tr key={m + p} className="border-t border-line align-top">
                    <Td mono>{m}</Td>
                    <Td mono>{p}</Td>
                    <Td>{d}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <H2 id="data">6. Data model</H2>
        <P>
          DDL in <Ext href="/downloads/misty-backend-kit/schema.sql">schema.sql</Ext> (Postgres; works on Supabase). Money in cents, credit in whole units, timestamps UTC.
        </P>
        <Card>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Table</Th>
                <Th>Holds</Th>
              </tr>
            </thead>
            <tbody>
              {TABLES.map(([t, d]) => (
                <tr key={t} className="border-t border-line align-top">
                  <Td mono>{t}</Td>
                  <Td>{d}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <P>Invariants: a table version is immutable and its percents sum to 100; every open pins the hash of the table it was resolved with and the price at creation; the ledger is append-only and never negative; the seed is encrypted at rest and decrypted only inside the spin transaction.</P>
      </section>

      <section className="space-y-3">
        <H2 id="backoffice">7. Back office rules</H2>
        <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>Odds edits create a new version; nothing is edited in place. Store who, when, why.</li>
          <li>Validation on save: every outcome present, percents ≥ 0, sum = 100 ± 1e-6, item outcomes have a value, free-spin outcomes have free spins ≥ 1.</li>
          <li>
            Show the per-open maths on save, exactly as the simulator&apos;s &quot;The maths of this box&quot; table: value × percent for every row, added up, on screen and in real money, against the price. The function is <code>mistyMath</code> in the kit.
          </li>
          <li>Publish every activated table hash with its activation time to the public log. A player can then check that the hash on their open was the public one at that moment. This is the cheapest honest answer to &quot;did everyone get the same odds&quot;.</li>
          <li>Segments (per-player tables) are the one thing the proof cannot reveal. Either do not build them, or publish their hashes too. Product decision, section 11.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="security">8. Security checklist</H2>
        <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            Server seed from <code>crypto.randomBytes(32)</code> or a KMS. Never a PRNG, never derived from time or ids.
          </li>
          <li>Generate and hash the seed before accepting a client seed, and make the commit response the first thing the front end shows. Order is the whole proof.</li>
          <li>Store the seed encrypted; decrypt only inside the spin transaction; reveal only in the spin response and afterwards.</li>
          <li>One open, one seed. Expire unpaid opens. Never reuse a seed.</li>
          <li>Idempotency keys on pay and spin; a retried spin returns the stored result, never a new roll.</li>
          <li>Freeze price, table hash and bonus hash at creation; resolve with the frozen snapshot even if the admin changed the table meanwhile.</li>
          <li>Log every open with digest, roll, outcome and hashes; make verify a pure function over that record.</li>
          <li>Rate-limit open creation; cap bonus depth; let nothing but the client seed come from the front end into the roll.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="conformance">9. Conformance and test vectors</H2>
        <ol className="max-w-[78ch] list-decimal space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            Run <Ext href="/downloads/misty-backend-kit/test-vectors.json">test-vectors.json</Ext>: for each entry recompute serverHash, digest, roll, outcomeId, bonus spins and tableHash; all must match byte for byte. The file also holds one full open from the opener with the commitment shown before payment.
          </li>
          <li>
            Property test: 1,000,000 synthetic opens on the Timepiece table; per-outcome counts within chi-square p &gt; 0.01 of the stated odds (<code>chiSquare</code> in metrics.ts).
          </li>
          <li>Replay: for 1,000 stored opens, verify must reproduce every field from the stored seed, client seed, nonce and table snapshot.</li>
          <li>
            Cross-language: the key is UTF-8; format the nonce as a plain integer (<code>&quot;1&quot;</code>, never <code>&quot;1.0&quot;</code>).
          </li>
        </ol>
        <P>
          The simulator runs these in <code>scripts/smoke-misty.ts</code>: 50,000 opens return within chance of the table, 500 of 500 proofs pass, a tampered seed fails, and a VIP segment with boosted odds verifies like everyone else.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="plan">10. Implementation plan</H2>
        <ol className="max-w-[78ch] list-decimal space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <b>Data and admin.</b> Migrate schema.sql; import the live boxes as seed data or load your own; admin endpoints for table versions with validation and the maths preview.
          </li>
          <li>
            <b>Open flow.</b> Create with commit; client seed; pay (stub the provider); spin with the engine functions; award and ledger in one transaction; reveal.
          </li>
          <li>
            <b>Public verify.</b> Stateless verify and table-by-hash endpoints; a public page in the front end that calls them.
          </li>
          <li>
            <b>Credit.</b> Ledger, balance, pay-with-credit, trade-in.
          </li>
          <li>
            <b>Publication log and segments</b>, if the product decision is yes.
          </li>
          <li>
            <b>Conformance</b> (section 9) in CI.
          </li>
        </ol>
      </section>

      <section className="space-y-3">
        <H2 id="decisions">11. Decisions the main site still has to make</H2>
        <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>The credit unit&apos;s name and its on-screen dollar rate; whether it is displayed as money at all.</li>
          <li>The trade-in rate for items (Misty: listed dollars = credits; the per-item number is only shown after a win).</li>
          <li>Default client seed policy when the player sets none (publish it).</li>
          <li>Whether segments exist; if yes, the publication log is mandatory.</li>
          <li>Spend limits, cooling-off, and a plain &quot;paid in / got back&quot; counter per player.</li>
          <li>Whether to show the table hash on the box page before payment (recommended: yes).</li>
        </ul>
        <div className="pt-1">
          <Badge>Kit v1.1 · 14 October 2026</Badge>
        </div>
      </section>

      <section className="space-y-3">
        <H2 id="frontend-prompt">12. Prompt for the front end</H2>
        <P>Paste this into a Claude session opened in the front-end repository. It carries the mechanic, the API calls in order, the hard rules, the screens, the copy rules and the questions to ask, with links back to this kit.</P>
        <CopyBlock text={FRONTEND_PROMPT} filename="misty-frontend-prompt.txt" />
        <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
          <li>The links point at this site. If the other session cannot open them, attach the kit zip from section 2.</li>
          <li>The prompt forbids computing outcomes in the browser and forbids near-miss effects. Keep both lines if you edit it.</li>
          <li>It is also in the kit as FRONTEND_PROMPT.md.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <H2 id="changes">13. What changed in 1.1</H2>
        <P>The front end built against kit 1.0 (its mock runs at <Ext href="https://mysterybox-seven.vercel.app">mysterybox-seven.vercel.app</Ext>) and sent a list of gaps on 14 October 2026. Each point was checked against the kit. The roll did not change; every 1.0 vector still passes.</P>
        <Card>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>They found</Th>
                <Th>Decision</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["The table hash only matches with the dollar price and the raw percents; rounding to 8 decimals changes it.", "Correct. Hash input: { slug, price in dollars, table: [{ id, percent }] } with the percents exactly as stored. The database keeps the hashed JSON as is. The 1.0 note about numeric(12,8) is gone. test-vectors.json carries tableHashInput, the exact string hashed."],
                ["bonusHash has no recipe.", "Their placeholder is now the recipe: sha256(canonicalJson({ slug, bonus: [{ credits, percent }] })). Engine function bonusHash; vectors carry bonusHash and bonusHashInput."],
                ["Outcome kinds: openapi says item, credit, bonus; the vectors say oroos, mistees, weight; the sandbox sent free-spin rows as credit.", "The API vocabulary is the contract: kind item | credit | bonus (bonus = credit plus free spins), credits, percent, valueCents. The engine keeps Misty's words; the mapping is in the README. The sandbox below sends free-spin rows as bonus and the vectors carry an api block."],
                ["Outcomes have no image, brand or category; the box response lacked rarity, tagline, bonusHash and maths.", "Added imageUrl, brand, category on outcomes; the box returns tagline, bonusHash, maths, tradeInPercent and the dollar price."],
                ["No endpoint to list awards or opens; no shipping endpoint.", "GET /v1/me/awards, GET /v1/me/opens, POST /v1/awards/{id}/ship; award_shipments in the schema."],
                ["GET /v1/tables/{hash} returns only the main table; the public check needs the bonus table too.", "GET /v1/bonus-tables/{bonusHash}; the open and verifyUrl carry both hashes."],
                ["The browser also checks the outcome, each free spin's credits and the bonus hash; /v1/verify did not.", "GET /v1/verify takes outcomeId, bonusCredits and bonusHash and answers ok plus one boolean per claim."],
                ["Every open pins a full copy of the table.", "Same invariant. The reference server now loads the pinned snapshots by hash instead of refusing when the current table moved."],
                ["Credits are whole numbers on their side; Misty's $25 and $50 bonus tables are fractional.", "Decided: credits are whole numbers in the contract, shown as $1 each. The Misty capture stays reference data and is not seeded on the main site."],
                ["Trade-in 90%, default seed grailnoir-default, 15-minute expiry.", "Recorded as the main site's policy; tradeInPercent is returned on the box and fixed on every award."],
                ["Their catalogue is their own 8 boxes, not the Misty capture.", "POST /v1/admin/boxes upserts a box from the catalogue export and activates its first table and bonus versions."],
                ["Who issues the bearer token; the error body shape.", "The main site's auth issues the JWT (Supabase Auth in the plan); the API verifies it and maps sub to the player. Errors are { code, message, details? } with the codes listed in the README."],
              ].map(([a, b]) => (
                <tr key={a} className="border-t border-line align-top">
                  <Td>{a}</Td>
                  <Td>{b}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <P>Still open for the main site: segments (if yes, the publication log is mandatory), spend limits and a paid-in / got-back counter, publishing the table hash before payment, shipping fees and carrier, and whether the Analysis section is shown to players.</P>
      </section>

      <section className="space-y-3">
        <H2 id="sandbox">API sandbox</H2>
        <DevSandbox />
      </section>
      </div>
      <aside className="mt-8 lg:mt-0">
        <div className="rounded-xl border border-line bg-paper p-3 text-xs lg:sticky lg:top-4">
          <Link href="/operators/misty" className="btn w-full justify-center no-underline">
            ← Back to the Misty mystery box
          </Link>
          <div className="mb-1 mt-3 text-[10px] font-semibold uppercase tracking-wide text-ink-3">On this page</div>
          <ol className="space-y-1">
            {TOC.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="block rounded px-1 py-0.5 text-ink-2 no-underline hover:bg-accent-soft hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ol>
          <Link href="/docs/misty" className="mt-3 block text-accent-ink underline underline-offset-2">
            The mechanism in plain words →
          </Link>
          <Link href="/build" className="mt-1 block text-accent-ink underline underline-offset-2">
            Build your own box →
          </Link>
        </div>
      </aside>
    </div>
  );
}
