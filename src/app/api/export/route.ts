import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import path from "node:path";
import { db } from "@/lib/db";
import { select, summarize, groupRows, periodValidity } from "@/lib/analysis";
import {
  DEFAULT_FILTERS,
  Filters,
  ImportMeta,
  SourceRow,
  COLORS,
} from "@/lib/types";
import { fmt, pct, pp } from "@/lib/format";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const { id, filters: input } = (await req.json()) as {
      id: string;
      filters: Partial<Filters>;
    };
    const filters = { ...DEFAULT_FILTERS, ...input };
    const batch = await db.importBatch.findUnique({
      where: { id },
      include: { records: true },
    });
    if (!batch)
      return NextResponse.json({ error: "Import not found." }, { status: 404 });
    const meta = JSON.parse(batch.metadata) as ImportMeta;
    const result = select(
        batch.records.map((r) => JSON.parse(r.normalized) as SourceRow),
        meta,
        filters,
      ),
      s = summarize(result.rows);
    const doc = new PDFDocument({
      size: "A4",
      margin: 42,
      bufferPages: true,
      info: {
        Title: "SKU Performance Analysis",
        Author: "Folio Local Analytics",
      },
    });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve, reject) => {
      doc.on("data", (b: Buffer) => chunks.push(b));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });
    doc.font(path.join(process.cwd(), "public/fonts/Kanit-Regular.ttf"));
    const line = (text: string, size = 10) => {
      if (doc.y > 745) doc.addPage();
      doc.fontSize(size).fillColor("#273d3b").text(text, { lineGap: 3 });
    };
    line("FOLIO / LOCAL ANALYTICS", 11);
    line("SKU Performance Analysis", 26);
    line("2025 vs 2026 · " + batch.filename, 12);
    line(periodValidity(meta).label);
    line(periodValidity(meta).warning);
    line(
      `2025: ${meta.start25 || "Unconfirmed"} — ${meta.end25 || "Unconfirmed"} | 2026: ${meta.start26 || "Unconfirmed"} — ${meta.end26 || "Unconfirmed"}`,
    );
    line(
      `Currency: ${meta.currency} · VAT: ${meta.vat} · Filters: ${JSON.stringify(filters)}`,
      9,
    );
    doc.moveDown();
    line("Portfolio overview", 18);
    line(
      `SKUs: ${s.count} | Sales: ${fmt(s.sales25)} → ${fmt(s.sales26)} | Change: ${fmt(s.salesChange)} (${pct(s.salesGrowth)})`,
    );
    line(
      `Quantity: ${fmt(s.qty25)} → ${fmt(s.qty26)} | Change: ${fmt(s.qtyChange)} (${pct(s.qtyGrowth)})`,
    );
    line(
      `Weighted GP: ${pct(s.gp25)} → ${pct(s.gp26)} | ${pp(s.gpChange)} | Revenue coverage: ${pct(s.coverage25)} / ${pct(s.coverage26)}`,
    );
    line(
      `Portfolio ASP: ${fmt(s.price25)} → ${fmt(s.price26)} | ${pct(s.priceGrowth)} | SKUs with missing sales/quantity: ${s.missing}`,
    );
    line(
      "Totals use available values. Missing values are never replaced with zero. Estimated GP is calculated only when the financial basis was confirmed.",
      9,
    );
    doc.moveDown();
    line("BCG classification", 18);
    for (const group of groupRows(result.rows, "quadrant"))
      line(
        `${group.name}: ${group.count} SKUs · sales ${fmt(group.sales26)} · weighted GP ${pct(group.gp25)} → ${pct(group.gp26)} (${pp(group.gpChange)})`,
      );
    line(
      `Pareto cutoff: ${pct(result.cutoff)}. Rank-based membership is authoritative when sales are tied.`,
      9,
    );
    const points = result.rows.filter(
      (r) =>
        r.salesGrowth !== null &&
        r.contribution !== null &&
        r.quadrant !== "Unclassified",
    );
    if (points.length) {
      doc.addPage();
      line("BCG matrix", 20);
      const left = 65,
        top = 120,
        width = 460,
        height = 340;
      const minX = Math.min(-10, ...points.map((r) => r.salesGrowth!)),
        maxX = Math.max(10, ...points.map((r) => r.salesGrowth!)),
        maxY = Math.max(1, ...points.map((r) => r.contribution!)) * 1.1;
      const x = (n: number) => left + ((n - minX) / (maxX - minX)) * width,
        y = (n: number) => top + height - (n / maxY) * height;
      doc.rect(left, top, width, height).stroke("#d5e3de");
      doc
        .moveTo(x(0), top)
        .lineTo(x(0), top + height)
        .stroke("#9bad9f");
      doc
        .moveTo(left, y(result.cutoff ?? 0))
        .lineTo(left + width, y(result.cutoff ?? 0))
        .stroke("#9bad9f");
      const largest = Math.max(...points.map((r) => r.sales26!));
      points.forEach((r) =>
        doc
          .circle(
            x(r.salesGrowth!),
            y(r.contribution!),
            3 + Math.sqrt(r.sales26! / largest) * 12,
          )
          .fillOpacity(0.65)
          .fill(COLORS[r.quadrant]),
      );
      doc.fillOpacity(1);
      doc.y = 480;
      line("X: sales growth (%) · Y: 2026 sales contribution (%)");
      line(
        "Green: Stars · Amber: Cash Cows · Blue: Question Marks · Red: Dogs",
      );
    }
    doc.addPage();
    line("Product group comparison", 20);
    for (const g of groupRows(result.rows, "group")) {
      line(g.name, 14);
      line(
        `${g.count} SKUs · Sales ${fmt(g.sales25)} → ${fmt(g.sales26)} (${pct(g.salesGrowth)}) · Qty ${fmt(g.qty25)} → ${fmt(g.qty26)} (${pct(g.qtyGrowth)}) · GP ${pct(g.gp25)} → ${pct(g.gp26)} (${pp(g.gpChange)}) · GP coverage ${pct(g.coverage25)} / ${pct(g.coverage26)}`,
      );
    }
    for (const key of ["salesChange", "qtyChange", "gpChange"] as const) {
      doc.addPage();
      line(`Top growth & decline: ${key}`, 20);
      for (const up of [true, false]) {
        line(up ? "Top 10 improvements" : "Top 10 declines", 14);
        for (const r of result.rows
          .filter((r) => r[key] !== null && (up ? r[key]! > 0 : r[key]! < 0))
          .sort((a, b) => (up ? b[key]! - a[key]! : a[key]! - b[key]!))
          .slice(0, 10)) {
          const a =
              key === "salesChange"
                ? r.sales25
                : key === "qtyChange"
                  ? r.qty25
                  : r.gp25,
            b =
              key === "salesChange"
                ? r.sales26
                : key === "qtyChange"
                  ? r.qty26
                  : r.gp26;
          line(
            `${r.sku} · ${r.name} · ${r.group} · ${r.quadrant}: ${fmt(a)} → ${fmt(b)} | Δ ${fmt(r[key])} | ${key === "gpChange" ? pp(r.gpChange) : pct(key === "salesChange" ? r.salesGrowth : r.qtyGrowth)}`,
          );
        }
      }
    }
    for (const r of result.rows) {
      doc.addPage();
      line(`${r.sku} · ${r.name}`, 20);
      line(r.group + " / " + r.quadrant, 12);
      line(r.classificationBasis, 10);
      line(
        `Sales: ${fmt(r.sales25)} → ${fmt(r.sales26)} | Δ ${fmt(r.salesChange)} | ${pct(r.salesGrowth)}`,
      );
      line(
        `Quantity: ${fmt(r.qty25)} → ${fmt(r.qty26)} | Δ ${fmt(r.qtyChange)} | ${pct(r.qtyGrowth)}`,
      );
      line(
        `Source ASP: ${fmt(r.price25)} → ${fmt(r.price26)} | Δ ${fmt(r.priceChange)} | ${pct(r.priceGrowth)}`,
      );
      line(
        `GP margin: ${pct(r.gp25)} → ${pct(r.gp26)} | ${pp(r.gpChange)} | ${r.gpStatus}`,
      );
      line(
        `Rank: ${fmt(r.rank)} · Contribution: ${pct(r.contribution)} · Cumulative: ${pct(r.cumulative)}`,
      );
      line(
        `Estimated GP: ${fmt(r.estimatedGp25)} → ${fmt(r.estimatedGp26)} | Δ ${fmt(r.estimatedGpChange)}`,
      );
      line(
        `Volume effect: ${fmt(r.volumeEffect)} · Price effect: ${fmt(r.priceEffect)} · Residual: ${fmt(r.residual)} · Reconciles: ${r.bridgeExact ? "Yes" : "No"}`,
      );
      line("Measured findings", 14);
      line(r.findings.join(" ") || "Insufficient change data.");
      line("Suggested actions (inferences)", 14);
      line(r.recommendations.join(" "));
      line("Exceptions", 14);
      line(r.exceptions.join("; ") || "None identified.");
    }
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      doc
        .fontSize(8)
        .fillColor("#61726f")
        .text(`Local analysis · ${i + 1} / ${pages.count}`, 42, 795, {
          lineBreak: false,
        });
    }
    doc.end();
    const output = await done;
    return new Response(new Uint8Array(output), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition":
          "attachment; filename=sku-performance-analysis.pdf",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "PDF export failed." },
      { status: 500 },
    );
  }
}
