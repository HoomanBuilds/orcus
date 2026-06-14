import { describe, it, expect, vi, afterEach } from "vitest";
import { sealedDecide } from "./sealedDecide.js";

describe("sealedDecide", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses an EXECUTE decision from the TEE response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ action: "EXECUTE", reason: "ok", tradeParams: {} }) } }],
      }),
    }) as unknown as typeof fetch;
    const out = await sealedDecide("https://tee.example", "secret", "test-model", "ciphertext", "market");
    expect(out.action).toBe("EXECUTE");
    expect(out.reason).toBe("ok");
  });

  it("strips markdown fences before parsing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "```json\n{\"action\":\"WAIT\",\"reason\":\"conditional\"}\n```" } }],
      }),
    }) as unknown as typeof fetch;
    const out = await sealedDecide("https://tee.example", "secret", "test-model", "c", "m");
    expect(out.action).toBe("WAIT");
  });

  it("throws on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }) as unknown as typeof fetch;
    await expect(sealedDecide("https://tee.example", "secret", "test-model", "c", "m")).rejects.toThrow(/inference error 500/);
  });

  it("throws when serviceUrl/apiSecret missing", async () => {
    await expect(sealedDecide("", "", "test-model", "c", "m")).rejects.toThrow(/must be set/);
  });
});
