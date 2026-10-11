import { Icon } from "./Icon";
import type { CatalogItem } from "@/engine/types";
import { TIER_LABEL } from "@/engine/catalog";

/** A "product image": icon on a tier-coloured tile with the brand monogram. */
export function ItemTile({ item, size = 56 }: { item: CatalogItem; size?: number }) {
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-xl"
      style={{ width: size, height: size, background: item.color + "1a", border: `1px solid ${item.color}55` }}
      title={`${item.brand} · ${item.name} · ${TIER_LABEL[item.tier]}`}
    >
      <Icon name={item.icon} size={Math.round(size * 0.58)} />
      <span
        className="absolute bottom-0.5 right-1 text-[9px] font-bold uppercase tracking-tight"
        style={{ color: item.color }}
      >
        {item.brand.split(" ")[0].slice(0, 3)}
      </span>
    </div>
  );
}

export function TierBadge({ tier }: { tier: CatalogItem["tier"] }) {
  const color = `var(--color-tier-${tier})`;
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white" style={{ background: color }}>
      {TIER_LABEL[tier]}
    </span>
  );
}
