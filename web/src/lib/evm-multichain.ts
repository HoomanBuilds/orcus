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

// Public testnet RPCs cap eth_getLogs ranges (Base Sepolia rejects >10k), so we scan
// in chunks newest-first over a bounded lookback — mirrors the agent's chunked scan.
const LOOKBACK = 20_000n;
const CHUNK = 5_000n;

// Aggregates TradeExecuted across all 5 EVM chains. One bad RPC -> that chain yields [],
// never breaks the aggregate. Returns newest-first per chain.
export async function fetchEvmTradesAllChains(user?: `0x${string}`): Promise<TradeRow[]> {
  const perChain = await Promise.all(
    EVM_CHAINS.map(async (meta): Promise<TradeRow[]> => {
      const viemChain = VIEM_CHAINS[meta.key];
      if (!viemChain) return [];
      try {
        const client = createPublicClient({ chain: viemChain, transport: http(meta.rpcUrl) });
        const current = await client.getBlockNumber();
        const floor = current > LOOKBACK ? current - LOOKBACK : 0n;
        const out: TradeRow[] = [];
        for (let hi = current; hi > floor; hi -= CHUNK) {
          const lo = hi - CHUNK + 1n > floor ? hi - CHUNK + 1n : floor;
          let logs;
          try {
            logs = await client.getContractEvents({
              address: meta.vault as `0x${string}`,
              abi: vaultAbi,
              eventName: "TradeExecuted",
              fromBlock: lo,
              toBlock: hi,
              ...(user ? { args: { user } } : {}),
            });
          } catch {
            break; // RPC range/other error on this chunk -> stop scanning this chain
          }
          for (const l of logs.reverse()) {
            const a = l.args as { user?: string; amountOut?: bigint; receiptHash?: string };
            out.push({
              chainKey: meta.key,
              vm: "evm" as const,
              user: a.user ?? "",
              amountOut: (a.amountOut ?? 0n).toString(),
              receiptHash: a.receiptHash ?? "",
              txHash: l.transactionHash ?? "",
              ts: Number(l.blockNumber ?? 0n),
            });
          }
          if (lo === floor) break;
        }
        return out;
      } catch {
        return [];
      }
    }),
  );
  return perChain.flat();
}
