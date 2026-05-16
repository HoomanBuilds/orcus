import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
import { JsonRpcProvider, type Wallet } from "ethers";

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
    // Storage nodes operate on 0G Chain (16661), not Galileo testnet (16602).
    // Must connect wallet to 0G mainnet so flow.market() resolves correctly.
    const storageRpc = "https://evmrpc.0g.ai";
    const storageWallet = wallet.connect(new JsonRpcProvider(storageRpc));
    const [, err] = await indexer.upload(file, storageRpc, storageWallet);
    if (err) {
      // Best-effort: storage upload failed (e.g. insufficient 0G mainnet balance)
      // Return the local merkle root so the vault tx can still proceed
      console.warn("[storage] upload failed (best-effort):", String(err).split("\n")[0]);
      return rootHash;
    }
    return rootHash;
  } finally {
    await file.close();
    await unlink(tmpPath).catch(() => {});
  }
}
