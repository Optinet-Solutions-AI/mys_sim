import type { KitBattlesConfig } from "@/engine/types";
import { GLASSBOX_BOX, LUCKY_BAG, VENDOR_BOX } from "./presets";

/**
 * Evo Verse battles on the kit's logic. The admin panel holds every setting; the player's choice sits inside it.
 * The simulator switches every mode on so each can be tried; the kit's production default is normal, crazy and terminal.
 */
export const DEFAULT_KIT_BATTLES: KitBattlesConfig = {
  settings: {
    enabled: true,
    modesAllowed: ["normal", "crazy", "terminal", "jackpot", "group", "break", "coinflip"],
    seatsAllowed: [2, 3, 4],
    roundsMax: 10,
    feePercent: 0,
    coinflipEdge: 0.05,
    countdownSeconds: 3,
    openExpiryMinutes: 30,
    privateAllowed: true,
    botsEnabled: true,
    botNames: ["Atlas", "Nova", "Rook", "Juno", "Sable", "Orion", "Vega"],
    maxConcurrentPerPlayer: 3,
    creditFaceCents: 100,
    sponsored: { enabled: false, sponsor: "Evo Verse" },
  },
  boxes: [VENDOR_BOX, GLASSBOX_BOX, LUCKY_BAG],
  play: { mode: "normal", seats: 4, rounds: [0, 0, 0], humans: 1 },
};
