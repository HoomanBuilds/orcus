import { describe, it, expect, vi } from "vitest";
import { sealedDecide } from "./sealedDecide.js";

function mockBroker() {
  return {
    inference: {
      listService: vi.fn().mockResolvedValue([
        { provider: "0xPROV", verifiability: "TeeML" },
      ]),
      getServiceMetadata: vi.fn().mockResolvedValue({
        endpoint: "https://tee.example",
        model: "deepseek",
      }),
      requestHeaders: vi.fn().mockResolvedValue({ "X-Sig": "ok" }),
      processResponse: vi.fn().mockResolvedValue(undefined),
    },
  };
}

describe("sealedDecide", () => {
  it("returns parsed decision and ALWAYS calls processResponse", async () => {
    const broker = mockBroker();
    global.fetch = vi.fn().mockResolvedValue({
      headers: { get: () => "chat-123" },
      json: async () => ({
        id: "chat-123",
        choices: [
          { message: { content: JSON.stringify({ action: "EXECUTE", reason: "ok", tradeParams: {} }) } },
        ],
        usage: { total_tokens: 10 },
      }),
    }) as unknown as typeof fetch;

    const out = await sealedDecide(broker as any, "0xPROV", "ciphertext", "market");
    expect(out.action).toBe("EXECUTE");
    expect(broker.inference.processResponse).toHaveBeenCalledWith("0xPROV", "chat-123", { total_tokens: 10 });
  });

  it("calls processResponse even when JSON parse fails", async () => {
    const broker = mockBroker();
    global.fetch = vi.fn().mockResolvedValue({
      headers: { get: () => "chat-456" },
      json: async () => ({
        id: "chat-456",
        choices: [{ message: { content: "not json" } }],
        usage: { total_tokens: 5 },
      }),
    }) as unknown as typeof fetch;

    await expect(sealedDecide(broker as any, "0xPROV", "c", "m")).rejects.toThrow();
    expect(broker.inference.processResponse).toHaveBeenCalledWith("0xPROV", "chat-456", { total_tokens: 5 });
  });
});
