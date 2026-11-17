import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  diff,
  growth,
  groupRows,
  periodValidity,
  select,
  summarize,
  weighted,
} from "../src/lib/analysis";
import {
  DEFAULT_FILTERS,
  DEFAULT_META,
  ImportMeta,
  SourceRow,
} from "../src/lib/types";
const meta: ImportMeta = {
  ...DEFAULT_META,
  gpMeaning: "margin",
  sameBasis: true,
};
const row = (sku: string, overrides: Partial<SourceRow> = {}): SourceRow => ({
  sku,
  name: sku,
  group: "A",
  sales25: 100,
  sales26: 120,
  qty25: 10,
  qty26: 12,
  price25: 10,
  price26: 10,
  gp25: 35,
  gp26: 30,
  ...overrides,
});
test("sales amount growth and absolute difference", () => {
  assert.equal(growth(100, 120), 20);
  assert.equal(diff(100, 120), 20);
});
test("quantity growth", () =>
  assert.equal(analyze([row("A")], meta).rows[0].qtyGrowth, 20));
test("source average price growth, never inferred from revenue", () => {
  const r = analyze([row("A", { price26: 12 })], meta).rows[0];
  assert.equal(r.priceGrowth, 20);
  assert.equal(r.priceChange, 2);
});
test("GP changes use percentage points", () =>
  assert.equal(analyze([row("A")], meta).rows[0].gpChange, -5));
