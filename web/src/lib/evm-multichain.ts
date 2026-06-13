import { createPublicClient, http, type Chain } from "viem";
import { galileo, arbitrumSepolia, baseSepolia, avalancheFuji, mantleSepoliaTestnet } from "./chain";
import { vaultAbi } from "./vaultAbi";
import { EVM_CHAINS } from "./chains";
import type { TradeRow } from "./sui";

const VIEM_CHAINS: Record<string, Chain> = {
  "galileo": galileo,
  "arbitrum-sepolia": arbitrumSepolia,
  "base-sepolia": baseSepolia,
  "avalanche-fuji": avalancheFuji,
  "mantle-sepolia": mantleSepoliaTestnet,
};

const LOOKBACK = 100_000n;

// Aggregates TradeExecuted across all 5 EVM chains. One bad RPC -> that chain yields [],
// never breaks the aggregate. Returns newest-first per chain (block order).
export async function fetchEvmTradesAllChains(user?: `0x${string}`): Promise<TradeRow[]> {
  const perChain = await Promise.all(
    EVM_CHAINS.map(async (meta): Promise<TradeRow[]> => {
      const viemChain = VIEM_CHAINS[meta.key];
      if (!viemChain) return [];
      try {
        const client = createPublicClient({ chain: viemChain, transport: http(meta.rpcUrl) });
        const current = await client.getBlockNumber();
        const fromBlock = current > LOOKBACK ? current - LOOKBACK : 0n;
        const logs = await client.getContractEvents({
          address: meta.vault as `0x${string}`,
          abi: vaultAbi,
          eventName: "TradeExecuted",
          fromBlock,
          ...(user ? { args: { user } } : {}),
        });
        return logs.reverse().map((l) => {
          const a = l.args as { user?: string; amountOut?: bigint; receiptHash?: string };
          return {
            chainKey: meta.key,
            vm: "evm" as const,
            user: a.user ?? "",
            amountOut: (a.amountOut ?? 0n).toString(),
            receiptHash: a.receiptHash ?? "",
            txHash: l.transactionHash ?? "",
            ts: Number(l.blockNumber ?? 0n),
          };
        });
      } catch {
        return [];
      }
    }),
  );
  return perChain.flat();
}
