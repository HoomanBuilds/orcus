"use client";
import { useEffect, useState } from "react";
import { ConnectButton as RainbowConnectButton } from "@rainbow-me/rainbowkit";
import { ConnectButton as SuiConnectButton } from "@mysten/dapp-kit";
import { useSwitchChain } from "wagmi";
import { useActiveChain } from "@/lib/active-chain";

const PILL = "inline-flex items-center justify-center text-[11px] px-4 py-2 rounded-xl transition-all duration-200 tracking-widest font-medium";

function EvmConnect({ activeChainId }: { activeChainId: number }) {
  const { switchChain } = useSwitchChain();
  return (
    <RainbowConnectButton.Custom>
      {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
        if (!mounted) return null;
        if (!account) {
          return (
            <button onClick={openConnectModal} type="button" className={`${PILL} border border-black/10 bg-[#111] text-white hover:bg-[#333]`}>
              CONNECT
            </button>
          );
        }
        if (chain && chain.id !== activeChainId) {
          return (
            <button onClick={() => switchChain({ chainId: activeChainId })} type="button"
              className={`${PILL} border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 tracking-wide`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
              Switch network
            </button>
          );
        }
        return (
          <button onClick={openAccountModal} type="button"
            className={`${PILL} border border-black/10 bg-white hover:bg-black/[0.03] tracking-wide`}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />
            <span className="text-black/70" style={{ fontFamily: "var(--font-data)" }}>{account.displayName}</span>
          </button>
        );
      }}
    </RainbowConnectButton.Custom>
  );
}

export function OrcusConnectButton() {
  const { activeChain } = useActiveChain();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  if (activeChain.vm === "sui") {
    return <div className="orcus-sui-connect"><SuiConnectButton connectText="CONNECT" /></div>;
  }
  return <EvmConnect activeChainId={activeChain.evmChainId!} />;
}