test("estimated GP requires confirmed meaning and common financial basis", () => {
  assert.equal(analyze([row("A")], meta).rows[0].estimatedGpChange, 1);
  assert.equal(
    analyze([row("A")], { ...meta, sameBasis: false }).rows[0].estimatedGp25,
    null,
  );
  assert.equal(
    analyze([row("A")], { ...meta, gpMeaning: "unconfirmed" }).rows[0]
      .estimatedGp25,
    null,
  );
});
test("revenue-weighted GP excludes non-positive sales", () => {
  const rows = [
    row("A", { sales26: 100, gp26: 20 }),
    row("B", { sales26: 300, gp26: 40 }),
    row("C", { sales26: -10, gp26: 90 }),
  ];
  assert.equal(weighted(rows, "26").value, 35);
});
test("period validity recognizes comparable YTD and unequal periods", () => {
  const dates = {
    ...meta,
    start25: "2025-01-01",
    end25: "2025-10-31",
    start26: "2026-01-01",
    end26: "2026-10-31",
  };
  assert.equal(periodValidity(dates).comparable, true);
  assert.match(periodValidity(dates).label, /YTD/);
  assert.equal(
    periodValidity({ ...dates, end25: "2025-12-31" }).comparable,
    false,
  );
  assert.equal(periodValidity(meta).comparable, false);
  assert.equal(
    periodValidity({ ...dates, start25: "2025-02-30" }).label,
    "Invalid reporting periods",
  );
});
test("sales contributions reconcile to 100", () => {
  const a = analyze([row("A"), row("B", { sales26: 80 })], meta);
  assert.equal(
    a.rows.reduce((s, r) => s + r.contribution!, 0),
    100,
  );
  assert.equal(a.rows[0].contribution, 60);
});
test("Pareto 80 includes the boundary SKU", () => {
  const rows = [300, 250, 150, 100, 80, 70, 50].map((v, i) =>
    row(String(i), { sales26: v }),
  );
  const a = analyze(rows, meta);
  assert.equal(a.cutoff, 10);
  assert.deepEqual(
    a.rows.filter((r) => r.high).map((r) => r.sku),
    ["0", "1", "2", "3"],
  );
  assert.equal(a.rows[3].cumulative, 80);
});
test("ties are ranked by SKU code, not numeric cutoff classification", () => {
  const a = analyze(
    ["E", "D", "C", "B", "A"].map((sku) => row(sku, { sales26: 100 })),
    meta,
  );
  assert.equal(a.cutoff, 20);
  assert.deepEqual(
    a.rows
      .filter((r) => r.high)
      .map((r) => r.sku)
      .sort(),
    ["A", "B", "C", "D"],
  );
  assert.equal(a.rows.find((r) => r.sku === "E")?.high, false);
});
test("all four BCG classifications including zero growth", () => {
  const a = analyze(
    [
      row("A", { sales25: 500, sales26: 500 }),
      row("B", { sales25: 400, sales26: 300 }),
      row("C", { sales25: 50, sales26: 100 }),
      row("D", { sales25: 200, sales26: 100 }),
    ],
    meta,
  );
  assert.deepEqual(
    a.rows.map((r) => r.quadrant),
    ["Stars", "Cash Cows", "Question Marks", "Dogs"],
  );
});
test("zero prior-year denominator is N/A and new products default to Question Marks", () => {
  const a = analyze(
    [row("A", { sales25: 0 }), row("B", { sales25: null })],
    meta,
  );
  assert.equal(a.rows[0].salesGrowth, null);
  assert.equal(a.rows[0].status, "New / No Baseline");
  assert.ok(a.rows.every((r) => r.quadrant === "Question Marks"));
  assert.equal(diff(null, 3), null);
});
test("negative sales are excluded from Pareto, retained in totals", () => {
  const rows = [
    row("A", { sales26: 100 }),
    row("B", { sales26: -20 }),
    row("C", { sales26: 0 }),
  ];
  const a = analyze(rows, meta);
  assert.equal(a.eligibleSales, 100);
  assert.equal(a.rows[1].contribution, null);
  assert.equal(a.rows[2].quadrant, "Unclassified");
  assert.equal(summarize(a.rows).sales26, 80);
});
test("filter recalculation uses scope before quadrant filters", () => {
  const rows = [
    row("A", { sales26: 800, group: "A" }),
    row("B", { sales26: 150, group: "B" }),
    row("C", { sales26: 50, group: "B" }),
  ];
  const global = select(rows, meta, { ...DEFAULT_FILTERS, group: "B" });
  assert.equal(global.rows[0].high, false);
  const local = select(rows, meta, {
    ...DEFAULT_FILTERS,
    group: "B",
    mode: "selection",
  });
  assert.equal(local.rows[0].high, true);
  assert.equal(local.rows[0].contribution, 75);
  const filtered = select(rows, meta, {
    ...DEFAULT_FILTERS,
    group: "B",
    mode: "selection",
    quadrant: "Stars",
  });
  assert.equal(filtered.cutoff, local.cutoff);
  assert.equal(filtered.rows[0].contribution, 75);
});
test("product group aggregation uses totals and weighted margins", () => {
  const a = analyze(
    [
      row("A", { sales26: 100, gp26: 20 }),
      row("B", { sales26: 300, gp26: 40 }),
    ],
    meta,
  );
  const g = groupRows(a.rows, "group")[0];
  assert.equal(g.sales26, 400);
  assert.equal(g.gp26, 35);
  assert.equal(g.count, 2);
});
test("price-volume bridge reconciles with valid input", () => {
  const r = analyze([row("A", { sales26: 144, qty26: 12, price26: 12 })], meta)
    .rows[0];
  assert.equal(r.volumeEffect, 20);
  assert.equal(r.priceEffect, 24);
  assert.equal(r.residual, 0);
  assert.equal(r.bridgeExact, true);
});
test("non-reconciling bridge exposes residual and does not claim causation", () => {
  const r = analyze([row("A", { sales26: 150, qty26: 12, price26: 12 })], meta)
    .rows[0];
  assert.equal(r.residual, 6);
  assert.equal(r.bridgeExact, false);
});
test("portfolio total and average-price reconciliation", () => {
  const rows = [row("A"), row("B", { sales26: 300, qty26: 10 })];
  const s = summarize(rows);
  assert.equal(s.sales26, 420);
  assert.equal(s.qty26, 22);
  assert.equal(s.price26, 420 / 22);
  assert.equal(s.salesChange, 220);
});
test("GP coverage reports uncovered positive revenue", () => {
  const w = weighted(
    [
      row("A", { sales26: 100, gp26: 30 }),
      row("B", { sales26: 300, gp26: null }),
    ],
    "26",
  );
  assert.equal(w.value, 30);
  assert.equal(w.coverage, 25);
});
test("missing GP unavailable, negative GP preserved", () => {
  const a = analyze([row("A", { gp26: null }), row("B", { gp26: -10 })], meta);
  assert.equal(a.rows[0].gpChange, null);
  assert.equal(a.rows[0].estimatedGp26, null);
  assert.equal(a.rows[1].gpStatus, "Loss-making");
  assert.equal(a.rows[1].estimatedGp26, -12);
});
test("missing values never become zero and totals flag incomplete inputs", () => {
  const s = summarize([row("A", { sales25: null, qty25: null })]);
  assert.equal(s.sales25, null);
  assert.equal(s.salesGrowth, null);
  assert.equal(s.missing, 1);
});
test("empty portfolio is valid", () => {
  assert.deepEqual(analyze([], meta), {
    rows: [],
    cutoff: null,
    eligibleSales: 0,
  });
  assert.equal(summarize([]).sales26, null);
});
