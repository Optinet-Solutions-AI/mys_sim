# Mystery Box Simulator

A research sandbox that reproduces how mystery-box platforms work, so any algorithm and any setting can be
tested, the documented manipulations can be switched on, and an honest verifier plus the statistics show what
would be caught. No real money, no registration; every player is a simulated agent. Phase 1 runs entirely in the
browser. Phase 2 adds Supabase (shared history and logs) and Vercel hosting.

The plan, the hub roadmap and the scorecard are in the research folder of the parent workspace
(`research/05-simulator-plan.md`; the research documents are not part of this repository). The odds engine
follows `research/04-backend-blueprint.md` §2 there.

## Run it

```bash
npm install
npm run build      # production build (Next.js 16, Turbopack)
npm start          # serves on http://localhost:3000
# or, while developing:
npm run dev
```

Other scripts:

```bash
npx -y tsx scripts/smoke.ts      # runs the engine headless: every scheme, every rig, every lab, with timings
node scripts/extract-icons.mjs   # regenerates src/lib/icons.generated.ts from the Iconify JSON packages
npx tsc --noEmit                 # type check
```

## What is in it (phase 1)

The hub is organised **by source**. Each operator has its own page with its own features as tabs; nothing from one
operator is mixed into another's screens. Every feature is an isolated lab with a fixed structure (draw model,
economy rules, battle modes), its own presets and only the options that operator actually has. Captured tables
are locked to the published odds unless you unlock them to experiment. Across all of them the research toggles
are the same: the commitment scheme, the ticket mapping, the rigs and the detector.

Each source page has its own **look**: palette, typography and wording (`src/lib/skins.ts`), its own reveal motif
(card flip for IcyBox drops and blind boxes, tier ladder for StockX, pack rip for Courtyard, scratch ticket for
Misty, kuji and Omaze, reels for the case sites, a transparent card for the Glass Box) and an operator panel that
reproduces what that operator shows around a result (keep-or-sell timers, credit offers, the public pull log,
seeds, entries). The looks are inspired by the public products; no logos or assets are copied.

Within a feature the pattern is the same everywhere: you land on the **test page** and can play at once; two
buttons explain it in plain language, **Player view** (how it works for a player) and **Settings explained**
(what the configuration and the algorithm mean, with a glossary); the **cog** holds the settings in sections; the
summary chips open the matching section; **Run simulation** produces the statistics below the test page. Live
opens and simulations share the same engine, rigs and verifier.

| Route | Source | Features |
|---|---|---|
| `/operators/vendor` | The B2B vendor from the demo call | Mystery Boxes (90% RTP knob on listed values, no commitment), Sell-back & Cart (credit at displayed value, withdraw only through items), Battles (five modes, bots as the house), Retention (daily boxes with 24-hour expiry, races, affiliates), Deals |
| `/operators/icybox` | IcyBox | Drops (finite pools, retail values, no fairness scheme; early-retirement rig), Buyback (undisclosed estimate, buyback window then auto-sold, keep fees) |
| `/operators/stockx` | StockX Mystery Boxes | Tiered box (tier-first draw, floor at price, finite inventory delists), Credit sell-back (75 to 90% of list as expiring credit, five-minute window then charged and shipped) |
| `/operators/courtyard` | Courtyard | EV-priced pack (price equals expected value, public pull log), FMV buyback (cash at fair market value, seven-day window, guaranteed-value floor) |
| `/operators/jemlit` | Jemlit | Apple eBox (captured table, Jemlit scheme, 40% guaranteed variant), Cashback credits (0 to 30% haircut, never cash, expire), Upgrader |
| `/operators/cases` | Cases.gg | Pack Up box (captured table, 10% edge, rotation every 1,000), Upgrader, Coinflip, Battles, Vault, Missions and the free route |
| `/operators/misty` | Misty | Timepiece Suite and Penthouse (captured tables, Misty scheme), Credits and draws (the two-stage economy with free postal entry) |
| `/operators/glassbox` | Glass Box (our design) | Glass Box (manifest, beacon, per-open rotation, ledger, realized value), Cash buyback, Lucky bag, Pity ceiling, Group opens, Pooled draw with disclosed EV, Spend cap |
| `/operators/adjacent` | Adjacent models | Ichiban Kuji (Last One), Pop Mart secret, Fukubukuro, Breaks, Omaze-style draw, Gacha pity |
| `/operators/presentation` | Presentation layer (research) | Near-miss reel, losses disguised as wins, fabricated live feed, tickets-away message, demo odds, urgency cues |
| `/` | Hub | The sources and their features |
| `/catalog` | Catalogue | 48 fictional items plus the items of the reconstructed operator tables, three price layers each |
| `/runs`, `/runs/[id]` | Run history | Saved runs from every source side by side, compare two of one lab type, export JSON or a Markdown report |
| `/verify` | Verifier | Recompute commitment, digest and ticket from seeds; verify a pasted record |
| `/docs` | Docs | Sources and their features, schemes, mappings, randomness sources, odds models, agent policies, battle modes, rigs, principles |

