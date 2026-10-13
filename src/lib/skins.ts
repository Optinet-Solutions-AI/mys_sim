// Per-source looks and wording, so each operator's screens resemble its own product: palette, typography, the
// reveal motif (how an open is shown), the words used, and which operator panel sits beside the result.
// Inspired by the operators' public products; no logos or assets are copied.

export type Motif = "boxopen" | "reel" | "cardflip" | "packrip" | "tiers" | "ticket";

export interface SkinTerms {
  unit: string; // box, case, pack, drop, ticket, bag
  openCta: string; // "{price}" is replaced
  openedTitle: string;
  wonTitle: string;
  startBattle: string;
  sellBack: string;
  ship: string;
  balance: string;
}

export interface Skin {
  id: string;
  dark: boolean;
  font: "sans" | "serif";
  vars: Record<string, string>; // CSS variables overriding the theme inside the operator page
  motif: Motif;
  terms: SkinTerms;
  panel?: "icybox" | "stockx" | "courtyard" | "jemlit" | "cases" | "misty" | "glassbox" | "vendor";
  tagline: string;
}

const light = (accent: string, accentInk: string, accentSoft: string, paper: string, surface = "#ffffff", line = "#dfe4df") => ({
  "--color-accent": accent,
  "--color-accent-ink": accentInk,
  "--color-accent-soft": accentSoft,
  "--color-paper": paper,
  "--color-surface": surface,
  "--color-line": line,
  "--color-ink": "#16191d",
  "--color-ink-2": "#4a5560",
  "--color-ink-3": "#78838c",
  "--tip-bg": "#16191d",
  "--tip-fg": "#ffffff",
});
const dark = (accent: string, accentInk: string, accentSoft: string, paper: string, surface: string, line: string) => ({
  "--color-accent": accent,
  "--color-accent-ink": accentInk,
  "--color-accent-soft": accentSoft,
  "--color-paper": paper,
  "--color-surface": surface,
  "--color-line": line,
  "--color-ink": "#eceef4",
  "--color-ink-2": "#b6bcc9",
  "--color-ink-3": "#8089a0",
  "--color-good-soft": "#143d2a",
  "--color-warn-soft": "#3d2e10",
  "--color-bad-soft": "#3f1d1a",
  "--color-good": "#5fd38d",
  "--color-warn": "#f0b85a",
  "--color-bad": "#ff7b6e",
  "--tip-bg": "#f3f4f8",
  "--tip-fg": "#16191d",
});

const base: Omit<SkinTerms, "unit" | "openCta" | "openedTitle" | "wonTitle"> = { startBattle: "Start battle", sellBack: "Sell back", ship: "Ship it", balance: "Balance" };

