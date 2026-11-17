"use client";
import { Fragment, useState } from "react";
import { AnalyzedRow, QUADRANTS } from "@/lib/types";
import { groupRows } from "@/lib/analysis";
import { fmt, pct, pp, tone } from "@/lib/format";
import { DataTable, YOY_COLUMNS } from "./table";
export function ProductGroups({
  rows,
  onSelect,
}: {
  rows: AnalyzedRow[];
  onSelect: (r: AnalyzedRow) => void;
}) {
  const [expanded, setExpanded] = useState<string[]>([]);
  return (
    <section className="panel" id="groups">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">06 / THE CATEGORY VIEW</span>
          <h3>Product group analysis</h3>
          <p>
            Expand any product group for a complete, sortable SKU-level
            comparison.
          </p>
        </div>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Product group analysis"
      >
        <table>
          <thead>
            <tr>
              {[
                "Product group",
                "SKUs",
                "Sales 2025",
                "Sales 2026",
                "Sales growth",
                "Qty 2025",
                "Qty 2026",
                "Qty growth",
                "Weighted GP 2025",
                "Weighted GP 2026",
                "GP change",
                "GP coverage 25 / 26",
                ...QUADRANTS,
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groupRows(rows, "group").map((g) => {
              const open = expanded.includes(g.name);
              return (
                <Fragment key={g.name}>
                  <tr>
                    <td>
                      <button
                        className="group-expand"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((old) =>
                            open
                              ? old.filter((v) => v !== g.name)
                              : [...old, g.name],
                          )
                        }
                      >
                        {open ? "▾" : "▸"} {g.name}
                      </button>
                    </td>
                    <td>{g.count}</td>
                    <td>{fmt(g.sales25)}</td>
                    <td>{fmt(g.sales26)}</td>
                    <td className={tone(g.salesGrowth)}>
                      {pct(g.salesGrowth)}
                    </td>
                    <td>{fmt(g.qty25)}</td>
                    <td>{fmt(g.qty26)}</td>
                    <td>{pct(g.qtyGrowth)}</td>
                    <td>{pct(g.gp25)}</td>
                    <td>{pct(g.gp26)}</td>
                    <td className={tone(g.gpChange)}>{pp(g.gpChange)}</td>
                    <td>
                      {pct(g.coverage25)} / {pct(g.coverage26)}
                    </td>
                    {QUADRANTS.map((q) => (
                      <td key={q}>
                        {g.rows.filter((r) => r.quadrant === q).length}
                      </td>
                    ))}
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={17} className="group-breakdown-cell">
                        <div className="group-breakdown">
                          <div className="group-breakdown-heading">
                            <h5>
                              {g.name} · {g.count} SKUs
                            </h5>
                            <button
                              className="text-button"
                              onClick={() =>
                                setExpanded((old) =>
                                  old.filter((v) => v !== g.name),
                                )
                              }
                            >
                              Collapse group ↑
                            </button>
                          </div>
                          <DataTable
                            rows={g.rows}
                            columns={YOY_COLUMNS}
                            onSelect={onSelect}
                            label={g.name + " SKU breakdown"}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
