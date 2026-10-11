// Ticket mappings: turn a hex digest into a ticket in [0, T). Each is documented in registry.ts.
import type { MappingId } from "./types";
import { sha256Hex } from "./hash";

export interface MappingOutcome {
  ticket: number;
  /** uniform [0,1) estimate used by float mappings; informative only */
  u?: number;
  /** rejection sampling: how many 64-bit chunks were discarded */
  rejected?: number;
}

const TWO32 = 4294967296;
const TWO52 = 4503599627370496;

export function mapTicket(id: MappingId, digestHex: string, T: number): MappingOutcome {
  switch (id) {
    case "int32-mod": {
      const v = parseInt(digestHex.slice(0, 8), 16);
      return { ticket: v % T, u: v / TWO32 };
    }
    case "int32-floor": {
      const v = parseInt(digestHex.slice(0, 8), 16);
      return { ticket: Math.floor((v / TWO32) * T), u: v / TWO32 };
    }
    case "int52-floor": {
      const v = parseInt(digestHex.slice(0, 13), 16);
      return { ticket: Math.floor((v / TWO52) * T), u: v / TWO52 };
    }
    case "int256-mod": {
      const big = BigInt("0x" + digestHex.slice(0, 64));
      return { ticket: Number(big % BigInt(T)) };
    }
    case "int256-floor": {
      const hex = digestHex.slice(0, 64);
      const big = BigInt("0x" + hex);
      const bits = BigInt(hex.length * 4);
      return { ticket: Number((big * BigInt(T)) >> bits), u: Number(big >> (bits - 53n)) / 2 ** 53 };
    }
    case "rejection64": {
      let rejected = 0;
      let hex = digestHex;
      const limit = (2n ** 64n / BigInt(T)) * BigInt(T);
      // consume 16-hex chunks; re-hash when exhausted
      for (;;) {
        for (let i = 0; i + 16 <= hex.length; i += 16) {
          const v = BigInt("0x" + hex.slice(i, i + 16));
          if (v < limit) return { ticket: Number(v % BigInt(T)), rejected };
          rejected++;
        }
        hex = sha256Hex(hex);
      }
    }
    case "float-cumulative": {
      // u from 52 bits; the cumulative comparison itself happens in table.ts (lookupFloat)
      const v = parseInt(digestHex.slice(0, 13), 16);
      return { ticket: Math.floor((v / TWO52) * T), u: v / TWO52 };
    }
  }
}

export const MAPPING_IDS: MappingId[] = [
  "float-cumulative",
  "int32-mod",
  "int32-floor",
  "int52-floor",
  "int256-mod",
  "int256-floor",
  "rejection64",
];
