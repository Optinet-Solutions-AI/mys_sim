import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge, Card } from "@/components/ui";
import { LAB_DOCS } from "@/lib/labDocs";

const labs = [
  { href: "/labs/mystery-box", id: "mystery-box", icon: "fluent:package" },
  { href: "/labs/sellback", id: "sellback", icon: "fluent:money-bag" },
  { href: "/labs/battles", id: "battles", icon: "fluent:trophy" },
  { href: "/labs/retention", id: "retention", icon: "fluent:wrapped-gift" },
  { href: "/labs/credits", id: "credits", icon: "fluent:ticket" },
  { href: "/labs/upgrader", id: "upgrader", icon: "fluent:chart-increasing" },
] as const;

const waves = [
  { wave: "1", source: "Vendor platform", status: "in", items: "Mystery boxes with the 90% RTP knob, sell-back and cart, battles with bots, retention (daily boxes, races, affiliates)" },
  { wave: "1b", source: "Vendor platform", status: "in", items: "Deals (in the Upgrader & Deals lab); withdraw only through items (Sell-back option)" },
  { wave: "2", source: "IcyBox · StockX · Courtyard", status: "in", items: "Finite drops with early retirement; tier-first draw, value floor and finite inventory; EV pricing and public pull log; buyback windows, keep fees, undisclosed estimates, credit expiry, guarantee floors (Sell-back options)" },
  { wave: "3", source: "Jemlit · Cases.gg · Misty", status: "in", items: "Reconstructed real drop tables as presets; guaranteed-tier mix; rotation every 1,000; Upgrader; coinflip; vault; missions; free-entry parity; the Credits & draws lab" },
  { wave: "4", source: "Glass Box (ours)", status: "in", items: "Manifest commitment, beacon, per-open rotation, public ledger root, pools that must distribute, pity ceiling, spend caps, lucky bag, break mode, pooled draw with disclosed EV" },
  { wave: "5", source: "Adjacent models", status: "in", items: "Kuji Last One, Pop Mart secret item, fukubukuro lucky bag, breaks, Omaze-style draws with a free route and a cap, gacha pity" },
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
        <p className="mt-2 text-ink-2">Open packs, run battles, and test any algorithm or rig on simulated players. No real money; every run is reproducible.</p>
      </header>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Labs</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {labs.map((l) => {
            const d = LAB_DOCS[l.id];
            return (
              <Link key={l.id} href={l.href} className="group rounded-xl border border-line bg-surface p-4 no-underline transition hover:border-accent">
                <div className="flex items-start gap-3">
                  <Icon name={l.icon} size={36} />
                  <div>
                    <div className="font-semibold text-ink group-hover:text-accent-ink">{d.title}</div>
                    <div className="mt-1 text-sm text-ink-2">{d.short}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <Card title="How to use it">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Open a lab and play: Open a pack, or Start battle.</li>
          <li>
            Press the cog <Icon name="ph:gear-six" size={14} className="inline text-accent-ink" /> to change items, odds, algorithm, rigs, bots and run sizes.
          </li>
          <li>Press Run simulation for the statistics; results appear below.</li>
          <li>Save or export the run.</li>
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
                    <Badge tone={w.status === "in" ? "good" : w.status === "building" ? "accent" : "neutral"}>{w.status}</Badge>
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
