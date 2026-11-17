import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseImport, readWorkbook } from "@/lib/import";
import { ImportMeta } from "@/lib/types";
import { periodValidity } from "@/lib/analysis";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (id) {
      const batch = await db.importBatch.findUnique({
        where: { id },
        include: { records: true },
      });
      if (!batch)
        return NextResponse.json(
          { error: "Import not found." },
          { status: 404 },
        );
      if (req.nextUrl.searchParams.get("source") === "1")
        return new Response(batch.source, {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(batch.filename)}`,
            "Cache-Control": "no-store",
          },
        });
      return NextResponse.json({
        id: batch.id,
        filename: batch.filename,
        createdAt: batch.createdAt,
        metadata: JSON.parse(batch.metadata),
        rows: batch.records.map((r) => JSON.parse(r.normalized)),
      });
    }
    return NextResponse.json(
      await db.importBatch.findMany({
        select: {
          id: true,
          filename: true,
          createdAt: true,
          rowCount: true,
          metadata: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Local database unavailable. Run npm run setup before starting the app.",
      },
      { status: 500 },
    );
  }
}
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      return NextResponse.json(
        { error: "Cross-origin imports are not allowed." },
        { status: 403 },
      );
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File))
      throw new Error("Select an Excel or CSV file.");
    if (file.size > 20 * 1024 * 1024)
      throw new Error("The maximum upload size is 20 MB.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (form.get("preview") === "1") {
      const book = readWorkbook(bytes, file.name);
      return NextResponse.json({ sheets: book.SheetNames });
    }
    const meta = JSON.parse(String(form.get("metadata") || "{}")) as ImportMeta;
    if (
      !["margin", "unconfirmed"].includes(meta.gpMeaning) ||
      !["percent", "fraction"].includes(meta.gpScale) ||
      typeof meta.sameBasis !== "boolean" ||
      !["As supplied", "VAT inclusive", "VAT exclusive"].includes(meta.vat) ||
      typeof meta.currency !== "string" ||
      !/^([A-Z]{3})$/.test(meta.currency) ||
      !["start25", "end25", "start26", "end26", "sheet"].every(
        (key) => typeof meta[key as keyof ImportMeta] === "string",
      )
    )
      throw new Error("Invalid import settings.");
    if (meta.gpMeaning !== "margin")
      throw new Error(
        "Confirm that %Total GP means gross profit margin before importing.",
      );
    if (periodValidity(meta).label === "Invalid reporting periods")
      throw new Error(periodValidity(meta).warning);
    const parsed = parseImport(bytes, file.name, meta);
    const metadata = {
      ...meta,
      sheet: parsed.sheet,
      warnings: parsed.warnings,
      sourceRows: parsed.sourceRows,
      hasPeriod: parsed.hasPeriod,
    };
    const batch = await db.importBatch.create({
      data: {
        filename: file.name,
        source: bytes,
        metadata: JSON.stringify(metadata),
        rowCount: parsed.rows.length,
        records: {
          create: parsed.rows.map((row) => ({
            sku: row.sku,
            normalized: JSON.stringify(row),
          })),
        },
      },
      select: { id: true },
    });
    return NextResponse.json({ id: batch.id, warnings: parsed.warnings });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to import this file.",
      },
      { status: 400 },
    );
  }
}
