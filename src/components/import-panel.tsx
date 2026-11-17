"use client";
import { useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Check,
  ArrowUpRight,
  LoaderCircle,
} from "lucide-react";
import { DEFAULT_META, ImportMeta } from "@/lib/types";
import { HEADERS } from "@/lib/import";
import { downloadBlob } from "@/lib/export";
import { periodValidity } from "@/lib/analysis";
export function ImportPanel({
  onImported,
}: {
  onImported: (id: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null),
    [meta, setMeta] = useState<ImportMeta>(DEFAULT_META),
    [sheets, setSheets] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function choose(value: File | undefined) {
    if (!value) return;
    setError("");
    setFile(null);
    setSheets([]);
    if (!/\.(xlsx|csv)$/i.test(value.name)) {
      setError("Unsupported file. Choose .xlsx or .csv.");
      return;
    }
    if (value.size > 20 * 1024 * 1024) {
      setError("Maximum file size is 20 MB.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", value);
      form.set("preview", "1");
      const response = await fetch("/api/imports", {
          method: "POST",
          body: form,
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setFile(value);
      setSheets(data.sheets);
      setMeta((m) => ({ ...m, sheet: data.sheets[0] }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read file.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("metadata", JSON.stringify(meta));
      const response = await fetch("/api/imports", {
          method: "POST",
          body: form,
        }),
        data = await response.json();
      if (!response.ok) throw new Error(data.error);
      await onImported(data.id);
      setFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel import-panel" id="import">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">YOUR DATA, YOUR DEVICE</span>
          <h3>Start with your sales data</h3>
          <p>
            Turn your spreadsheet into a clearer picture of product performance.
          </p>
        </div>
        <span className="file-pill">
          <FileSpreadsheet size={16} /> XLSX & CSV
        </span>
      </div>
      <div className="upload-grid">
        <div
          className={"dropzone " + (drag ? "dragging" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (!busy) void choose(e.dataTransfer.files[0]);
          }}
        >
          <div className="upload-icon">
            <Upload size={25} />
          </div>
          <h5>{file ? file.name : "Drop your spreadsheet here"}</h5>
          <p>or browse files from your computer</p>
          <button
            className="button primary"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Upload size={17} />
            )}{" "}
            Choose file
          </button>
          <input
            ref={input}
            type="file"
            accept=".xlsx,.csv"
            hidden
            onChange={(e) => void choose(e.target.files?.[0])}
          />
          <span className="caption">
            Up to 20 MB · 50,000 source rows · Stored locally
          </span>
        </div>
        <div className="import-guide">
          <h5>A little preparation. Better insights.</h5>
          <p>
            Include a unique SKU code, product name and group, plus these fields
            for both 2025 and 2026:
          </p>
          <ul>
            {[
              "Sales amount & sales quantity",
              "Source average selling price",
              "Total gross profit margin (%)",
            ].map((t) => (
              <li key={t}>
                <Check size={16} />
                {t}
              </li>
            ))}
          </ul>
          <button
            className="text-button"
            onClick={() =>
              downloadBlob(
                new Blob(["\uFEFF" + HEADERS.join(",") + "\r\n"], {
                  type: "text/csv;charset=utf-8",
                }),
                "sku-import-template.csv",
              )
            }
          >
            Download blank template <ArrowUpRight size={16} />
          </button>
          <details>
            <summary>View source and calculation rules</summary>
            <p>
              Empty numeric cells stay unavailable. Duplicate SKUs aggregate
              sales and quantity; source prices are quantity-weighted and GP is
              revenue-weighted. Incomplete aggregate inputs remain unavailable.
              Conflicting product names/groups are rejected.
            </p>
            <p>
              Optional Period 2025 and Period 2026 columns accept ISO dates as
              text. Those rows are filtered by the reporting dates before
              aggregation. Annual columns are never prorated.
            </p>
          </details>
        </div>
      </div>
      {file && (
        <div className="import-settings">
          <h4>Review import settings</h4>
          <div className="form-grid">
            <label>
              Worksheet
              <select
                value={meta.sheet}
                onChange={(e) => setMeta({ ...meta, sheet: e.target.value })}
              >
                {sheets.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Numeric GP values
              <select
                value={meta.gpScale}
                onChange={(e) =>
                  setMeta({
                    ...meta,
                    gpScale: e.target.value as ImportMeta["gpScale"],
                  })
                }
              >
                <option value="percent">35 means 35%</option>
                <option value="fraction">0.35 means 35%</option>
              </select>
            </label>
            <label>
              Source VAT basis
              <select
                value={meta.vat}
                onChange={(e) =>
                  setMeta({ ...meta, vat: e.target.value as ImportMeta["vat"] })
                }
              >
                <option>As supplied</option>
                <option>VAT inclusive</option>
                <option>VAT exclusive</option>
              </select>
            </label>
            <label>
              Currency
              <select
                value={meta.currency}
                onChange={(e) => setMeta({ ...meta, currency: e.target.value })}
              >
                {["THB", "USD", "EUR", "GBP", "JPY"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            {(["25", "26"] as const).map((year) => (
              <div className="date-pair" key={year}>
                <label>
                  20{year} period start
                  <input
                    type="date"
                    min={`20${year}-01-01`}
                    max={`20${year}-12-31`}
                    value={meta[`start${year}`]}
                    onChange={(e) =>
                      setMeta({ ...meta, [`start${year}`]: e.target.value })
                    }
                  />
                </label>
                <label>
                  20{year} period end
                  <input
                    type="date"
                    min={`20${year}-01-01`}
                    max={`20${year}-12-31`}
                    value={meta[`end${year}`]}
                    onChange={(e) =>
                      setMeta({ ...meta, [`end${year}`]: e.target.value })
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <p className="notice">
            {periodValidity(meta).warning || periodValidity(meta).label}{" "}
            Percentage-formatted Excel cells and text such as 35% are recognized
            automatically.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={meta.gpMeaning === "margin"}
              onChange={(e) =>
                setMeta({
                  ...meta,
                  gpMeaning: e.target.checked ? "margin" : "unconfirmed",
                })
              }
            />{" "}
            I confirm %Total GP means gross profit margin, not markup or profit
            contribution.
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={meta.sameBasis}
              onChange={(e) =>
                setMeta({ ...meta, sameBasis: e.target.checked })
              }
            />{" "}
            Sales and margin use the same financial / VAT basis. Enable
            estimated GP amounts.
          </label>
          <button
            className="button primary"
            disabled={busy || meta.gpMeaning !== "margin"}
            onClick={submit}
          >
            {busy ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Check size={17} />
            )}{" "}
            Import & analyze
          </button>
        </div>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
