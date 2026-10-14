import type { JemlitBox, JemlitConfig } from "@/engine/types";
import { JEMLIT_FEATURED, JEMLIT_PACKS, JEMLIT_SUMMARY } from "@/engine/jemlitLive.generated";
import { liveChances } from "@/engine/labs/jemlit";

const DEFAULT_PLAYERS = [
  { id: "guest", name: "Guest (box odds)", share: 0.9 },
  { id: "vip", name: "VIP (own odds)", share: 0.1 },
];

/** A config for one Jemlit box with the page's own chances. The box object travels inside the config. */
export function jemlitConfigFor(box: JemlitBox, base?: JemlitConfig): JemlitConfig {
  const players = (base?.players ?? DEFAULT_PLAYERS).map((p) => ({ id: p.id, name: p.name, share: p.share }));
  return {
    boxSlug: box.slug,
    box,
    chances: liveChances(box),
    creditFace: base?.creditFace ?? 1,
    creditReal: base?.creditReal ?? 0.4,
    itemRealized: base?.itemRealized ?? 0.7,
    provablyFair: base?.provablyFair ?? true,
    clientSeed: base?.clientSeed ?? "my-lucky-seed",
    players,
    activePlayerId: players.some((p) => p.id === base?.activePlayerId) ? (base?.activePlayerId as string) : players[0].id,
    run: base?.run ?? { opens: 20000, verifySample: 200 },
  };
}

export const JEMLIT_DEFAULT_BOX: JemlitBox = JEMLIT_FEATURED.find((b) => b.slug === "apple-ebox") ?? JEMLIT_FEATURED[0];
export const DEFAULT_JEMLIT: JemlitConfig = jemlitConfigFor(JEMLIT_DEFAULT_BOX);

/** Load any of the captured boxes from the public capture folder (the featured ones are embedded). */
export async function loadJemlitBox(slug: string): Promise<JemlitBox> {
  const f = JEMLIT_FEATURED.find((b) => b.slug === slug) ?? JEMLIT_PACKS.find((b) => b.slug === slug);
  if (f) return f;
  const r = await fetch(`/captures/jemlit/${slug}.json`);
  if (!r.ok) throw new Error(`Box not found: ${slug}`);
  const j = (await r.json()) as JemlitBox & { basePrice?: number; riskLevel?: number | null };
  return { slug: j.slug, name: j.name, price: j.price, basePrice: j.basePrice, riskLevel: j.riskLevel, items: j.items };
}

export const JEMLIT_BOX_LIST = JEMLIT_SUMMARY;
export const JEMLIT_DEFAULT_PACK: JemlitBox = JEMLIT_PACKS[0];
export const DEFAULT_JEMLIT_PACKS: JemlitConfig = jemlitConfigFor(JEMLIT_DEFAULT_PACK);
