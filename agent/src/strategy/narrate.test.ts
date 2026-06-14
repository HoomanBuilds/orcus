import { describe, it, expect, vi, afterEach } from "vitest";
import { narrate } from "./narrate.js";
import type { Strategy } from "./schema.js";
import type { EvalResult } from "./evaluate.js";

const ev: EvalResult = {
  action: "EXECUTE",
  evaluated: [
    { desc: "rsi(14) lt 30", computedValue: 27, pass: true },
    { desc: "price below ma(60)", computedValue: 0.74, pass: true },
  ],
};
const strat: Strategy = { version: 1, conditions: [], logic: "AND", trade: { inputAsset: "native", amountIn: "0.01", outputToken: "oUSDC", slippageBps: 0 } };

describe("narrate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the AI reason when the response is valid JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"reason":"RSI below 30 and price under the 1h MA"}' } }] }),
    }) as unknown as typeof fetch;
    const r = await narrate("https://tee", "secret", "model", strat, ev);
    expect(r.aiReason).toBe("RSI below 30 and price under the 1h MA");
    expect(r.reason).toBe("RSI below 30 and price under the 1h MA");
  });

  it("falls back to a code reason on unparseable output (action preserved)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ choices: [{ message: { content: "not json at all" } }] }),
    }) as unknown as typeof fetch;
    const r = await narrate("https://tee", "secret", "model", strat, ev);
    expect(r.aiReason).toBeNull();
    expect(r.reason).toContain("EXECUTE");
    expect(r.reason).toContain("rsi(14) lt 30");
  });

  it("falls back on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("boom")) as unknown as typeof fetch;
    const r = await narrate("https://tee", "secret", "model", strat, ev);
    expect(r.aiReason).toBeNull();
    expect(r.reason).toContain("EXECUTE");
  });

  it("falls back when creds missing (no network call)", async () => {
    const spy = vi.fn();
    global.fetch = spy as unknown as typeof fetch;
    const r = await narrate("", "", "model", strat, ev);
    expect(r.aiReason).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });
});
