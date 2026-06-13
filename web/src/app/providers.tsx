"use client";
import "@rainbow-me/rainbowkit/styles.css";
import "@mysten/dapp-kit/dist/index.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import { wagmiConfig } from "@/lib/wagmi";
import { orcusTheme } from "@/lib/rainbowkit-theme";
import { ToastProvider } from "@/components/toast";
import { ActiveChainProvider } from "@/lib/active-chain";
import { SUI_CHAIN } from "@/lib/chains";
import { useState } from "react";

const { networkConfig } = createNetworkConfig({
  testnet: { url: SUI_CHAIN.rpcUrl, network: "testnet" },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
          <WalletProvider autoConnect>
            <RainbowKitProvider theme={orcusTheme}>
              <ActiveChainProvider>
                <ToastProvider>
                  {children}
                </ToastProvider>
              </ActiveChainProvider>
            </RainbowKitProvider>
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
