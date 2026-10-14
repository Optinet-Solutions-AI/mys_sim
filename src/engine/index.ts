import { CATALOG, CATALOG_BY_ID } from "./catalog";
import { runMysteryBox } from "./labs/mysteryBox";
import { runSellback } from "./labs/sellback";
import { runBattles } from "./labs/battles";
import { runRetention } from "./labs/retention";
import { runCredits } from "./labs/credits";
import { runUpgrader } from "./labs/upgrader";
import { runMisty } from "./labs/misty";
import { runJemlit } from "./labs/jemlit";
import { runIcybox } from "./labs/icybox";
import type {
  AnyConfig,
  AnyResult,
  BattlesConfig,
  CatalogItem,
  CreditsConfig,
  LabId,
  MysteryBoxConfig,
  Progress,
  RetentionConfig,
  SellbackConfig,
  UpgraderConfig,
  MistyConfig,
  JemlitConfig,
  IcyboxConfig,
} from "./types";

export const ENGINE_VERSION = "0.2.0";

export interface RunRequest {
  lab: LabId;
  config: AnyConfig;
  sizes: Record<string, number>;
  seed: number;
  catalog?: CatalogItem[];
}

export function runLab(req: RunRequest, onProgress?: Progress): AnyResult {
  const catalog = req.catalog ? new Map(req.catalog.map((c) => [c.id, c])) : CATALOG_BY_ID;
  switch (req.lab) {
    case "mystery-box":
      return runMysteryBox(req.config as MysteryBoxConfig, { opens: req.sizes.opens ?? 10000, verifySample: req.sizes.verifySample ?? 200 }, req.seed, catalog, onProgress);
    case "sellback":
      return runSellback(req.config as SellbackConfig, req.seed, catalog, onProgress);
    case "battles":
      return runBattles(req.config as BattlesConfig, req.sizes.battles ?? 1000, req.seed, catalog, onProgress);
    case "retention":
      return runRetention(req.config as RetentionConfig, req.seed, catalog, onProgress);
    case "credits":
      return runCredits(req.config as CreditsConfig, req.seed, catalog, onProgress);
    case "upgrader":
      return runUpgrader(req.config as UpgraderConfig, req.seed, catalog, onProgress);
    case "misty":
      return runMisty(req.config as MistyConfig, req.seed, onProgress);
    case "jemlit":
      return runJemlit(req.config as JemlitConfig, req.seed, onProgress);
    case "jemlit-games":
      throw new Error("The Jemlit games are played on the page; they have no batch simulation.");
    case "icybox":
      return runIcybox(req.config as IcyboxConfig, req.seed, onProgress);
  }
}

export { CATALOG, CATALOG_BY_ID };
export * from "./types";
