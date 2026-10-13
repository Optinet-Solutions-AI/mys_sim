// Randomness sources. The simulation itself always uses a seeded generator so runs are reproducible.
// The sources below are also selectable as the thing under test when the commitment scheme is "none".
import type { RngId } from "./types";

export interface Rng {
  /** uniform float in [0, 1) */
  next(): number;
  /** uniform integer in [0, n) */
  int(n: number): number;
  /** 32 random bits as unsigned */
  u32(): number;
  /** 64 random bits as hex */
  hex(bytes: number): string;
  readonly id: RngId;
}

/** cyrb128 string hash to 4 x 32-bit seeds */
export function seedFromString(str: string): [number, number, number, number] {
  let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0, k; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

function base(id: RngId, u32: () => number): Rng {
  const next = () => u32() / 4294967296;
  return {
    id,
    u32,
    next,
    int: (n) => Math.floor(next() * n),
    hex: (bytes) => {
      let s = "";
      for (let i = 0; i < bytes; i += 4) s += u32().toString(16).padStart(8, "0");
      return s.slice(0, bytes * 2);
    },
  };
}

/** sfc32: small fast chaotic generator, 128-bit state, good statistical quality for simulation. */
export function sfc32(seed: number | string): Rng {
  const s = typeof seed === "string" ? seedFromString(seed) : seedFromString("seed:" + seed);
  let a = s[0], b = s[1], c = s[2], d = s[3];
  const u32 = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
  for (let i = 0; i < 12; i++) u32();
  return base("sfc32", u32);
}

/** Textbook linear congruential generator (Numerical Recipes constants). Deliberately weak. */
export function lcg(seed: number | string): Rng {
  let state = seedFromString(typeof seed === "string" ? seed : "lcg:" + seed)[0] >>> 0;
  const u32 = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state;
  };
  return base("lcg", u32);
}

/** Math.random: unseeded, not reproducible. Included as the naive baseline. */
export function mathRandom(): Rng {
  const u32 = () => Math.floor(Math.random() * 4294967296) >>> 0;
  return base("math-random", u32);
}

/** Cryptographically secure, unseeded, not reproducible. */
export function csprng(): Rng {
  const buf = new Uint32Array(256);
  let i = buf.length;
  const u32 = () => {
    if (i >= buf.length) {
      crypto.getRandomValues(buf);
      i = 0;
    }
    return buf[i++];
  };
  return base("csprng", u32);
}

export function makeRng(id: RngId, seed: number | string): Rng {
  switch (id) {
    case "sfc32":
      return sfc32(seed);
    case "lcg":
      return lcg(seed);
    case "math-random":
      return mathRandom();
    case "csprng":
      return csprng();
  }
}

/** Standard normal via Box-Muller */
export function normal(rng: Rng): number {
  let u = 0, v = 0;
  while (u === 0) u = rng.next();
  while (v === 0) v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Lognormal with given median and sigma */
export function lognormal(rng: Rng, median: number, sigma: number): number {
  return median * Math.exp(sigma * normal(rng));
}
