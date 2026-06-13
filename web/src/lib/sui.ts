import { Transaction } from "@mysten/sui/transactions";
import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { ChainMeta } from "./chains";

function hexToBytes(hex: string): number[] {
  const h = hex.replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
}

function byteArrToHex(v: unknown): string {
  if (Array.isArray(v)) return `0x${(v as number[]).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  if (typeof v === "string") return v.startsWith("0x") ? v : `0x${v}`;
  return "0x";
}

// Browser-wallet version of scripts/create-sui-intent.ts: deposit SUI + encrypted goal.
export function suiDepositTx(chain: ChainMeta, ciphertextHex: string, slippageBps: number, amountMist: bigint): Transaction {
  if (!chain.sui) throw new Error("not a Sui chain");
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.moveCall({
    target: `${chain.sui.packageId}::vault::deposit`,
    arguments: [
      tx.object(chain.vault),
      coin,
      tx.pure.vector("u8", hexToBytes(ciphertextHex)),
      tx.pure.u64(BigInt(slippageBps)),
    ],
  });
  return tx;
}

export function suiWithdrawTx(chain: ChainMeta): Transaction {
  if (!chain.sui) throw new Error("not a Sui chain");
  const tx = new Transaction();
  tx.moveCall({ target: `${chain.sui.packageId}::vault::withdraw`, arguments: [tx.object(chain.vault)] });
  return tx;
}

export interface SuiIntent { active: boolean; amountMist: bigint; }

// Reads the user's intent from the vault's intents Table dynamic field.
// `client` is the dapp-kit SuiClient (untyped JSON-RPC content).
export async function fetchSuiIntent(client: SuiJsonRpcClient, chain: ChainMeta, user: string): Promise<SuiIntent> {
  if (!chain.sui) return { active: false, amountMist: 0n };
  try {
    const v = (await client.getObject({ id: chain.vault, options: { showContent: true } })) as { data?: { content?: { fields?: { intents?: { fields?: { id?: { id?: string } } } } } } };
    const tableId = v?.data?.content?.fields?.intents?.fields?.id?.id;
    if (!tableId) return { active: false, amountMist: 0n };
    const f = (await client.getDynamicFieldObject({ parentId: tableId, name: { type: "address", value: user } })) as { data?: { content?: { fields?: { value?: { fields?: { deposit?: unknown } } } } } };
    if (!f?.data) return { active: false, amountMist: 0n };
    const dep = f.data.content?.fields?.value?.fields?.deposit as unknown;
    const amt = typeof dep === "object" && dep !== null ? (dep as { value?: string; fields?: { value?: string } }).fields?.value ?? (dep as { value?: string }).value : dep;
    return { active: true, amountMist: BigInt((amt as string | number) ?? 0) };
  } catch {
    return { active: false, amountMist: 0n };
  }
}

export interface TradeRow {
  chainKey: string;
  vm: "evm" | "sui";
  user: string;
  amountOut: string;
  receiptHash: string;
  txHash: string;
  ts: number;
}

// Reads TradeExecuted events on Sui, newest first.
export async function fetchSuiTrades(client: SuiJsonRpcClient, chain: ChainMeta, user?: string): Promise<TradeRow[]> {
  if (!chain.sui) return [];
  try {
    const res = (await client.queryEvents({
      query: { MoveEventType: `${chain.sui.packageId}::vault::TradeExecuted` },
      limit: 50,
      order: "descending",
    })) as { data?: Array<{ parsedJson?: { user?: string; amount_out?: string; receipt_hash?: unknown }; id?: { txDigest?: string }; timestampMs?: string }> };
    const rows: TradeRow[] = (res.data ?? []).map((e) => ({
      chainKey: chain.key,
      vm: "sui" as const,
      user: e.parsedJson?.user ?? "",
      amountOut: String(e.parsedJson?.amount_out ?? "0"),
      receiptHash: byteArrToHex(e.parsedJson?.receipt_hash),
      txHash: e.id?.txDigest ?? "",
      ts: Number(e.timestampMs ?? 0),
    }));
    return user ? rows.filter((r) => r.user.toLowerCase() === user.toLowerCase()) : rows;
  } catch {
    return [];
  }
}
