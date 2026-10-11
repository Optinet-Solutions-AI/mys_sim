// Commitment schemes ("provably fair" implementations) with verifiers. Each reproduces a documented operator.
import type { MappingId, SchemeId } from "./types";
import { hmacSha256Hex, hmacSha512Hex, hmacSha512_256Hex, sha256Hex, sha512Hex } from "./hash";
import type { Rng } from "./rng";

export interface DigestInputs {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  opening: number;
  beaconRound?: number;
  beaconValue?: string;
  slug?: string;
}

export interface Scheme {
  id: SchemeId;
  name: string;
  nativeMapping: MappingId;
  usesClientSeed: boolean;
  usesBeacon: boolean;
  usesNonce: boolean;
  /** how the operator publishes its commitment */
  commit(serverSeed: string): string;
  newServerSeed(rng: Rng): string;
  digest(i: DigestInputs): string;
  /** plain-words description of the message layout, used by the verifier page */
  messageLayout: string;
}

const seed64 = (rng: Rng) => rng.hex(32);

export const SCHEMES: Record<SchemeId, Scheme> = {
  none: {
    id: "none",
    name: "No commitment (plain RNG)",
    nativeMapping: "int256-floor",
    usesClientSeed: false,
    usesBeacon: false,
    usesNonce: false,
    commit: () => "",
    newServerSeed: (rng) => seed64(rng),
    // digest is derived from the simulation RNG stream; see labs (they bypass this)
    digest: ({ serverSeed, nonce }) => sha256Hex(serverSeed + ":" + nonce),
    messageLayout: "No commitment is published. The result comes straight from the operator's random number generator.",
  },
  "server-hash": {
    id: "server-hash",
    name: "Server seed hash only (SHA-256), revealed on retire",
    nativeMapping: "int256-mod",
    usesClientSeed: false,
    usesBeacon: false,
    usesNonce: true,
    commit: (s) => sha256Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, nonce }) => sha256Hex(serverSeed + ":" + nonce),
    messageLayout: "digest = SHA256(serverSeed + ':' + nonce). The player contributes nothing.",
  },
  "hmac-sha256": {
    id: "hmac-sha256",
    name: "HMAC-SHA256(server seed, client seed:nonce)",
    nativeMapping: "int256-mod",
    usesClientSeed: true,
    usesBeacon: false,
    usesNonce: true,
    commit: (s) => sha256Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, clientSeed, nonce }) => hmacSha256Hex(serverSeed, clientSeed + ":" + nonce),
    messageLayout: "digest = HMAC_SHA256(key = serverSeed, message = clientSeed + ':' + nonce); ticket = int(digest) mod T.",
  },
  jemlit: {
    id: "jemlit",
    name: "Jemlit: HMAC-SHA512/256(server, 'client-nonce'), roll = int / 16^64 × 100",
    nativeMapping: "int256-floor",
    usesClientSeed: true,
    usesBeacon: false,
    usesNonce: true,
    commit: (s) => sha512Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, clientSeed, nonce }) => hmacSha512_256Hex(serverSeed, clientSeed + "-" + nonce),
    messageLayout:
      "hash_hmac('sha512/256', clientSeed + '-' + nonce, serverSeed); roll = hexdec(hash) / 16^64 × 100; item wins if lower < roll ≤ upper. Commitment is SHA-512 of the server seed.",
  },
  packs: {
    id: "packs",
    name: "Packs.com: HMAC-SHA512 keyed by 'server:client:nonce:opening' over an empty message, 32-bit ticket",
    nativeMapping: "int32-mod",
    usesClientSeed: true,
    usesBeacon: false,
    usesNonce: true,
    commit: (s) => sha256Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, clientSeed, nonce, opening }) => hmacSha512Hex(`${serverSeed}:${clientSeed}:${nonce}:${opening}`, ""),
    messageLayout:
      "digest = HMAC_SHA512(key = serverSeed:clientSeed:nonce:openingNumber, message = ''); ticket = first 8 hex characters reduced to 0..99,999,999. Server seed rotates every opening.",
  },
  misty: {
    id: "misty",
    name: "Misty draw: HMAC-SHA256 keyed by 'DRAW-slug-server-client-count' over an empty message, 13-hex ticket",
    nativeMapping: "int52-floor",
    usesClientSeed: true,
    usesBeacon: false,
    usesNonce: true,
    commit: (s) => sha256Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, clientSeed, nonce, slug }) =>
      hmacSha256Hex(["DRAW", slug ?? "box", serverSeed, clientSeed, String(nonce)].join("-"), ""),
    messageLayout:
      "key = 'DRAW-' + slug + '-' + serverSeed + '-' + clientSeed + '-' + count; digest = HMAC_SHA256(key, ''); position = floor(parseInt(digest[0:13], 16) / 2^52 × count) + 1.",
  },
  razed: {
    id: "razed",
    name: "Razed / EOS pattern: SHA-512(server:blockHash:nonce), block hash as client seed",
    nativeMapping: "int256-mod",
    usesClientSeed: false,
    usesBeacon: true,
    usesNonce: true,
    commit: (s) => sha256Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, beaconValue, nonce }) => sha512Hex(`${serverSeed}:${beaconValue ?? ""}:${nonce}`),
    messageLayout:
      "After players join, the next block hash becomes the client seed; digest = SHA512(serverSeed + ':' + blockHash + ':' + nonce); ticket in 1..100,000,000.",
  },
  glassbox: {
    id: "glassbox",
    name: "Glass Box: HMAC-SHA256(server, client:beaconRound:beaconValue:nonce) mod T, manifest committed, per-open rotation",
    nativeMapping: "int256-mod",
    usesClientSeed: true,
    usesBeacon: true,
    usesNonce: true,
    commit: (s) => sha256Hex(s),
    newServerSeed: (rng) => seed64(rng),
    digest: ({ serverSeed, clientSeed, beaconRound, beaconValue, nonce }) =>
      hmacSha256Hex(serverSeed, `${clientSeed}:${beaconRound ?? 0}:${beaconValue ?? ""}:${nonce}`),
    messageLayout:
      "manifest hash published first; digest = HMAC_SHA256(key = serverSeed, message = clientSeed:beaconRound:beaconValue:nonce); ticket = int(digest) mod T; server seed revealed after every open.",
  },
};

export const SCHEME_IDS = Object.keys(SCHEMES) as SchemeId[];

/** Simulated public beacon: deterministic from the simulation seed, unknown to operator and player in the model. */
export function makeBeacon(rng: Rng) {
  let round = 1_000_000;
  return {
    next(): { round: number; value: string } {
      round += 1;
      return { round, value: sha256Hex("beacon:" + round + ":" + rng.hex(16)) };
    },
  };
}
