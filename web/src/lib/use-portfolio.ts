"use client";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { fetchEvmTradesAllChains } from "./evm-multichain";
import { fetchSuiTrades, type TradeRow } from "./sui";
import { SUI_CHAIN } from "./chains";
import { useActiveChain } from "./active-chain";

export type PortfolioVm = "evm" | "sui";

// Single source of truth = the navbar's active chain VM (the connect button is VM-aware,
// so the connected wallet always matches the active VM). EVM active -> all 5 EVM chains
// aggregated; Sui active -> Sui only. `userScoped` true filters to the connected address;
// `publicFallback` (activity) shows the feed even with no wallet connected.
export function usePortfolio(opts?: { userScoped?: boolean; publicFallback?: boolean }) {
  const { activeChain } = useActiveChain();
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const suiAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  const vm: PortfolioVm = activeChain.vm === "sui" ? "sui" : "evm";
  const walletConnected = vm === "evm" ? evmConnected : !!suiAccount;
  const userScoped = (opts?.userScoped ?? true) && walletConnected;
  const enabled = walletConnected || !!opts?.publicFallback;

  const evmQuery = useQuery({
    queryKey: ["portfolio", "evm", userScoped ? (evmAddress ?? "") : "all"],
    queryFn: () => fetchEvmTradesAllChains(userScoped ? (evmAddress as `0x${string}`) : undefined),
    enabled: vm === "evm" && enabled,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const suiQuery = useQuery({
    queryKey: ["portfolio", "sui", userScoped ? (suiAccount?.address ?? "") : "all"],
    queryFn: () => fetchSuiTrades(suiClient, SUI_CHAIN, userScoped ? suiAccount?.address : undefined),
    enabled: vm === "sui" && enabled,
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  const rows: TradeRow[] = vm === "evm" ? (evmQuery.data ?? []) : (suiQuery.data ?? []);
  const isLoading = vm === "evm" ? evmQuery.isLoading : suiQuery.isLoading;
  const address = userScoped ? (vm === "evm" ? evmAddress : suiAccount?.address) : undefined;

  return { vm, walletConnected, rows, isLoading, address };
}
