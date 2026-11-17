import test from "node:test";
import assert from "node:assert/strict";
import { analyze, select, groupRows } from "../src/lib/analysis";
import { DEFAULT_META, DEFAULT_FILTERS, SourceRow } from "../src/lib/types";
import { exportRow } from "../src/lib/export";
import { placeLabels, shortProductName } from "../src/lib/chart-layout";
const meta = { ...DEFAULT_META, gpMeaning: "margin" as const, sameBasis: true };
const row = (sku: string, changes: Partial<SourceRow> = {}): SourceRow => ({
  sku,
  name: sku,
  group: "Group",
  sales25: null,
  sales26: 200,
  qty25: null,
  qty26: 10,
  price25: null,
  price26: 20,
  gp25: null,
  gp26: 30,
  ...changes,
});
test("missing history defaults to Question Marks without changing source inputs", () => {
  const source = row("NEW"),
    before = JSON.stringify(source),
    r = analyze([source], meta).rows[0];
  assert.equal(r.quadrant, "Question Marks");
  assert.equal(r.sales25, null);
  assert.equal(r.qty25, null);
  assert.equal(r.salesGrowth, null);
  assert.equal(r.salesChange, null);
  assert.equal(r.status, "New / No Baseline");
  assert.equal(JSON.stringify(source), before);
  assert.equal(r.high, true); // The business rule takes precedence even for a Pareto leader.
});
test("the named product exception is Dogs by source SKU or exact normalized product name", () => {
  const rows = analyze(
    [
      row("345338"),
      row("OTHER", { name: " hb hof zer bx10rb4ca   (11634) " }),
      row("11635", { name: "HB HOF ZER BX10RB4CA (11635)" }),
    ],
    meta,
  ).rows;
  assert.deepEqual(
    rows.map((r) => r.quadrant),
    ["Dogs", "Dogs", "Question Marks"],
  );
  assert.match(rows[0].classificationBasis, /Business exception/);
});
test("classification exceptions do not replace valid historical calculations", () => {
  const r = analyze([row("345338", { sales25: 100 })], meta).rows[0];
  assert.equal(r.quadrant, "Stars");
  assert.equal(r.salesGrowth, 100);
  const invalid = analyze(
    [row("NEGATIVE", { sales25: -10 }), row("MISSING", { sales26: null })],
    meta,
  ).rows;
  assert.ok(invalid.every((r) => r.quadrant === "Unclassified"));
});
test("business classifications stay consistent through filters, groups and spreadsheet exports", () => {
  const rows = [
    row("345338"),
    row("NEW"),
    row("BASE", { sales25: 100, sales26: 1000, group: "Other" }),
  ];
  for (const mode of ["global", "selection"] as const) {
    const s = select(rows, meta, { ...DEFAULT_FILTERS, mode, group: "Group" });
    const groups = groupRows(s.rows, "quadrant");
    assert.equal(groups.find((g) => g.name === "Dogs")?.count, 1);
    assert.equal(groups.find((g) => g.name === "Question Marks")?.count, 1);
    assert.equal(
      select(rows, meta, { ...DEFAULT_FILTERS, mode, quadrant: "Dogs" }).rows[0]
        .sku,
      "345338",
    );
    assert.equal(exportRow(s.rows[0])["BCG Classification"], "Dogs");
    assert.equal(exportRow(s.rows[0])["Sales Amount 2025"], null);
  }
});
test("short chart labels retain meaningful product text", () => {
  assert.equal(shortProductName("HB MAGNESIUM BOTTLE", 30), "MAGNESIUM BOTTLE");
  assert.ok(
    Array.from(
      shortProductName("A very long product name for a small label", 12),
    ).length <= 12,
  );
});
test("label placement separates a dense cluster without moving measured points", () => {
  const points = Array.from({ length: 12 }, (_, i) => ({
    sku: String(i),
    label: "Product " + i,
    x: 600,
    y: 400,
    radius: 8,
  }));
  const boxes = placeLabels(points, {
    left: 80,
    top: 45,
    width: 1340,
    height: 560,
  });
  assert.equal(boxes.length, points.length);
  for (let i = 0; i < boxes.length; i++) {
    assert.equal(boxes[i].pointX, 600);
    assert.equal(boxes[i].pointY, 400);
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      assert.ok(
        !(
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y
        ),
      );
    }
  }
});