The reconstructed operator tables (Jemlit Apple eBox, Misty Timepiece Suite and Penthouse, Cases.gg Pack Up) are
rebuilt to the metrics documented in dossier 1 (top-item odds, cheapest-outcome share, expected value) in
`src/engine/captured.ts`; the item-by-item lists were not kept at capture time, so they are labelled reconstructions
and their realized values are stated assumptions.

## Misty, copied one to one

The Misty page (`/operators/misty`, tab "Mystery boxes") is a dedicated lab rather than a preset of the generic one. `src/engine/mistyLive.generated.ts` holds the thirteen live boxes with their real names, prices, exact page weights and free-spin tables, generated from the pages captured on 12 October 2026 (`research/captures/misty-boxes-2026-10-12.json`). `src/engine/labs/misty.ts` reproduces one open as the site describes it: a secret committed per open, the player's seed, a spin number, `HMAC-SHA256("DRAW-slug-secret-seed-nonce", "")`, the first 13 hex characters as a roll, the odds table hashed and frozen onto the open, free spins on the next nonces, reveal, rotate; plus a verifier and a runner that shares opens between players who may hold different tables. The page shows the box strip, a spin strip, the Mistee balance, trade-in, the proof panel and a step-by-step narration of each spin; the cog is the back office (odds per outcome, free-spin table, Mistee values, per-player odds, proof on or off, run size). `scripts/smoke-misty.ts` checks every box, the proofs and a per-player table. The plain-language write-up is `research/06-misty-box-mechanism.md`, and the same explanation with live sums, a sources table and a critique is served inside the app at `/docs/misty` (`src/app/docs/misty/page.tsx`); the saved captures it links to are under `public/captures/`. For now the Misty operator page shows only the Mystery boxes tab; the Research view, Mistees economy and Competitions tabs are kept under `hiddenFeatures` in `src/lib/operators.ts`.

For the team building the main site there is a developer page at `/docs/misty/dev` (`src/app/docs/misty/dev/page.tsx`, sandbox in `src/components/DevSandbox.tsx`) and a downloadable kit. The kit's source is `kit/misty-backend/` (README, `schema.sql`, `openapi.yaml`, `server-reference.ts`); `npx tsx scripts/misty-vectors.ts` regenerates `test-vectors.json` and `python scripts/build-misty-kit.py` assembles `public/downloads/misty-backend-kit.zip` (engine files copied with flattened imports) plus the readable copies under `public/downloads/misty-backend-kit/`. The `kit` and `public` folders are excluded from the app's typecheck.

## Structure

