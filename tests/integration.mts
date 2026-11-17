import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { HEADERS } from "../src/lib/import";
import { DEFAULT_META, DEFAULT_FILTERS } from "../src/lib/types";
const base = process.env.TEST_URL || "http://127.0.0.1:3006";
const rows = [
  ["TEST-A", "สินค้า A · Test only", "Core", 500, 550, 50, 55, 10, 10, 35, 32],
  ["TEST-B", "Product B · Test only", "Core", 400, 300, 40, 30, 10, 10, 38, 40],
  ["TEST-C", "Product C · Test only", "Growth", 50, 100, 5, 10, 10, 10, 25, 20],
  ["TEST-D", "Product D · Test only", "Growth", 200, 50, 20, 5, 10, 10, 30, -5],
  ["TEST-NEW", "New · Test only", "Growth", 0, 25, 0, 5, 0, 5, "", 35],
  ["TEST-RETURN", "Returns · Test only", "Core", 20, -5, 2, -1, 10, 5, 25, 20],
  [
    "TEST-MISSING",
    "Missing · Test only",
    "Review",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ],
];
mkdirSync("test-results", { recursive: true });
const csv = "\uFEFF" + [HEADERS, ...rows].map((r) => r.join(",")).join("\r\n");
writeFileSync("test-results/TEST-ONLY-skus.csv", csv);
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  book,
  XLSX.utils.aoa_to_sheet([HEADERS, ...rows]),
  "Performance",
);
const xlsx = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
writeFileSync("test-results/TEST-ONLY-skus.xlsx", xlsx);
const meta = {
  ...DEFAULT_META,
  gpMeaning: "margin",
  sameBasis: true,
  start25: "2025-01-01",
  end25: "2025-10-31",
  start26: "2026-01-01",
  end26: "2026-10-31",
};
async function upload(filename: string, bytes: BlobPart, settings = meta) {
  const form = new FormData();
  form.set("file", new File([bytes], filename));
  form.set("metadata", JSON.stringify(settings));
  return fetch(base + "/api/imports", {
    method: "POST",
    body: form,
    headers: { Origin: base },
  });
}
const page = await fetch(base);
assert.equal(page.status, 200);
const bad = await upload("invalid.txt", "test");
assert.equal(bad.status, 400);
const badGp = await upload("TEST-invalid.csv", csv, {
  ...meta,
  gpMeaning: "unconfirmed",
});
assert.equal(badGp.status, 400);
const x = await upload("TEST-ONLY-skus.xlsx", new Uint8Array(xlsx));
assert.equal(x.status, 200, await x.clone().text());
const c = await upload("TEST-ONLY-skus.csv", csv);
assert.equal(c.status, 200, await c.clone().text());
const imported = (await c.json()) as { id: string };
const saved = (await (
  await fetch(base + "/api/imports?id=" + imported.id)
).json()) as { rows: { sku: string; gp26: number | null }[] };
assert.equal(saved.rows.length, 7);
assert.equal(saved.rows.find((r) => r.sku === "TEST-D")?.gp26, -5);
const source = await fetch(
  base + "/api/imports?id=" + imported.id + "&source=1",
);
assert.equal(await source.text(), csv.replace(/^\uFEFF/, ""));
const pdf = await fetch(base + "/api/export", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ id: imported.id, filters: DEFAULT_FILTERS }),
});
assert.equal(pdf.status, 200, await pdf.clone().text());
const bytes = Buffer.from(await pdf.arrayBuffer());
assert.equal(bytes.subarray(0, 4).toString(), "%PDF");
assert.ok(bytes.length > 10000);
writeFileSync("test-results/analysis.pdf", bytes);
const filtered = await fetch(base + "/api/export", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: imported.id,
    filters: { ...DEFAULT_FILTERS, group: "Core" },
  }),
});
assert.equal(filtered.status, 200);
writeFileSync(
  "test-results/filtered-analysis.pdf",
  Buffer.from(await filtered.arrayBuffer()),
);
console.log(
  "PASS: homepage, invalid uploads, GP confirmation, XLSX and CSV imports, persisted records, original source round-trip, complete and filtered PDF exports.",
);
console.log("Test import:", imported.id);
