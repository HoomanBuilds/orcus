// Server-side fetch of a decision receipt from 0G Storage by its merkle root
// (the bytes32 receiptHash emitted in TradeExecuted). The turbo indexer serves the
// raw file at /file?root=0x..., or {code:101,"File not found"} when it isn't there yet.
const INDEXER_FILE_URL =
  process.env.ZG_INDEXER_FILE_URL ?? "https://indexer-storage-testnet-turbo.0g.ai/file";

export interface DecisionReceipt {
  version: string;
  ts: number;
  chain: { key: string; chainId: number };
  user: string;
  inputs: {
    market: unknown;
    oracle: { mode: string; address: string | null; priceScaled: string | null };
  };
  tee: { provider: string; verifiability: string };
  verdict: { action: string; reason: string };
  strategy?: {
    conditions: unknown[];
    logic: string;
    evaluated: Array<{ desc: string; computedValue: number | null; pass: boolean }>;
    action: string;
    reason: string;
    aiReason: string | null;
  };
}

export async function fetchReceipt(root: string): Promise<DecisionReceipt | null> {
  try {
    const r = root.startsWith("0x") ? root : `0x${root}`;
    const res = await fetch(`${INDEXER_FILE_URL}?root=${r}`, { cache: "no-store" });
    if (!res.ok) return null;
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return null;
    }
    const obj = json as Record<string, unknown>;
    if (!obj || obj.code === 101 || obj.message === "File not found") return null;
    if (obj.verdict === undefined && obj.version === undefined) return null;
    return obj as unknown as DecisionReceipt;
  } catch {
    return null;
  }
}
