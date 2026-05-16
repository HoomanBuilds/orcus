import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ZgFile, Indexer } from "@0gfoundation/0g-ts-sdk";
import type { Wallet } from "ethers";

export async function writeReceipt(
  indexer: Indexer,
  _ZgFile: unknown,
  wallet: Wallet,
  receipt: unknown,
  rpc: string,
): Promise<string> {
  const tmpPath = join(tmpdir(), `orcus-receipt-${Date.now()}.json`);
  await writeFile(tmpPath, JSON.stringify(receipt));

  const file = await ZgFile.fromFilePath(tmpPath);
  try {
    const [tree] = await file.merkleTree();
    const rootHash = tree.rootHash();
    const [, err] = await indexer.upload(file, rpc, wallet);
    if (err) {
      console.warn("[storage] upload failed (best-effort):", String(err).split("\n")[0]);
      return rootHash;
    }
    return rootHash;
  } finally {
    await file.close();
    await unlink(tmpPath).catch(() => {});
  }
}
