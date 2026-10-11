import { CATALOG_BY_ID } from "@/engine/catalog";
import { ENGINE_VERSION } from "@/engine";
import type { AnyConfig, AnyResult, BoxDef, CatalogItem, LabId, RunRecord } from "@/engine/types";
import { newId, saveRun } from "./store";
import { headlineFor } from "./report";

function boxesOf(config: AnyConfig): BoxDef[] {
  if ("boxes" in config) return config.boxes;
  if ("box" in config) return [config.box];
  return [];
}

export async function persistRun(lab: LabId, name: string, config: AnyConfig, sizes: Record<string, number>, seed: number, result: AnyResult): Promise<RunRecord> {
  const ids = new Set(boxesOf(config).flatMap((b) => b.items.map((i) => i.itemId)));
  const catalogSnapshot: CatalogItem[] = [...ids].map((id) => CATALOG_BY_ID.get(id)!).filter(Boolean);
  const run: RunRecord = {
    id: newId("run"),
    lab,
    name,
    createdAt: new Date().toISOString(),
    seed,
    engineVersion: ENGINE_VERSION,
    config: JSON.parse(JSON.stringify(config)),
    sizes,
    catalogSnapshot,
    result,
  };
  await saveRun(run, headlineFor(result));
  return run;
}
