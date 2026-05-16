"use client";
import { useQuery } from "@tanstack/react-query";
import { usePublicClient, useReadContract } from "wagmi";
import { VAULT, getAnchorBlock, fetchTradeExecuted, tradeExecutedKeys } from "@/lib/vaultEvents";
import { vaultAbi } from "@/lib/vaultAbi";

export type IntentLifecycle = "none" | "pending" | "executed" | "withdrawn";

export function useTradeExecutedFeed() {
  const client = usePublicClient();
  return useQuery({
    queryKey: tradeExecutedKeys.all,
    queryFn: async () => {
      const from = await getAnchorBlock(client!);
      return fetchTradeExecuted(client!, from);
    },
    enabled: !!client && !!VAULT,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useUserTradeExecuted(address: `0x${string}` | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: tradeExecutedKeys.user(address ?? ""),
    queryFn: async () => {
      const from = await getAnchorBlock(client!);
      return fetchTradeExecuted(client!, from, address!);
    },
    enabled: !!client && !!VAULT && !!address,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useIntentStatus(address: `0x${string}` | undefined): {
  lifecycle: IntentLifecycle;
  lastTrade: { receiptHash: string; txHash: string } | null;
} {
  const { data: intent } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "intents",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT, refetchInterval: 8_000 },
  });

  const { data: balance } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT, refetchInterval: 8_000 },
  });

  const { data: trades } = useUserTradeExecuted(address);

  if (!address || !intent) return { lifecycle: "none", lastTrade: null };

  const isActive = intent[4] === true;
  const hasTrade = (trades?.length ?? 0) > 0;
  const hasBalance = (balance ?? 0n) > 0n;
  const lastTrade = trades?.[0] ? { receiptHash: trades[0].receiptHash, txHash: trades[0].txHash } : null;

  if (isActive) return { lifecycle: "pending", lastTrade };
  if (hasTrade && !isActive) return { lifecycle: "executed", lastTrade };
  if (!hasBalance && !isActive) return { lifecycle: "withdrawn", lastTrade };
  return { lifecycle: "none", lastTrade };
}
