import { AGENT_DOCS, MAPPING_DOCS, RNG_DOCS, SCHEME_DOCS, TABLE_DOCS, type DocEntry } from "@/engine/registry";
import { RIGS } from "@/engine/rigs";
import { BATTLE_MODES } from "@/engine/labs/battles";
import { OPERATORS } from "@/lib/operators";
import { Badge, Card } from "@/components/ui";

function Entry({ d }: { d: DocEntry }) {
  return (
    <div id={`${d.family}-${d.id}`} className="rounded-lg border border-line bg-paper p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{d.name}</span>
        <Badge>{d.family}</Badge>
        <span className="font-mono text-[11px] text-ink-3">{d.id}</span>
      </div>
      <p className="mt-1 text-ink-2">{d.summary}</p>
      <dl className="mt-2 grid gap-1 text-xs md:grid-cols-2">
        <div>
          <dt className="font-semibold text-ink-3">Inputs</dt>
          <dd>{d.inputs}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-3">Used by</dt>
          <dd>{d.usedBy}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-3">Known weaknesses</dt>
          <dd>{d.weaknesses}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink-3">Detection</dt>
          <dd>{d.detection}</dd>
        </div>
      </dl>
      <div className="mt-1 text-[11px] text-ink-3">References: {d.references}</div>
    </div>
  );
}

const sections: { id: string; title: string; intro: string; entries: DocEntry[] }[] = [
  { id: "schemes", title: "Commitment schemes", intro: "How a result is produced and proven. Each reproduces a documented operator; the Glass Box entry is our design.", entries: SCHEME_DOCS },
  { id: "mappings", title: "Ticket mappings", intro: "How a hash becomes a ticket in [0, T). This is where modulo bias lives.", entries: MAPPING_DOCS },
  { id: "rngs", title: "Randomness sources", intro: "Used when there is no commitment, and by the simulator itself.", entries: RNG_DOCS },
  { id: "tables", title: "Odds-table models", intro: "How weights are produced.", entries: TABLE_DOCS },
  { id: "agents", title: "Agent policies", intro: "Every participant is a simulated agent with an explicit policy. Where a policy is an assumption, it says so.", entries: AGENT_DOCS },
];

export default function DocsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Docs</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">Every selectable algorithm, mapping, randomness source, odds model, agent policy, battle mode and rig has an entry here, generated from the same metadata the labs use. The research dossiers (documents 01 to 05) are in the repository&apos;s research folder.</p>
        <nav className="mt-2 flex flex-wrap gap-2 text-xs">
          <a href="#labs">Labs</a>
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.title}
            </a>
          ))}
          <a href="#modes">Battle modes</a>
          <a href="#rigs">Rigs</a>
          <a href="#principles">Principles</a>
        </nav>
      </header>

      <Card title={<span id="labs">Sources and their features</span>}>
        <div className="space-y-4">
          {OPERATORS.map((o) => (
            <div key={o.id} className="rounded-lg border border-line bg-paper p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{o.name}</span>
                <Badge tone="accent">{o.kind === "operator" ? "operator" : o.kind === "ours" ? "our design" : o.kind}</Badge>
                <span className="text-[11px] text-ink-3">{o.sources}</span>
              </div>
              <p className="mt-1 text-ink-2">{o.description}</p>
              <ul className="mt-2 grid gap-1 md:grid-cols-2">
                {o.features.map((f) => (
                  <li key={f.key} className="rounded-md border border-line bg-surface px-2 py-1 text-xs">
                    <b>{f.doc.title}.</b> {f.doc.what}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      {sections.map((s) => (
        <Card key={s.id} title={<span id={s.id}>{s.title}</span>}>
          <p className="mb-3 text-sm text-ink-2">{s.intro}</p>
          <div className="space-y-2">
            {s.entries.map((d) => (
              <Entry key={d.id} d={d} />
            ))}
          </div>
        </Card>
      ))}

      <Card title={<span id="modes">Battle modes</span>}>
        <div className="grid gap-2 md:grid-cols-2">
          {BATTLE_MODES.map((m) => (
            <div key={m.id} className="rounded-lg border border-line bg-paper p-3 text-sm">
              <div className="font-medium">{m.name}</div>
              <div className="text-ink-2">{m.rule}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={<span id="rigs">White-hat rigging toolkit</span>}>
        <p className="mb-3 text-sm text-ink-2">Each rig reproduces a manipulation documented in the research, inside the simulator only. The columns say where it was seen, what an honest verifier shows while it runs, and how it can be detected.</p>
        <div className="space-y-2">
          {RIGS.map((r) => (
            <div key={r.id} id={`rig-${r.id}`} className="rounded-lg border border-line bg-paper p-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <Badge tone="bad">rig</Badge>
                <span className="text-[11px] text-ink-3">labs: {r.labs.join(", ")}</span>
              </div>
              <p className="mt-1 text-ink-2">{r.mechanism}</p>
              <dl className="mt-2 grid gap-1 text-xs md:grid-cols-3">
                <div>
                  <dt className="font-semibold text-ink-3">Documented source</dt>
                  <dd>{r.source}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-3">What verification shows</dt>
                  <dd>{r.verificationShows}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-ink-3">Detection</dt>
                  <dd>{r.detection}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </Card>

      <Card title={<span id="principles">Principles and ethics</span>}>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Isolation: each lab has its own configuration and runs; the catalogue is the only shared resource and is read-only.</li>
          <li>Immutability: a run snapshots everything it used. Editing a configuration never changes an earlier run.</li>
          <li>Reproducibility: same snapshot and seed give identical results.</li>
          <li>Honesty is a setting: provably fair can be on, off, bypassed or rigged, so honest, vendor-style and cheating versions of the same box can be compared.</li>
          <li>Ethics: the rigs run only against this engine. Nothing here connects to a live operator. The documentation describes mechanisms and detection, the standard security-research posture.</li>
        </ul>
      </Card>
    </div>
  );
}