export const SKINS: Record<string, Skin> = {
  vendor: {
    id: "vendor",
    dark: false,
    font: "sans",
    vars: light("#0f6b6b", "#0a5252", "#dbecea", "#f6f7f5"),
    motif: "boxopen",
    terms: { ...base, unit: "box", openCta: "Open box · {price}", openedTitle: "You got", wonTitle: "You won!" },
    panel: "vendor",
    tagline: "Evo Verse: white-label case site, as demoed",
  },
  icybox: {
    id: "icybox",
    dark: false,
    font: "serif",
    vars: light("#1f5fd0", "#173f8a", "#e4edfc", "#f4f7fc", "#ffffff", "#d9e1ef"),
    motif: "boxopen",
    terms: { unit: "drop", openCta: "Open drop · {price}", openedTitle: "Your drop", wonTitle: "Grail!", startBattle: "Start", sellBack: "Sell back to IcyBox", ship: "Keep it", balance: "Wallet" },
    panel: "icybox",
    tagline: "Luxury app: cards, drops, keep or sell back",
  },
  stockx: {
    id: "stockx",
    dark: false,
    font: "sans",
    vars: light("#0a6b3a", "#064a28", "#dff2e6", "#f6f6f6", "#ffffff", "#e3e3e3"),
    motif: "tiers",
    terms: { unit: "box", openCta: "Buy box · {price}", openedTitle: "Your item", wonTitle: "Top tier!", startBattle: "Start", sellBack: "Sell for StockX Credit", ship: "Keep it", balance: "Credit" },
    panel: "stockx",
    tagline: "Marketplace: tiers, floors, credit",
  },
  courtyard: {
    id: "courtyard",
    dark: false,
    font: "sans",
    vars: light("#c2410c", "#8a2d07", "#fde8dc", "#fbf6f1", "#ffffff", "#ead9cc"),
    motif: "packrip",
    terms: { unit: "pack", openCta: "Rip pack · {price}", openedTitle: "You pulled", wonTitle: "Hit!", startBattle: "Start break", sellBack: "Accept buyback", ship: "Ship from vault", balance: "Balance" },
    panel: "courtyard",
    tagline: "Collectibles: packs, public pulls, FMV",
  },
  jemlit: {
    id: "jemlit",
    dark: true,
    font: "sans",
    vars: dark("#f5c542", "#ffd966", "#3a3114", "#0f1320", "#171c2e", "#2a3148"),
    motif: "reel",
    terms: { unit: "box", openCta: "Open box · {price}", openedTitle: "You won", wonTitle: "You won!", startBattle: "Start battle", sellBack: "Exchange for credits", ship: "Ship item", balance: "Credits" },
    panel: "jemlit",
    tagline: "Case site: provably fair, credits, upgrader",
  },
  cases: {
    id: "cases",
    dark: true,
    font: "sans",
    vars: dark("#7c5cff", "#a894ff", "#241d4d", "#0b0e14", "#141924", "#232a3a"),
    motif: "reel",
    terms: { unit: "case", openCta: "Open case · {price}", openedTitle: "You unboxed", wonTitle: "Big win!", startBattle: "Start battle", sellBack: "Quick sell", ship: "Withdraw item", balance: "Balance" },
    panel: "cases",
    tagline: "Case site: edge disclosed, live drops, levels",
  },
  misty: {
    id: "misty",
    dark: false,
    font: "serif",
    vars: light("#b4236b", "#7f1849", "#fbe3ee", "#fdf5f9", "#ffffff", "#efd6e2"),
    motif: "ticket",
    terms: { unit: "box", openCta: "Tap to spin · {price}", openedTitle: "You pulled", wonTitle: "Grail!", startBattle: "Start", sellBack: "Trade in for Mistees", ship: "Ship it", balance: "Mistees" },
    panel: "misty",
    tagline: "Prize competitions: entries, draws, postal route",
  },
  glassbox: {
    id: "glassbox",
    dark: false,
    font: "sans",
    vars: light("#0f6b6b", "#0a5252", "#dbecea", "#f2f7f6", "#ffffff", "#cfe0dc"),
    motif: "boxopen",
    terms: { unit: "box", openCta: "Open · {price}", openedTitle: "You got", wonTitle: "You won", startBattle: "Open together", sellBack: "Cash out", ship: "Ship it", balance: "Cash" },
    panel: "glassbox",
    tagline: "Our design: everything shown before you open",
  },
  adjacent: {
    id: "adjacent",
    dark: false,
    font: "sans",
    vars: light("#6b4f2a", "#4a3519", "#efe4d4", "#faf6f0", "#ffffff", "#e6dccc"),
    motif: "boxopen",
    terms: { unit: "box", openCta: "Open · {price}", openedTitle: "You got", wonTitle: "You won", startBattle: "Start break", sellBack: "Sell", ship: "Keep", balance: "Balance" },
    tagline: "Retail chance formats",
  },
  presentation: {
    id: "presentation",
    dark: true,
    font: "sans",
    vars: dark("#ff6a3d", "#ff9a7a", "#4a1f12", "#121014", "#1c181f", "#2e2833"),
    motif: "reel",
    terms: { ...base, unit: "box", openCta: "Open box · {price}", openedTitle: "You got", wonTitle: "WIN!" },
    tagline: "The theatre around the draw",
  },
};

/** Some features open differently from the rest of their source. */
export const MOTIF_BY_FEATURE: Record<string, Motif> = {
  kuji: "ticket",
  omaze: "ticket",
  popmart: "boxopen",
  fukubukuro: "boxopen",
  gacha: "boxopen",
  "glass-luckybag": "boxopen",
};

export function skinFor(operatorId: string): Skin {
  return SKINS[operatorId] ?? SKINS.vendor;
}

