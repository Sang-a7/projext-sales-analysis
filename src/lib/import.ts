import * as XLSX from "xlsx";
import { ImportMeta, SourceRow, Value } from "./types";
import { periodValidity } from "./analysis";
export const HEADERS = [
  "SKU Code",
  "Product Name",
  "Product Group",
  "Sales Amount 2025",
  "Sales Amount 2026",
  "Sales Quantity 2025",
  "Sales Quantity 2026",
  "Average Price 2025",
  "Average Price 2026",
  "%Total GP 2025",
  "%Total GP 2026",
];
const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_%()-]/g, "");
export function readWorkbook(data: Uint8Array, filename: string) {
  if (!/\.(csv|xlsx)$/i.test(filename))
    throw new Error("Please choose a .xlsx or .csv file.");
  if (!data.byteLength || data.byteLength > 20 * 1024 * 1024)
    throw new Error("Files must contain data and be no larger than 20 MB.");
  if (/\.xlsx$/i.test(filename) && !(data[0] === 80 && data[1] === 75))
    throw new Error("This file is not a valid XLSX workbook.");
  const book = XLSX.read(data, {
    type: "array",
    cellNF: true,
    cellText: true,
    raw: true,
    codepage: 65001,
  });
  if (!book.SheetNames.length) throw new Error("No worksheets were found.");
  return book;
}
export function parseImport(
  data: Uint8Array,
  filename: string,
  meta: ImportMeta,
) {
  const book = readWorkbook(data, filename);
  const sheet = book.Sheets[meta.sheet || book.SheetNames[0]];
  if (!sheet) throw new Error("The selected worksheet does not exist.");
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });
  if (grid.length < 2) throw new Error("The worksheet has no data rows.");
  if (grid.length > 50001)
    throw new Error("Please use at most 50,000 source rows.");
  const header = grid[0].map((v) => norm(String(v ?? "")));
  const columns = HEADERS.map((h) => header.indexOf(norm(h)));
  const missing = HEADERS.filter((_, i) => columns[i] < 0);
  if (missing.length) throw new Error("Missing columns: " + missing.join(", "));
  if (new Set(header.filter(Boolean)).size !== header.filter(Boolean).length)
    throw new Error("Duplicate column names are not supported.");
  const warnings: string[] = [];
  const number = (
    value: unknown,
    row: number,
    col: number,
    gp = false,
  ): Value => {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === "" ||
      /^(n\/a|null|data unavailable|-)$/i.test(String(value).trim())
    )
      return null;
    const text = String(value).trim();
    const negative = /^\(.*\)$/.test(text);
    const n = Number(text.replace(/[,%\s()]/g, "")) * (negative ? -1 : 1);
    if (!Number.isFinite(n))
      throw new Error(
        `Invalid number at row ${row + 1}, column ${HEADERS[columns.indexOf(col)]}.`,
      );
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })] as
      XLSX.CellObject | undefined;
    const percentFormat = typeof cell?.z === "string" && cell.z.includes("%");
    const result =
      gp &&
      !text.includes("%") &&
      (percentFormat || meta.gpScale === "fraction")
        ? n * 100
        : n;
    if (gp && result > 100) {
      warnings.push(
        `Row ${row + 1}: GP above 100% excluded as invalid; original source retained.`,
      );
      return null;
    }
    return result;
  };
  const periodCols = [
    header.indexOf(norm("Period 2025")),
    header.indexOf(norm("Period 2026")),
  ];
  const hasPeriod = periodCols.some((i) => i >= 0);
  if (hasPeriod && periodCols.some((i) => i < 0))
    throw new Error(
      "Period-level files need both Period 2025 and Period 2026 columns (YYYY-MM-DD).",
    );
  if (
    hasPeriod &&
    (!meta.start25 ||
      !meta.end25 ||
      !meta.start26 ||
      !meta.end26 ||
      periodValidity(meta).label === "Invalid reporting periods")
  )
    throw new Error(
      "Select valid reporting dates to import period-level data.",
    );
  const records: SourceRow[] = [];
  for (let index = 1; index < grid.length; index++) {
    const values = grid[index];
    if (values.every((v) => v === null || v === "")) continue;
    const skuCell = sheet[
      XLSX.utils.encode_cell({ r: index, c: columns[0] })
    ] as XLSX.CellObject | undefined;
    const sku = String(skuCell?.w ?? values[columns[0]] ?? "").trim();
    if (!sku) throw new Error(`Missing SKU Code at row ${index + 1}.`);
    const row: SourceRow = {
      sku,
      name: String(values[columns[1]] ?? "").trim() || sku,
      group: String(values[columns[2]] ?? "").trim() || "Uncategorized",
      sales25: number(values[columns[3]], index, columns[3]),
      sales26: number(values[columns[4]], index, columns[4]),
      qty25: number(values[columns[5]], index, columns[5]),
      qty26: number(values[columns[6]], index, columns[6]),
      price25: number(values[columns[7]], index, columns[7]),
      price26: number(values[columns[8]], index, columns[8]),
      gp25: number(values[columns[9]], index, columns[9], true),
      gp26: number(values[columns[10]], index, columns[10], true),
    };
    if (hasPeriod) {
      let matches = 0;
      (["25", "26"] as const).forEach((year, i) => {
        const period = String(values[periodCols[i]] ?? "").trim();
        if (
          !/^20(25|26)-\d{2}-\d{2}$/.test(period) ||
          !period.startsWith("20" + year) ||
          Number.isNaN(Date.parse(period)) ||
          new Date(period).toISOString().slice(0, 10) !== period
        )
          throw new Error(
            `Invalid Period 20${year} on row ${index + 1}; use ISO dates stored as text.`,
          );
        if (period >= meta[`start${year}`] && period <= meta[`end${year}`])
          matches++;
        else
          for (const key of ["sales", "qty", "price", "gp"] as const)
            row[`${key}${year}`] = null;
      });
      if (matches === 0) continue;
    }
    records.push(row);
  }
  if (!records.length)
    throw new Error("No rows match the selected reporting periods.");
  const grouped = new Map<string, SourceRow[]>();
  records.forEach((row) => {
    const members = grouped.get(row.sku);
    if (members) members.push(row);
    else grouped.set(row.sku, [row]);
  });
  const rows = [...grouped.values()].map((members) => {
    if (
      new Set(members.map((r) => r.group)).size > 1 ||
      new Set(members.map((r) => r.name)).size > 1
    )
      throw new Error(
        `SKU ${members[0].sku} has conflicting product names or groups. Resolve the source before import.`,
      );
    const result = { ...members[0] };
    if (members.length === 1) return result;
    for (const year of ["25", "26"] as const) {
      const active = members.filter(
        (m) =>
          !hasPeriod ||
          m[`sales${year}`] !== null ||
          m[`qty${year}`] !== null ||
          m[`gp${year}`] !== null ||
          m[`price${year}`] !== null,
      );
      for (const prefix of ["sales", "qty"] as const) {
        const key = `${prefix}${year}` as const;
        result[key] =
          active.length && active.every((m) => m[key] !== null)
            ? active.reduce((a, m) => a + m[key]!, 0)
            : null;
      }
      for (const prefix of ["price", "gp"] as const) {
        const key = `${prefix}${year}` as const,
          weight = `${prefix === "price" ? "qty" : "sales"}${year}` as const;
        const valid = active.filter(
          (m) => m[key] !== null && m[weight] !== null && m[weight]! > 0,
        );
        const total = valid.reduce((a, m) => a + m[weight]!, 0);
        result[key] =
          active.length && valid.length === active.length && total > 0
            ? valid.reduce((a, m) => a + m[key]! * m[weight]!, 0) / total
            : null;
      }
    }
    return result;
  });
  if (rows.length < records.length)
    warnings.push(
      "Repeated SKU rows aggregated: sums for sales/quantity, source prices weighted by positive quantity, GP weighted by positive revenue. Incomplete aggregate inputs remain unavailable.",
    );
  if (!hasPeriod)
    warnings.push(
      "Summary columns used as supplied. Date selections describe source coverage; they do not prorate annual amounts.",
    );
  return {
    rows,
    warnings,
    sourceRows: records.length,
    sheet: meta.sheet || book.SheetNames[0],
    hasPeriod,
  };
}
