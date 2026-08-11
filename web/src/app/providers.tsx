"use client";
import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { wagmiConfig } from "@/lib/wagmi";
import { orcusTheme } from "@/lib/rainbowkit-theme";
import { ToastProvider } from "@/components/toast";
import { ActiveChainProvider } from "@/lib/active-chain";
import { suiDAppKit } from "@/lib/dapp-kit";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={qc}>
        <DAppKitProvider dAppKit={suiDAppKit}>
          <RainbowKitProvider theme={orcusTheme}>
            <ActiveChainProvider>
              <ToastProvider>
                {children}
              </ToastProvider>
            </ActiveChainProvider>
          </RainbowKitProvider>
        </DAppKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
