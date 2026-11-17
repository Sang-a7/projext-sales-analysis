import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { HEADERS, parseImport } from "../src/lib/import";
import { DEFAULT_META, ImportMeta } from "../src/lib/types";
const meta: ImportMeta = {
  ...DEFAULT_META,
  gpMeaning: "margin",
  sameBasis: true,
};
const values = [
  "001",
  "สินค้า ทดสอบ",
  "Group A",
  100,
  120,
  10,
  12,
  10,
  10,
  35,
  30,
];
function csv(rows: unknown[][], header = HEADERS) {
  return new TextEncoder().encode(
    [header, ...rows].map((r) => r.join(",")).join("\r\n"),
  );
}
test("CSV upload retains SKU code leading zeros and Thai names", () => {
  const p = parseImport(csv([values]), "test.csv", meta);
  assert.equal(p.rows[0].sku, "001");
  assert.equal(p.rows[0].name, "สินค้า ทดสอบ");
  assert.equal(p.rows[0].gp26, 30);
});
test("Excel percentage cell formatting is normalized once", () => {
  const book = XLSX.utils.book_new(),
    sheet = XLSX.utils.aoa_to_sheet([
      HEADERS,
      [...values.slice(0, 9), 0.35, 0.3],
    ]);
  sheet.J2.z = "0%";
  sheet.K2.z = "0%";
  XLSX.utils.book_append_sheet(book, sheet, "Data");
  const p = parseImport(
    XLSX.write(book, { type: "buffer", bookType: "xlsx" }),
    "test.xlsx",
    { ...meta, gpScale: "fraction" },
  );
  assert.equal(p.rows[0].gp25, 35);
  assert.equal(p.rows[0].gp26, 30);
});
test("missing numeric cells stay null", () => {
  const v = [...values];
  v[4] = "";
  assert.equal(parseImport(csv([v]), "test.csv", meta).rows[0].sales26, null);
});
test("invalid GP values are unavailable with audit warning", () => {
  const v = [...values];
  v[10] = 150;
  const p = parseImport(csv([v]), "test.csv", meta);
  assert.equal(p.rows[0].gp26, null);
  assert.match(p.warnings.join(" "), /above 100/);
});
test("negative GP and negative net sales are preserved", () => {
  const v = [...values];
  v[4] = -20;
  v[10] = -12;
  const r = parseImport(csv([v]), "test.csv", meta).rows[0];
  assert.equal(r.sales26, -20);
  assert.equal(r.gp26, -12);
});
test("invalid file types, fake Excel and missing headers are rejected", () => {
  assert.throws(() => parseImport(csv([values]), "test.exe", meta), /xlsx/);
  assert.throws(
    () => parseImport(csv([values]), "test.xlsx", meta),
    /valid XLSX/,
  );
  assert.throws(
    () => parseImport(csv([values], ["Wrong"]), "test.csv", meta),
    /Missing columns/,
  );
});
test("invalid numeric values are rejected instead of coercing to zero", () => {
  const v = [...values];
  v[4] = "bad";
  assert.throws(
    () => parseImport(csv([v]), "test.csv", meta),
    /Invalid number/,
  );
});
test("duplicate SKUs aggregate amount and quantity with weighted source values", () => {
  const second = [...values];
  second[3] = 300;
  second[4] = 360;
  second[5] = 20;
  second[6] = 24;
  second[7] = 15;
  second[8] = 15;
  second[9] = 45;
  second[10] = 40;
  const p = parseImport(csv([values, second]), "test.csv", meta);
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].sales26, 480);
  assert.equal(p.rows[0].price26, (12 * 10 + 24 * 15) / 36);
  assert.equal(p.rows[0].gp26, 37.5);
});
test("duplicate SKU conflicts are rejected", () => {
  const v = [...values];
  v[2] = "Other";
  assert.throws(
    () => parseImport(csv([values, v]), "test.csv", meta),
    /conflicting/,
  );
});
test("period-level input is filtered without fabricating monthly values", () => {
  const a = [...values, "2025-01-01", "2026-01-01"],
    b = [...values, "2025-02-01", "2026-02-01"];
  const p = parseImport(
    csv([a, b], [...HEADERS, "Period 2025", "Period 2026"]),
    "test.csv",
    {
      ...meta,
      start25: "2025-01-01",
      end25: "2025-01-31",
      start26: "2026-01-01",
      end26: "2026-01-31",
    },
  );
  assert.equal(p.rows[0].sales26, 120);
  assert.equal(p.hasPeriod, true);
});
