// Typed strategy schema - mirrors agent/src/strategy/schema.ts (kept in sync manually).

export type Op = "lt" | "gt" | "lte" | "gte" | "below" | "above" | "crossesAbove" | "crossesBelow";
export type Indicator = "rsi" | "ma" | "price" | "volatility" | "trend" | "change24h";

export interface Condition {
  indicator: Indicator;
  period?: number;
  op: Op;
  value?: number;
  ref?: "ma";
  maPeriod?: number;
}

export interface Strategy {
  version: 1;
  conditions: Condition[];
  logic: "AND" | "OR";
  notes?: string;
  trade: { inputAsset: "native" | string; amountIn: string; outputToken: string; slippageBps: number };
  expiryTs?: number;
}

export const INDICATORS: Indicator[] = ["rsi", "ma", "price", "volatility", "trend", "change24h"];
export const OPS: Op[] = ["lt", "gt", "lte", "gte", "below", "above", "crossesAbove", "crossesBelow"];
export const OP_LABEL: Record<Op, string> = {
  lt: "<", gt: ">", lte: "≤", gte: "≥", below: "below", above: "above", crossesAbove: "crosses above", crossesBelow: "crosses below",
};

export function validateStrategy(s: Strategy): string | null {
  if (!s.conditions?.length) return "Add at least one condition";
  if (s.logic !== "AND" && s.logic !== "OR") return "Pick AND or OR";
  for (const c of s.conditions) {
    if (!INDICATORS.includes(c.indicator)) return `Unknown indicator: ${c.indicator}`;
    if (!OPS.includes(c.op)) return `Unknown operator: ${c.op}`;
    if (c.ref !== "ma" && (c.value === undefined || isNaN(Number(c.value)))) return `Set a value for ${c.indicator}`;
  }
  if (!s.trade.amountIn || isNaN(Number(s.trade.amountIn)) || Number(s.trade.amountIn) <= 0) return "Enter a valid amount";
  return null;
}

const OP_MAP: Record<string, Op> = {
  "<": "lt", "<=": "lte", ">": "gt", ">=": "gte", "less than": "lt", "greater than": "gt",
  below: "below", above: "above", lt: "lt", gt: "gt", lte: "lte", gte: "gte",
  crossesabove: "crossesAbove", crossesbelow: "crossesBelow", "crosses above": "crossesAbove", "crosses below": "crossesBelow",
};

// The 7B parse is sloppy (wrong op enums, spurious fields). Coerce to valid Conditions.
export function normalizeConditions(raw: unknown): Condition[] {
  if (!Array.isArray(raw)) return [];
  const out: Condition[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const indicator = String(o.indicator ?? "").toLowerCase() as Indicator;
    if (!INDICATORS.includes(indicator)) continue;
    const opRaw = String(o.op ?? "").toLowerCase();
    const op: Op = OP_MAP[opRaw] ?? (OPS.includes(opRaw as Op) ? (opRaw as Op) : "lt");
    const c: Condition = { indicator, op };
    if (indicator === "rsi") c.period = typeof o.period === "number" ? o.period : 14;
    const maPeriod = typeof o.maPeriod === "number" ? o.maPeriod : undefined;
    if (o.ref === "ma" || maPeriod !== undefined) {
      c.ref = "ma";
      c.maPeriod = maPeriod ?? 60;
    } else if (o.value !== undefined && !isNaN(Number(o.value))) {
      c.value = Number(o.value);
    }
    if (c.ref !== "ma" && c.value === undefined) continue; // unusable
    out.push(c);
  }
  return out;
}
