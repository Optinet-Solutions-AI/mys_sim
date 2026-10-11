import { CATALOG, TIER_LABEL, TIER_ORDER } from "@/engine/catalog";
import { ItemTile, TierBadge } from "@/components/ItemTile";
import { Card } from "@/components/ui";
import { money } from "@/lib/format";

export default function CatalogPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Catalogue</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          {CATALOG.length} fictional but realistic luxury items with three price layers: retail (boutique), asking (resale listings) and realized (what items actually sell for). Brands are invented. Prices are shaped like the research: realized below asking below retail for most, and above retail for the rationed bags. Images are placeholder icons on tier-coloured tiles.
        </p>
      </header>
      {TIER_ORDER.map((tier) => (
        <Card key={tier} title={<span className="flex items-center gap-2">{TIER_LABEL[tier]} <TierBadge tier={tier} /></span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {CATALOG.filter((c) => c.tier === tier).map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-line bg-paper p-2">
                <ItemTile item={c} size={48} />
                <div className="min-w-0 flex-1 text-xs">
                  <div className="truncate font-medium text-ink">{c.name}</div>
                  <div className="text-ink-3">
                    {c.brand} · {c.category} · confidence {c.confidence}
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 font-mono text-[11px]">
                    <span title="retail">R {money(c.retail)}</span>
                    <span title="asking">A {money(c.asking)}</span>
                    <span title="realized" className="font-semibold">
                      Z {money(c.realized)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      <p className="text-xs text-ink-3">R = retail, A = asking, Z = realized. Editable catalogue and item versioning arrive with Supabase in phase 2; in phase 1 the catalogue is the file src/engine/catalog.ts.</p>
    </div>
  );
}
