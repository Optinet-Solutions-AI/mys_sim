import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge, Card } from "@/components/ui";
import { LAB_DOCS } from "@/lib/labDocs";

const labs = [
  { href: "/labs/mystery-box", id: "mystery-box", icon: "fluent:package" },
  { href: "/labs/sellback", id: "sellback", icon: "fluent:money-bag" },
  { href: "/labs/battles", id: "battles", icon: "fluent:trophy" },
  { href: "/labs/retention", id: "retention", icon: "fluent:wrapped-gift" },
] as const;

const waves = [
  { wave: "1 · now", source: "Vendor platform", status: "building", items: "Mystery boxes with the 90% RTP knob, sell-back and cart, battles with bots, retention (daily boxes, races, affiliates)" },
  { wave: "1b", source: "Vendor platform", status: "next", items: "Deals mode; withdraw-only-through-items as a Sell-back option" },
  { wave: "2", source: "IcyBox · StockX · Courtyard", status: "planned", items: "Finite drops and early retirement; tier-first draw and value floors; EV pricing, public pull log, FMV buyback with a 7-day window" },
  { wave: "3", source: "Jemlit · Cases.gg · Misty", status: "planned", items: "Haircut and tier floors; rotation every 1,000; Upgrader; free-entry parity; the credits-to-raffle economy" },
  { wave: "4", source: "Glass Box (ours)", status: "partly in", items: "Manifest commitment, beacon and per-open rotation are already selectable; comparison layer and pools to come" },
  { wave: "5", source: "Adjacent models", status: "planned", items: "Kuji Last One, Pop Mart secrets, lucky bags, breaks, Omaze-style draws, gacha pity" },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="accent">Feature hub · research sandbox</Badge>
          <Badge>phase 1 · browser only</Badge>
        </div>
        <h1 className="text-3xl font-semibold">Mystery Box Simulator</h1>
        <p className="mt-2 text-ink-2">
          Reproduce how mystery-box platforms work, test any algorithm and any setting, switch the documented cheats on and see what an honest verifier and the statistics would catch. No real money, no registration; every player is a simulated agent. Each lab is isolated and every run is reproducible from its seed.
        </p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Labs (wave 1: the vendor&apos;s features)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {labs.map((l) => {
            const d = LAB_DOCS[l.id];
            return (
              <Link key={l.id} href={l.href} className="group rounded-xl border border-line bg-surface p-4 no-underline transition hover:border-accent">
                <div className="flex items-start gap-3">
                  <Icon name={l.icon} size={36} />
                  <div>
                    <div className="font-semibold text-ink group-hover:text-accent-ink">{d.title}</div>
                    <div className="mt-1 text-sm text-ink-2">{d.what}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Card title="How to use it">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open a lab: you land on the test page. Press Open to open a pack with the reveal, or Start battle to play one battle round by round.</li>
          <li>Press the cog (Settings) to change anything: items and odds, the RTP knob, the algorithm, the rigs, the number of bots, and how many opens or battles to simulate. The summary chips under the title open the right section.</li>
          <li>Press Run simulation for the statistics: stated versus observed odds, realized return with its error bar, proof verification and the detector. Results appear below the test page.</li>
          <li>Save the run to history to compare later, or download the Markdown report for the research documents.</li>
        </ol>
      </Card>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Hub roadmap</h2>
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-ink-3">
                <th className="px-3 py-2">Wave</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Features</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {waves.map((w) => (
                <tr key={w.wave} className="border-t border-line">
                  <td className="px-3 py-2 font-medium">{w.wave}</td>
                  <td className="px-3 py-2">{w.source}</td>
                  <td className="px-3 py-2 text-ink-2">{w.items}</td>
                  <td className="px-3 py-2">
                    <Badge tone={w.status === "building" ? "accent" : w.status === "partly in" ? "good" : "neutral"}>{w.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">The plan, the decision scorecard and the sources are in the research folder (document 05). Phase 2 adds Supabase for shared history and Vercel hosting.</p>
      </section>
    </div>
  );
}
