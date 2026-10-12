import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Badge, Card } from "@/components/ui";
import { OPERATORS } from "@/lib/operators";
import { skinFor } from "@/lib/skins";

const KIND_LABEL: Record<string, string> = { operator: "Operators we audited", ours: "Our design", adjacent: "Adjacent models", research: "Research" };

export default function Home() {
  const kinds = ["operator", "ours", "adjacent", "research"] as const;
  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <div className="mb-2 flex items-center gap-2">
          <Badge tone="accent">Feature hub · research sandbox</Badge>
          <Badge>phase 1 · browser only</Badge>
        </div>
        <h1 className="text-3xl font-semibold">Mystery Box Simulator</h1>
        <p className="mt-2 text-ink-2">Each source has its own section, in its own look, with its own features and presets. Open one, play, press the cog to change settings, run the simulation for the statistics.</p>
      </header>

      {kinds.map((k) => (
        <section key={k}>
          <h2 className="mb-2 text-lg font-semibold">{KIND_LABEL[k]}</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {OPERATORS.filter((o) => o.kind === k).map((o) => {
              const skin = skinFor(o.id);
              const accent = skin.vars["--color-accent"];
              const soft = skin.vars["--color-accent-soft"];
              return (
                <Link key={o.id} href={`/operators/${o.id}`} className="group rounded-xl border border-line bg-surface p-4 no-underline transition hover:border-accent" style={{ borderLeft: `5px solid ${accent}` }}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: skin.dark ? accent : soft }}>
                      <Icon name={o.icon} size={28} />
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-ink group-hover:text-accent-ink">{o.name}</div>
                      <div className="mt-0.5 text-xs text-ink-2">{o.tagline}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {o.features.map((f) => (
                          <span key={f.key} className="rounded-full border border-line bg-paper px-2 py-0.5 text-[11px] text-ink-2">
                            {f.doc.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <Card title="How to use it">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Pick a source and one of its features: you land on its test page, in that source&apos;s look, and can play at once.</li>
          <li>
            <Icon name="ph:user" size={14} className="inline text-accent-ink" /> Player view explains how it works for a player; <Icon name="ph:question" size={14} className="inline text-accent-ink" /> Settings explained covers the configuration and the algorithm, all in plain words.
          </li>
          <li>
            Press the cog <Icon name="ph:gear-six" size={14} className="inline text-accent-ink" /> to change what that source lets you change, plus the research toggles (algorithm, rigs).
          </li>
          <li>Press Run simulation for the statistics; results appear below. Save or export the run.</li>
        </ol>
      </Card>
      <p className="text-xs text-ink-3">Sources are kept apart on purpose: each has its own structure, and the simulator reproduces each as it is. The plan, scorecard and sources are in the research folder (document 05). Phase 2 adds Supabase for shared history and Vercel hosting.</p>
    </div>
  );
}
