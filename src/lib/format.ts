import { Value } from "./types";
export function fmt(n: Value | undefined, digits = 1) {
  return n === null || n === undefined
    ? "Data Unavailable"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(
        n,
      );
}
export function pct(n: Value | undefined) {
  return n === null || n === undefined ? "N/A" : fmt(n) + "%";
}
export function pp(n: Value | undefined) {
  return n === null || n === undefined
    ? "Data Unavailable"
    : (n > 0 ? "+" : "") + fmt(n) + " pp";
}
export function compact(n: Value | undefined) {
  return n === null || n === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 2,
      }).format(n);
}
export const tone = (n: Value | undefined) =>
  n === null || n === undefined || n === 0
    ? "neutral"
    : n > 0
      ? "positive"
      : "negative";
export const gpTone = (n: Value) =>
  n === null
    ? "neutral"
    : n < 0
      ? "gp-loss"
      : n < 20
        ? "gp-critical"
        : n < 30
          ? "gp-high-risk"
          : n < 35
            ? "gp-caution"
            : "gp-healthy";
