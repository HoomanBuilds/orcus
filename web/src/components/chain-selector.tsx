"use client";
import { useState, useRef, useEffect } from "react";
import { useSwitchChain, useAccount } from "wagmi";
import { EVM_CHAINS, SUI_CHAIN, chainByKey } from "@/lib/chains";
import { useActiveChain } from "@/lib/active-chain";
import { ChainIcon } from "./chain-icon";

export function ChainSelector() {
  const { activeChain, setActiveChainKey } = useActiveChain();
  const { switchChain } = useSwitchChain();
  const { isConnected, chainId } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(key: string) {
    setActiveChainKey(key);
    setOpen(false);
    const c = chainByKey(key);
    // Auto-switch the EVM wallet network to the picked chain.
    if (c?.vm === "evm" && c.evmChainId && isConnected && chainId !== c.evmChainId) {
      switchChain({ chainId: c.evmChainId });
    }
  }

  const Row = ({ k, name }: { k: string; name: string }) => {
    const c = chainByKey(k)!;
    const active = activeChain.key === k;
    return (
      <button
        onClick={() => pick(k)}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors hover:bg-black/[0.04]"
        style={{ background: active ? "rgba(0,0,0,0.04)" : "transparent" }}
      >
        <ChainIcon chain={c} size={18} />
        <span className="text-[12px] text-[#111]">{name}</span>
        {active && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        type="button"
        className="inline-flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-xl border border-black/10 bg-white hover:bg-black/[0.03] transition-all duration-200"
      >
        <ChainIcon chain={activeChain} size={16} />
        <span className="text-black/70 font-medium tracking-wide">{activeChain.shortLabel}</span>
        <span className="text-black/30 text-[9px]">▾</span>
      </button>
      {open && (
        <div
          className="absolute right-0 mt-2 w-52 rounded-xl border border-black/10 bg-white p-1.5 z-50"
          style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}
        >
          <p className="px-3 pt-1.5 pb-1 text-[9px] tracking-[0.16em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>EVM</p>
          {EVM_CHAINS.map((c) => <Row key={c.key} k={c.key} name={c.name} />)}
          <p className="px-3 pt-2 pb-1 text-[9px] tracking-[0.16em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Sui (Move)</p>
          <Row k={SUI_CHAIN.key} name={SUI_CHAIN.name} />
        </div>
      )}
    </div>
  );
}