```
src/engine/          pure TypeScript, no React, no browser APIs
  types.ts           every config and result type
  hash.ts            sha256/sha512/hmac (noble), canonical JSON, Merkle root
  rng.ts             seeded generators (sfc32, lcg, Math.random, CSPRNG) for the simulator itself
  mapping.ts         digest -> ticket (float-cumulative, int32 mod/floor, int52, int256 mod/floor, rejection)
  table.ts           integer-ticket tables, RTP solver (weights ~ value^-beta), lookups
  schemes.ts         commitment schemes: none, server-hash, hmac-sha256, Jemlit, Packs, Misty, Razed, Glass Box
  opener.ts          the Opener: draws with any scheme/mapping/rotation and any active rig; verifyRecord()
  rigs.ts            the white-hat rigging toolkit, documented
  metrics.ts         chi-square (regularised gamma), histograms, Welford, detectable sample size
  catalog.ts         the item catalogue
  labs/              runMysteryBox, runSellback, runBattles, runRetention; registry (docs for everything)
  index.ts           runLab(request, onProgress)
src/workers/         Web Worker that runs runLab off the main thread
src/lib/             store (IndexedDB), presets, detector, report (Markdown), useRun hook, formatting
src/components/      UI: config panels, run controls, results, lab shells, verifier, run history
src/app/             routes
scripts/             smoke test, icon extraction
```

## Rules the code keeps

- **Isolation.** Each lab has its own configuration type, its own presets and its own runs. The only shared
  resource is the read-only catalogue. Nothing a lab does changes another lab.
- **Immutability.** A run snapshots the box, the algorithm, the rigs, the sizes, the seed and the catalogue items
  it used. Editing a configuration afterwards never changes an earlier run.
- **Reproducibility.** Same snapshot and same seed give identical results. All randomness inside a run comes from
  one seeded generator.
- **Honesty is a setting.** Provably fair can be on, off, bypassed or rigged. Honest, vendor-style and cheating
  versions of the same box are compared on the same metrics.
- **Everything documented.** A scheme, mapping, rig, agent policy or battle mode is not selectable until it has a
  registry entry; the Docs page is generated from the registry.
- **Ethics.** Rigs run only against this engine. Nothing connects to a live operator.

## Adding things

- **A scheme:** add it to `SCHEMES` in `src/engine/schemes.ts` (commit, newServerSeed, digest, messageLayout,
  nativeMapping) and a `SCHEME_DOCS` entry in `src/engine/labs/registry.ts`. The verifier and the algorithm
  panel pick it up.
- **A mapping:** add a case to `mapTicket` in `src/engine/mapping.ts` and a `MAPPING_DOCS` entry.
- **A rig:** add its key to `RigConfig` in `types.ts`, implement it in `opener.ts` (or a lab runner), and add a
  `RigDoc` in `rigs.ts` with params, labs and detection notes. The rig panel renders it.
- **A lab:** add config and result types, a runner under `src/engine/labs/`, a case in `runLab`, an entry in
  `LAB_DOCS`, a page under `src/app/labs/`, and a nav item.

Every addition also gets a row in the research tracker (`research/00-tracker.md` in the parent workspace).

## Deployment

- **Vercel.** Import the repository; the framework preset is Next.js and the defaults work (`npm run build`,
  Node 20 or later). Phase 1 needs no environment variables: everything runs in the browser.
- **Phase 2 (Supabase).** `.env.example` lists the variables the app will read once shared history and logs
  are wired in. `.env*` files are ignored by git, so set them in the Vercel project settings, not in the
  repository. Only variables prefixed `NEXT_PUBLIC_` reach the browser; the anon key is designed to be public and
  is protected by row-level security on the database side.

## Known limits of phase 1

- Runs are in the browser: a few million opens take a minute or more. Server runs for large N arrive in phase 2.
- History is per browser (IndexedDB). Clearing site data clears it. Export runs you want to keep.
- Agent behaviour in the Sell-back and Retention labs is an explicit assumption, labelled in the UI; none of it
  comes from data yet.
- The catalogue is a file. Editing items and item versioning arrive with Supabase.
