import Link from "next/link";
import { DocsToc } from "@/components/DocsToc";
import { EXTERNAL, FAMILIES, MECHANICS, SOURCES, adoption, presence, sourceProfile, spread, type Presence, type Spread } from "@/lib/featureMatrix";
import { AdoptionChart, FamilyChart, SpreadChart, VizStyle } from "@/components/FeatureCharts";
import { Badge, Card, Td, Th } from "@/components/ui";

export const metadata = { title: "Feature report · Simulator" };

const MARK: Record<Presence, string> = { yes: "✓", variant: "~", no: "–", unknown: "?" };
const MARK_CLASS: Record<Presence, string> = { yes: "text-good font-semibold", variant: "text-warn font-semibold", no: "text-ink-3", unknown: "text-ink-3" };
const SPREAD_LABEL: Record<Spread, string> = { same: "Same across operators", similar: "Similar, with variants", unique: "Unique to one operator" };

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

const TOC = [
  ["summary", "Summary"],
  ["popular", "1. Most used mechanics"],
  ["families", "2. What each source has"],
  ["spread", "3. Same, similar, unique"],
  ["matrix", "4. The matrix"],
  ["per-source", "5. Source by source"],
  ["takeaways", "6. Takeaways for our build"],
] as const;

export default function FeaturesPage() {
  const ranked = [...MECHANICS].map((m) => ({ m, a: adoption(m) })).sort((p, q) => q.a.yes + q.a.variant - (p.a.yes + p.a.variant) || q.a.yes - p.a.yes);
  const bySpread: Record<Spread, typeof ranked> = { same: [], similar: [], unique: [] };
  for (const r of ranked) bySpread[spread(r.m)].push(r);
  const evo = sourceProfile("evo");
  const nOps = EXTERNAL.length;

  return (
    <div className="mx-auto flex max-w-6xl flex-col pb-16 lg:grid lg:grid-cols-[minmax(0,1fr)_230px] lg:gap-8">
      <VizStyle />
      <div className="min-w-0 space-y-8">
        <header className="space-y-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-ink">All sources</div>
          <h1 className="text-3xl font-semibold">Feature and mechanic report</h1>
          <P>
            {MECHANICS.length} mechanics across {nOps} operators, our Glass Box and the adjacent formats. ✓ has it as described, ~ a close variant, – absent, ? not visible from outside. Hover a cell for the note.
          </P>
        </header>

        <section className="space-y-3">
          <H2 id="summary">Summary</H2>
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              ["Mechanics", String(MECHANICS.length), "catalogued"],
              ["Same across operators", String(bySpread.same.length), "three or more have it"],
              ["Similar", String(bySpread.similar.length), "two or more, with variants"],
              ["Unique", String(bySpread.unique.length), "one operator only"],
            ].map(([k, v, s]) => (
              <div key={k} className="rounded-lg border border-line bg-paper px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-ink-3">{k}</div>
                <div className="text-xl font-semibold tabular-nums">{v}</div>
                <div className="text-[11px] text-ink-3">{s}</div>
              </div>
            ))}
          </div>
          <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
            <li>
              <b>Everyone shares the core:</b> a weighted odds table with independent opens, published odds, and a sell-back into balance. Those three are the product.
            </li>
            <li>
              <b>The case sites form one family:</b> Jemlit, Cases.gg and Misty add a committed secret, a player seed and a verifier. Evo Verse, IcyBox, StockX and Courtyard have no proof at all.
            </li>
            <li>
              <b>Side games are the case sites&apos; territory:</b> battles and the upgrader appear on Evo Verse, Jemlit and Cases.gg and nowhere else.
            </li>
            <li>
              <b>Unique mechanics are where the margin or the honesty lives:</b> Misty&apos;s credit-only payouts, free spins and frozen table; IcyBox&apos;s early retirement; StockX&apos;s tiers; Courtyard&apos;s price-from-contents.
            </li>
            <li>
              <b>Evo Verse</b> has {evo.has.length} of the {MECHANICS.length} mechanics: {evo.same} shared, {evo.similar} similar, {evo.unique} unique. Its gap is the proof family: nothing committed, nothing to check.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <H2 id="popular">1. Most used mechanics</H2>
          <P>How many of the {nOps} operators have each mechanic. Blue counts those that have it as described; orange adds close variants. Our Glass Box and the adjacent formats are not counted here.</P>
          <Card>
            <AdoptionChart />
          </Card>
          <Card title="Table view">
            <div className="overflow-x-auto">
              <div className="tbl"><table className="w-full text-xs">
                <thead>
                  <tr>
                    <Th>Mechanic</Th>
                    <Th>Family</Th>
                    <Th right>Has it</Th>
                    <Th right>Variant</Th>
                    <Th right>Total of {nOps}</Th>
                    <Th>Spread</Th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map(({ m, a }) => (
                    <tr key={m.id} className="border-t border-line">
                      <Td>{m.name}</Td>
                      <Td>{FAMILIES.find((f) => f.id === m.family)?.name}</Td>
                      <Td right mono>{a.yes}</Td>
                      <Td right mono>{a.variant}</Td>
                      <Td right mono>{a.yes + a.variant}</Td>
                      <Td>
                        <Badge tone={spread(m) === "same" ? "good" : spread(m) === "similar" ? "warn" : "accent"}>{spread(m)}</Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <H2 id="families">2. What each source has</H2>
          <P>Mechanics per source, coloured by family. Longer bars mean a bigger product, not a better one.</P>
          <Card>
            <FamilyChart />
          </Card>
        </section>

        <section className="space-y-3">
          <H2 id="spread">3. Same, similar, unique</H2>
          <P>
            For each source, how many of its mechanics are shared with at least two other operators (same), found elsewhere as a variant (similar), or found nowhere else (unique).
          </P>
          <Card>
            <SpreadChart />
          </Card>
          <div className="grid gap-3 md:grid-cols-3">
            {(["same", "similar", "unique"] as Spread[]).map((k) => (
              <Card key={k} title={SPREAD_LABEL[k]}>
                <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
                  {bySpread[k].map(({ m, a }) => (
                    <li key={m.id}>
                      {m.name}
                      <span className="text-ink-3">
                        {" "}
                        · {a.yes + a.variant} of {nOps}
                        {k === "unique" && a.sources.find((s) => s.p === "yes") ? `: ${SOURCES.find((q) => q.id === a.sources.find((s) => s.p === "yes")!.id)?.name}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <H2 id="matrix">4. The matrix</H2>
          <Card>
            <div className="overflow-x-auto">
              <div className="tbl"><table className="w-full min-w-[900px] text-xs">
                <thead>
                  <tr>
                    <Th>Mechanic</Th>
                    {SOURCES.map((s) => (
                      <Th key={s.id} right>
                        {s.name.replace(" (ours)", "")}
                      </Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FAMILIES.map((f) => (
                    <FamilyRows key={f.id} familyId={f.id} familyName={f.name} />
                  ))}
                </tbody>
              </table></div>
            </div>
            <div className="mt-2 text-[11px] text-ink-3">✓ has it as described · ~ close variant · – absent · ? not visible from outside. Hover a cell for the note.</div>
          </Card>
        </section>

        <section className="space-y-3">
          <H2 id="per-source">5. Source by source</H2>
          <div className="grid gap-3 md:grid-cols-2">
            {SOURCES.map((s) => {
              const p = sourceProfile(s.id);
              const uniques = p.has.filter((m) => spread(m) === "unique" && presence(m, s.id) === "yes");
              return (
                <Card key={s.id} title={s.name}>
                  <p className="text-sm text-ink-2">{s.short}</p>
                  <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                    <Badge>{p.has.length} mechanics</Badge>
                    <Badge tone="good">{p.same} same</Badge>
                    <Badge tone="warn">{p.similar} similar</Badge>
                    <Badge tone="accent">{p.unique} unique</Badge>
                  </div>
                  {uniques.length > 0 && (
                    <p className="mt-2 text-xs text-ink-2">
                      <b>Only here:</b> {uniques.map((m) => m.name).join("; ")}.
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-3">
                    Missing: {MECHANICS.filter((m) => presence(m, s.id) === "no").length}; not visible: {MECHANICS.filter((m) => presence(m, s.id) === "unknown").length}.
                  </p>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          <H2 id="takeaways">6. Takeaways for our build</H2>
          <ul className="max-w-[78ch] list-disc space-y-1 pl-5 text-sm leading-6 text-ink-2">
            <li>
              <b>Table stakes:</b> weighted table, published odds, sell-back. Without these the product is not recognisable.
            </li>
            <li>
              <b>Proof is the dividing line.</b> Three operators commit a secret; four do not. Committing per open with a frozen table (Misty, Glass Box) is the strongest version and costs nothing to run.
            </li>
            <li>
              <b>Credit-only payouts are Misty&apos;s margin engine and unique.</b> They raise the on-screen return without paying more. Copy the mechanism only with a published rate.
            </li>
            <li>
              <b>Battles and upgrader</b> are expected on a case site and absent on luxury boxes. Evo Verse already ships both.
            </li>
            <li>
              <b>Nobody shows an independent market value</b> except our design. That is the cheapest visible difference.
            </li>
            <li>
              <b>Price from contents</b> (Courtyard, Glass Box) is rare and honest; price first (everyone else) is the industry habit.
            </li>
          </ul>
          <div className="pt-1">
            <Badge>Matrix v1.0 · 13 October 2026 · hand-curated from the dossiers and captures</Badge>
          </div>
        </section>
      </div>
      <DocsToc toc={TOC} back={{ href: "/", label: "← Back to the hub" }} links={[{ href: "/docs/misty", label: "Misty, explained →" }, { href: "/build", label: "Create a mystery box →" }]} />
    </div>
  );
}

function FamilyRows({ familyId, familyName }: { familyId: string; familyName: string }) {
  const rows = MECHANICS.filter((m) => m.family === familyId);
  return (
    <>
      <tr className="border-t-2 border-line bg-paper">
        <td colSpan={SOURCES.length + 1} className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-3">
          {familyName}
        </td>
      </tr>
      {rows.map((m) => (
        <tr key={m.id} className="border-t border-line">
          <Td>
            <span title={m.plain}>{m.name}</span>
          </Td>
          {SOURCES.map((s) => {
            const [p, note] = m.cells[s.id] ?? ["unknown", ""];
            return (
              <Td key={s.id} right>
                <span className={MARK_CLASS[p]} title={note || m.plain}>
                  {MARK[p]}
                </span>
              </Td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
