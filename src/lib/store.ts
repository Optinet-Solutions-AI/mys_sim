// Phase-1 storage: the browser's IndexedDB via idb-keyval. Same interface a Supabase adapter will implement in phase 2.
import { get, set, del, keys } from "idb-keyval";
import type { AnyConfig, LabId, RunRecord } from "@/engine/types";

export interface RunSummary {
  id: string;
  lab: LabId;
  name: string;
  createdAt: string;
  seed: number;
  headline: string;
}

export interface SavedConfig {
  id: string;
  lab: LabId;
  name: string;
  version: number;
  parentId?: string;
  createdAt: string;
  config: AnyConfig;
  sizes: Record<string, number>;
}

const RUNS_INDEX = "runs:index";
const CONFIGS_INDEX = "configs:index";

export function newId(prefix: string): string {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export async function listRuns(): Promise<RunSummary[]> {
  return (await get<RunSummary[]>(RUNS_INDEX)) ?? [];
}

export async function saveRun(run: RunRecord, headline: string): Promise<void> {
  const idx = await listRuns();
  idx.unshift({ id: run.id, lab: run.lab, name: run.name, createdAt: run.createdAt, seed: run.seed, headline });
  await set(`run:${run.id}`, run);
  await set(RUNS_INDEX, idx.slice(0, 500));
}

export async function getRun(id: string): Promise<RunRecord | undefined> {
  return get<RunRecord>(`run:${id}`);
}

export async function deleteRun(id: string): Promise<void> {
  const idx = (await listRuns()).filter((r) => r.id !== id);
  await set(RUNS_INDEX, idx);
  await del(`run:${id}`);
}

export async function listConfigs(lab?: LabId): Promise<SavedConfig[]> {
  const all = (await get<SavedConfig[]>(CONFIGS_INDEX)) ?? [];
  return lab ? all.filter((c) => c.lab === lab) : all;
}

/** Configs are insert-only: saving an edited config creates a new version with a parent pointer. */
export async function saveConfig(c: Omit<SavedConfig, "id" | "createdAt" | "version"> & { parentId?: string }): Promise<SavedConfig> {
  const all = (await get<SavedConfig[]>(CONFIGS_INDEX)) ?? [];
  const siblings = all.filter((x) => x.lab === c.lab && x.name === c.name);
  const version = siblings.length ? Math.max(...siblings.map((s) => s.version)) + 1 : 1;
  const saved: SavedConfig = { ...c, id: newId("cfg"), createdAt: new Date().toISOString(), version };
  all.unshift(saved);
  await set(CONFIGS_INDEX, all.slice(0, 500));
  return saved;
}

export async function deleteConfig(id: string): Promise<void> {
  const all = (await get<SavedConfig[]>(CONFIGS_INDEX)) ?? [];
  await set(
    CONFIGS_INDEX,
    all.filter((c) => c.id !== id),
  );
}

export async function clearAll(): Promise<void> {
  for (const k of await keys()) await del(k);
}
