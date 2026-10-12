import type { MistyConfig } from "@/engine/types";
import { liveWeights, mistyBox } from "@/engine/labs/misty";

/** Misty's Timepiece Suite as the live page had it on 12 October 2026, with the page's own odds and free-spin table. */
export function mistyConfigFor(slug: string, base?: MistyConfig): MistyConfig {
  const box = mistyBox(slug);
  const players = (base?.players ?? DEFAULT_PLAYERS).map((p) => ({ id: p.id, name: p.name, share: p.share }));
  return {
    boxSlug: slug,
    weights: liveWeights(box),
    bonus: box.bonus.map((b) => ({ ...b })),
    misteeFace: base?.misteeFace ?? 1,
    misteeReal: base?.misteeReal ?? 0.37,
    itemRealized: base?.itemRealized ?? 0.7,
    provablyFair: base?.provablyFair ?? true,
    clientSeed: base?.clientSeed ?? "my-lucky-seed",
    players,
    activePlayerId: players.some((p) => p.id === base?.activePlayerId) ? (base?.activePlayerId as string) : players[0].id,
    run: base?.run ?? { opens: 20000, verifySample: 200 },
  };
}

const DEFAULT_PLAYERS = [
  { id: "guest", name: "Guest (box odds)", share: 0.9 },
  { id: "vip", name: "VIP (own odds)", share: 0.1 },
];

export const DEFAULT_MISTY: MistyConfig = mistyConfigFor("timepiece-suite");
