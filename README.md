# Folio - SKU Performance Analysis

A local Next.js App Router application for the supplied 2025 vs 2026 SKU performance specification. Built in the requested empty folder as a new application, with no dependency on or changes to the neighboring project.

## Run on Windows

Requires Node.js 22.12 or newer.

Double-click **install-local.bat** once, then **start-local.bat**. The server binds only to 127.0.0.1:3005.

Or use PowerShell:

```powershell
cd G:\coding\projext-sales-analysis
npm ci
npm run setup
npm run build
npm start
```

Open http://127.0.0.1:3005. For development, use npm run dev.

The delivered database is empty. No demonstration figures are displayed. Import an actual XLSX or UTF-8 CSV file through the page, or download the blank CSV template.

## Imports and financial definitions

Required headers:

- SKU Code, Product Name, Product Group
- Sales Amount 2025, Sales Amount 2026
- Sales Quantity 2025, Sales Quantity 2026
- Average Price 2025, Average Price 2026
- %Total GP 2025, %Total GP 2026

Header matching ignores spaces, case and punctuation. SKU codes retain leading zeros; Excel identifier columns should be text or explicitly zero-formatted. Select the worksheet before import. The importer supports Excel percentage-formatted cells, numeric percentages, decimal fractions selected in settings, negative values and blank numeric cells.

Confirm that %Total GP means gross profit margin before importing. Estimated gross profit is enabled only when sales and margin share the same financial/VAT basis. Invalid margins over 100% become unavailable with an audit warning; valid negative margins remain loss-making.

Duplicate SKU rows sum sales and quantity. Source average prices are weighted by positive quantity and GP by positive revenue. A duplicate aggregate with incomplete or invalid weights remains unavailable rather than pretending to be complete. Conflicting names/groups for the same SKU are rejected. Original bytes and import settings are preserved.

Files are limited to 20 MB and 50,000 source rows. Numeric parsing accepts standard decimal notation, comma thousands separators and parenthesized negatives. It does not assume locale-specific decimal commas.

## Reporting periods

Record source coverage separately for 2025 and 2026. Equal month/day coverage is marked comparable (YTD when applicable). Missing coverage is unconfirmed; unequal coverage carries an explicit non-like-for-like warning. Yearly summary values are used as supplied, never prorated.

Optional **Period 2025** and **Period 2026** columns accept ISO dates stored as text (YYYY-MM-DD). With these columns, select date ranges during import to filter each year's rows before aggregation. Re-import the preserved source to analyze another date range; each analysis remains a separate historical snapshot. The importer does not fabricate monthly data.

VAT mode records the supplied financial basis. The source schema contains no VAT rates or accounting conversion rules, so the application does not silently convert amounts between VAT-inclusive and VAT-exclusive values. Currency is a label, not an exchange-rate conversion.

## Analysis

- Dynamic Pareto 80% ranking on positive 2026 sales, with deterministic SKU-code ties. Includes the boundary SKU; the numerical cutoff is visual only.
- Four BCG classifications with a separate exception list. Products with unavailable or zero 2025 sales and available 2026 sales default to Question Marks; HB HOF ZER BX10RB4CA (11634), SKU 345338, defaults to Dogs. Original historical values and unavailable growth remain unchanged. Negative baselines or missing current sales remain unclassified.
- Global classification or recalculation for the product-group/search scope. Quadrant, GP and movement filters apply afterward, preventing recursive reclassification.
- Synchronized KPI cards, interactive SVG bubble and grouped comparison charts, sortable/paginated tables and full SKU panels.
- Source average prices at SKU level; total sales / total quantity for aggregate average prices.
- Revenue-weighted GP and revenue coverage per year, GP percentage-point changes, five GP alerts and conditional formatting.
- Seven profitability insight patterns, quantity/revenue and revenue/GP scenarios, a reconciled price-volume bridge with residuals, six top-10 rankings and expandable product groups.
- Missing inputs remain unavailable. Zero or negative prior-year denominators do not create infinite growth. Totals of available data are clearly flagged when incomplete.

Chart controls support mouse/pointer panning, zoom buttons, reset, labels, GP highlighting, keyboard activation and PNG export. On phones the wide analytical chart/table areas scroll within their cards.

The wider matrix shows abbreviated product labels with collision-aware placement. Products without a calculable historical growth rate appear in a labeled band beneath the axes, with their business classification, rather than at an invented growth coordinate. Comparison charts show values on every bar and all groups in a scrollable overview. Select a group to inspect its SKU charts and full table; Back restores the overview and its scroll position without changing global filters. Expanded product-group rows also contain a separate table with each SKU's metrics.

## Exports and audit trail

- **Excel:** all analyzed SKU columns, portfolio and group summaries, BCG summary, exception records, six rankings and reporting/filter context in separate worksheets.
- **CSV:** current filtered analyzed SKU rows; formula-like text is escaped.
- **PDF:** current filtered portfolio, BCG plot, group analysis, rankings and a full analysis page per SKU. Kanit is embedded, including Thai characters.
- **PNG:** the current BCG chart, with Kanit embedded during rendering.
- **Import history:** select prior snapshots or download the byte-preserved original file.

Business data stays in data/analysis.db (SQLite through Prisma). Back up this file while the app is stopped. The runtime performs no external analytics or font requests. Initial package installation requires Internet access. Kanit is bundled under its SIL Open Font License in public/fonts/OFL.txt.

## Development and verification

```powershell
npm run typecheck
npm test
npm run build
```

Integration tests create explicitly labeled synthetic imports. Run them only against a disposable database/server:

```powershell
$env:TEST_URL='http://127.0.0.1:3006'
npm run test:integration
```

The integration suite verifies invalid uploads, GP confirmation, CSV/XLSX imports, database persistence, original file downloads and filtered/full PDF exports. Unit tests cover all 18 calculation areas in the requirements plus import regressions. The browser workflow is exercised for file selection, GP confirmation, filters, details, history and export downloads at desktop, tablet and mobile sizes.

Next.js uses webpack because the Windows Turbopack/PostCSS worker failed in the development environment. Kanit uses next/font/local: next/font/google was attempted, but its build-time Google Fonts connection was unavailable. Local font loading also keeps the installed app usable offline.

## Structure

- src/lib/analysis.ts: pure, testable analytics and scope filtering
- src/lib/import.ts: workbook validation, normalization and aggregation
- src/lib/export.ts: spreadsheet and CSV exports
- src/app/api/imports: local import persistence, history and originals
- src/app/api/export: server-side PDF generation
- src/components: dashboard, importer, tables and interactive charts
- prisma/schema.prisma: source snapshots and normalized SKU records
- tests: calculation/import tests and local API integration workflow

Private-domain migration can reuse the calculation and storage modules. The application is intentionally localhost-only today; authentication and remote hosting have not been configured.
