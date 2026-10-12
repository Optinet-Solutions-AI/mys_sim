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
  credits: {
    title: "Credits & draws",
    wave: "Wave 3 · Misty",
    short: "Box pays credits, credits are draw tickets; measure the nominal and the real return.",
    what: "Misty's two-stage economy. The box pays mostly credits; each credit is a ticket in a draw with a fixed pool for one prize. The box page values credits at face, so the nominal return looks generous; the real value of a ticket is the prize divided by the pool and depends on sell-through. The lab runs both stages on the same agents and reports both returns.",
    configure: [
      "The box (the reconstructed Misty Timepiece Suite by default) and its algorithm and rigs.",
      "The draw: ticket pool, credit face value, prize item, draw rule (when sold out, or on schedule regardless of sell-through), free-entry share, Omaze-style spend cap, disclosed expected value.",
      "Agents and opens per agent.",
    ],
    read: ["Nominal return with credits at face against the end-to-end return; the real value of one credit; prizes that went to free entrants; operator hold across both stages; unsold share at each draw."],
    source: "Dossier 1 §2.1 (Misty): credits as entries, 100,000-ticket pools, free postal entry with equal odds, drawn on the date regardless of sell-through.",
  },
  upgrader: {
    title: "Upgrader & Deals",
    wave: "Wave 3 · Jemlit, Cases.gg, vendor",
    short: "Stake money for a chance at a better item; measure the edge and how fast the ladder ruins.",
    what: "The Upgrader (Jemlit, Cases.gg) and the vendor's Deals are the same mechanic seen from two sides: stake an amount for a chance at an item at proportional odds minus the edge, or pick the chance and pay the price it implies. Built as a two-outcome box, so every scheme, rig and the verifier apply. Agents follow a ladder policy and the lab measures the realized edge against the stated one and the ruin rate.",
    configure: ["Mode (Upgrader or Deals), stated edge, the chance cap (the vendor caps Deals at 80%), the target item and value layer, the stake or the chosen chance, the algorithm and rigs (a table swap here is a hidden edge).", "Agents, bankroll, attempts, policy (single attempt or ladder until won or bust)."],
    read: ["Win rate against the stated chance; realized edge against the stated edge; ruin fraction and median attempts to ruin; how many agents reached the target; proof verification."],
    source: "Dossier 1 §2.2 and §2.3 (Jemlit and Cases.gg Upgrader at a 10% edge); vendor demo (Deals: pick an item, choose a chance up to 80%, price scales).",
  },
};
