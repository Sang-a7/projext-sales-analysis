"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  ChevronDown,
  Database,
  FileClock,
  LayoutDashboard,
  Leaf,
  LoaderCircle,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  AnalyzedRow,
  COLORS,
  DEFAULT_FILTERS,
  DEFAULT_META,
  Filters,
  ImportMeta,
  QUADRANTS,
  SourceRow,
} from "@/lib/types";
import { groupRows, periodValidity, select, summarize } from "@/lib/analysis";
import { compact, fmt, pct, pp, tone } from "@/lib/format";
import { downloadBlob, exportData } from "@/lib/export";
import { ImportPanel } from "./import-panel";
import { BcgChart, ComparisonCharts } from "./charts";
import { ProductGroups } from "./product-groups";
import { BCG_COLUMNS, DataTable, YOY_COLUMNS } from "./table";
type Batch = {
  id: string;
  filename: string;
  createdAt: string;
  rowCount: number;
  metadata: string;
};
type Loaded = {
  id: string;
  filename: string;
  createdAt: string;
  metadata: ImportMeta & { warnings: string[]; hasPeriod: boolean };
  rows: SourceRow[];
};
export default function Dashboard() {
  const [batch, setBatch] = useState<Loaded | null>(null),
    [history, setHistory] = useState<Batch[]>([]),
    [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [historyOpen, setHistoryOpen] = useState(false),
    [uploadOpen, setUploadOpen] = useState(false),
    [selected, setSelected] = useState<AnalyzedRow | null>(null),
    [exporting, setExporting] = useState(false),
    [advanced, setAdvanced] = useState(false);
  const meta = batch?.metadata ?? DEFAULT_META;
  const result = useMemo(
    () => select(batch?.rows ?? [], meta, filters),
    [batch, meta, filters],
  );
  const summary = summarize(result.rows),
    period = periodValidity(meta),
    groups = [...new Set(batch?.rows.map((r) => r.group))].sort();
  const change = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  async function refresh(id?: string) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/imports"),
        items = await response.json();
      if (!response.ok) throw new Error(items.error);
      setHistory(items);
      const chosen = id ?? items[0]?.id;
      if (chosen) {
        const response = await fetch(
            "/api/imports?id=" + encodeURIComponent(chosen),
          ),
          data = await response.json();
        if (!response.ok) throw new Error(data.error);
        setBatch(data);
        setFilters(DEFAULT_FILTERS);
        setUploadOpen(false);
        setHistoryOpen(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load local data.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function pdf() {
    if (!batch) return;
    setExporting(true);
    setError("");
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: batch.id, filters }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      downloadBlob(await response.blob(), "sku-performance-analysis.pdf");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF export failed.");
    } finally {
      setExporting(false);
    }
  }
  function spreadsheet(format: "xlsx" | "csv") {
    try {
      exportData(result.rows, meta, filters, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    }
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview">
          <span className="brand-icon">
            <Leaf size={23} />
          </span>
          folio<span className="brand-dot">.</span>
        </a>
        <p className="workspace-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <a className="nav-active" href="#overview">
            <LayoutDashboard size={19} /> Overview
          </a>
          <a href="#bcg">
            <Activity size={19} /> BCG matrix
          </a>
          <a href="#yoy">
            <BarChart3 size={19} /> YoY performance
          </a>
          <a href="#drivers">
            <Sparkles size={19} /> Performance drivers
          </a>
          <button onClick={() => setHistoryOpen(true)}>
            <FileClock size={19} /> Import history{" "}
            <span className="nav-count">{history.length}</span>
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-mark">
            <ShieldCheck size={18} />
            <div>
              <strong>Local by design</strong>
              <p>Your data stays on this device.</p>
            </div>
          </div>
          <div className="profile">
            <span>SA</span>
            <div>
              <strong>Sales analytics</strong>
              <p>Private workspace</p>
            </div>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            Analytics <span>/</span> <strong>SKU performance</strong>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i /> Local workspace
            </span>
            <button
              className="icon-button mobile-history"
              aria-label="Import history"
              onClick={() => setHistoryOpen(true)}
            >
              <FileClock size={18} />
            </button>
            <span className="avatar">SA</span>
          </div>
        </header>
        <main id="overview">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> THE BIG PICTURE, DOWN TO THE SKU
              </div>
              <h1>
                Know what drives
                <br />
                <span>your performance.</span>
              </h1>
              <p>
                Connect sales, volume and profitability.
                <br className="mobile-break" /> Turn every SKU into a more
                informed decision.
              </p>
            </div>
            <div className="heading-actions">
              <span className="period-pill">
                <span />
                2025 <ArrowRight size={15} /> 2026
              </span>
              <button
                className="button primary"
                onClick={() => {
                  setUploadOpen(true);
                  setTimeout(
                    () =>
                      document
                        .getElementById("import")
                        ?.scrollIntoView({ behavior: "smooth" }),
                    50,
                  );
                }}
              >
                <Upload size={17} /> Import data
              </button>
            </div>
          </div>
          <div className="section-label">
            <h5>Portfolio overview</h5>
            <span>
              {batch
                ? summary.count + " SKUs in selection"
                : "Waiting for your first import"}{" "}
              <span className="dot-separator">·</span>{" "}
              {batch ? meta.currency : "2025 vs 2026"}
            </span>
          </div>
          <KpiCards
            summary={summary}
            empty={!batch}
            comparable={period.comparable}
          />
          {error && (
            <div className="error-box" role="alert">
              {error}
              <button className="text-button" onClick={() => void refresh()}>
                Retry
              </button>
            </div>
          )}
          {loading && (
            <p className="loading" role="status">
              <LoaderCircle className="spin" size={18} /> Loading local
              workspace…
            </p>
          )}
          {(!batch || uploadOpen) && <ImportPanel onImported={refresh} />}
          {!batch && !loading && (
            <div className="empty-features">
              {[
                {
                  icon: <Activity />,
                  title: "Map your portfolio",
                  text: "A dynamic Pareto matrix reveals your stars, cash cows and opportunities.",
                },
                {
                  icon: <BarChart3 />,
                  title: "See what changed",
                  text: "Compare 2025 and 2026 sales, quantities, prices and gross profit.",
                },
                {
                  icon: <ShieldCheck />,
                  title: "Keep it in your hands",
                  text: "Local storage, traceable imports and export-ready analysis.",
                },
              ].map((item) => (
                <article key={item.title}>
                  {item.icon}
                  <h5>{item.title}</h5>
                  <p>{item.text}</p>
                </article>
              ))}
            </div>
          )}
          {batch && (
            <>
              <div
                className={
                  "period-notice " + (period.comparable ? "comparable" : "")
                }
              >
                <ShieldCheck size={20} />
                <div>
                  <strong>{period.label}</strong>
                  <p>
                    {period.warning ||
                      "The reporting dates match across years."}{" "}
                    2025: {meta.start25 || "unknown"} –{" "}
                    {meta.end25 || "unknown"} · 2026:{" "}
                    {meta.start26 || "unknown"} – {meta.end26 || "unknown"}.
                    VAT: {meta.vat}.
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setHistoryOpen(true)}
                >
                  {batch.filename} <FileClock size={16} />
                </button>
              </div>
              {(summary.missing > 0 ||
                summary.coverage25 !== 100 ||
                summary.coverage26 !== 100) && (
                <p className="notice">
                  Coverage notice: {summary.missing} SKUs have missing sales or
                  quantity values. Totals sum available values and may be
                  incomplete. Weighted GP covers {pct(summary.coverage25)} of
                  positive 2025 revenue and {pct(summary.coverage26)} of
                  positive 2026 revenue; the covered SKU mix may differ.
                </p>
              )}
              <section className="filter-panel" aria-label="Dashboard filters">
                <div className="filter-main">
                  <label className="search-field">
                    <Search size={17} />
                    <input
                      aria-label="Search SKU or product name"
                      placeholder="Search SKU or product name…"
                      value={filters.search}
                      onChange={(e) => change("search", e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Product group</span>
                    <select
                      value={filters.group}
                      onChange={(e) => change("group", e.target.value)}
                    >
                      <option value="">All product groups</option>
                      {groups.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="sr-only">BCG quadrant</span>
                    <select
                      value={filters.quadrant}
                      onChange={(e) => change("quadrant", e.target.value)}
                    >
                      <option value="">All quadrants</option>
                      {QUADRANTS.map((q) => (
                        <option key={q}>{q}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    onClick={() => setAdvanced(!advanced)}
                    aria-expanded={advanced}
                  >
                    <SlidersHorizontal size={16} /> Filters{" "}
                    <ChevronDown size={14} />
                  </button>
                </div>
                {advanced && (
                  <div className="filter-advanced">
                    <label>
                      GP alert status
                      <select
                        value={filters.gpStatus}
                        onChange={(e) => change("gpStatus", e.target.value)}
                      >
                        <option value="">All GP statuses</option>
                        {[
                          "Healthy",
                          "Caution",
                          "High Risk",
                          "Critical",
                          "Loss-making",
                          "Data Unavailable",
                        ].map((g) => (
                          <option key={g}>{g}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Minimum GP %
                      <input
                        type="number"
                        placeholder="No minimum"
                        value={filters.minGp}
                        onChange={(e) => change("minGp", e.target.value)}
                      />
                    </label>
                    <label>
                      Maximum GP %
                      <input
                        type="number"
                        placeholder="No maximum"
                        value={filters.maxGp}
                        onChange={(e) => change("maxGp", e.target.value)}
                      />
                    </label>
                    <label>
                      Revenue movement
                      <select
                        value={filters.growth}
                        onChange={(e) => change("growth", e.target.value)}
                      >
                        <option value="">All movements</option>
                        <option value="up">Growing</option>
                        <option value="down">Declining</option>
                        <option value="flat">Unchanged</option>
                        <option value="new">New / No Baseline</option>
                      </select>
                    </label>
                  </div>
                )}
                <div className="filter-bottom">
                  <label>
                    Pareto basis{" "}
                    <select
                      value={filters.mode}
                      onChange={(e) => change("mode", e.target.value)}
                    >
                      <option value="global">Global portfolio</option>
                      <option value="selection">
                        Recalculate within selection
                      </option>
                    </select>
                  </label>
                  <span className="caption">
                    {filters.mode === "global"
                      ? "Classification uses the entire imported portfolio."
                      : "Recalculates for product group and search scope before applying quadrant, GP and growth filters."}
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Reset filters
                  </button>
                </div>
              </section>
              <section id="bcg" className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">01 / PORTFOLIO POSITION</span>
                    <h3>BCG matrix</h3>
                    <p>
                      Where contribution meets growth. Find the products that
                      move your business.
                    </p>
                  </div>
                  <span className="file-pill">Pareto 80%</span>
                </div>
                <BcgChart
                  rows={result.rows}
                  cutoff={result.cutoff}
                  onSelect={setSelected}
                />
              </section>
              <div className="quadrant-grid">
                {QUADRANTS.map((q) => {
                  const members = result.rows.filter((r) => r.quadrant === q),
                    s = summarize(members),
                    growths = members.filter((r) => r.salesGrowth !== null),
                    avg = growths.length
                      ? growths.reduce((a, r) => a + r.salesGrowth!, 0) /
                        growths.length
                      : null;
                  return (
                    <article
                      className="quadrant-card"
                      key={q}
                      style={{ borderTopColor: COLORS[q] }}
                    >
                      <button
                        className="quadrant-title"
                        onClick={() =>
                          change("quadrant", filters.quadrant === q ? "" : q)
                        }
                      >
                        <span style={{ color: COLORS[q] }}>●</span> {q}
                        <ArrowRight size={15} />
                      </button>
                      <div className="quadrant-number">
                        {members.length}
                        <span>SKUs</span>
                      </div>
                      <dl>
                        <div>
                          <dt>Sales 2026</dt>
                          <dd>{fmt(s.sales26)}</dd>
                        </div>
                        <div>
                          <dt>Portfolio share¹</dt>
                          <dd>
                            {pct(
                              summary.sales26 !== null &&
                                summary.sales26 > 0 &&
                                s.sales26 !== null
                                ? (s.sales26 / summary.sales26) * 100
                                : null,
                            )}
                          </dd>
                        </div>
                        <div>
                          <dt>Avg growth</dt>
                          <dd>{pct(avg)}</dd>
                        </div>
                        <div>
                          <dt>Weighted GP 25 / 26</dt>
                          <dd>
                            {pct(s.gp25)} / {pct(s.gp26)}
                          </dd>
                        </div>
                        <div>
                          <dt>GP movement</dt>
                          <dd className={tone(s.gpChange)}>{pp(s.gpChange)}</dd>
                        </div>
                        <div>
                          <dt>GP coverage 25 / 26</dt>
                          <dd>
                            {pct(s.coverage25)} / {pct(s.coverage26)}
                          </dd>
                        </div>
                        <div>
                          <dt>Below 30% GP</dt>
                          <dd>
                            {
                              members.filter(
                                (r) => r.gp26 !== null && r.gp26 < 30,
                              ).length
                            }
                          </dd>
                        </div>
                      </dl>
                    </article>
                  );
                })}
              </div>
              <p className="caption">
                ¹ Share of selected net sales, including exceptions; negative
                sales can produce shares outside 0–100%. BCG contribution uses
                positive eligible sales only.
              </p>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">
                      02 / THE DETAIL BEHIND THE DOTS
                    </span>
                    <h3>SKU performance</h3>
                    <p>
                      Compare contributions, growth and profitability across
                      your selection.
                    </p>
                  </div>
                  <div className="export-actions">
                    <button
                      className="button secondary"
                      onClick={() => spreadsheet("csv")}
                    >
                      CSV
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => spreadsheet("xlsx")}
                    >
                      <ArrowDownToLine size={16} /> Excel
                    </button>
                    <button
                      className="button primary"
                      onClick={pdf}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <LoaderCircle size={16} className="spin" />
                      ) : (
                        <ArrowDownToLine size={16} />
                      )}{" "}
                      PDF
                    </button>
                  </div>
                </div>
                <DataTable
                  rows={result.rows}
                  columns={BCG_COLUMNS}
                  onSelect={setSelected}
                  label="Detailed BCG SKU table"
                />
              </section>
              <section id="yoy" className="yoy-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">03 / UNDERSTAND THE CHANGE</span>
                    <h2>
                      Year over year.
                      <br />
                      <span>A clearer perspective.</span>
                    </h2>
                  </div>
                  <p>
                    Quantity. Revenue. Margin.
                    <br />
                    See the movements behind your performance.
                  </p>
                </div>
                <KpiCards
                  summary={summary}
                  empty={false}
                  comparable={period.comparable}
                  yoy
                />
                <ComparisonCharts rows={result.rows} onSelect={setSelected} />
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h3>YoY SKU comparison</h3>
                      <p>
                        Sort any metric to find the largest improvements and
                        declines. GP changes are percentage points.
                      </p>
                    </div>
                  </div>
                  <DataTable
                    rows={result.rows}
                    columns={YOY_COLUMNS}
                    onSelect={setSelected}
                    label="YoY SKU performance table"
                  />
                </section>
              </section>
              <DriverAnalysis rows={result.rows} onSelect={setSelected} />
              <section id="rankings">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">05 / THE BIGGEST MOVERS</span>
                    <h2>Growth & decline rankings</h2>
                  </div>
                  <span className="caption">
                    Top 10 in the current selection
                  </span>
                </div>
                <div className="ranking-grid">
                  {(["salesChange", "qtyChange", "gpChange"] as const).flatMap(
                    (key) =>
                      [true, false].map((up) => (
                        <Ranking
                          key={key + up}
                          rows={result.rows}
                          metric={key}
                          up={up}
                          onSelect={setSelected}
                        />
                      )),
                  )}
                </div>
              </section>
              <ProductGroups rows={result.rows} onSelect={setSelected} />
              <section className="panel exception-panel">
                <div className="panel-heading">
                  <div>
                    <h4>Exceptions & data quality</h4>
                    <p>
                      Non-positive sales, new products and incomplete baselines
                      remain visible here.
                    </p>
                  </div>
                  <span className="file-pill">
                    {result.rows.filter((r) => r.exceptions.length).length} SKUs
                    to review
                  </span>
                </div>
                {result.rows.some((r) => r.exceptions.length) ? (
                  <div className="exception-list">
                    {result.rows
                      .filter((r) => r.exceptions.length)
                      .map((r) => (
                        <div key={r.sku}>
                          <button
                            className="sku-link"
                            onClick={() => setSelected(r)}
                          >
                            {r.sku}
                          </button>
                          <span>{r.exceptions.join(" · ")}</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="caption">
                    No sales or baseline exceptions in this selection.
                  </p>
                )}
              </section>
            </>
          )}
          <footer>
            <span className="footer-brand">
              <Leaf size={16} /> folio.
            </span>
            <span>Clarity in every SKU.</span>
            <span>
              <ShieldCheck size={14} /> Processed and stored on this device
            </span>
          </footer>
        </main>
      </div>
      {historyOpen && (
        <Modal title="Import history" onClose={() => setHistoryOpen(false)}>
          <p>
            Each import is an independent snapshot. Opening a snapshot updates
            every analysis view.
          </p>
          {history.length === 0 ? (
            <div className="empty-history">
              <Database size={28} />
              <p>No imports yet.</p>
            </div>
          ) : (
            history.map((h) => {
              const m = JSON.parse(h.metadata) as Loaded["metadata"];
              return (
                <article className="history-item" key={h.id}>
                  <div>
                    <strong>{h.filename}</strong>
                    <span>
                      {new Date(h.createdAt).toLocaleString("en-GB", {
                        timeZone: "Asia/Bangkok",
                      })}{" "}
                      (Bangkok) · {h.rowCount} SKUs
                    </span>
                    <span>
                      {periodValidity(m).label} · {m.currency} · {m.vat}
                    </span>
                  </div>
                  <div className="history-actions">
                    <button
                      className="button secondary"
                      disabled={loading}
                      onClick={() => void refresh(h.id)}
                    >
                      Open analysis
                    </button>
                    <a
                      className="text-button"
                      href={
                        "/api/imports?id=" +
                        encodeURIComponent(h.id) +
                        "&source=1"
                      }
                      download
                    >
                      Original file ↓
                    </a>
                  </div>
                  <details>
                    <summary>Import notes</summary>
                    {m.warnings?.map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                    <p>
                      GP meaning: margin · Estimated GP:{" "}
                      {m.sameBasis
                        ? "enabled"
                        : "disabled (financial basis unconfirmed)"}{" "}
                      · Sheet: {m.sheet}
                    </p>
                    <p>
                      2025 {m.start25 || "unknown"} – {m.end25 || "unknown"} ·
                      2026 {m.start26 || "unknown"} – {m.end26 || "unknown"}
                    </p>
                  </details>
                </article>
              );
            })
          )}
        </Modal>
      )}
      {selected && (
        <Modal
          title={selected.sku + " · " + selected.name}
          onClose={() => setSelected(null)}
        >
          <div className="detail-intro">
            <span>{selected.group}</span>
            <span
              className={"badge q-" + selected.quadrant.replaceAll(" ", "-")}
            >
              {selected.quadrant}
            </span>
            <span className="badge">{selected.status}</span>
          </div>
          <table className="detail-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>2025</th>
                <th>2026</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Sales amount</td>
                <td>{fmt(selected.sales25)}</td>
                <td>{fmt(selected.sales26)}</td>
                <td>
                  {fmt(selected.salesChange)} / {pct(selected.salesGrowth)}
                </td>
              </tr>
              <tr>
                <td>Sales quantity</td>
                <td>{fmt(selected.qty25)}</td>
                <td>{fmt(selected.qty26)}</td>
                <td>
                  {fmt(selected.qtyChange)} / {pct(selected.qtyGrowth)}
                </td>
              </tr>
              <tr>
                <td>Source avg price</td>
                <td>{fmt(selected.price25)}</td>
                <td>{fmt(selected.price26)}</td>
                <td>
                  {fmt(selected.priceChange)} / {pct(selected.priceGrowth)}
                </td>
              </tr>
              <tr>
                <td>GP margin</td>
                <td>{pct(selected.gp25)}</td>
                <td>{pct(selected.gp26)}</td>
                <td>{pp(selected.gpChange)}</td>
              </tr>
              <tr>
                <td>Estimated GP</td>
                <td>{fmt(selected.estimatedGp25)}</td>
                <td>{fmt(selected.estimatedGp26)}</td>
                <td>{fmt(selected.estimatedGpChange)}</td>
              </tr>
            </tbody>
          </table>
          <p className="notice">
            GP alert: {selected.gpStatus} · Minimum target 30%. Estimated GP
            requires a confirmed common financial basis.
          </p>
          <h5>Measured findings</h5>
          <ul>
            {selected.findings.length ? (
              selected.findings.map((f) => <li key={f}>{f}</li>)
            ) : (
              <li>No directional changes available.</li>
            )}
          </ul>
          <h5>Price–volume bridge</h5>
          <p>
            Volume effect {fmt(selected.volumeEffect)} + price effect{" "}
            {fmt(selected.priceEffect)} + residual {fmt(selected.residual)} =
            sales change {fmt(selected.salesChange)}.
          </p>
          <p className="caption">
            {selected.bridgeExact
              ? "Source price × quantity reconciles with revenue in both years."
              : "The bridge is diagnostic, not an exact explanation: source price × quantity does not reconcile or inputs are missing."}
          </p>
          <h5>Suggested actions · inferred</h5>
          <ul>
            {selected.recommendations.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <h5>Classification rule</h5>
          <p>{selected.classificationBasis}</p>
          <h5>Data review</h5>
          <p>
            {selected.exceptions.join(" · ") || "No exceptions identified."}
          </p>
          <p className="caption">
            Pareto rank {fmt(selected.rank)} · Contribution{" "}
            {pct(selected.contribution)} · Cumulative {pct(selected.cumulative)}{" "}
            · {period.label}
          </p>
        </Modal>
      )}
    </div>
  );
}
function KpiCards({
  summary: s,
  empty,
  comparable,
  yoy = false,
}: {
  summary: ReturnType<typeof summarize>;
  empty: boolean;
  comparable: boolean;
  yoy?: boolean;
}) {
  const cards = [
    {
      label: "Sales amount",
      a: s.sales25,
      b: s.sales26,
      delta: s.salesChange,
      rate: s.salesGrowth,
      type: "sales",
    },
    {
      label: "Sales quantity",
      a: s.qty25,
      b: s.qty26,
      delta: s.qtyChange,
      rate: s.qtyGrowth,
      type: "qty",
    },
    {
      label: "Weighted gross margin",
      a: s.gp25,
      b: s.gp26,
      delta: s.gpChange,
      rate: s.gpChange,
      type: "gp",
    },
    {
      label: yoy ? "Average selling price" : "Portfolio average price",
      a: s.price25,
      b: s.price26,
      delta:
        s.price25 !== null && s.price26 !== null ? s.price26 - s.price25 : null,
      rate: s.priceGrowth,
      type: "price",
    },
  ];
  return (
    <div className="kpi-grid">
      {cards.map((c, i) => (
        <article
          key={c.type}
          className={"kpi-card " + (i === 0 ? "featured" : "")}
        >
          <div className="kpi-label">
            {c.label}
            <span>{i === 0 ? "↗" : i === 1 ? "▥" : i === 2 ? "◈" : "↔"}</span>
          </div>
          <div className="kpi-value">
            {empty ? "—" : c.type === "gp" ? pct(c.b) : compact(c.b)}
            <span>2026</span>
          </div>
          <div className="kpi-baseline">
            2025{" "}
            <strong>
              {empty ? "—" : c.type === "gp" ? pct(c.a) : fmt(c.a)}
            </strong>
          </div>
          <div className="kpi-bottom">
            <span className={"delta " + (empty ? "neutral" : tone(c.rate))}>
              {empty
                ? "Awaiting data"
                : c.type === "gp"
                  ? pp(c.rate)
                  : pct(c.rate)}
            </span>
            <span>
              {c.type === "gp"
                ? "margin movement"
                : comparable
                  ? "YoY change"
                  : "source-period change"}
            </span>
          </div>
          {yoy && (
            <p className="caption">
              Absolute change: {c.type === "gp" ? pp(c.delta) : fmt(c.delta)} ·
              2026: {c.type === "gp" ? pct(c.b) : fmt(c.b)}
            </p>
          )}
          {c.type === "gp" && !empty && (
            <p className="caption">
              Coverage 25 / 26: {pct(s.coverage25)} / {pct(s.coverage26)}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
function DriverAnalysis({
  rows,
  onSelect,
}: {
  rows: AnalyzedRow[];
  onSelect: (r: AnalyzedRow) => void;
}) {
  const cases = [
    {
      title: "Revenue up, margin down",
      match: (r: AnalyzedRow) =>
        r.salesChange !== null &&
        r.salesChange > 0 &&
        r.gpChange !== null &&
        r.gpChange < 0,
      note: "Review discounts and costs; growing sales alone may not strengthen margin.",
    },
    {
      title: "Revenue down, margin up",
      match: (r: AnalyzedRow) =>
        r.salesChange !== null &&
        r.salesChange < 0 &&
        r.gpChange !== null &&
        r.gpChange > 0,
      note: "Review the balance between volume retention and margin improvement.",
    },
    {
      title: "Quantity up, price down",
      match: (r: AnalyzedRow) =>
        r.qtyChange !== null &&
        r.qtyChange > 0 &&
        r.priceChange !== null &&
        r.priceChange < 0,
      note: "Investigate possible price or product-mix pressure.",
    },
    {
      title: "Growth below GP target",
      match: (r: AnalyzedRow) =>
        r.salesGrowth !== null &&
        r.salesGrowth > 0 &&
        r.gp26 !== null &&
        r.gp26 < 30,
      note: "Review profitability before increasing growth investment.",
    },
    {
      title: "High sales, low GP",
      match: (r: AnalyzedRow) => r.high && r.gp26 !== null && r.gp26 < 30,
      note: "Prioritize margin reviews for these major contributors.",
    },
    {
      title: "Small sales, strong GP",
      match: (r: AnalyzedRow) =>
        r.contribution !== null && !r.high && r.gp26 !== null && r.gp26 >= 35,
      note: "Consider targeted demand testing for profitable smaller products.",
    },
    {
      title: "Revenue, quantity & GP down",
      match: (r: AnalyzedRow) =>
        r.salesChange !== null &&
        r.salesChange < 0 &&
        r.qtyChange !== null &&
        r.qtyChange < 0 &&
        r.gpChange !== null &&
        r.gpChange < 0,
      note: "Investigate demand, pricing and costs together.",
    },
  ];
  return (
    <section id="drivers">
      <div className="section-heading">
        <div>
          <span className="eyebrow">04 / BEHIND THE MOVEMENT</span>
          <h2>What’s driving performance?</h2>
        </div>
        <p>
          Measured patterns. Practical next questions.
          <br />
          Suggested actions are hypotheses, not proven causes.
        </p>
      </div>
      <div className="insight-grid">
        {cases.map((c) => {
          const matches = rows.filter(c.match);
          return (
            <article className="panel insight" key={c.title}>
              <div className="insight-count">
                {matches.length}
                <span>SKUs</span>
              </div>
              <h5>{c.title}</h5>
              <p>{c.note}</p>
              <details>
                <summary>Explore matching SKUs</summary>
                {matches.length ? (
                  matches.map((r) => (
                    <button
                      key={r.sku}
                      className="group-sku"
                      onClick={() => onSelect(r)}
                    >
                      {r.sku} · {r.name}
                    </button>
                  ))
                ) : (
                  <p>No matches in this selection.</p>
                )}
              </details>
            </article>
          );
        })}
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h4>Price–volume & movement analysis</h4>
            <p>
              Source price × quantity must reconcile in both years for an exact
              bridge. Residuals remain visible.
            </p>
          </div>
        </div>
        <DataTable
          rows={rows}
          columns={[
            { key: "sku", label: "SKU" },
            { key: "name", label: "Product" },
            { key: "qtyChange", label: "Quantity Δ" },
            { key: "salesChange", label: "Sales Δ" },
            { key: "priceChange", label: "Price Δ" },
            { key: "gpChange", label: "GP Δ", format: "pp" },
            { key: "volumeEffect", label: "Volume effect" },
            { key: "priceEffect", label: "Price effect" },
            { key: "residual", label: "Residual" },
            { key: "bridgeExact", label: "Reconciles" },
            { key: "status", label: "Status" },
          ]}
          onSelect={onSelect}
          label="Performance driver analysis"
        />
      </section>
    </section>
  );
}
function Ranking({
  rows,
  metric,
  up,
  onSelect,
}: {
  rows: AnalyzedRow[];
  metric: "salesChange" | "qtyChange" | "gpChange";
  up: boolean;
  onSelect: (r: AnalyzedRow) => void;
}) {
  const ranked = rows
    .filter((r) => r[metric] !== null && (up ? r[metric]! > 0 : r[metric]! < 0))
    .sort((a, b) => (up ? b[metric]! - a[metric]! : a[metric]! - b[metric]!))
    .slice(0, 10);
  const name =
    metric === "salesChange"
      ? "Revenue"
      : metric === "qtyChange"
        ? "Quantity"
        : "GP";
  return (
    <article className="panel ranking">
      <div className="panel-heading">
        <h5>
          {name} {up ? "gainers" : "decliners"}
        </h5>
        <span className={up ? "positive" : "negative"}>{up ? "↗" : "↘"}</span>
      </div>
      {ranked.map((r, i) => {
        const a =
            metric === "salesChange"
              ? r.sales25
              : metric === "qtyChange"
                ? r.qty25
                : r.gp25,
          b =
            metric === "salesChange"
              ? r.sales26
              : metric === "qtyChange"
                ? r.qty26
                : r.gp26,
          rate = metric === "salesChange" ? r.salesGrowth : r.qtyGrowth;
        return (
          <button
            className="ranking-row"
            key={r.sku}
            onClick={() => onSelect(r)}
          >
            <span className="rank-position">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>
                {r.sku} · {r.name}
              </strong>
              <small>
                {r.group} · {r.quadrant}
              </small>
              <small>
                {fmt(a)} → {fmt(b)}
              </small>
            </span>
            <span className={up ? "positive" : "negative"}>
              <strong>
                {metric === "gpChange" ? pp(r[metric]) : fmt(r[metric])}
              </strong>
              {metric !== "gpChange" && <small>{pct(rate)}</small>}
            </span>
          </button>
        );
      })}
      {!ranked.length && (
        <p className="ranking-empty">
          No {up ? "improvements" : "declines"} in this selection.
        </p>
      )}
    </article>
  );
}
function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a[href],input,select,summary,[tabindex="0"]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
      >
        <div className="modal-heading">
          <h4>{title}</h4>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={21} />
          </button>
        </div>
        <div className="modal-content">{children}</div>
      </div>
    </div>
  );
}
