// Statistics used by the labs and the detector.
import type { ChiSquare, Histogram } from "./types";

/** Regularized upper incomplete gamma Q(a, x) via series / continued fraction (Numerical Recipes). */
export function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    // series for P, return 1 − P
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 500; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return Math.max(0, 1 - sum * Math.exp(-x + a * Math.log(x) - lnGamma(a)));
  }
  // continued fraction for Q
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.min(1, Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h);
}

export function lnGamma(z: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/** Chi-square goodness of fit; cells with expected < 5 are merged into one "rare" cell. */
export function chiSquare(observed: number[], expected: number[]): ChiSquare {
  let stat = 0, cells = 0, mergedO = 0, mergedE = 0, merged = 0;
  for (let i = 0; i < observed.length; i++) {
    if (expected[i] < 5) {
      mergedO += observed[i];
      mergedE += expected[i];
      merged++;
      continue;
    }
    stat += (observed[i] - expected[i]) ** 2 / expected[i];
    cells++;
  }
  if (mergedE > 0) {
    stat += (mergedO - mergedE) ** 2 / mergedE;
    cells++;
  }
  const df = Math.max(1, cells - 1);
  return { statistic: stat, df, pValue: gammaQ(df / 2, stat / 2), merged };
}

/** Log-spaced histogram of positive values (payouts). */
export function logHistogram(values: number[], label: string, bins = 14, min = 1, max = 100000): Histogram {
  const edges: number[] = [];
  const lmin = Math.log10(min), lmax = Math.log10(max);
  for (let i = 0; i <= bins; i++) edges.push(Math.pow(10, lmin + ((lmax - lmin) * i) / bins));
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    if (v < min) {
      counts[0]++;
      continue;
    }
    const k = Math.min(bins - 1, Math.floor(((Math.log10(v) - lmin) / (lmax - lmin)) * bins));
    counts[k]++;
  }
  return { edges, counts, label };
}

export function linearHistogram(values: number[], label: string, bins = 20, min = 0, max = 5): Histogram {
  const edges: number[] = [];
  for (let i = 0; i <= bins; i++) edges.push(min + ((max - min) * i) / bins);
  const counts = new Array(bins).fill(0);
  for (const v of values) {
    const k = Math.max(0, Math.min(bins - 1, Math.floor(((v - min) / (max - min)) * bins)));
    counts[k]++;
  }
  return { edges, counts, label };
}

export function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))));
  return sorted[idx];
}

/** Sample size needed to detect a relative shortfall r in a probability p at ~95% confidence, 80% power (normal approx). */
export function detectSampleSize(p: number, relativeShortfall: number): number {
  const p1 = p * (1 - relativeShortfall);
  const delta = Math.abs(p - p1);
  if (delta <= 0) return Infinity;
  const z = 1.96 + 0.84;
  return Math.ceil((z * z * (p * (1 - p) + p1 * (1 - p1))) / (delta * delta));
}

/** Streaming mean/variance (Welford) */
export class Welford {
  n = 0;
  mean = 0;
  m2 = 0;
  add(x: number) {
    this.n++;
    const d = x - this.mean;
    this.mean += d / this.n;
    this.m2 += d * (x - this.mean);
  }
  get variance() {
    return this.n > 1 ? this.m2 / (this.n - 1) : 0;
  }
  get sd() {
    return Math.sqrt(this.variance);
  }
}
