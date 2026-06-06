import { describe, it, expect } from "vitest";
import { sma, rsi, realizedVolatility } from "./indicators.js";

describe("sma", () => {
  it("averages the last `period` values", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([10, 20, 30], 2)).toBe(25);
  });
  it("returns null when not enough data", () => {
    expect(sma([1, 2], 3)).toBeNull();
    expect(sma([], 1)).toBeNull();
  });
});

describe("rsi", () => {
  it("is 100 for a strictly rising series", () => {
    expect(rsi([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 14)).toBe(100);
  });
  it("is 0 for a strictly falling series", () => {
    expect(rsi([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 14)).toBe(0);
  });
  it("is 50 for a flat series", () => {
    expect(rsi(new Array(16).fill(100), 14)).toBe(50);
  });
  it("returns null when not enough data", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
  });
});

describe("realizedVolatility", () => {
  it("is 0 for constant prices", () => {
    expect(realizedVolatility([100, 100, 100, 100])).toBe(0);
  });
  it("is positive for varying prices", () => {
    const v = realizedVolatility([100, 110, 100, 120, 90]);
    expect(v).not.toBeNull();
    expect(v as number).toBeGreaterThan(0);
  });
  it("returns null when not enough data", () => {
    expect(realizedVolatility([100])).toBeNull();
  });
});
