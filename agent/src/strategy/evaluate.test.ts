import { describe, it, expect } from "vitest";
import { evaluateStrategy, type Indicators } from "./evaluate.js";
import type { Strategy } from "./schema.js";

function ind(o: Partial<Indicators> & { rsiVal?: number | null; maVal?: number | null } = {}): Indicators {
  return {
    price: o.price ?? 100,
    rsi: o.rsi ?? (() => (o.rsiVal === undefined ? 50 : o.rsiVal)),
    ma: o.ma ?? (() => (o.maVal === undefined ? 100 : o.maVal)),
    volatility: o.volatility ?? 1,
    change24h: o.change24h ?? 0,
    trend: o.trend ?? "flat",
    prev: o.prev,
  };
}

function strat(conditions: Strategy["conditions"], logic: Strategy["logic"] = "AND"): Strategy {
  return { version: 1, conditions, logic, trade: { inputAsset: "native", amountIn: "0.01", outputToken: "oUSDC", slippageBps: 0 } };
}

describe("evaluateStrategy", () => {
  it("AND, all pass -> EXECUTE", () => {
    const r = evaluateStrategy(
      strat([{ indicator: "rsi", period: 14, op: "lt", value: 30 }, { indicator: "price", op: "below", ref: "ma", maPeriod: 60 }]),
      ind({ rsiVal: 27, price: 0.74, maVal: 0.75 }),
    );
    expect(r.action).toBe("EXECUTE");
    expect(r.evaluated.map((e) => e.pass)).toEqual([true, true]);
  });

  it("AND, one fails -> WAIT", () => {
    const r = evaluateStrategy(
      strat([{ indicator: "rsi", period: 14, op: "lt", value: 30 }, { indicator: "price", op: "below", ref: "ma", maPeriod: 60 }]),
      ind({ rsiVal: 58, price: 0.74, maVal: 0.75 }),
    );
    expect(r.action).toBe("WAIT");
    expect(r.evaluated.map((e) => e.pass)).toEqual([false, true]);
  });

  it("OR, one passes -> EXECUTE", () => {
    const r = evaluateStrategy(
      strat([{ indicator: "rsi", op: "lt", value: 30 }, { indicator: "price", op: "below", ref: "ma", maPeriod: 60 }], "OR"),
      ind({ rsiVal: 58, price: 0.74, maVal: 0.75 }),
    );
    expect(r.action).toBe("EXECUTE");
  });

  it("OR, both fail -> WAIT", () => {
    const r = evaluateStrategy(
      strat([{ indicator: "rsi", op: "lt", value: 30 }, { indicator: "price", op: "above", ref: "ma", maPeriod: 60 }], "OR"),
      ind({ rsiVal: 58, price: 0.74, maVal: 0.75 }),
    );
    expect(r.action).toBe("WAIT");
  });

  it("operators gt/gte/lte/above + boundary equality", () => {
    expect(evaluateStrategy(strat([{ indicator: "rsi", op: "gt", value: 70 }]), ind({ rsiVal: 75 })).action).toBe("EXECUTE");
    expect(evaluateStrategy(strat([{ indicator: "rsi", op: "gte", value: 70 }]), ind({ rsiVal: 70 })).action).toBe("EXECUTE");
    expect(evaluateStrategy(strat([{ indicator: "rsi", op: "lt", value: 30 }]), ind({ rsiVal: 30 })).action).toBe("WAIT"); // strict
    expect(evaluateStrategy(strat([{ indicator: "rsi", op: "lte", value: 30 }]), ind({ rsiVal: 30 })).action).toBe("EXECUTE");
    expect(evaluateStrategy(strat([{ indicator: "price", op: "above", value: 99 }]), ind({ price: 100 })).action).toBe("EXECUTE");
  });

  it("crossesAbove / crossesBelow use prev", () => {
    const up = evaluateStrategy(
      strat([{ indicator: "price", op: "crossesAbove", ref: "ma", maPeriod: 7 }]),
      ind({ price: 101, maVal: 100, prev: { price: 99, ma: () => 100 } }),
    );
    expect(up.action).toBe("EXECUTE");
    const noCross = evaluateStrategy(
      strat([{ indicator: "price", op: "crossesAbove", ref: "ma", maPeriod: 7 }]),
      ind({ price: 101, maVal: 100, prev: { price: 100.5, ma: () => 100 } }),
    );
    expect(noCross.action).toBe("WAIT"); // already above last candle, no cross
  });

  it("null indicator value -> condition fails, value null", () => {
    const r = evaluateStrategy(strat([{ indicator: "rsi", op: "lt", value: 30 }]), ind({ rsiVal: null }));
    expect(r.action).toBe("WAIT");
    expect(r.evaluated[0].pass).toBe(false);
    expect(r.evaluated[0].computedValue).toBeNull();
  });

  it("empty conditions -> WAIT", () => {
    expect(evaluateStrategy(strat([]), ind()).action).toBe("WAIT");
  });
});
