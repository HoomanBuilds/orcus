import { describe, it, expect, vi } from "vitest";
import { writeReceipt } from "./writeReceipt.js";

// v2 writeReceipt writes a temp JSON file, computes the merkle root via the real
// @0gfoundation ZgFile (local, no network), then best-effort uploads via the indexer.
// We mock only the indexer (the network part); the merkle root is computed for real.
describe("writeReceipt", () => {
  it("computes a merkle root and returns it on a successful upload", async () => {
    const indexer = { upload: vi.fn().mockResolvedValue([{ txHash: "0x" }, null]) };
    const root = await writeReceipt(indexer as never, null, "wallet" as never, { test: 1 }, "rpc");
    expect(typeof root).toBe("string");
    expect(root.startsWith("0x")).toBe(true);
    expect(indexer.upload).toHaveBeenCalledTimes(1);
  });

  it("returns the root even when the indexer reports an error (best-effort)", async () => {
    const indexer = { upload: vi.fn().mockResolvedValue([null, new Error("indexer down")]) };
    const root = await writeReceipt(indexer as never, null, "wallet" as never, { a: 1 }, "rpc");
    expect(root.startsWith("0x")).toBe(true);
  });

  it("propagates when the indexer upload rejects", async () => {
    const indexer = { upload: vi.fn().mockRejectedValue(new Error("boom")) };
    await expect(
      writeReceipt(indexer as never, null, "wallet" as never, {}, "rpc"),
    ).rejects.toThrow("boom");
  });
});
