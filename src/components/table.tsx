"use client";
import { useState } from "react";
import { AnalyzedRow } from "@/lib/types";
import { fmt, pct, pp, tone, gpTone } from "@/lib/format";
export type Column = {
  key: keyof AnalyzedRow;
  label: string;
  format?: "percent" | "pp";
};
export const BCG_COLUMNS: Column[] = [
  { key: "sku", label: "SKU code" },
  { key: "name", label: "Product name" },
  { key: "group", label: "Product group" },
  { key: "sales25", label: "Sales 2025" },
  { key: "sales26", label: "Sales 2026" },
  { key: "salesGrowth", label: "Sales growth", format: "percent" },
  { key: "contribution", label: "Contribution", format: "percent" },
  { key: "cumulative", label: "Cumulative", format: "percent" },
  { key: "rank", label: "Sales rank" },
  { key: "qty25", label: "Quantity 2025" },
  { key: "qty26", label: "Quantity 2026" },
  { key: "price25", label: "Avg price 2025" },
  { key: "price26", label: "Avg price 2026" },
  { key: "gp25", label: "GP 2025", format: "percent" },
  { key: "gp26", label: "GP 2026", format: "percent" },
  { key: "gpChange", label: "GP change", format: "pp" },
  { key: "gpStatus", label: "GP alert" },
  { key: "quadrant", label: "BCG classification" },
];
export const YOY_COLUMNS: Column[] = [
  ...BCG_COLUMNS.slice(0, 3),
  { key: "quadrant", label: "BCG quadrant" },
  { key: "qty25", label: "Qty 2025" },
  { key: "qty26", label: "Qty 2026" },
  { key: "qtyChange", label: "Qty change" },
  { key: "qtyGrowth", label: "Qty growth", format: "percent" },
  { key: "sales25", label: "Sales 2025" },
  { key: "sales26", label: "Sales 2026" },
  { key: "salesChange", label: "Sales change" },
  { key: "salesGrowth", label: "Sales growth", format: "percent" },
  { key: "price25", label: "Avg price 2025" },
  { key: "price26", label: "Avg price 2026" },
  { key: "priceGrowth", label: "Price change", format: "percent" },
  { key: "gp25", label: "GP 2025", format: "percent" },
  { key: "gp26", label: "GP 2026", format: "percent" },
  { key: "gpChange", label: "GP change", format: "pp" },
  { key: "estimatedGpChange", label: "Estimated GP change" },
  { key: "status", label: "Performance status" },
];
export function DataTable({
  rows,
  columns,
  onSelect,
  label,
}: {
  rows: AnalyzedRow[];
  columns: Column[];
  onSelect: (r: AnalyzedRow) => void;
  label: string;
}) {
  const [sort, setSort] = useState<{ key: keyof AnalyzedRow; asc: boolean }>({
      key: "sales26",
      asc: false,
    }),
    [page, setPage] = useState(0),
    [expanded, setExpanded] = useState<string | null>(null);
  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key],
      bv = b[sort.key];
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    return (
      (typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv))) * (sort.asc ? 1 : -1)
    );
  });
  const pages = Math.max(1, Math.ceil(rows.length / 15)),
    current = Math.min(page, pages - 1);
  return (
    <>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={label}
      >
        <table>
          <thead>
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  aria-sort={
                    sort.key === c.key
                      ? sort.asc
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  <button
                    onClick={() =>
                      setSort({
                        key: c.key,
                        asc: sort.key === c.key ? !sort.asc : false,
                      })
                    }
                  >
                    {c.label}{" "}
                    <span>
                      {sort.key === c.key ? (sort.asc ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                </th>
              ))}
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {sorted.slice(current * 15, current * 15 + 15).map((r) => (
              <TableRows
                key={r.sku}
                row={r}
                columns={columns}
                open={expanded === r.sku}
                onExpand={() => setExpanded(expanded === r.sku ? null : r.sku)}
                onSelect={() => onSelect(r)}
              />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length + 1} className="no-results">
                  No SKUs match this selection.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span>{rows.length} SKUs · Scroll horizontally for all metrics</span>
        <div>
          <button
            className="icon-button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            aria-label="Previous page"
          >
            ←
          </button>
          <span>
            {current + 1} / {pages}
          </span>
          <button
            className="icon-button"
            disabled={current === pages - 1}
            onClick={() => setPage(current + 1)}
            aria-label="Next page"
          >
            →
          </button>
        </div>
      </div>
    </>
  );
}
function TableRows({
  row: r,
  columns,
  open,
  onExpand,
  onSelect,
}: {
  row: AnalyzedRow;
  columns: Column[];
  open: boolean;
  onExpand: () => void;
  onSelect: () => void;
}) {
  return (
    <>
      <tr>
        {columns.map((c) => {
          const value = r[c.key],
            num = typeof value === "number" ? value : null;
          return (
            <td
              key={c.key}
              className={
                /Growth|Change/.test(c.key)
                  ? tone(num)
                  : c.key === "gp26"
                    ? gpTone(num)
                    : ""
              }
            >
              {c.key === "sku" ? (
                <button className="sku-link" onClick={onSelect}>
                  {r.sku}
                </button>
              ) : c.key === "quadrant" ? (
                <span className={"badge q-" + r.quadrant.replaceAll(" ", "-")}>
                  {r.quadrant}
                </span>
              ) : c.key === "gpStatus" ? (
                <span className={gpTone(r.gp26)}>{String(value)}</span>
              ) : c.format === "percent" ? (
                value === null &&
                (c.key.startsWith("gp") ||
                  (c.key === "salesGrowth" &&
                    (r.sales25 === null || r.sales26 === null)) ||
                  (c.key === "qtyGrowth" &&
                    (r.qty25 === null || r.qty26 === null)) ||
                  (c.key === "priceGrowth" &&
                    (r.price25 === null || r.price26 === null)) ||
                  c.key === "contribution" ||
                  c.key === "cumulative") ? (
                  "Data Unavailable"
                ) : (
                  pct(num)
                )
              ) : c.format === "pp" ? (
                pp(num)
              ) : typeof value === "number" ? (
                fmt(value)
              ) : value === null ? (
                "Data Unavailable"
              ) : (
                String(value)
              )}
            </td>
          );
        })}
        <td>
          <button
            className="text-button"
            aria-expanded={open}
            onClick={onExpand}
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={columns.length + 1} className="expanded">
            <strong>
              {r.name} · {r.status}
            </strong>
            <p>{r.findings.join(" ") || "No measured movement available."}</p>
            <p>Suggested action: {r.recommendations.join(" ")}</p>
            <button className="text-button" onClick={onSelect}>
              Open full SKU analysis →
            </button>
          </td>
        </tr>
      )}
    </>
  );
}
