"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { deleteRun, listRuns, type RunSummary } from "@/lib/store";
import { Badge, Button, Card, Th, Td } from "./ui";
import { Icon } from "./Icon";

const LAB_LABEL: Record<string, string> = { "mystery-box": "Mystery Boxes", sellback: "Sell-back", battles: "Battles", retention: "Retention", credits: "Credits & draws", upgrader: "Upgrader & Deals" };

export function RunsList() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [compare, setCompare] = useState<string[]>([]);
  const load = () => listRuns().then(setRuns).catch(() => setRuns([]));
  useEffect(() => {
    load();
  }, []);
  const shown = (runs ?? []).filter((r) => filter === "all" || r.lab === filter);
  const compareLab = compare.length ? (runs ?? []).find((r) => r.id === compare[0])?.lab : undefined;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Run history</h1>
          <p className="mt-1 text-sm text-ink-2">Saved in this browser (IndexedDB). Phase 2 moves history to Supabase so it can be shared. Comparisons are only offered within one lab.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-44">
            <option value="all">All labs</option>
            {Object.entries(LAB_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          {compare.length === 2 && (
            <Link href={`/runs/${compare[0]}?compare=${compare[1]}`} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white no-underline">
              Compare selected
            </Link>
          )}
        </div>
      </header>
      <Card>
        {runs === null ? (
          <p className="text-sm text-ink-3">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-ink-3">No saved runs yet. Run a lab and click &ldquo;Save run to history&rdquo;.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Compare</Th>
                  <Th>Lab</Th>
                  <Th>Name</Th>
                  <Th>Headline</Th>
                  <Th>Seed</Th>
                  <Th>Created</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const disabled = compare.length >= 2 && !compare.includes(r.id) ? true : !!(compareLab && compareLab !== r.lab && !compare.includes(r.id));
                  return (
                    <tr key={r.id}>
                      <Td>
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={compare.includes(r.id)}
                          onChange={(e) => setCompare(e.target.checked ? [...compare, r.id] : compare.filter((x) => x !== r.id))}
                          title={disabled ? "Compare two runs of the same lab" : "Select for comparison"}
                        />
                      </Td>
                      <Td>
                        <Badge tone="accent">{LAB_LABEL[r.lab] ?? r.lab}</Badge>
                      </Td>
                      <Td>
                        <Link href={`/runs/${r.id}`}>{r.name}</Link>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-2">{r.headline}</span>
                      </Td>
                      <Td mono>{r.seed}</Td>
                      <Td>
                        <span className="text-xs text-ink-3">{new Date(r.createdAt).toLocaleString()}</span>
                      </Td>
                      <Td>
                        <Button
                          kind="danger"
                          onClick={async () => {
                            await deleteRun(r.id);
                            load();
                          }}
                        >
                          <Icon name="ph:trash" size={14} /> Delete
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
