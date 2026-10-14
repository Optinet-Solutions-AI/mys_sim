import type { IcyboxBox, IcyboxConfig } from "@/engine/types";
import { ICYBOX_BOXES, icyboxBox, liveChances } from "@/engine/labs/icybox";

/** A config for a box: the reconstructed chances and the reported money rules. Every number is editable in the back office. */
export function icyboxConfigFor(box: IcyboxBox, base?: Partial<IcyboxConfig>): IcyboxConfig {
  return {
    boxSlug: box.slug,
    chances: liveChances(box),
    buybackPercent: base?.buybackPercent ?? 0.9,
    buybackWindowHours: base?.buybackWindowHours ?? 72,
    missWindowRate: base?.missWindowRate ?? 0.1,
    keepRate: base?.keepRate ?? 0.3,
    shippingFee: base?.shippingFee ?? 30,
    taxRate: base?.taxRate ?? 0.08,
    withdrawMin: base?.withdrawMin ?? 6,
    withdrawFee: base?.withdrawFee ?? 2,
    itemRealized: base?.itemRealized ?? 0.6,
    drop: base?.drop ? { ...base.drop } : { enabled: false, copies: 1000, retireAt: 0 },
    run: base?.run ? { ...base.run } : { opens: 200000 },
  };
}
export const ICYBOX_DEFAULT_BOX: IcyboxBox = icyboxBox("ruby");
export const DEFAULT_ICYBOX: IcyboxConfig = icyboxConfigFor(ICYBOX_DEFAULT_BOX);
export const ICYBOX_BOX_LIST = ICYBOX_BOXES;
