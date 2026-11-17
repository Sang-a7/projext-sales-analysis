import * as XLSX from "xlsx";
import { AnalyzedRow, Filters, ImportMeta } from "./types";
import { groupRows, periodValidity, summarize } from "./analysis";
export const exportRow = (r: AnalyzedRow) => ({
  "SKU Code": r.sku,
  "Product Name": r.name,
  "Product Group": r.group,
  "BCG Classification": r.quadrant,
  "Classification basis": r.classificationBasis,
  "Sales Amount 2025": r.sales25,
  "Sales Amount 2026": r.sales26,
  "Sales Change": r.salesChange,
  "Sales Growth (%)": r.salesGrowth,
  "Sales Contribution (%)": r.contribution,
  "Cumulative Contribution (%)": r.cumulative,
  "Sales Rank": r.rank,
  "Sales Quantity 2025": r.qty25,
  "Sales Quantity 2026": r.qty26,
  "Quantity Change": r.qtyChange,
  "Quantity Growth (%)": r.qtyGrowth,
  "Average Price 2025": r.price25,
  "Average Price 2026": r.price26,
  "Average Price Change": r.priceChange,
  "Average Price Change (%)": r.priceGrowth,
  "%Total GP 2025": r.gp25,
  "%Total GP 2026": r.gp26,
  "GP Change (pp)": r.gpChange,
  "GP Alert Status": r.gpStatus,
  "Estimated GP 2025": r.estimatedGp25,
  "Estimated GP 2026": r.estimatedGp26,
  "Estimated GP Amount Change": r.estimatedGpChange,
  "Performance Status": r.status,
  "Volume Effect": r.volumeEffect,
  "Price Effect": r.priceEffect,
  "Bridge Residual": r.residual,
  "Bridge Reconciles": r.bridgeExact ? "Yes" : "No",
  "Measured Findings": r.findings.join(" "),
  "Suggested Actions": r.recommendations.join(" "),
  Exceptions: r.exceptions.join("; "),
});
function safeCell(value: unknown): unknown {
  return typeof value === "string" && /^[=+\-@\t\r]/.test(value)
    ? "'" + value
    : value;
}
export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a"),
    url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function exportData(
  rows: AnalyzedRow[],
  meta: ImportMeta,
  filters: Filters,
  format: "xlsx" | "csv",
) {
  const data = rows.map((r) =>
    Object.fromEntries(
      Object.entries(exportRow(r)).map(([k, v]) => [
        k,
        format === "csv" ? safeCell(v) : v,
      ]),
    ),
  );
  const sheet = XLSX.utils.json_to_sheet(data);
  if (format === "csv") {
    downloadBlob(
      new Blob(["\uFEFF" + XLSX.utils.sheet_to_csv(sheet)], {
        type: "text/csv;charset=utf-8",
      }),
      "sku-analysis.csv",
    );
    return;
  }
  const book = XLSX.utils.book_new();
  const add = (name: string, data: object[]) =>
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(data), name);
  XLSX.utils.book_append_sheet(book, sheet, "SKU Analysis");
  add("Portfolio", [summarize(rows)]);
  add(
    "Product Groups",
    groupRows(rows, "group").map(({ rows: members, ...g }) => ({
      ...g,
      Stars: members.filter((r) => r.quadrant === "Stars").length,
      "Cash Cows": members.filter((r) => r.quadrant === "Cash Cows").length,
      "Question Marks": members.filter((r) => r.quadrant === "Question Marks")
        .length,
      Dogs: members.filter((r) => r.quadrant === "Dogs").length,
    })),
  );
  add(
    "BCG Summary",
    groupRows(rows, "quadrant").map(({ rows: members, ...g }) => ({
      ...g,
      belowTarget: members.filter((r) => r.gp26 !== null && r.gp26 < 30).length,
      averageGrowth:
        members
          .filter((r) => r.salesGrowth !== null)
          .reduce((a, r) => a + r.salesGrowth!, 0) /
        (members.filter((r) => r.salesGrowth !== null).length || 1),
    })),
  );
  add("Exceptions", rows.filter((r) => r.exceptions.length).map(exportRow));
  add("Reporting Context", [
    {
      ...meta,
      ...periodValidity(meta),
      ...filters,
      exportedAt: new Date().toISOString(),
      note: "Blank numeric cells are unavailable. GP changes are percentage points. Derived GP is estimated. Totals use available inputs; check missing and GP coverage.",
    },
  ]);
  for (const key of ["salesChange", "qtyChange", "gpChange"] as const)
    for (const up of [true, false]) {
      const ranked = rows
        .filter((r) => r[key] !== null && (up ? r[key]! > 0 : r[key]! < 0))
        .sort((a, b) => (up ? b[key]! - a[key]! : a[key]! - b[key]!))
        .slice(0, 10);
      add(key + (up ? " gainers" : " decliners"), ranked.map(exportRow));
    }
  XLSX.writeFile(book, "sku-performance-analysis.xlsx");
}
