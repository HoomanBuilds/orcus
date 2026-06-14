import { describe, it, expect } from "vitest";
import { buildDecisionReceipt } from "./receipt.js";

const base = {
  chainKey: "galileo",
  chainId: 16602,
  user: "0xUser",
  ts: 1_700_000_000_000,
  marketJson: JSON.stringify({ price: 0.3, trend: "up", indicators: { rsi14: 55 } }),
  oracleMode: "mock",
  oracleAddress: "0xOracle",
  priceScaled: "300000000000000000",
  teeProvider: "0xProvider",
  action: "EXECUTE",
  reason: "price above MA, momentum positive",
};

describe("buildDecisionReceipt", () => {
  it("captures inputs and verdict with version 1", () => {
    const r = buildDecisionReceipt(base);
    expect(r.version).toBe("1");
    expect(r.chain).toEqual({ key: "galileo", chainId: 16602 });
    expect(r.verdict).toEqual({ action: "EXECUTE", reason: "price above MA, momentum positive" });
    expect(r.inputs.oracle).toEqual({ mode: "mock", address: "0xOracle", priceScaled: "300000000000000000" });
    expect((r.inputs.market as { price: number }).price).toBe(0.3);
    expect(r.tee.verifiability).toBe("TeeML");
  });

  it("NEVER includes plaintext strategy fields", () => {
    const r = buildDecisionReceipt(base);
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/encryptedGoal/i);
    expect(json).not.toMatch(/"goal"/i);
    expect(json).not.toMatch(/"strategy"/i);
  });

  it("tolerates non-JSON market input", () => {
    const r = buildDecisionReceipt({ ...base, marketJson: "not json" });
    expect((r.inputs.market as { raw: string }).raw).toBe("not json");
  });

  it("nulls the applied price for pyth oracle mode", () => {
    const r = buildDecisionReceipt({ ...base, oracleMode: "pyth", oracleAddress: null, priceScaled: null });
    expect(r.inputs.oracle).toEqual({ mode: "pyth", address: null, priceScaled: null });
  });
});
