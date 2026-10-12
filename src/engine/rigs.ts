// Rigging toolkit metadata. The behaviour lives in the lab engines; this file documents each rig for the docs pages
// and the detector, and provides the plain list used by the UI.
import type { RigConfig } from "./types";

export interface RigDoc {
  id: keyof RigConfig;
  name: string;
  summary: string;
  mechanism: string;
  source: string;
  verificationShows: string;
  detection: string;
  params: { key: string; label: string; min?: number; max?: number; step?: number; defaultValue: number | string }[];
  labs: ("mystery-box" | "sellback" | "battles" | "retention")[];
}

export const RIGS: RigDoc[] = [
  {
    id: "bypass",
    name: "Bypass the commitment",
    summary: "A commitment is published, but the result is chosen from a hidden table and the proof is fabricated.",
    mechanism:
      "The displayed server hash is real, but the item is drawn from a hidden table at a lower RTP. The proof fields are the honest ones, so recomputing them gives a different item than the one awarded.",
    source: "Thesis control case; what any site can do if nobody verifies.",
    verificationShows: "Fails for every open that is actually checked. Passes for everyone who never checks.",
    detection: "Verify a sample of opens. One failure is proof.",
    params: [{ key: "hiddenRtp", label: "Hidden RTP", min: 0.1, max: 1.2, step: 0.01, defaultValue: 0.6 }],
    labs: ["mystery-box", "sellback", "battles"],
  },
  {
    id: "tableSwap",
    name: "Table swap",
    summary: "The odds shown to players are not the odds used to draw.",
    mechanism:
      "The box page displays the configured table. The draw uses a table re-solved at a hidden RTP. The commitment covers only the seed, so every proof verifies.",
    source: "Dossier 1 loophole 1; Richard Lewis's case-site coder: weights entered then erased.",
    verificationShows: "Passes if the operator's own tool uses the hidden table. An independent verifier that uses the displayed odds fails on the fraction of tickets where the two tables disagree, which is itself a detection.",
    detection: "Independent verification against the displayed table; chi-square of observed versus stated odds; realized RTP below stated.",
    params: [{ key: "hiddenRtp", label: "Hidden RTP", min: 0.1, max: 1.2, step: 0.01, defaultValue: 0.75 }],
    labs: ["mystery-box", "sellback", "battles"],
  },
  {
    id: "perAccount",
    name: "Per-account odds",
    summary: "Tagged accounts (streamers, VIPs, bots) draw from a different table.",
    mechanism: "Opens by accounts carrying the tag use a table re-solved at the tag's RTP; everyone else uses the displayed table.",
    source: "CSGO Diamonds admission (2016); CSGOShuffle logs (2016).",
    verificationShows: "Passes.",
    detection: "Compare outcome distributions by account tag; streamer cohorts with realized RTP far above the rest.",
    params: [
      { key: "tag", label: "Account tag", defaultValue: "streamer" },
      { key: "rtp", label: "RTP for tagged accounts", min: 0.1, max: 3, step: 0.01, defaultValue: 1.6 },
    ],
    labs: ["mystery-box"],
  },
  {
    id: "cheapestTwo",
    name: "Cheapest-two mode",
    summary: "Only the two cheapest items are ever paid, whatever the table says.",
    mechanism: "Every draw lands on one of the two lowest-value items, split by their relative weights.",
    source: "Richard Lewis's case-site coder: 'a mode that preemptively gives the two cheapest skins from any case every time'.",
    verificationShows: "Passes when the proof is fabricated to match (combine with Bypass) or fails if checked honestly.",
    detection: "Top items never observed; chi-square collapses immediately.",
    params: [],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "serverChosenClientSeed",
    name: "Server-chosen client seed (grinding)",
    summary: "The operator generates the player's 'client seed' and tries several until the outcome is cheap.",
    mechanism:
      "When the honest result is expensive (payout at or above a multiple of the price), the operator tries up to k alternative client seeds and keeps the first cheap one. The chosen client seed appears in the proof, so it verifies.",
    source: "Zealynx audit of Fair Casino, finding F-2026-0003 (January 2026).",
    verificationShows: "Passes.",
    detection:
      "Only players who set their own client seed are immune; compare realized RTP between site-default and player-set cohorts.",
    params: [
      { key: "attempts", label: "Seeds tried per open", min: 2, max: 50, step: 1, defaultValue: 5 },
      { key: "thresholdMultiple", label: "Only when payout ≥ price ×", min: 1, max: 100, step: 0.5, defaultValue: 3 },
    ],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "commitAfterClient",
    name: "Commit after seeing the client seed",
    summary: "The server picks its seed after the client seed is known, trying several.",
    mechanism:
      "When the honest result is expensive, the operator generates up to k server seeds after reading the client seed, keeps the first cheap one, and publishes that seed's hash as if it had been committed earlier.",
    source: "Zealynx audit of Fair Casino, finding F-2026-0004 (January 2026).",
    verificationShows: "Passes.",
    detection: "Timing and log analysis; statistical tilt against stated odds.",
    params: [
      { key: "attempts", label: "Server seeds tried per open", min: 2, max: 50, step: 1, defaultValue: 5 },
      { key: "thresholdMultiple", label: "Only when payout ≥ price ×", min: 1, max: 100, step: 0.5, defaultValue: 3 },
    ],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "rotationOnWins",
    name: "Seed rotation on wins (reroll)",
    summary: "When the pending result is expensive, the operator rotates the seed and draws again.",
    mechanism:
      "If the payout exceeds a multiple of the box price, the server seed is 'rotated' and the open is recomputed, up to a maximum number of rerolls. Each individual proof verifies.",
    source: "Dossier 1 loophole 3; UK RTS 7B forbids discarding RNG output.",
    verificationShows: "Passes per round.",
    detection: "Count rotations and aborted rounds against outcomes; rotation rate correlated with big items.",
    params: [
      { key: "thresholdMultiple", label: "Reroll if payout ≥ price ×", min: 1, max: 100, step: 0.5, defaultValue: 5 },
      { key: "maxRerolls", label: "Max rerolls", min: 1, max: 10, step: 1, defaultValue: 3 },
    ],
    labs: ["mystery-box", "sellback", "battles"],
  },
  {
    id: "valuationInflation",
    name: "Valuation inflation",
    summary: "Displayed item values are inflated; payouts are not.",
    mechanism: "Every displayed value is multiplied by a factor. The displayed RTP rises; the realized RTP does not change.",
    source: "Vendor: 'list a Rolex for $11K, buy for $10K'; Misty credits at $1 face value; retail-basis values everywhere.",
    verificationShows: "Not a fairness question; passes.",
    detection: "Three-price comparison: displayed value against realized value.",
    params: [{ key: "factor", label: "Display multiplier", min: 1, max: 3, step: 0.05, defaultValue: 1.25 }],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "dynamicOdds",
    name: "Hidden dynamic odds",
    summary: "RTP drifts across the run without disclosure.",
    mechanism: "The table is re-solved continuously from a start RTP to an end RTP as the run progresses.",
    source: "FTC 2020 staff paper concern (odds that vary by player or time); compensated games banned by UK RTS 7A.",
    verificationShows: "Passes per round.",
    detection: "Drift tests over time windows; change in realized RTP between early and late opens.",
    params: [
      { key: "rtpStart", label: "RTP at start", min: 0.1, max: 1.5, step: 0.01, defaultValue: 1.0 },
      { key: "rtpEnd", label: "RTP at end", min: 0.1, max: 1.5, step: 0.01, defaultValue: 0.7 },
    ],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "midRunRtpChange",
    name: "Mid-run RTP change",
    summary: "The target RTP is lowered after launch.",
    mechanism: "At a fraction of the run the table is re-solved to a new RTP and used from then on.",
    source: "Vendor: RTP is configurable in the back office.",
    verificationShows: "Passes.",
    detection: "Change-point detection on realized RTP.",
    params: [
      { key: "atFraction", label: "Change at fraction of run", min: 0.05, max: 0.95, step: 0.05, defaultValue: 0.5 },
      { key: "newRtp", label: "New RTP", min: 0.1, max: 1.5, step: 0.01, defaultValue: 0.8 },
    ],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "favouredBots",
    name: "Favoured house bots",
    summary: "Bots in battles draw from a better table than humans.",
    mechanism: "Bot players use a table re-solved at the bot RTP; humans use the displayed table.",
    source: "Vendor: 'call the bots and basically play against the house'.",
    verificationShows: "Passes.",
    detection: "Bot win rate against the expectation for identical odds.",
    params: [{ key: "botRtp", label: "Bot RTP", min: 0.5, max: 3, step: 0.05, defaultValue: 1.3 }],
    labs: ["battles"],
  },
  {
    id: "selectiveDisclosure",
    name: "Selective disclosure",
    summary: "Seeds are revealed only on manual retire; most players never verify.",
    mechanism: "No change to the draw. The detector is told what fraction of players verify, which sets how many rigged opens would ever be caught.",
    source: "Cases.gg and Jemlit practice: verify only after retiring a seed, via an external tool.",
    verificationShows: "Passes for those who check.",
    detection: "Fraction of opens ever verified; the detector reports the expected number of caught failures under Bypass.",
    params: [{ key: "verifyFraction", label: "Fraction of players who verify", min: 0, max: 1, step: 0.01, defaultValue: 0.01 }],
    labs: ["mystery-box"],
  },
  {
    id: "nearMiss",
    name: "Near-miss reel (presentation)",
    summary: "Losing spins are shown stopping right beside a valuable item, and the reel strip shows rare items far more often than their odds. The draw itself is untouched.",
    mechanism:
      "After the ticket is drawn, the animation is built around it. With probability `rate`, a losing result gets a clear win (a medium or high value item, chosen so medium values appear as often as grails) placed beside the landing tile, and the reel decelerates naturally to a stop a few pixels from its edge: nothing moves after the stop. `showcase` flattens the sampling of the decoration strip so rare items scroll past constantly. Odds, payouts and proofs do not change.",
    source: "Slot-machine near-miss programming (Universal Distributing, Nevada 1989); case-site reels; the vendor demo's emphasis on the opening animation; near-miss research (Reid 1986; Clark et al. 2009).",
    verificationShows: "Passes. RTP, chi-square and every proof are identical with the rig on or off.",
    detection: "Invisible in outcome data. Only an audit of the presentation catches it: record where the pointer stops relative to top items and how often top items appear in the strip, and compare with the table. Regulated RNG games forbid it (Nevada since the 1989 Universal decision; UKGC RTS 7 requires the display to reflect the real odds).",
    params: [
      { key: "rate", label: "Share of losing spins dressed as near misses", min: 0, max: 1, step: 0.05, defaultValue: 0.5 },
      { key: "showcase", label: "Showcase: 0 = strip matches real odds, 0.9 = grails everywhere", min: 0, max: 0.9, step: 0.05, defaultValue: 0.6 },
    ],
    labs: ["mystery-box", "battles"],
  },
];

export const RIG_BY_ID = new Map(RIGS.map((r) => [r.id, r]));
