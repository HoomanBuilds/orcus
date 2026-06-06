import type { PublicClient } from "viem";
import { vaultAbi } from "./vaultAbi";

export const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;

let _anchorBlock: bigint | null = null;

export async function getAnchorBlock(client: PublicClient): Promise<bigint> {
  if (_anchorBlock !== null) return _anchorBlock;
  const current = await client.getBlockNumber();
  _anchorBlock = current > 500_000n ? current - 500_000n : 0n;
  return _anchorBlock;
}

export interface TradeExecution {
  blockNumber: bigint;
  txHash: string;
  receiptHash: string;
  user: string;
  tokenOut: string;
  amountOut: bigint;
}

export async function fetchTradeExecuted(
  client: PublicClient,
  fromBlock: bigint,
  user?: `0x${string}`,
): Promise<TradeExecution[]> {
  const logs = await client.getContractEvents({
    address: VAULT,
    abi: vaultAbi,
    eventName: "TradeExecuted",
    fromBlock,
    ...(user ? { args: { user } } : {}),
  });
  return logs.reverse().map((l) => {
    const args = l.args as { user?: string; tokenOut?: string; amountOut?: bigint; receiptHash?: string };
    return {
      blockNumber: l.blockNumber ?? 0n,
      txHash: l.transactionHash ?? "",
      receiptHash: args.receiptHash ?? "",
      user: args.user ?? "",
      tokenOut: args.tokenOut ?? "",
      amountOut: args.amountOut ?? 0n,
    };
  });
}

export const tradeExecutedKeys = {
  all: ["tradeExecuted"] as const,
  user: (addr: string) => ["tradeExecuted", "user", addr] as const,
};
