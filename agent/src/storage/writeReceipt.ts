import type { Wallet } from "ethers";

interface ZgFileLike {
  merkleTree(): Promise<[{ rootHash(): string }]>;
  close(): Promise<void>;
}
interface ZgFileCtor {
  fromBuffer(buf: Buffer, name: string): Promise<ZgFileLike>;
}
interface IndexerLike {
  upload(file: ZgFileLike, rpc: string, wallet: Wallet): Promise<unknown>;
}

export async function writeReceipt(
  indexer: IndexerLike,
  ZgFile: ZgFileCtor,
  wallet: Wallet,
  receipt: unknown,
  rpc: string,
): Promise<string> {
  const file = await ZgFile.fromBuffer(Buffer.from(JSON.stringify(receipt)), "receipt.json");
  try {
    const [tree] = await file.merkleTree();
    await indexer.upload(file, rpc, wallet);
    return tree.rootHash();
  } finally {
    await file.close();
  }
}