/** Plain-language explanation of the settings every feature shares. */
export const SETTINGS_PLAIN: { title: string; text: string }[] = [
  { title: "How a draw works", text: "Picture 100 million numbered tickets in a hat. Every item owns a block of tickets sized by its odds: an item at 1% owns a million tickets, an item at 0.0001% owns a hundred. One ticket is drawn and whichever block it lands in is what you get." },
  { title: "Provably fair, in one breath", text: "Before you open, the site writes down a secret number and shows you only its fingerprint (a hash). Your open mixes that secret with a number of yours and a counter. Later the site reveals the secret, you check the fingerprint matches, and you redo the mixing yourself to confirm the ticket. It proves the dice were not changed after you bet. It says nothing about whether the odds table or the prices were honest." },
  { title: "Server seed, client seed, nonce", text: "The site's secret number, your number, and a counter that goes up by one each open so every open is different even with the same seeds." },
  { title: "Ticket mapping", text: "The mixing produces a huge number; the mapping squeezes it down to a ticket number. Done carelessly (taking a small slice and using the remainder) some tickets come up slightly less often than others. Done properly every ticket is equally likely." },
  { title: "Seed rotation", text: "How often the site changes its secret. One secret for a whole run means you cannot check any open until the run ends; a fresh secret every open, revealed immediately, lets you check at once." },
  { title: "Commitment scheme", text: "The particular recipe a site uses for the fingerprint and the mixing. Each one in the list is a real operator's recipe, reproduced exactly, plus ours." },
  { title: "RTP (return to player)", text: "For every $100 put in, how much comes back on average. The catch is at which price: the operator usually counts at shop price (retail), which flatters the number. The lab shows it at retail, at asking price and at what items actually sell for (realized)." },
  { title: "Value layers", text: "Retail is the boutique price. Asking is what resellers list items for. Realized is what items actually sell for. Operators show one; the lab shows all three." },
  { title: "The RTP knob and the odds table", text: "The vendor sets a target return and software spreads the odds across the items to hit it, usually piling tickets on the cheap items. You can do the same with the slider, or type percentages by hand." },
  { title: "Rigs", text: "Switches that make the simulator cheat the way the research found operators can: swap the table behind the proof, reroll big wins, favour certain accounts, retire a drop early, dress losses up as near misses. Turn one on, run, and see what the proofs and the statistics catch. They only ever act inside the simulator." },
  { title: "Agents", text: "Every player is a simulated agent with a simple rule book: how much it deposits, how often it comes back, when it ships an item. The rules are assumptions until data replaces them, and every number is editable." },
  { title: "Seed (of the simulation)", text: "Not a casino seed. A number that makes a run repeatable: same settings and same seed give the exact same results, so a finding can be reproduced." },
  { title: "The detector", text: "An outsider's view of a finished run: do the proofs check out, do the observed odds match the stated ones, does the return match, do account groups differ, and which cheats each finding is consistent with." },
];

