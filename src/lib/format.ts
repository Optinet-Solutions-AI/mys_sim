export const money = (v: number, dp?: number) =>
  "$" + v.toLocaleString(undefined, { minimumFractionDigits: dp ?? (Math.abs(v) < 10 ? 2 : 0), maximumFractionDigits: dp ?? (Math.abs(v) < 10 ? 2 : 0) });
export const pct = (v: number, dp = 1) => (v * 100).toFixed(dp) + "%";
export const pctSmart = (v: number) => (v * 100).toFixed(v < 0.0001 ? 5 : v < 0.001 ? 4 : v < 0.01 ? 3 : 2) + "%";
export const num = (v: number) => v.toLocaleString();
export const oneIn = (p: number) => (p > 0 ? "1 in " + Math.round(1 / p).toLocaleString() : "never");
export const sci = (v: number) => (v === 0 ? "0" : v < 1e-4 ? v.toExponential(1) : v.toFixed(4));
