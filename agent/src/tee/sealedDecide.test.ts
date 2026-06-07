import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sealedDecide } from "./sealedDecide.js";

// v2 sealedDecide uses a direct HTTP fetch to the 0G TEE endpoint (no broker SDK).
const SAVED = { ...process.env };

describe("sealedDecide", () => {
  beforeEach(() => {
    process.env = { ...SAVED, ZG_SERVICE_URL: "https://tee.example", ZG_API_SECRET: "secret" };
  });
  afterEach(() => {
    process.env = { ...SAVED };
    vi.restoreAllMocks();
  });

  it("parses an EXECUTE decision from the TEE response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ action: "EXECUTE", reason: "ok", tradeParams: {} }) } }],
      }),
    }) as unknown as typeof fetch;
    const out = await sealedDecide(null, "0xPROV", "ciphertext", "market");
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
    const out = await sealedDecide(null, "0xPROV", "c", "m");
    expect(out.action).toBe("WAIT");
  });

  it("throws on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "boom" }) as unknown as typeof fetch;
    await expect(sealedDecide(null, "0xPROV", "c", "m")).rejects.toThrow(/inference error 500/);
  });

  it("throws when the TEE env is missing", async () => {
    delete process.env.ZG_SERVICE_URL;
    await expect(sealedDecide(null, "0xPROV", "c", "m")).rejects.toThrow(/must be set/);
  });
});
