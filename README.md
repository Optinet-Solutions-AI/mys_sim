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

## What is in it (phase 1, wave 1: the vendor's features)

Every lab follows one pattern: you land on the **test page** and can play at once; the **cog** (Settings)
holds all configuration in sections (run size and seed, box and items, algorithm, rigs, accounts or population);
the summary chips under the title open the matching section; **Run simulation** produces the statistics, which
appear below the test page. Live opens and simulations share the same engine, rigs and verifier.

| Route | What it does |
|---|---|
| `/` | Hub: the four labs, how to use them, the wave roadmap |
| `/labs/mystery-box` | Test page: open a pack with a reveal reel, see the item and its proof (verifier result), open ×10 or ×100, session tally, box contents, recent pulls. Settings: box builder with the RTP solver or manual percentages, algorithm, rigs, account mix, run size. Results: realized RTP with standard error at three price layers, chi-square against stated odds, proof verification, detector, bias map, payout histogram, per-item table, sample of opens with proof fields |
| `/labs/sellback` | Test page: a wallet walkthrough (deposit, open, sell back or ship, withdraw under the chosen rule, auto-play a session) next to the operator's view of the same money. Settings: economy rules, agent population, box, algorithm, rigs. Results: hold, GGR, sell-back and ship rates, ruin, bankroll percentiles |
| `/labs/battles` | Test page: an arena with human and bot seats, played round by round, winner and pot, session tally against the fair win rate. Settings: mode (normal, crazy, group, terminal, jackpot), players, bots, boxes per round, algorithm, rigs, run size. Results: wager multiplier, realized edge, human win rate against the equal-odds expectation, pot distribution |
| `/labs/retention` | Test page: the offer as a visitor sees it (daily box, races, affiliate) and the horizon. Settings: visitors and days, incentives, missions, free entry route, spend cap, visitor model, box, algorithm, rigs. Results against a control run on the same seed: retention curves, bonus cost, incremental wager per bonus dollar, LTV, hold after bonuses |
| `/labs/credits` | Misty's two-stage economy. Test page: open the box, collect credits, watch the draw fill, see what a credit is really worth, force the draw date. Settings: ticket pool, face value, prize, draw rule, free-entry share, spend cap, disclosed EV. Results: nominal return with credits at face against the end-to-end return, real value of a credit, prizes to free entrants, hold |
| `/labs/upgrader` | Upgrader (Jemlit, Cases.gg) and the vendor's Deals as one two-outcome box. Test page: pick the target, set the stake or the chance, roll on the win-zone bar with a bankroll. Settings: mode, stated edge, chance cap, value layer, agents and ladder policy. Results: win rate against the stated chance, realized edge against the stated edge, ruin |

**Draw models and presets.** The box builder offers three draw models: weighted odds (every case site; RTP solver, manual percentages, guaranteed-tier mix, pity ceiling, value floor, price from EV), finite drop (IcyBox, kuji, lucky bags; copies drawn without replacement, retirement rules, Last One prize) and tier-first (StockX; tier odds, operator-picked item, finite inventory that delists the box). Presets in the Mystery Boxes lab include the reconstructed operator tables (Jemlit Apple eBox, Misty Timepiece Suite and Penthouse, Cases.gg Pack Up, rebuilt to the documented metrics in `src/engine/captured.ts`), IcyBox, StockX, Courtyard, Glass Box lucky bag, kuji, pity, secret item, and the presentation rigs. Sell-back presets reproduce IcyBox (undisclosed buyback estimate, decision window with auto-sell, keep fees), StockX (expiring credit, five-minute window then charged and shipped), Courtyard (FMV cash, seven-day window, guaranteed-value floor), Cases.gg vault and creator packs.
| `/catalog` | 48 fictional luxury items with retail, asking and realized prices and placeholder icon tiles |
| `/runs`, `/runs/[id]` | Saved runs (IndexedDB), compare two runs of the same lab, export JSON or a Markdown report |
| `/verify` | The engine's verifier as a tool: recompute commitment, digest and ticket from seeds; verify a pasted record |
| `/docs` | Generated from the registry: schemes, mappings, randomness sources, odds models, agent policies, battle modes, rigs, principles |

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
