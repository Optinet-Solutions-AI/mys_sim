import type { LabId } from "@/engine/types";

export const LAB_DOCS: Record<LabId, { title: string; wave: string; short: string; what: string; configure: string[]; read: string[]; source: string }> = {
  "mystery-box": {
    title: "Mystery Boxes",
    wave: "Wave 1 · vendor feature",
    short: "Open packs; test odds, return and proofs under any algorithm or rig.",
    what: "One box opened N times. The core experiment: do the stated odds hold, what does the box really return at each price layer, and does the proof reproduce the item.",
    configure: [
      "Items and odds: pick catalogue items; set the RTP knob (the vendor's default is 90% on listed value) or enter percentages by hand.",
      "Value layer: which price counts as the payout. The vendor uses listed (retail) value; the Glass Box uses realized value.",
      "Algorithm: the commitment scheme, the ticket mapping, the randomness source, seed rotation, and whether the player sets a client seed.",
      "Rigs: any of the documented manipulations, switched on individually.",
      "Accounts: shares of opens by tag, so per-account rigs and cohort detection can be tested.",
    ],
    read: [
      "Realized RTP with its standard error against the stated RTP, at all three price layers.",
      "Chi-square test of observed versus stated odds; per-item deviation in standard deviations.",
      "Proof verification on a sample; the detector's findings and what each one is consistent with.",
      "Ticket-region bias map; payout distribution; operator-side counters (rotations, rerolls, grinds) that the public never sees.",
    ],
    source: "Vendor demo (dossier 2 §3.5); operator audits (dossier 1 §1 to §2.5); odds engine (dossier 4 §2).",
  },
  sellback: {
    title: "Sell-back / Cart",
    wave: "Wave 1 · vendor feature",
    short: "Deposit, open, sell back or ship; measure hold, ruin and what ever leaves.",
    what: "Agents deposit, open, and either ship an item or sell it back into their balance and bet again. Measures what the vendor called 'the economy': hold, sell-back rate, how many items ever ship, and how fast agents go bust.",
    configure: [
      "Sell-back rule: the vendor's (credited at displayed value, stays as balance) or cash at a chosen price layer with a haircut.",
      "Withdrawal rule: cash allowed, or the vendor's 'only through items' after wagering.",
      "Population: deposit size and spread, sessions, opens per session, ship threshold, re-bet fraction, lifetime deposit budget, cash-out target.",
    ],
    read: [
      "Hold as a share of deposits; GGR; sell-back and ship rates (the vendor says 99.9% and about 200 orders a month).",
      "Ruin fraction and sessions to ruin; bankroll percentiles over sessions.",
      "Money that actually left the system; extra wagering forced by withdraw-through-items.",
    ],
    source: "Vendor demo (dossier 2 §3.5): 99.9% sold back, hold 15 to 30% of deposits, withdraw only through items.",
  },
  battles: {
    title: "Battles",
    wave: "Wave 1 · vendor feature",
    short: "Play battles against bots in five modes; measure edge and win rates.",
    what: "Several players open the same boxes; a mode decides who takes the pot. Bots fill empty seats and can be given better odds. The vendor says battles are 90% of all wagering because the bet is the sum of all boxes.",
    configure: [
      "Boxes in the battle (each configured like a Mystery Box), number of players, humans per battle, bots on or off.",
      "Mode: Normal (highest total wins), Crazy (lowest wins), Group (pot split), Terminal (last round decides), Jackpot (winner drawn proportional to total).",
      "Rigs: favoured bots, plus any box-level rig.",
    ],
    read: ["Wager multiplier against a single open; realized house edge; human win rate against the equal-odds expectation; pot distribution."],
    source: "Vendor demo (dossier 2 §3.5): battle flow, bots as the house, 90% of GGR.",
  },
  retention: {
    title: "Retention",
    wave: "Wave 1 · vendor feature",
    short: "Daily boxes, races and affiliates against a control run; what they buy and cost.",
    what: "Visitor agents decide each day whether to come back. Daily free boxes that expire, wager races with prizes, and affiliate bonuses lift the visit probability. A control run with incentives off, on the same seed, measures the uplift and what it costs.",
    configure: [
      "Daily box tiers and the expiry rule (24-hour no-stacking, as the vendor built it, or stacking).",
      "Races: cadence and prize ladder. Affiliate: referred share, free boxes, commission.",
      "Visitor model: base visit probability, incentive lift, race lift, churn hazard after a losing day, deposit and opens per visit. All assumptions, labelled as such.",
    ],
    read: ["Retention curves against control; bonus cost; incremental wager per bonus dollar; LTV; hold after bonuses; wager concentration in races."],
    source: "Vendor demo (dossier 2 §3.5): daily boxes with 24-hour expiry, leaderboards, affiliate codes, bonus cost equals the drop value.",
  },
};
