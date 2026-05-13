import { describe, it, expect, vi } from "vitest";
import { writeReceipt } from "./writeReceipt.js";

describe("writeReceipt", () => {
  it("uploads, returns root hash, and ALWAYS closes the file", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const merkleTree = vi.fn().mockResolvedValue([{ rootHash: () => "0xROOT" }]);
    const ZgFileMock = { fromBuffer: vi.fn().mockResolvedValue({ merkleTree, close }) };
    const indexer = { upload: vi.fn().mockResolvedValue(undefined) };

    const root = await writeReceipt(
      indexer as any,
      ZgFileMock as any,
      "wallet" as any,
      { test: 1 },
      "rpc"
    );
    expect(root).toBe("0xROOT");
    expect(indexer.upload).toHaveBeenCalled();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("closes the file even when upload throws", async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const merkleTree = vi.fn().mockResolvedValue([{ rootHash: () => "0xROOT" }]);
    const ZgFileMock = { fromBuffer: vi.fn().mockResolvedValue({ merkleTree, close }) };
    const indexer = { upload: vi.fn().mockRejectedValue(new Error("boom")) };

    await expect(
      writeReceipt(indexer as any, ZgFileMock as any, "wallet" as any, {}, "rpc")
    ).rejects.toThrow("boom");
    expect(close).toHaveBeenCalledTimes(1);
  });
});
