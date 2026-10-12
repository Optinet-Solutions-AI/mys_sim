// Rigging toolkit metadata. The behaviour lives in the lab engines; this file documents each rig for the docs pages
// and the detector, and provides the plain list used by the UI.
import type { LabId, RigConfig } from "./types";

export interface RigDoc {
  id: keyof RigConfig;
  name: string;
  summary: string;
  mechanism: string;
  source: string;
  verificationShows: string;
  detection: string;
  params: { key: string; label: string; min?: number; max?: number; step?: number; defaultValue: number | string }[];
  labs: LabId[];
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
    labs: ["mystery-box", "sellback", "battles", "credits", "upgrader"],
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
    labs: ["mystery-box", "sellback", "battles", "credits", "upgrader"],
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
    labs: ["mystery-box", "sellback", "battles", "credits", "upgrader"],
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
  {
    id: "earlyRetire",
    name: "Retire the drop early (IcyBox)",
    summary: "A finite drop is ended once enough of it has sold while its top items are still inside, and a fresh drop starts. Buyers paid for odds that included a grail nobody could ever win.",
    mechanism:
      "On a pool box, when the sold fraction reaches atFraction and any copy worth at least grailMultiple times the price remains, the pool is reset. With the pool rule 'operator may retire' those copies vanish; with 'must distribute' they are awarded to past buyers at retirement, which is the Glass Box rule.",
    source: "IcyBox terms: a box may be 'terminated or removed at any time even before all Assets included in the Icebox are distributed (including any grail)' (dossier 1 §2.4).",
    verificationShows: "Passes: every draw was honest against the pool as it stood.",
    detection: "Realized return below the stated return of the drop; count of drops retired against drops completed; no grail in the public pull history.",
    params: [
      { key: "atFraction", label: "Retire once this fraction is sold", min: 0.1, max: 0.99, step: 0.01, defaultValue: 0.7 },
      { key: "grailMultiple", label: "...if an item worth at least this × price remains", min: 1, max: 1000, step: 1, defaultValue: 20 },
    ],
    labs: ["mystery-box", "sellback"],
  },
  {
    id: "secretItem",
    name: "Secret item (Pop Mart)",
    summary: "An item that is not on the displayed table takes a slice of the most common item's tickets. Players chase it; proofs fail on exactly those draws.",
    mechanism: "The draw table is the displayed table with the secret inserted right after the most common item, so no other range moves. The displayed table does not list it. An honest verifier that uses the displayed table reports an item mismatch whenever the secret drops.",
    source: "Pop Mart blind boxes: a 'secret' edition at 1 in 144 whose identity is not disclosed (dossier 2 §3.2).",
    verificationShows: "Fails on secret draws only; passes on everything else.",
    detection: "Observed items not on the stated table; proof failures clustered on one item.",
    params: [
      { key: "itemId", label: "Secret item id", defaultValue: "a-hermine-scarf" },
      { key: "percent", label: "Share of opens (percent)", min: 0.01, max: 10, step: 0.01, defaultValue: 0.69 },
    ],
    labs: ["mystery-box"],
  },
  {
    id: "ldwCelebration",
    name: "Losses disguised as wins (presentation)",
    summary: "Every drop below the price gets the full win celebration. The player sees a win while losing money.",
    mechanism: "Presentation only: the result card celebrates any drop, not just drops worth at least the price. Odds, payouts and proofs do not change.",
    source: "Slot machine research on losses disguised as wins (Dixon et al. 2010); credit and filler items celebrated on case sites and in the vendor demo.",
    verificationShows: "Passes.",
    detection: "Invisible in outcome data; a presentation audit comparing celebrations with payouts against the price.",
    params: [],
    labs: ["mystery-box"],
  },
  {
    id: "fakeLiveFeed",
    name: "Fabricated live-drops feed (presentation)",
    summary: "A ticker of other players winning top items, generated by the site rather than by real opens.",
    mechanism: "Presentation only: the stage shows a feed of bot wins at the configured rate, drawn from the box's most valuable items regardless of their odds.",
    source: "Standard on case and pack sites; Jemlit's own feed in the captured HTML was dominated by credits worth $0.02 to $0.35 (dossier 1 §2.2).",
    verificationShows: "Passes.",
    detection: "Compare the feed's win rate for top items with their stated odds times a plausible open rate.",
    params: [{ key: "grailsPerMinute", label: "Top-item wins shown per minute", min: 0.1, max: 60, step: 0.1, defaultValue: 6 }],
    labs: ["mystery-box"],
  },
  {
    id: "ticketsAwayMessage",
    name: "'You were N tickets away' (presentation)",
    summary: "After a loss, the player is told how close the ticket was to a big item. True, and misleading: every ticket is equally likely.",
    mechanism: "Presentation only: the result card shows the distance from the drawn ticket to the nearest range of an item worth at least ten times the price.",
    source: "Near-miss framing in slot and lottery presentation; 'so close' messages on case sites.",
    verificationShows: "Passes.",
    detection: "Presentation audit.",
    params: [],
    labs: ["mystery-box"],
  },
  {
    id: "demoOdds",
    name: "Demo spins at different odds (presentation)",
    summary: "Free demo opens draw from a table at a higher return than the paid game.",
    mechanism: "The stage offers a Demo switch. In demo mode opens are drawn from a table re-solved at demoRtp and cost nothing; the paid table is unchanged.",
    source: "Cases.gg demo spins; a long-standing concern in social casino and slot demo modes.",
    verificationShows: "Not applicable to demo spins; paid spins pass.",
    detection: "Compare demo and paid return over many opens.",
    params: [{ key: "demoRtp", label: "Demo RTP", min: 0.5, max: 3, step: 0.05, defaultValue: 1.6 }],
    labs: ["mystery-box"],
  },
  {
    id: "urgency",
    name: "Urgency cues (presentation)",
    summary: "Countdown, 'only N left' and 'N people viewing' around the open button.",
    mechanism: "Presentation only: the stage shows the cues with the configured numbers. They are not tied to anything real.",
    source: "IcyBox drops ('once they're gone, they're gone'), limited-time boxes on case sites, StockX's five-minute decision timer.",
    verificationShows: "Passes.",
    detection: "Presentation audit: check the counters against real inventory and traffic.",
    params: [
      { key: "stockLeft", label: "Stock left shown", min: 1, max: 999, step: 1, defaultValue: 12 },
      { key: "viewers", label: "Viewers shown", min: 1, max: 9999, step: 1, defaultValue: 38 },
      { key: "countdownMinutes", label: "Countdown (minutes)", min: 1, max: 1440, step: 1, defaultValue: 14 },
    ],
    labs: ["mystery-box"],
  },
];

export const RIG_BY_ID = new Map(RIGS.map((r) => [r.id, r]));
