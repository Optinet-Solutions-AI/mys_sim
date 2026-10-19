import Link from "next/link";
import { DocsToc } from "@/components/DocsToc";
import { Badge, Card, Td, Th } from "@/components/ui";
import { KIT_BATTLE_MODES, battleCommit, resolveBattle } from "@/engine/labs/battleKit";
import { DEFAULT_KIT_BATTLES } from "@/lib/battlesPresets";
import { entryOf, prepareRound } from "@/lib/kitBattles";
import { money, pct } from "@/lib/format";

export const metadata = { title: "Battles, explained · Simulator" };

const cents = (c: number) => money(c / 100);
const short = (h: string, n = 8) => `${h.slice(0, n)}…${h.slice(-n)}`;

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-20 text-xl font-semibold">
      {children}
    </h2>
  );
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-[72ch] text-sm leading-6 text-ink-2">{children}</p>;
}
function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="max-w-[72ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">{children}</ul>;
}

const TOC = [
  ["in-short", "In short"],
  ["what", "1. What a battle is"],
  ["one-battle", "2. One battle, step by step"],
  ["modes", "3. The modes"],
  ["status", "4. The status of a battle"],
  ["sums", "5. The sums"],
  ["bots", "6. Bots"],
  ["sponsored", "7. Sponsored battles"],
  ["check", "8. The check"],
  ["admin", "9. What the admin panel sets"],
  ["player", "10. What the player sees"],
  ["history", "11. History and reports"],
  ["critique", "12. Critique"],
  ["glossary", "Glossary"],
] as const;

// the worked example: the default Evo Verse battle, resolved from a fixed secret so the page always shows the same numbers
const EX_SEED = "6f1d2c3b4a59687706152433425160798a9bacbdcedfe0f10213243546576879";
const EX_ROUNDS = [0, 0, 0].map((bi, i) => prepareRound(DEFAULT_KIT_BATTLES.boxes[bi], i));
const EX_SEATS = [
  { seat: 0, clientSeed: "seat-0-5e21", name: "Anna" },
  { seat: 1, clientSeed: "bot-7c1e", name: "Atlas (bot)" },
  { seat: 2, clientSeed: "bot-02aa", name: "Nova (bot)" },
  { seat: 3, clientSeed: "bot-d41b", name: "Rook (bot)" },
];
const EX = resolveBattle("normal", EX_ROUNDS.map((r) => r.round), EX_SEATS.map(({ seat, clientSeed }) => ({ seat, clientSeed })), EX_SEED);
const EX_ENTRY = entryOf(EX_ROUNDS.map((r) => r.round), 0);
const EX_EV = EX_ROUNDS.reduce((a, r) => a + r.evCents, 0);
const EX_BOX = EX_ROUNDS[0];
const winnerName = EX_SEATS[EX.winners[0]].name;