/** Plain-language guides per feature: how it feels as a player, and what the settings mean. */
export const GUIDES: Record<string, { player: string[]; settings: string[] }> = {
  "vendor-boxes": {
    player: ["You pick a box with a price and a list of items with their odds. You pay, a reel spins, it stops on an item, and that item is credited to your account at the value the site shows.", "Most of the time you get something worth less than you paid; occasionally a bigger item. The site shows the return as 90% of listed value, which is the vendor's default.", "There is no proof to check: the site simply tells you what you got."],
    settings: ["Box & items: which items are inside and their odds. The RTP slider spreads the odds to hit a target return at the chosen price layer.", "Algorithm: the vendor publishes nothing, so the default is 'no commitment'. Switch a scheme on to see what a provably-fair version would prove.", "Rigs and accounts: research switches; see the shared explainer below."],
  },
  "vendor-sellback": {
    player: ["You deposit money, open boxes, and each item you win can be sold back instantly for site balance at its shown value, then bet again.", "Balance cannot be withdrawn as money. The only way anything leaves is to win an item worth enough and ship it.", "The site's own numbers: 99.9% of items get sold back; the site keeps 15 to 30% of all deposits."],
    settings: ["Economy rules: the haircut on sell-back and whether withdrawal is cash or only through items.", "Agents: how much the simulated players deposit, how often they play, when they ship, when they stop.", "Run gives the hold (how much of deposits never leaves), ruin (how many players go bust) and the ship rate."],
  },
  "vendor-battles": {
    player: ["Two to eight players open the same boxes at the same time. Whoever pulls the highest total (or the lowest, in crazy mode) takes everything.", "Empty seats are filled by bots, which means you are playing against the house.", "The bet is the price of all the boxes together, so battles move much more money than single opens."],
    settings: ["Battle: mode, players, bots, and the boxes per round.", "Rigs include 'favoured bots', which quietly gives the house seats better odds.", "Run gives the house edge, how often humans win against the fair rate, and the pot sizes."],
  },
  "vendor-retention": {
    player: ["A free box every day that disappears if you miss a day, leaderboards that pay the biggest spenders, and invite codes with free boxes and commission.", "Each one is a reason to come back and spend a little more."],
    settings: ["Incentives: the daily box tiers and expiry, race cadence and prizes, affiliate terms.", "Visitor model: how likely a simulated visitor is to come back, deposit and play; all assumptions.", "Run compares against the same visitors with every incentive switched off, so you see what the incentives buy and cost."],
  },
  "vendor-deals": {
    player: ["Pick an item you want and choose your chance of winning it, up to 80%. The price goes up with the chance.", "The chance is a green zone on a wheel. You can drag the zone anywhere around the wheel; a needle spins and slows down, and if it stops inside the zone you win. The needle starts each spin from where it last stopped.", "Moving the zone changes nothing: the roll is read relative to where the zone sits, so the odds are the same wherever you put it.", "Win and you get the item; lose and the money is gone."],
    settings: ["Terms: the item, the chance, the cap and the stated edge, which decides how much more than fair the price is.", "Agents: a bankroll and whether they keep trying.", "Run gives the real win rate, the real edge and how many players go bust."],
  },
  "icybox-drops": {
    player: ["A drop is a limited run: a fixed number of cards, one grail among them. You buy a card and flip it.", "Because cards are not replaced, the odds change as the drop sells. Once they're gone, they're gone.", "Nothing is published to check the draw, and the terms allow a drop to be ended before the grail is ever handed out."],
    settings: ["Box & items: copies of each item in the drop. Odds are copies left over copies in total.", "Retirement rule: whether a drop can be ended early and whether leftover top items must be distributed.", "The early-retirement rig ends the drop once most of it has sold while the grail is still inside."],
  },
  "icybox-buyback": {
    player: ["After a flip you keep the item or sell it back. The offer is an estimate the app sets and does not explain.", "You have a limited time to decide; after that it is sold back automatically.", "Keeping costs sales tax, insurance and premium shipping on top."],
    settings: ["Options: the estimate as a share of real value, the window and how many miss it, the keep fees.", "Agents: deposits, how often they play, when they would rather keep.", "Run gives how much value ever leaves as goods and how much the window and fees push back to the operator."],
  },
  "stockx-box": {
    player: ["You pick a box size. The odds are shown per tier, not per item, and are the same for everyone.", "The draw lands on a tier; the item inside comes from what is in stock. Every item is worth at least the box price before fees.", "If a tier runs out, the box is taken down."],
    settings: ["Box & items: tiers, their odds, their items, and optional inventory per item.", "Floor: the rule that every item is worth at least the price.", "Run shows the return at list and real prices, and how soon finite inventory delists the box."],
  },
  "stockx-credit": {
    player: ["Keep the item or sell it back instantly for up to 90% of its list value as store credit.", "Credit cannot be withdrawn and expires after a year. You have five minutes to decide, otherwise you are charged and shipped."],
    settings: ["Options: the credit haircut, expiry, and the five-minute window with the share who miss it.", "Run gives breakage (credit that expires unused) and what the short window does to keep and sell decisions."],
  },
  "courtyard-pack": {
    player: ["A pack is priced at the average value of what is inside, so on average you get back what you pay. Odds are exact per card.", "You rip the pack, the card appears, and your pull is added to a public log anyone can read."],
    settings: ["Box & items: the odds, with the price set from expected value.", "Public log: every pull visible to outsiders, so the odds can be checked by anyone over all pulls.", "Run shows the return hovering around 100% and what an outsider could audit."],
  },
  "courtyard-buyback": {
    player: ["After a pull you can accept a buyback at fair market value, which ignores what you paid, with seven days to decide; or vault it for free; or ship it.", "Guaranteed-value codes promise a minimum buyback."],
    settings: ["Options: the buyback discount, the seven-day window, the guaranteed floor.", "Run gives hold under an honest cash buyback with a long window, and the floor top-ups paid."],
  },
  "jemlit-ebox": {
    player: ["A box with Apple products. Ten headline items sit at one in a million; most opens pay a case, a sticker or a few credits.", "Before you open you see a fingerprint of the site's secret; afterwards you can reveal the secret and check the draw with Jemlit's published recipe."],
    settings: ["Box & items: the captured table, locked to the published odds (unlock to experiment).", "The 'guaranteed' preset applies Jemlit's 40% mix: four opens in ten come from items worth at least $19.", "Run checks the draw against Jemlit's recipe and shows the return at listed and cashback values."],
  },
  "jemlit-cashback": {
    player: ["Any item can be exchanged for credits at its value less a haircut of up to 30%.", "Credits are not money: you cannot withdraw them and they expire after a year. The only way out is shipping an item."],
    settings: ["Economy: the haircut; withdrawal only through items.", "Options: credit expiry.", "Run gives hold, credit that expired, and how little ever ships."],
  },
  "jemlit-upgrader": {
    player: ["Stake some balance on a better item. Your chance is the stake divided by the item's value, less the house's cut.", "Win and the item is yours; lose and the stake is gone. Most people try again."],
    settings: ["Terms: stake, target, stated edge.", "Agents: bankroll and whether they keep trying until they win or go bust.", "Run gives the real win rate and edge, and the ruin rate."],
  },
  "cases-packup": {
    player: ["A luxury luggage case at $1,813. The site says the house keeps 10%; six opens in ten pay the $71 suitcase.", "Seeds change automatically every 1,000 bets; you can verify after that."],
    settings: ["Box & items: the captured table, locked to the published odds.", "Algorithm: HMAC-SHA256 with rotation every 1,000, as disclosed; the function from seed to item is not published, so the mapping is a research choice.", "Run checks the 10% edge and the proofs."],
  },
  "cases-upgrader": {
    player: ["Stake balance for a chance at a better item at a disclosed 10% edge."],
    settings: ["Terms, agents and run as in the Upgrader explainer; a table swap in Rigs hides a bigger edge."],
  },
  "cases-coinflip": {
    player: ["Two seats stake the same amount, a coin picks the winner, and the house takes its cut from the pot first."],
    settings: ["Coinflip: the edge and the stake. Bots on means you flip against the house.", "Run gives the realized edge and your win rate against 50%."],
  },
  "cases-battles": {
    player: ["Case battles with the usual modes at the disclosed 10% edge."],
    settings: ["As in the vendor battles explainer, with Cases.gg's seed rotation."],
  },
  "cases-vault": {
    player: ["Lock part of your balance in a vault so you cannot bet it until you cash out."],
    settings: ["Options: the locked share of each deposit.", "Run shows what the vault does to wagering, ruin and the operator's hold."],
  },
  "cases-missions": {
    player: ["Daily missions pay a bonus for wagering a target amount; a weekly race pays the biggest wagerers; there is a free-to-play route with the same odds for those who do not pay."],
    settings: ["Incentives plus missions and the free route share.", "Run compares against a control with incentives off and prices the free route."],
  },
  "misty-boxes": {
    player: [
      "Pick one of the thirteen boxes, pay its price and tap to spin. The strip stops on one outcome.",
      "Most spins pay Mistees, Misty's site credit: one to a few of them. A piece drops rarely; on the $10 Timepiece Suite about one spin in 61, and the Rolex once in 25,000.",
      "Some outcomes carry one or two free spins, which pay a few more Mistees from a small second table.",
      "A piece can be shipped or traded in for Mistees. Mistees never become money: they only buy more boxes or products on the site.",
      "Before you pay, the site locks in a secret number for your open. After the spin it shows the secret, so the result can be checked by anyone. Under the box every step is written out in plain words, and the technical details stay folded away unless you open them.",
    ],
    settings: [
      "Box & odds: the live table of the chosen box. Every percentage can be changed; the sum, the chance of a piece and what the box pays back (on screen and really) update as you type.",
      "Per player: give any player a table of their own, by multiplying the odds of the pieces or by editing each outcome. In live play choose who is spinning; in the simulation players share the opens.",
      "What things are worth: one Mistee on screen ($1 in the page data) and really (about 37 cents if it only buys boxes); pieces at resale.",
      "The proof: Misty's recipe (secret committed per open, your seed, spin number, frozen table) or plain random with nothing to check.",
      "Run opens the box thousands of times and compares counts, returns and per-player results with what the tables say.",
    ],
  },
  "misty-boxes-generic": {
    player: ["The same Timepiece Suite table inside the shared research lab, so it can be compared with the other sources.", "One open in 61 pays a piece; the rest pay Mistees counted at $1 face."],
    settings: ["Box & items: the live table, locked to the published odds (unlock to experiment).", "Algorithm: swap the scheme and mapping; research rigs; the detector.", "Run shows the return with Mistees at face against what they really cost Misty."],
  },
  "misty-mistees": {
    player: ["Almost every open pays you Mistees instead of an item. You cannot cash them; you can only open more boxes with them.", "Each of those opens pays mostly Mistees again, so the credit goes round and round, shrinking a little each time, until it is gone or a physical item finally drops.", "The only thing that ever leaves Misty is a physical item. Everything else is a number on your account."],
    settings: ["The live table and Misty's recipe.", "Agents: how much they deposit, how often they come back, when they would rather ship than keep spinning.", "Run gives the hold (how much of the deposits never leaves), how few opens end in a shipped item, and how many extra opens the credit funded."],
  },
  "misty-credits": {
    player: ["A competition sells numbered entries for one prize out of a fixed pool, and draws on a set date whether or not all numbers sold.", "Anyone can enter free by postcard with the same odds, provided the skill question is answered correctly.", "This tab models the two-stage version captured on 9 October, where box credits were entries; by 12 October Misty described Mistees as site credit for boxes instead."],
    settings: ["The draw: pool size, face value, prize, draw rule, free-entry share.", "Run gives the nominal return (entries at face) against the real one after the draw, and what one entry is worth."],
  },
  "glass-box": {
    player: ["Before you open, you see the whole box committed: items, odds, three prices and the cash-out value, with its fingerprint. A public beacon adds randomness nobody controls.", "After the open you can check everything at once, and the value shown is what the item actually sells for."],
    settings: ["Items and odds; the Glass Box scheme is on by default.", "Switch rigs on to see which ones this design defeats and which it cannot."],
  },
  "glass-buyback": { player: ["Sell back for cash at real market value and withdraw whenever you like."], settings: ["Economy: the haircut (zero by default).", "Run gives hold under the honest rules, for comparison."] },
  "glass-luckybag": { player: ["A sealed bag worth more than it costs, sold in a fixed run that cannot be ended early."], settings: ["Copies per item.", "Run shows a return above 100% and drops completed."] },
  "glass-pity": { player: ["After a run of bad opens, the next one is guaranteed to pay at least the price. The rule is written in the box before you open."], settings: ["Pity: how many losses before it fires and the floor.", "Run shows how often it fires and what it costs."] },
  "glass-group": { player: ["Open the same boxes together with friends; everyone keeps their own pulls."], settings: ["Players and boxes per round.", "Run gives the return per seat."] },
  "glass-pooled": { player: ["Tickets with their real expected value printed on them; the draw happens only when the pool sells out."], settings: ["Pool, prize, free share; disclosure is on.", "Run shows the nominal and real returns almost equal."] },
  "glass-spendcap": { player: ["A daily deposit limit per visitor, on top of the usual incentives."], settings: ["Cap per day; incentives; visitor model.", "Run shows retention and what the cap costs."] },
  kuji: { player: ["Buy a ticket from a set of 80. Each ticket is a prize tier; the odds move as tickets sell. The last ticket also wins the Last One prize."], settings: ["Copies per tier and the Last One item.", "Run gives the return per set."] },
  popmart: { player: ["A blind box with a secret edition that is not on the list, at about 1 in 144."], settings: ["The secret item and its share (the secret-item rig).", "Run shows secret draws and the proof failures they cause."] },
  fukubukuro: { player: ["A sealed New Year bag worth more than it costs, in a limited run."], settings: ["Copies per item.", "Run shows a return above 100%."] },
  breaks: { player: ["A sealed break: everyone gets their own pulls from the same boxes."], settings: ["Players and boxes per round.", "Run gives the return per seat."] },
  omaze: { player: ["A prize draw with a free entry route and a cap on how much one person can spend."], settings: ["Pool, prize, free share, cap.", "Run shows prizes to free entrants and blocked entries."] },
  gacha: { player: ["A capsule with a pity rule: after a losing streak the next pull is guaranteed to pay."], settings: ["Pity threshold and floor.", "Run shows how often it fires and what it costs."] },
  "presentation-rigs": {
    player: ["The same vendor box with the theatre switched on: a reel that stops just beside the big item, every drop celebrated like a win, a ticker of other people winning, 'you were N tickets away', free demo spins that pay better, countdowns and 'only 12 left'.", "Nothing about the odds has changed."],
    settings: ["Each rig and its parameters.", "Run shows that the outcome data is identical with the theatre on or off; only an audit of the presentation can see it."],
  },
};

export const GUIDE_BY_LAB: Record<string, { player: string[]; settings: string[] }> = {
  "mystery-box": GUIDES["vendor-boxes"],
  sellback: GUIDES["vendor-sellback"],
  battles: GUIDES["vendor-battles"],
  retention: GUIDES["vendor-retention"],
  credits: GUIDES["misty-credits"],
  upgrader: GUIDES["jemlit-upgrader"],
  misty: GUIDES["misty-boxes"],
};
