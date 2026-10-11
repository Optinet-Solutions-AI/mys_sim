// Hash helpers over @noble/hashes (synchronous, audited). Hex in, hex out.
import { sha256, sha512, sha512_256 } from "@noble/hashes/sha2.js";
import { hmac } from "@noble/hashes/hmac.js";
import { bytesToHex, utf8ToBytes, randomBytes } from "@noble/hashes/utils.js";

export const sha256Hex = (s: string) => bytesToHex(sha256(utf8ToBytes(s)));
export const sha512Hex = (s: string) => bytesToHex(sha512(utf8ToBytes(s)));
export const hmacSha256Hex = (key: string, msg: string) => bytesToHex(hmac(sha256, utf8ToBytes(key), utf8ToBytes(msg)));
export const hmacSha512Hex = (key: string, msg: string) => bytesToHex(hmac(sha512, utf8ToBytes(key), utf8ToBytes(msg)));
export const hmacSha512_256Hex = (key: string, msg: string) =>
  bytesToHex(hmac(sha512_256, utf8ToBytes(key), utf8ToBytes(msg)));
export const randomHex = (bytes: number) => bytesToHex(randomBytes(bytes));

/** Canonical JSON: sorted keys, no whitespace. Numbers must already be integers or short decimals. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]))
      .join(",") +
    "}"
  );
}

/** Merkle root over hex leaves (SHA-256), duplicating the last leaf on odd levels. */
export function merkleRoot(leaves: string[]): string {
  if (leaves.length === 0) return sha256Hex("");
  let level = leaves.slice();
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(sha256Hex(a + b));
    }
    level = next;
  }
  return level[0];
}