const STEPS: { what: string; why: string; example: string }[] = [
  { what: "Someone creates a battle: a mode, a number of seats, and one box per round, all from the lists the admin allowed.", why: "The player chooses inside the admin's limits. Nothing about odds or boxes is decided by the player.", example: `Anna creates a normal battle, 4 seats, 3 rounds of the ${EX_BOX.box.name.split(" · ")[0]} at ${money(EX_BOX.box.price)}.` },
  { what: "Before anyone else joins, the server draws one secret for the whole battle and shows its hash on the page.", why: "Every roll in the battle comes from that secret. Showing the hash first proves it was fixed before anyone paid or sat down.", example: `The page shows ${short(battleCommit(EX_SEED))}. Nobody can read the secret from it.` },
  { what: "When a seat is taken, the server gives it a random seed of its own and records it. The entry is held from the player's credit. Players never type a seed.", why: "Each seat's seed goes into its rolls and is stored before the battle starts, so it cannot be changed afterwards. The hold means a seat is never taken with money that is then spent elsewhere.", example: `Anna joins and ${cents(EX_ENTRY.entryCents)} is held; her seat gets the seed seat-0-5e21. Three bots join with seeds of their own.` },
  { what: "When the last seat is taken, a short countdown runs on the server, and the battle starts. From here nothing that feeds a roll can change.", why: "The countdown lets people see the seats fill; the server owns the clock so no client can start or delay a battle.", example: "Four seats, countdown 3, 2, 1." },
  { what: "Every seat opens the round's box. Each open is a normal open: secret + the seat's seed + a spin number → a roll between 0 and 1 → read against the box's odds table.", why: "Battles reuse the single-open rule, so one check covers both. The spin number is the pull's position: round × seats + seat + 1.", example: `Round 1: Anna is spin 1, Atlas spin 2, Nova spin 3, Rook spin 4. Anna's roll ${EX.pulls[0].roll.toFixed(4)} lands on ${EX.pulls[0].label} (${cents(EX.pulls[0].valueCents)}).` },
  { what: "After the last round the mode decides who takes the pot. If seats tie, one extra roll breaks the tie.", why: "The extra roll uses the next spin number and every seat's seed joined together, so no single seat controls it.", example: `Totals ${EX.totals.map((t, i) => `${EX_SEATS[i].name.split(" ")[0]} ${cents(t)}`).join(", ")}. ${winnerName} has the highest total and takes the pot of ${cents(EX.potCents)}.${EX.tiedSeats.length > 1 ? " A tie was broken by the extra roll." : ""}` },
  { what: "The winner's items become awards (ship or trade in) and the credit goes to the ledger. Then the battle is marked settled and the secret is published.", why: "Money moves first, status last, so a crash can never leave a battle finished but unpaid. The secret comes out only when there is nothing left to influence.", example: `${winnerName === "Anna" ? "Anna's" : `${winnerName.split(" ")[0]}'s`} ${EX.pulls.filter((p) => p.seat === EX.winners[0]).length} pulls plus everyone else's go to ${winnerName === "Anna" ? "Anna" : "the house, because a bot won"}. Status: Settled. Secret ${short(EX_SEED)}.` },
  { what: "Anyone can check the battle: recompute every roll from the secret, the seeds and the odds tables.", why: "The check proves the secret matches the hash, every pull landed where the page says, and the right seat won.", example: "The Check button on the battle page does it in the browser; the public verify endpoint does the same on the server." },
];

export default function BattlesDocPage() {
  const s = DEFAULT_KIT_BATTLES.settings;
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Battles, explained simply</h1>
          <Badge tone="accent">Evo Verse</Badge>
          <Badge>kit 1.2 · 19 October 2026</Badge>
        </div>
        <P>
          How a battle works on the committed-seed engine, for anyone on the team. Every number on this page is computed live from the default Evo Verse battle, resolved from one fixed secret so the example always reads the same. Play it on the <Link href="/operators/vendor">Evo Verse page</Link>, Battles tab; the developer version with the API, the tables and the prompt is at <Link href="/docs/battles/dev">Battles for developers</Link>.
        </P>
      </header>

      <DocsToc toc={TOC} back={{ href: "/operators/vendor", label: "← Back to Evo Verse" }} links={[{ href: "/docs/battles/dev", label: "For developers →" }, { href: "/docs/misty", label: "Misty, explained →" }]} />

      <section className="space-y-3">
        <H2 id="in-short">In short</H2>
        <Card>
          <p className="text-sm leading-6 text-ink-2">
            <b>In one sentence.</b> Several seats open the same boxes at the same time, one secret fixed before anyone joins decides every roll, a mode decides who takes everything, and the whole battle has a status in the database from the moment it is created until it is settled.
          </p>
        </Card>
        <Ul>
          <li>The admin panel decides what is possible: which modes, how many seats, which boxes, the fee, the bots, the timers. Players create and join battles inside those limits with their credit.</li>
          <li>Every pull is a normal open with the box&apos;s own odds. A battle does not change any box&apos;s odds; it changes who takes the items.</li>
          <li>A battle is Waiting, then Ongoing, then Settled. The row in the database moves through those states one guarded step at a time, and the secret is published only at Settled.</li>
          <li>Bots, when the admin allows them, are a name and a picture with the same odds as everyone else; what a bot wins goes back to the house.</li>
          <li>Over many battles each seat takes home what its boxes pay back on average, so what the house keeps is the boxes&apos; margin plus any disclosed fee. Bots do not change your expectation; they change who sits across the table.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="what">1. What a battle is</H2>
        <P>
          A battle has N seats, 2 or more, and R rounds. Each round names one box, and in that round every seat opens that box once. The entry per seat is the sum of the round prices{s.feePercent ? " plus the admin's fee" : ""}; it is held from the player&apos;s credit when the seat is taken and returned if the battle is cancelled or never fills. What the seats pull makes the pot. The mode decides who takes it.
        </P>
        <P>
          The default Evo Verse battle: {EX.seats} seats, {EX.rounds} rounds of the {EX_BOX.box.name.split(" · ")[0]} at {money(EX_BOX.box.price)}, so an entry of {cents(EX_ENTRY.entryCents)} per seat and {cents(EX_ENTRY.entryCents * EX.seats)} on the table. The box pays back {cents(Math.round(EX_BOX.evCents))} per open on average, {pct(EX_BOX.ret, 1)} of its price.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="one-battle">2. One battle, step by step</H2>
        <P>The example is the default battle resolved from the secret {short(EX_SEED)}. Anna takes seat 0; three bots take the others.</P>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>What happens</Th>
                <Th>Why it is done that way</Th>
                <Th>In the example</Th>
              </tr>
            </thead>
            <tbody>
              {STEPS.map((st, i) => (
                <tr key={i} className="border-t border-line align-top">
                  <Td>
                    <b>{i + 1}.</b> {st.what}
                  </Td>
                  <Td>{st.why}</Td>
                  <Td>{st.example}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Card title="Every pull of the example">
          <div className="tbl">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Round</Th>
                  <Th>Seat</Th>
                  <Th right>Spin number</Th>
                  <Th right>Roll</Th>
                  <Th>Lands on</Th>
                  <Th right>Value</Th>
                </tr>
              </thead>
              <tbody>
                {EX.pulls.map((p, i) => (
                  <tr key={i} className="border-t border-line">
                    <Td mono>{p.round + 1}</Td>
                    <Td>{EX_SEATS[p.seat].name}</Td>
                    <Td right mono>{p.nonce}</Td>
                    <Td right mono>{p.roll.toFixed(6)}</Td>
                    <Td>{p.label}</Td>
                    <Td right mono>{cents(p.valueCents)}</Td>
                  </tr>
                ))}
                {EX.extra && (
                  <tr className="border-t border-line bg-accent-soft/40">
                    <Td mono>extra</Td>
                    <Td>tie-break</Td>
                    <Td right mono>{EX.extra.nonce}</Td>
                    <Td right mono>{EX.extra.roll.toFixed(6)}</Td>
                    <Td>seed = every seat&apos;s seed joined by |</Td>
                    <Td right mono>seat {EX.winners[0]}</Td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-ink font-semibold">
                  <Td>Totals</Td>
                  <td colSpan={4} className="border-b border-line/60 px-2 py-1.5 align-top">{EX.totals.map((t, i) => `${EX_SEATS[i].name}: ${cents(t)}`).join(" · ")}</td>
                  <Td right mono>pot {cents(EX.potCents)}</Td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      <section className="space-y-3">
        <H2 id="modes">3. The modes</H2>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Mode</Th>
                <Th>Who wins</Th>
                <Th>What is paid</Th>
              </tr>
            </thead>
            <tbody>
              {KIT_BATTLE_MODES.map((m) => (
                <tr key={m.id} className="border-t border-line align-top">
                  <Td>
                    <b>{m.name}</b>
                  </Td>
                  <Td>{m.rule}</Td>
                  <Td>{m.id === "group" ? "The pot split equally; odd cents to seat 0." : m.id === "break" ? "Each seat keeps its own pulls. No pot." : m.id === "coinflip" ? "The two stakes less the disclosed edge, to the winner." : "Every item and credit pulled by every seat, to the winner."}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>Ties in normal, crazy and terminal are broken by one extra roll among the tied seats, in seat order. Jackpot uses the same extra roll to draw a winner in proportion to the totals; if every total is zero the draw is uniform.</P>
      </section>

      <section className="space-y-3">
        <H2 id="status">4. The status of a battle</H2>
        <P>Every battle is a row in the database with a status. The screens show plain words; the codes stay in the API. A status only ever changes by one guarded step: the server writes the new status together with a version number and refuses the write if anyone else moved first.</P>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>On screen</Th>
                <Th>Code</Th>
                <Th>What it means</Th>
                <Th>What the database holds</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Waiting", "open", "Created; seats free; credit held for the seats taken.", "The secret hash, the mode, the seats, the rounds with their table hashes, the holds."],
                  ["Waiting · starting", "full", "Every seat taken; the countdown runs on the server.", "The seats with their seeds, fixed; the start time."],
                  ["Ongoing", "in_progress", "The server resolves every round from the committed inputs and writes the pulls.", "Every pull with its spin number, digest, roll, outcome and value."],
                  ["Ongoing · settling", "settling", "Awards and ledger entries are being written.", "The pot, the winners, the shares; item awards and ledger rows."],
                  ["Settled", "finished", "Everything is paid; the secret is published; anyone can check.", "The secret, the settled time, the result; nothing is ever edited again."],
                  ["Cancelled", "cancelled", "The creator (while alone) or an admin cancelled it before the start.", "The reason, the refunds."],
                  ["Expired", "expired", "Never filled within the admin's window.", "The refunds."],
                ] as const
              ).map(([a, b, c, d]) => (
                <tr key={b} className="border-t border-line align-top">
                  <Td>
                    <b>{a}</b>
                  </Td>
                  <Td mono>{b}</Td>
                  <Td>{c}</Td>
                  <Td>{d}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>The only paths are open → full → in_progress → settling → finished, full → open (a seat left), and open or full → cancelled, open → expired. Because every roll is computed from fixed inputs, a server that crashes halfway simply runs the same resolution again and gets the same pulls: nothing is re-rolled and nothing is paid twice.</P>
      </section>

      <section className="space-y-3">
        <H2 id="sums">5. The sums</H2>
        <P>
          {EX.seats} seats pay {cents(EX_ENTRY.entryCents * EX.seats)} in. The {EX_BOX.box.name.split(" · ")[0]} pays back {cents(Math.round(EX_BOX.evCents))} per open at listed value, so over {EX.rounds} rounds each seat pulls about {cents(Math.round(EX_EV))} on average and the whole table about {cents(Math.round(EX_EV * EX.seats))}. The house expects to keep about {cents(Math.round((EX_ENTRY.entryCents - EX_EV) * EX.seats))} per battle: the boxes&apos; margin, nothing more.
        </P>
        <P>
          Every seat plays the same table with the same odds, so each seat wins one battle in {EX.seats} on average and, when it wins, takes a pot made of everyone&apos;s pulls. Over many battles that works out to each seat taking home exactly what its own boxes pay back. Your expected return in a battle equals the box&apos;s return; the battle changes the shape of the result (all or nothing) and the size of the bet (all the rounds at once), not the average.
        </P>
        <P>
          Bots do not change that. When the house fills {EX.seats - 1} seats with bots it funds those seats itself; against Anna it still expects to keep {cents(Math.round(EX_ENTRY.entryCents - EX_EV))} per battle, exactly what one open of each box would keep. A disclosed fee, when the admin sets one, is added on top of the entry and kept by the house; it never touches the pot.
        </P>
      </section>

      <section className="space-y-3">
        <H2 id="bots">6. Bots</H2>
        <Ul>
          <li>Off unless the admin switches them on. When they are on, the creator of a waiting battle that nobody joins can ask for bots; the server fills every free seat with a bot from the admin&apos;s list and the countdown starts.</li>
          <li>A bot is a name and a picture, nothing more. It plays the same boxes with the same odds and the same committed secret; the server gives it a seed like any seat; it holds no credit; what it wins returns to the house with no award and no ledger row.</li>
          <li>A bot seat is labelled as a bot on every screen, in the lobby and in the game history.</li>
          <li>A bot with better odds than players would be a rig. The engine has no setting for it and the kit forbids it. Evocase described its bots the same way in its 15 October demo: &quot;just names and images, no higher configuration&quot;.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="sponsored">7. Sponsored battles</H2>
        <P>A battle whose entries the house pays. The admin creates it, for a stream or a promotion; players join free; the house ledger takes one entry for the whole cost; the pot is real and the winner is paid as usual. The battle shows &quot;Sponsored by …&quot; on the lobby and the battle page. A promo code that gives &quot;a free battle&quot; is the same thing seen from the player: a credit voucher that may only pay a battle entry.</P>
      </section>

      <section className="space-y-3">
        <H2 id="check">8. The check</H2>
        <P>After a battle is settled, the page shows the secret, every seat&apos;s seed, the table hash of every round and the spin number of every pull. The Check button recomputes every roll in the browser and compares four things: the secret hashes to what was shown before the battle; every pull lands where the page says; every total matches; the same seat wins. The public verify endpoint does the same on the server for anyone with the battle id. On the Evo Verse page a &quot;tamper with the secret&quot; switch changes one character of the secret so you can watch the check fail.</P>
      </section>

      <section className="space-y-3">
        <H2 id="admin">9. What the admin panel sets</H2>
        <div className="tbl">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Setting</Th>
                <Th>Meaning</Th>
                <Th>Kit default</Th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["Battles enabled", "The master switch.", "off"],
                  ["Modes allowed", "Which of the seven modes players may pick.", "normal, crazy, terminal"],
                  ["Seats allowed", "Which seat counts a battle may have.", "2, 3, 4"],
                  ["Rounds max", "Boxes per battle.", "10"],
                  ["Eligible boxes", "Which boxes from the catalogue may be put in a battle; each is pinned by its table hash.", "none until chosen"],
                  ["Fee", "A disclosed percentage on top of the box prices, kept by the house.", "0"],
                  ["Coinflip edge", "Taken from the coinflip pot before the winner is paid.", "0"],
                  ["Open battle expiry", "Minutes a waiting battle lives before it expires and refunds.", "30"],
                  ["Countdown", "Seconds from every seat taken to the start.", "5"],
                  ["Private battles", "Invite code instead of the public list.", "on"],
                  ["Bots", "Off, or on with a list of names and pictures.", "off"],
                  ["Max open battles per player", "Anti-abuse.", "3"],
                  ["Credit face", "What one credit counts for in totals.", "100 cents"],
                ] as const
              ).map(([a, b, c]) => (
                <tr key={a} className="border-t border-line align-top">
                  <Td>
                    <b>{a}</b>
                  </Td>
                  <Td>{b}</Td>
                  <Td mono>{c}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <P>Changing a setting never touches an existing battle: a battle pins its mode, its seats, its fee and its boxes&apos; table hashes when it is created. On the Evo Verse page the same panel is behind the Admin panel button, with every mode switched on so each can be tried.</P>
      </section>

      <section className="space-y-3">
        <H2 id="player">10. What the player sees</H2>
        <Ul>
          <li>A lobby: open battles with mode, seats taken, entry, boxes and the secret hash; a Create button that offers only what the admin allowed; Join; private battles by code.</li>
          <li>The battle room: the seats with names (bots labelled), the boxes per round, the secret hash, the countdown from the server, then the rounds playing back from the server&apos;s pull records, totals updating, the winner, the pot, what each seat takes home, Ship or Trade in for item awards.</li>
          <li>The result and the check: the secret revealed, the seeds, the spin numbers, the table hashes, and a Check this battle button.</li>
          <li>Nothing is computed in the browser before the server has written it. The animation starts after the pull records arrive and ends on exactly what they say.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="history">11. History and reports</H2>
        <Ul>
          <li>A player&apos;s game history lists every battle they sat in with their pulls, the result and what they took home, next to their single opens. The admin&apos;s player screen shows &quot;Boxes opened&quot; and &quot;Battles played&quot;.</li>
          <li>The admin dashboard shows battles played per day and per mode, and the gross gaming revenue per game mode: what players paid in minus what players took home. Bot seats and sponsored seats are not player money.</li>
          <li>A settled battle is never edited; its seats, pulls, events and secret are kept as long as the ledger is.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="critique">12. Critique</H2>
        <Ul>
          <li>Battles multiply the bet. One click wagers every round at once, and the vendor&apos;s own figure was that battles make 90% of all wagering. The fairness of each roll is unchanged; the amount at risk per minute is not.</li>
          <li>Bots mean the house sits across the table. The odds are the same, so the player&apos;s expectation is the same as a single open, but a bot winning the pot is the house collecting the player&apos;s pulls as well as its own margin. The label on the seat is what keeps this honest.</li>
          <li>The check proves the roll, not the value. Items count at listed value; what they fetch when sold is a separate question, the same one the single-open pages raise.</li>
          <li>Sponsored battles are marketing spend. They cost the house every entry and should be reported as such, not as play.</li>
        </Ul>
      </section>

      <section className="space-y-3">
        <H2 id="glossary">Glossary</H2>
        <dl className="grid max-w-[78ch] gap-x-6 gap-y-2 text-sm leading-6 text-ink-2 md:grid-cols-2">
          {(
            [
              ["Seat", "One place in a battle. A player or a bot."],
              ["Round", "One box that every seat opens once."],
              ["Entry", "What a seat pays: the round prices plus any fee."],
              ["Pot", "Everything every seat pulled, in items and credit."],
              ["Secret", "The server seed drawn for the battle; its hash is shown before anyone joins; it is published when the battle is settled."],
              ["Seed", "A random value the server gives each seat when it joins and records; it goes into that seat's rolls. Players never enter one."],
              ["Spin number", "The nonce of a pull: round × seats + seat + 1."],
              ["Extra roll", "One more roll for ties, jackpot and coinflip, with every seat's seed joined together."],
              ["Hold", "Credit set aside for a seat; refunded if the battle never starts."],
              ["Settled", "Status finished: awards and ledger written, secret published."],
              ["Award", "An item won, waiting to be shipped or traded in."],
              ["GGR", "Gross gaming revenue: what players paid in minus what players took home."],
            ] as const
          ).map(([t, d]) => (
            <div key={t}>
              <dt className="font-semibold text-ink">{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
