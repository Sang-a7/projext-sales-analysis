import {
  AnalyzedRow,
  Filters,
  GpStatus,
  ImportMeta,
  SourceRow,
  Value,
} from "./types";
export const diff = (a: Value, b: Value): Value =>
  a === null || b === null ? null : b - a;
export const growth = (a: Value, b: Value): Value =>
  a === null || b === null || a <= 0 ? null : ((b - a) / a) * 100;
export const sum = (rows: SourceRow[], key: keyof SourceRow): Value => {
  const values = rows
    .map((r) => r[key])
    .filter((v): v is number => typeof v === "number");
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
};
export function weighted(rows: SourceRow[], year: "25" | "26") {
  const eligible = rows.filter(
    (r) => r[`sales${year}`] !== null && r[`sales${year}`]! > 0,
  );
  const covered = eligible.filter((r) => r[`gp${year}`] !== null);
  const total = eligible.reduce((a, r) => a + r[`sales${year}`]!, 0);
  const revenue = covered.reduce((a, r) => a + r[`sales${year}`]!, 0);
  return {
    value: revenue
      ? covered.reduce((a, r) => a + r[`sales${year}`]! * r[`gp${year}`]!, 0) /
        revenue
      : null,
    coverage: total ? (revenue / total) * 100 : null,
  };
}
export function summarize(rows: SourceRow[]) {
  const sales25 = sum(rows, "sales25"),
    sales26 = sum(rows, "sales26"),
    qty25 = sum(rows, "qty25"),
    qty26 = sum(rows, "qty26");
  const gp25 = weighted(rows, "25"),
    gp26 = weighted(rows, "26");
  const price25 =
    sales25 !== null && qty25 !== null && qty25 > 0 ? sales25 / qty25 : null;
  const price26 =
    sales26 !== null && qty26 !== null && qty26 > 0 ? sales26 / qty26 : null;
  const missing = rows.filter((r) =>
    [r.sales25, r.sales26, r.qty25, r.qty26].some((v) => v === null),
  ).length;
  return {
    count: rows.length,
    sales25,
    sales26,
    qty25,
    qty26,
    price25,
    price26,
    gp25: gp25.value,
    gp26: gp26.value,
    coverage25: gp25.coverage,
    coverage26: gp26.coverage,
    salesChange: diff(sales25, sales26),
    salesGrowth: growth(sales25, sales26),
    qtyChange: diff(qty25, qty26),
    qtyGrowth: growth(qty25, qty26),
    priceGrowth: growth(price25, price26),
    gpChange: diff(gp25.value, gp26.value),
    missing,
  };
}
export function periodValidity(meta: ImportMeta) {
  const dates = [meta.start25, meta.end25, meta.start26, meta.end26];
  if (dates.some((d) => !d))
    return {
      comparable: false,
      label: "Coverage unconfirmed",
      warning:
        "Annual source values are shown as supplied. Reporting coverage is unconfirmed; changes may not be like-for-like.",
    };
  const valid = dates.every(
    (d) =>
      /^\d{4}-\d{2}-\d{2}$/.test(d) &&
      !Number.isNaN(Date.parse(d)) &&
      new Date(d).toISOString().slice(0, 10) === d,
  );
  if (
    !valid ||
    !meta.start25.startsWith("2025") ||
    !meta.end25.startsWith("2025") ||
    !meta.start26.startsWith("2026") ||
    !meta.end26.startsWith("2026") ||
    meta.start25 > meta.end25 ||
    meta.start26 > meta.end26
  )
    return {
      comparable: false,
      label: "Invalid reporting periods",
      warning: "Choose valid start and end dates within each reporting year.",
    };
  const comparable =
    meta.start25.slice(5) === meta.start26.slice(5) &&
    meta.end25.slice(5) === meta.end26.slice(5);
  const ytd = meta.end26.slice(5) !== "12-31";
  return {
    comparable,
    label: comparable
      ? ytd
        ? "Comparable YTD periods"
        : "Comparable full years"
      : "Unequal reporting periods",
    warning: comparable
      ? ""
      : "Periods differ. Differences are source-period changes, not comparable YoY growth. No monthly data has been inferred.",
  };
}
export function gpStatus(value: Value): GpStatus {
  return value === null
    ? "Data Unavailable"
    : value < 0
      ? "Loss-making"
      : value < 20
        ? "Critical"
        : value < 30
          ? "High Risk"
          : value < 35
            ? "Caution"
            : "Healthy";
}
export function analyze(rows: SourceRow[], meta: ImportMeta) {
  const result: AnalyzedRow[] = rows.map((r) => {
    const salesChange = diff(r.sales25, r.sales26),
      salesGrowth = growth(r.sales25, r.sales26),
      qtyChange = diff(r.qty25, r.qty26),
      qtyGrowth = growth(r.qty25, r.qty26),
      priceChange = diff(r.price25, r.price26),
      priceGrowth = growth(r.price25, r.price26),
      gpChange = diff(r.gp25, r.gp26);
    const derive = (sales: Value, gp: Value) =>
      meta.gpMeaning === "margin" &&
      meta.sameBasis &&
      sales !== null &&
      gp !== null
        ? (sales * gp) / 100
        : null;
    const estimatedGp25 = derive(r.sales25, r.gp25),
      estimatedGp26 = derive(r.sales26, r.gp26);
    const volumeEffect =
      qtyChange !== null && r.price25 !== null ? qtyChange * r.price25 : null;
    const priceEffect =
      priceChange !== null && r.qty26 !== null ? r.qty26 * priceChange : null;
    const residual =
      salesChange !== null && volumeEffect !== null && priceEffect !== null
        ? salesChange - volumeEffect - priceEffect
        : null;
    const reconciles = (sales: Value, qty: Value, price: Value) =>
      sales !== null &&
      qty !== null &&
      price !== null &&
      Math.abs(sales - qty * price) <=
        Math.max(0.01, Math.abs(sales) * 0.000001);
    const exceptions: string[] = [];
    if (r.sales26 === null) exceptions.push("2026 sales unavailable");
    else if (r.sales26 <= 0)
      exceptions.push("Non-positive 2026 net sales; excluded from Pareto");
    if (r.sales25 === null || r.sales25 <= 0)
      exceptions.push(
        r.sales25 === 0 && r.sales26 !== null && r.sales26 > 0
          ? "New / No Baseline"
          : "Missing or invalid prior-year baseline",
      );
    if ((r.gp25 !== null && r.gp25 < 0) || (r.gp26 !== null && r.gp26 < 0))
      exceptions.push("Negative margin; review loss-making product");
    if ((r.qty25 !== null && r.qty25 < 0) || (r.qty26 !== null && r.qty26 < 0))
      exceptions.push("Negative net quantity; review returns");
    const findings: string[] = [],
      recommendations: string[] = [];
    if (salesChange !== null && qtyChange !== null) {
      if (qtyChange > 0 && salesChange > 0)
        findings.push("Volume and revenue increased.");
      if (qtyChange > 0 && salesChange < 0) {
        findings.push("Quantity increased while revenue declined.");
        recommendations.push(
          "Investigate possible price or product-mix pressure.",
        );
      }
      if (qtyChange < 0 && salesChange > 0) {
        findings.push("Revenue increased while quantity declined.");
        recommendations.push(
          "Review whether higher prices contributed to revenue growth.",
        );
      }
      if (qtyChange < 0 && salesChange < 0)
        findings.push("Sales volume and revenue declined.");
    }
    if (salesChange !== null && gpChange !== null) {
      if (salesChange > 0 && gpChange > 0)
        findings.push("Revenue and GP margin improved.");
      if (salesChange > 0 && gpChange < 0) {
        findings.push("Revenue grew while GP margin declined.");
        recommendations.push(
          "Review discounting and cost changes before expanding volume.",
        );
      }
      if (salesChange < 0 && gpChange > 0)
        findings.push("Revenue declined while GP margin improved.");
      if (salesChange < 0 && gpChange < 0)
        findings.push("Revenue and GP margin declined.");
    }
    if (
      qtyChange !== null &&
      qtyChange > 0 &&
      priceChange !== null &&
      priceChange < 0
    )
      findings.push(
        "Higher quantity coincided with a lower source average price.",
      );
    if (
      salesGrowth !== null &&
      salesGrowth > 0 &&
      r.gp26 !== null &&
      r.gp26 < 30
    )
      findings.push("Positive revenue growth with GP below the 30% target.");
    if (
      salesChange !== null &&
      salesChange < 0 &&
      qtyChange !== null &&
      qtyChange < 0 &&
      gpChange !== null &&
      gpChange < 0
    )
      findings.push("Revenue, quantity, and GP margin all declined.");
    const noBaseline =
      (r.sales25 === null || r.sales25 === 0) && r.sales26 !== null;
    // Explicit business exception requested for SKU 345338 / product 11634.
    const forcedDog =
      noBaseline &&
      (r.sku.trim() === "345338" ||
        r.name.replace(/\s+/g, " ").trim().toUpperCase() ===
          "HB HOF ZER BX10RB4CA (11634)");
    const classificationBasis = noBaseline
      ? forcedDog
        ? "Business exception: HB HOF ZER BX10RB4CA (11634) → Dogs; no 2025 baseline."
        : "New product default: Question Marks; no 2025 baseline."
      : "Sales growth and cumulative Pareto ranking.";
    if (noBaseline) findings.push(classificationBasis);
    const status = noBaseline
      ? "New / No Baseline"
      : salesChange === null
        ? "Data Unavailable"
        : salesChange > 0
          ? gpChange !== null && gpChange < 0
            ? "Growth / margin pressure"
            : "Growing"
          : salesChange < 0
            ? gpChange !== null && gpChange > 0
              ? "Decline / margin recovery"
              : "Declining"
            : "Unchanged";
    return {
      ...r,
      salesChange,
      salesGrowth,
      qtyChange,
      qtyGrowth,
      priceChange,
      priceGrowth,
      gpChange,
      estimatedGp25,
      estimatedGp26,
      estimatedGpChange: diff(estimatedGp25, estimatedGp26),
      volumeEffect,
      priceEffect,
      residual,
      bridgeExact:
        reconciles(r.sales25, r.qty25, r.price25) &&
        reconciles(r.sales26, r.qty26, r.price26),
      contribution: null,
      cumulative: null,
      rank: null,
      high: false,
      quadrant: noBaseline
        ? forcedDog
          ? "Dogs"
          : "Question Marks"
        : "Unclassified",
      classificationBasis,
      gpStatus: gpStatus(r.gp26),
      status,
      exceptions,
      findings,
      recommendations,
    };
  });
  const eligible = result
    .filter((r) => r.sales26 !== null && r.sales26 > 0)
    .sort(
      (a, b) =>
        b.sales26! - a.sales26! || (a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0),
    );
  const total = eligible.reduce((a, r) => a + r.sales26!, 0);
  let cumulative = 0,
    cutoff: Value = null,
    boundaryReached = false;
  eligible.forEach((r, i) => {
    r.contribution = (r.sales26! / total) * 100;
    cumulative += r.contribution;
    r.cumulative = cumulative;
    r.rank = i + 1;
    r.high = !boundaryReached;
    if (!boundaryReached && cumulative >= 80 - 1e-10) {
      cutoff = r.contribution;
      boundaryReached = true;
    }
    if (r.salesGrowth !== null)
      r.quadrant = r.high
        ? r.salesGrowth >= 0
          ? "Stars"
          : "Cash Cows"
        : r.salesGrowth >= 0
          ? "Question Marks"
          : "Dogs";
    if (r.high && r.gp26 !== null && r.gp26 < 30)
      r.findings.push("High-contribution SKU with below-target GP.");
    if (!r.high && r.gp26 !== null && r.gp26 >= 35)
      r.findings.push("Low-contribution SKU with strong GP.");
    const actions = {
      Stars:
        "Consider continued growth investment, subject to margin and demand.",
      "Cash Cows":
        "Prioritize customer retention and investigate revenue recovery.",
      "Question Marks":
        "Test targeted sales development while monitoring profitability.",
      Dogs: "Review profitability, demand, and inventory before changing assortment.",
      Unclassified: "Resolve baseline or data exceptions before BCG decisions.",
    };
    r.recommendations.push(actions[r.quadrant]);
  });
  result
    .filter((r) => r.quadrant === "Unclassified" && !r.recommendations.length)
    .forEach((r) =>
      r.recommendations.push(
        "Resolve baseline and net-sales exceptions before making BCG decisions.",
      ),
    );
  return { rows: result, cutoff, eligibleSales: total };
}
export function select(rows: SourceRow[], meta: ImportMeta, f: Filters) {
  const scope = rows.filter(
    (r) =>
      (!f.group || r.group === f.group) &&
      (!f.search ||
        [r.sku, r.name]
          .join(" ")
          .toLowerCase()
          .includes(f.search.toLowerCase())),
  );
  const model = analyze(f.mode === "selection" ? scope : rows, meta);
  const selected = new Set(scope.map((r) => r.sku));
  return {
    ...model,
    rows: model.rows.filter(
      (r) =>
        selected.has(r.sku) &&
        (!f.quadrant || r.quadrant === f.quadrant) &&
        (!f.gpStatus || r.gpStatus === f.gpStatus) &&
        (f.minGp === "" || (r.gp26 !== null && r.gp26 >= Number(f.minGp))) &&
        (f.maxGp === "" || (r.gp26 !== null && r.gp26 <= Number(f.maxGp))) &&
        (!f.growth ||
          (f.growth === "new"
            ? r.status === "New / No Baseline"
            : r.salesChange !== null &&
              (f.growth === "up"
                ? r.salesChange > 0
                : f.growth === "down"
                  ? r.salesChange < 0
                  : r.salesChange === 0))),
    ),
  };
}
export function groupRows(
  rows: AnalyzedRow[],
  key: "group" | "quadrant" | "sku",
) {
  const groups = new Map<string, AnalyzedRow[]>();
  for (const row of rows) {
    const members = groups.get(row[key]);
    if (members) members.push(row);
    else groups.set(row[key], [row]);
  }
  return [...groups].map(([name, members]) => ({
    name,
    rows: members,
    ...summarize(members),
  }));
}
