"use client";
import { useRef, useState } from "react";
import { AnalyzedRow, COLORS, Value } from "@/lib/types";
import { fmt, pct, pp } from "@/lib/format";
import { placeLabels, shortProductName } from "@/lib/chart-layout";
export { ComparisonCharts } from "./comparison-charts";
import { downloadBlob } from "@/lib/export";
import { Download, Minus, Plus, RotateCcw, Tags } from "lucide-react";
export function BcgChart({
  rows,
  cutoff,
  onSelect,
}: {
  rows: AnalyzedRow[];
  cutoff: Value;
  onSelect: (r: AnalyzedRow) => void;
}) {
  const svg = useRef<SVGSVGElement>(null),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [labels, setLabels] = useState(true),
    [highlight, setHighlight] = useState(true),
    [hover, setHover] = useState<AnalyzedRow | null>(null),
    [error, setError] = useState("");
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    moved: boolean;
  } | null>(null);
  const points = rows.filter(
    (r) =>
      r.salesGrowth !== null &&
      r.contribution !== null &&
      r.quadrant !== "Unclassified",
  );
  const rawMin = Math.min(-15, ...points.map((r) => r.salesGrowth!)),
    rawMax = Math.max(15, ...points.map((r) => r.salesGrowth!));
  const padding = (rawMax - rawMin) * 0.08,
    min = rawMin - padding,
    max = rawMax + padding,
    ymax =
      Math.max(2, cutoff ?? 0, ...points.map((r) => r.contribution!)) * 1.2;
  const width = 1340,
    height = 560,
    left = 80,
    top = 45;
  const x = (n: number) =>
    left + (((n - min) / (max - min)) * zoom + pan.x) * width;
  const y = (n: number) => top + height - ((n / ymax) * zoom + pan.y) * height;
  const biggest = Math.max(1, ...points.map((r) => r.sales26!));
  const noBaseline = rows.filter(
    (r) =>
      r.salesGrowth === null &&
      (r.quadrant === "Dogs" || r.quadrant === "Question Marks"),
  );
  const viewHeight =
    700 + (noBaseline.length ? 80 + Math.ceil(noBaseline.length / 3) * 74 : 0);
  const radius = (r: AnalyzedRow) => 4 + Math.sqrt(r.sales26! / biggest) * 18;
  const positions = placeLabels(
    points.map((r) => ({
      sku: r.sku,
      x: x(r.salesGrowth!),
      y: y(r.contribution!),
      radius: radius(r),
      label: shortProductName(r.name),
    })),
    { left, top, width, height },
  );
  const labelRows = new Map(points.map((r) => [r.sku, r]));
  const outputWidth = 2200,
    outputHeight = Math.round((outputWidth * viewHeight) / 1480);
  async function png() {
    try {
      if (!svg.current) return;
      const clone = svg.current.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("width", String(outputWidth));
      clone.setAttribute("height", String(outputHeight));
      const font = await fetch("/fonts/Kanit-Regular.ttf");
      if (!font.ok) throw new Error("The local Kanit font is unavailable.");
      const fontUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        void font.blob().then((blob) => reader.readAsDataURL(blob));
      });
      const style = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "style",
      );
      style.textContent = `@font-face{font-family:Kanit;src:url(${fontUrl})} text{font-family:Kanit,sans-serif}`;
      clone.prepend(style);
      const xml = new XMLSerializer().serializeToString(clone),
        url = URL.createObjectURL(
          new Blob([xml], { type: "image/svg+xml;charset=utf-8" }),
        ),
        img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Chart could not be rendered."));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("PNG export is unavailable.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, outputWidth, outputHeight);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("PNG export failed.");
      downloadBlob(blob, "bcg-matrix.png");
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export failed.");
    }
  }
  return (
    <div>
      <div className="chart-toolbar">
        <div className="legend">
          {Object.entries(COLORS)
            .filter(([q]) => q !== "Unclassified")
            .map(([q, c]) => (
              <span key={q}>
                <i style={{ background: c }} />
                {q}
              </span>
            ))}
        </div>
        <div className="chart-actions">
          <button
            className={labels ? "icon-button active" : "icon-button"}
            onClick={() => setLabels(!labels)}
            aria-label="Toggle SKU labels"
            aria-pressed={labels}
          >
            <Tags size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => setZoom(Math.min(zoom * 1.4, 8))}
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => setZoom(Math.max(zoom / 1.4, 1))}
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Reset zoom"
          >
            <RotateCcw size={15} />
          </button>
          <button
            className="icon-button"
            onClick={png}
            aria-label="Export BCG as PNG"
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="bcg-canvas">
        <svg
          ref={svg}
          viewBox={`0 0 1480 ${viewHeight}`}
          role="img"
          aria-label="BCG bubble chart. Horizontal axis sales growth, vertical axis sales contribution. Drag to pan."
          style={{
            touchAction: "pan-y",
            fontFamily: "Kanit, sans-serif",
            background: "#fff",
          }}
          onPointerDown={(e) => {
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              px: pan.x,
              py: pan.y,
              moved: false,
            };
          }}
          onPointerMove={(e) => {
            if (drag.current && e.buttons) {
              const box = e.currentTarget.getBoundingClientRect();
              const dx = (e.clientX - drag.current.x) / box.width,
                dy = (e.clientY - drag.current.y) / box.height;
              if (Math.abs(dx) + Math.abs(dy) > 0.01) drag.current.moved = true;
              setPan({
                x: drag.current.px + (dx * 1480) / width,
                y: drag.current.py - (dy * viewHeight) / height,
              });
            }
          }}
          onPointerUp={() => {
            setTimeout(() => {
              drag.current = null;
            }, 0);
          }}
          onPointerLeave={() => {
            drag.current = null;
          }}
        >
          <defs>
            <clipPath id="bcg-clip">
              <rect x={left} y={top} width={width} height={height} />
            </clipPath>
          </defs>
          <rect width="1480" height={viewHeight} fill="white" />
          <g clipPath="url(#bcg-clip)">
            <rect
              x={left}
              y={top}
              width={width}
              height={height}
              fill="#f7faf9"
            />
            <rect
              x={left}
              y={top}
              width={Math.max(0, x(0) - left)}
              height={Math.max(0, y(cutoff ?? 0) - top)}
              fill="#fdf7e9"
            />
            <rect
              x={x(0)}
              y={top}
              width={Math.max(0, left + width - x(0))}
              height={Math.max(0, y(cutoff ?? 0) - top)}
              fill="#edf7f0"
            />
            <rect
              x={left}
              y={y(cutoff ?? 0)}
              width={Math.max(0, x(0) - left)}
              height={Math.max(0, top + height - y(cutoff ?? 0))}
              fill="#fdf0ef"
            />
            <rect
              x={x(0)}
              y={y(cutoff ?? 0)}
              width={Math.max(0, left + width - x(0))}
              height={Math.max(0, top + height - y(cutoff ?? 0))}
              fill="#eef4fd"
            />
            {Array.from({ length: 6 }, (_, i) => (
              <line
                key={i}
                x1={left}
                y1={top + (i * height) / 5}
                x2={left + width}
                y2={top + (i * height) / 5}
                stroke="#dae5df"
                strokeDasharray="3 6"
              />
            ))}
            <line
              x1={x(0)}
              y1={top}
              x2={x(0)}
              y2={top + height}
              stroke="#8d9f97"
              strokeDasharray="5 4"
            />
            <line
              x1={left}
              y1={y(cutoff ?? 0)}
              x2={left + width}
              y2={y(cutoff ?? 0)}
              stroke="#8d9f97"
              strokeDasharray="5 4"
            />
            <text x={left + 18} y={top + 24} fill="#99701f" fontSize="13">
              CASH COWS
            </text>
            <text
              x={left + width - 18}
              y={top + 24}
              textAnchor="end"
              fill="#268367"
              fontSize="13"
            >
              STARS
            </text>
            <text
              x={left + 18}
              y={top + height - 15}
              fill="#bc6060"
              fontSize="13"
            >
              DOGS
            </text>
            <text
              x={left + width - 18}
              y={top + height - 15}
              textAnchor="end"
              fill="#567dbd"
              fontSize="13"
            >
              QUESTION MARKS
            </text>
            {points.map((r) => (
              <g
                key={r.sku}
                tabIndex={0}
                role="button"
                aria-label={
                  r.sku + ", " + r.quadrant + ", growth " + pct(r.salesGrowth)
                }
                onFocus={() => setHover(r)}
                onBlur={() => setHover(null)}
                onMouseEnter={() => setHover(r)}
                onMouseLeave={() => setHover(null)}
                onClick={() => {
                  if (!drag.current?.moved) onSelect(r);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(r);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={x(r.salesGrowth!)}
                  cy={y(r.contribution!)}
                  r={radius(r)}
                  fill={COLORS[r.quadrant]}
                  fillOpacity={0.75}
                  stroke={
                    highlight && r.gp26 !== null && r.gp26 < 30
                      ? "#ab3737"
                      : "white"
                  }
                  strokeWidth={
                    highlight && r.gp26 !== null && r.gp26 < 30 ? 2.5 : 1.5
                  }
                />
              </g>
            ))}
            {labels &&
              positions.map((box) => {
                const r = labelRows.get(box.sku)!;
                return (
                  <g
                    key={"label-" + box.sku}
                    className="bcg-product-label"
                    onClick={() => onSelect(r)}
                  >
                    <title>
                      {r.name} · SKU {r.sku}
                    </title>
                    <line
                      x1={box.pointX}
                      y1={box.pointY}
                      x2={box.x + box.width / 2}
                      y2={box.y + box.height / 2}
                      stroke={COLORS[r.quadrant]}
                        strokeOpacity=".3"
                    />
                    <rect
                      x={box.x}
                      y={box.y}
                      width={box.width}
                      height={box.height}
                      rx="5"
                      fill="white"
                      fillOpacity=".94"
                      stroke="#d9e3d7"
                    />
                    <text
                      x={box.x + box.width / 2}
                      y={box.y + 15}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#273d3b"
                    >
                      {shortProductName(r.name)}
                    </text>
                  </g>
                );
              })}
          </g>
          {Array.from({ length: 6 }, (_, i) => {
            const value = min + ((i / 5 - pan.x) / zoom) * (max - min);
            return (
              <text
                key={i}
                x={left + (i * width) / 5}
                y={top + height + 25}
                textAnchor="middle"
                fontSize="11"
                fill="#73817b"
              >
                {fmt(value)}%
              </text>
            );
          })}
          {Array.from({ length: 6 }, (_, i) => (
            <text
              key={i}
              x={left - 12}
              y={top + height - (i * height) / 5 + 4}
              textAnchor="end"
              fontSize="11"
              fill="#73817b"
            >
              {fmt(((i / 5 - pan.y) / zoom) * ymax)}%
            </text>
          ))}
          <text
            x="750"
            y="670"
            textAnchor="middle"
            fontSize="12"
            fill="#61736b"
          >
            Sales growth (%) · source periods
          </text>
          <text
            transform="translate(22,325) rotate(-90)"
            textAnchor="middle"
            fontSize="12"
            fill="#61736b"
          >
            2026 sales contribution (%)
          </text>
          {!points.length && (
            <text
              x="750"
              y="325"
              textAnchor="middle"
              fontSize="16"
              fill="#61736b"
            >
              No eligible SKUs to plot
            </text>
          )}
          {noBaseline.length > 0 && (
            <g>
              <rect
                x="60"
                y="700"
                width="1370"
                height={viewHeight - 710}
                rx="12"
                fill="#f6f8f3"
                stroke="#e1e7df"
              />
              <text x="82" y="728" fontSize="16" fill="#304d40">
                No 2025 baseline · business classification
              </text>
              <text x="82" y="749" fontSize="12" fill="#71816b">
                Growth is unavailable. These products are not assigned an
                invented position on the growth axis.
              </text>
              {noBaseline.map((r, i) => {
                const px = 82 + (i % 3) * 448,
                  py = 770 + Math.floor(i / 3) * 74;
                return (
                  <g
                    key={r.sku}
                    role="button"
                    tabIndex={0}
                    aria-label={
                      r.sku + ", " + r.quadrant + ", no 2025 baseline"
                    }
                    onClick={() => onSelect(r)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(r);
                      }
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <title>
                      {r.name} · {r.classificationBasis}
                    </title>
                    <rect
                      x={px}
                      y={py}
                      width="424"
                      height="60"
                      rx="7"
                      fill="white"
                      stroke={COLORS[r.quadrant]}
                    />
                    <circle
                      cx={px + 16}
                      cy={py + 20}
                      r="5"
                      fill={COLORS[r.quadrant]}
                    />
                    <text x={px + 30} y={py + 24} fontSize="13" fill="#304d40">
                      {shortProductName(r.name, 43)}
                    </text>
                    <text
                      x={px + 14}
                      y={py + 46}
                      fontSize="12"
                      fill={COLORS[r.quadrant]}
                    >
                      {r.sku} · {r.quadrant} · Sales {fmt(r.sales26)}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>
      {hover && (
        <div className="bubble-tooltip" role="status">
          <strong>
            {hover.sku} · {hover.name}
          </strong>
          <span>
            {hover.group} · {hover.quadrant}
          </span>
          <span>
            Sales {fmt(hover.sales25)} → {fmt(hover.sales26)} · Growth{" "}
            {pct(hover.salesGrowth)} · Contribution {pct(hover.contribution)}
          </span>
          <span>
            Qty {fmt(hover.qty25)} → {fmt(hover.qty26)} · ASP{" "}
            {fmt(hover.price25)} → {fmt(hover.price26)}
          </span>
          <span>
            GP {pct(hover.gp25)} → {pct(hover.gp26)} · {pp(hover.gpChange)}
          </span>
        </div>
      )}
      <div className="chart-note">
        <label>
          <input
            type="checkbox"
            checked={highlight}
            onChange={(e) => setHighlight(e.target.checked)}
          />{" "}
          Outline below-target GP
        </label>
        <span>
          Bubble size = 2026 sales · Pareto cutoff{" "}
          <strong>{pct(cutoff)}</strong> · Drag to pan
        </span>
      </div>
      <p className="caption">
        Rank determines Pareto membership. Tied contributions can share a
        position across classifications. New products default to Question Marks;
        product 11634 is a Dogs exception. Missing growth remains unavailable.
      </p>
      {error && (
        <p role="alert" className="negative">
          {error}
        </p>
      )}
    </div>
  );
}
