"use client";
import { useRef, useState } from "react";
import { AnalyzedRow } from "@/lib/types";
import { groupRows } from "@/lib/analysis";
import { fmt, pct, pp } from "@/lib/format";
import { shortProductName } from "@/lib/chart-layout";
import { DataTable, YOY_COLUMNS } from "./table";

type Grouping = "group" | "sku" | "quadrant";
type Metric = "sales" | "qty" | "gp" | "price";
export function ComparisonCharts({
  rows,
  onSelect,
}: {
  rows: AnalyzedRow[];
  onSelect: (row: AnalyzedRow) => void;
}) {
  const [overview, setOverview] = useState<Grouping>("group");
  const [drill, setDrill] = useState<{
    key: "group" | "quadrant";
    name: string;
  } | null>(null);
  const scrolls = useRef<(HTMLDivElement | null)[]>([]);
  const savedScroll = useRef<number[]>([]);
  const grouping = drill ? "sku" : overview;
  const members = drill
    ? rows.filter((r) => r[drill.key] === drill.name)
    : rows;
  const groups = groupRows(members, grouping);
  function open(key: "group" | "quadrant", name: string) {
    savedScroll.current = scrolls.current.map((el) => el?.scrollLeft ?? 0);
    setDrill({ key, name });
    scrolls.current.forEach((el) => el?.scrollTo({ left: 0 }));
  }
  function back() {
    setDrill(null);
    requestAnimationFrame(() =>
      scrolls.current.forEach((el, i) =>
        el?.scrollTo({ left: savedScroll.current[i] ?? 0 }),
      ),
    );
  }
  return (
    <>
      <div className="comparison-toolbar">
        {drill ? (
          <div className="chart-breadcrumb">
            <button className="button secondary" onClick={back}>
              ← Back to{" "}
              {overview === "group"
                ? "all product groups"
                : "quadrant overview"}
            </button>
            <strong>{drill.name}</strong>
            <span>{members.length} individual SKUs</span>
          </div>
        ) : (
          <>
            <label>
              Compare by{" "}
              <select
                value={overview}
                onChange={(e) => setOverview(e.target.value as Grouping)}
              >
                <option value="group">Product group</option>
                <option value="sku">Individual SKU</option>
                <option value="quadrant">BCG quadrant</option>
              </select>
            </label>
            <span className="caption">
              All {groups.length}{" "}
              {overview === "group"
                ? "product groups"
                : overview === "sku"
                  ? "SKUs"
                  : "quadrants"}{" "}
              · Scroll charts to compare every item
            </span>
          </>
        )}
      </div>
      <div className="comparison-grid">
        {(["qty", "sales", "gp", "price"] as Metric[]).map(
          (metric, chartIndex) => {
            const name = {
              qty: "Sales quantity",
              sales: "Sales amount",
              gp: "Gross profit margin",
              price: "Average selling price",
            }[metric];
            const value = (g: (typeof groups)[number], year: "25" | "26") =>
              grouping === "sku"
                ? g.rows[0][`${metric}${year}`]
                : g[`${metric}${year}`];
            const values = groups
              .flatMap((g) => [value(g, "25"), value(g, "26")])
              .filter((v): v is number => v !== null);
            const rawMin = Math.min(0, ...values),
              rawMax = Math.max(metric === "gp" ? 35 : 1, ...values),
              range = rawMax - rawMin;
            const min = rawMin < 0 ? rawMin - range * 0.12 : 0,
              max = rawMax + range * 0.16;
            const width = Math.max(600, groups.length * 220 + 70),
              height = 245,
              left = 60,
              top = 30,
              plotWidth = width - left - 20,
              band = plotWidth / Math.max(1, groups.length);
            const y = (n: number) => top + ((max - n) / (max - min)) * height;
            return (
              <article className="panel comparison" key={metric}>
                <div className="panel-heading">
                  <h4>{name}</h4>
                  <span className="caption">
                    {grouping === "sku" ? "SKU detail" : "Group overview"}
                  </span>
                </div>
                <div className="legend">
                  <span>
                    <i style={{ background: "#c1d4cc" }} />
                    2025
                  </span>
                  <span>
                    <i style={{ background: "#19755c" }} />
                    2026
                  </span>
                  {metric === "gp" && <span>— 30% target</span>}
                </div>
                <div
                  className="comparison-scroll"
                  ref={(el) => {
                    scrolls.current[chartIndex] = el;
                  }}
                  tabIndex={0}
                  role="region"
                  aria-label={name + " chart scroll area"}
                >
                  <svg
                    viewBox={`0 0 ${width} 360`}
                    style={{ width, minWidth: width }}
                    role="img"
                    aria-label={name + " grouped comparison"}
                  >
                    {[0, 0.5, 1].map((n) => (
                      <g key={n}>
                        <line
                          x1={left}
                          x2={width - 20}
                          y1={y(min + range * n)}
                          y2={y(min + range * n)}
                          stroke="#e3e9e4"
                        />
                        <text
                          x={left - 8}
                          y={y(min + range * n) + 4}
                          fontSize="11"
                          textAnchor="end"
                          fill="#65766e"
                        >
                          {new Intl.NumberFormat("en", {
                            notation: "compact",
                            maximumFractionDigits: 1,
                          }).format(min + range * n)}
                        </text>
                      </g>
                    ))}
                    {metric === "gp" && (
                      <line
                        x1={left}
                        x2={width - 20}
                        y1={y(30)}
                        y2={y(30)}
                        stroke="#c77731"
                        strokeDasharray="5 4"
                      />
                    )}
                    {groups.map((g, i) => {
                      const a = value(g, "25"),
                        b = value(g, "26"),
                        delta = a !== null && b !== null ? b - a : null,
                        rate =
                          a !== null && a > 0 && b !== null
                            ? ((b - a) / a) * 100
                            : null;
                      const click = () =>
                        grouping === "sku"
                          ? onSelect(g.rows[0])
                          : open(grouping, g.name);
                      return (
                        <g
                          key={g.name}
                          role="button"
                          tabIndex={0}
                          aria-label={`${g.name}: 2025 ${fmt(a)}, 2026 ${fmt(b)}. Open ${grouping === "sku" ? "SKU details" : "SKU breakdown"}`}
                          onClick={click}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              click();
                            }
                          }}
                          className="comparison-bar-item"
                        >
                          <title>
                            {g.name}: 2025 {fmt(a)} → 2026 {fmt(b)}. Change{" "}
                            {fmt(delta)} ·{" "}
                            {metric === "gp" ? pp(delta) : pct(rate)}
                            {metric === "gp"
                              ? " · GP coverage " +
                                pct(g.coverage25) +
                                " / " +
                                pct(g.coverage26)
                              : ""}
                          </title>
                          {[a, b].map((v, j) => {
                            const x =
                                left + i * band + band * (0.17 + j * 0.36),
                              barWidth = band * 0.28;
                            return (
                              <g key={j}>
                                {v !== null && (
                                  <rect
                                    x={x}
                                    y={Math.min(y(v), y(0))}
                                    width={barWidth}
                                    height={Math.max(1, Math.abs(y(v) - y(0)))}
                                    rx={4}
                                    fill={
                                      j === 0
                                        ? "#c1d4cc"
                                        : metric === "gp" && v < 30
                                          ? "#d1824f"
                                          : metric === "sales" &&
                                              delta !== null &&
                                              delta < 0
                                            ? "#c16464"
                                            : "#19755c"
                                    }
                                  />
                                )}
                                <text
                                  className="bar-value"
                                  x={x + barWidth / 2}
                                  y={
                                    v === null
                                      ? y(0) - 10
                                      : v >= 0
                                        ? y(v) - 10
                                        : y(v) + 18
                                  }
                                  textAnchor="middle"
                                  fontSize="12"
                                  fill="#314d41"
                                >
                                  {v === null
                                    ? "N/A"
                                    : fmt(v) + (metric === "gp" ? "%" : "")}
                                </text>
                              </g>
                            );
                          })}
                          <text
                            x={left + (i + 0.5) * band}
                            y="303"
                            textAnchor="middle"
                            fontSize="12"
                            fill="#304b40"
                          >
                            {shortProductName(g.name, 23)}
                          </text>
                          {grouping === "sku" && (
                            <text
                              x={left + (i + 0.5) * band}
                              y="321"
                              textAnchor="middle"
                              fontSize="11"
                              fill="#71816b"
                            >
                              {shortProductName(g.rows[0].name, 23)}
                            </text>
                          )}
                          <text
                            x={left + (i + 0.5) * band}
                            y="343"
                            textAnchor="middle"
                            fontSize="12"
                            fill={
                              delta !== null && delta < 0
                                ? "#b64d4d"
                                : "#247e63"
                            }
                          >
                            {metric === "gp" ? pp(delta) : pct(rate)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                {!groups.length && (
                  <p className="caption">No data in this selection.</p>
                )}
              </article>
            );
          },
        )}
      </div>
      {drill && (
        <section className="panel chart-group-details">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">INDIVIDUAL SKU BREAKDOWN</span>
              <h4>{drill.name}</h4>
              <p>
                Each row is one SKU. Select its code for complete analysis; sort
                any column to compare performance.
              </p>
            </div>
          </div>
          <DataTable
            rows={members}
            columns={YOY_COLUMNS}
            onSelect={onSelect}
            label={drill.name + " chart SKU breakdown"}
          />
        </section>
      )}
    </>
  );
}
