"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { fetchEvmTradesAllChains } from "./evm-multichain";
import { fetchSuiTrades, type TradeRow } from "./sui";
import { SUI_CHAIN } from "./chains";

export type PortfolioVm = "evm" | "sui" | "none";

// Read-page data scoped to the connected wallet's VM:
//   EVM wallet -> trades aggregated across all 5 EVM chains
//   Sui wallet -> Sui trades only
// `userScoped` false = protocol-wide feed (all users) for the activity page.
export function usePortfolio(opts?: { userScoped?: boolean; publicFallback?: boolean }) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const suiAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const rawVm: PortfolioVm = evmConnected ? "evm" : suiAccount ? "sui" : "none";
  // Protocol-wide pages (activity) default to the EVM feed when no wallet is connected.
  const vm: PortfolioVm = rawVm === "none" && opts?.publicFallback ? "evm" : rawVm;
  // Only scope to a user when a wallet is actually connected.
  const userScoped = (opts?.userScoped ?? true) && rawVm !== "none";

  const evmQuery = useQuery({
    queryKey: ["portfolio", "evm", userScoped ? (evmAddress ?? "") : "all"],
    queryFn: () => fetchEvmTradesAllChains(userScoped ? (evmAddress as `0x${string}`) : undefined),
    enabled: vm === "evm",
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const suiQuery = useQuery({
    queryKey: ["portfolio", "sui", userScoped ? (suiAccount?.address ?? "") : "all"],
    queryFn: () => fetchSuiTrades(suiClient, SUI_CHAIN, userScoped ? suiAccount?.address : undefined),
    enabled: vm === "sui",
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const rows: TradeRow[] = vm === "evm" ? (evmQuery.data ?? []) : vm === "sui" ? (suiQuery.data ?? []) : [];
  const isLoading = vm === "evm" ? evmQuery.isLoading : vm === "sui" ? suiQuery.isLoading : false;
  const address = vm === "evm" ? evmAddress : vm === "sui" ? suiAccount?.address : undefined;

  return { vm, rows, isLoading, address };
}
