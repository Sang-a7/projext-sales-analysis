export type Value = number | null;
export type Quadrant =
  "Stars" | "Cash Cows" | "Question Marks" | "Dogs" | "Unclassified";
export type GpStatus =
  | "Healthy"
  | "Caution"
  | "High Risk"
  | "Critical"
  | "Loss-making"
  | "Data Unavailable";
export interface SourceRow {
  sku: string;
  name: string;
  group: string;
  sales25: Value;
  sales26: Value;
  qty25: Value;
  qty26: Value;
  price25: Value;
  price26: Value;
  gp25: Value;
  gp26: Value;
}
export interface ImportMeta {
  start25: string;
  end25: string;
  start26: string;
  end26: string;
  gpMeaning: "margin" | "unconfirmed";
  sameBasis: boolean;
  gpScale: "percent" | "fraction";
  vat: "As supplied" | "VAT inclusive" | "VAT exclusive";
  currency: string;
  sheet: string;
}
export interface AnalyzedRow extends SourceRow {
  salesChange: Value;
  salesGrowth: Value;
  qtyChange: Value;
  qtyGrowth: Value;
  priceChange: Value;
  priceGrowth: Value;
  gpChange: Value;
  estimatedGp25: Value;
  estimatedGp26: Value;
  estimatedGpChange: Value;
  contribution: Value;
  cumulative: Value;
  rank: Value;
  high: boolean;
  quadrant: Quadrant;
  classificationBasis: string;
  gpStatus: GpStatus;
  status: string;
  exceptions: string[];
  findings: string[];
  recommendations: string[];
  volumeEffect: Value;
  priceEffect: Value;
  residual: Value;
  bridgeExact: boolean;
}
export interface Filters {
  search: string;
  group: string;
  quadrant: string;
  gpStatus: string;
  minGp: string;
  maxGp: string;
  growth: string;
  mode: "global" | "selection";
}
export const DEFAULT_FILTERS: Filters = {
  search: "",
  group: "",
  quadrant: "",
  gpStatus: "",
  minGp: "",
  maxGp: "",
  growth: "",
  mode: "global",
};
export const QUADRANTS: Quadrant[] = [
  "Stars",
  "Cash Cows",
  "Question Marks",
  "Dogs",
  "Unclassified",
];
export const COLORS: Record<Quadrant, string> = {
  Stars: "#16876b",
  "Cash Cows": "#bd871a",
  "Question Marks": "#4678cc",
  Dogs: "#d65757",
  Unclassified: "#788493",
};
export const DEFAULT_META: ImportMeta = {
  start25: "",
  end25: "",
  start26: "",
  end26: "",
  gpMeaning: "unconfirmed",
  sameBasis: false,
  gpScale: "percent",
  vat: "As supplied",
  currency: "THB",
  sheet: "",
};
