"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CHAINS, DEFAULT_CHAIN_KEY, chainByKey, type ChainMeta } from "./chains";

interface ActiveChainCtx {
  activeChain: ChainMeta;
  setActiveChainKey: (key: string) => void;
}

const Ctx = createContext<ActiveChainCtx | null>(null);
const LS_KEY = "orcus.activeChain";

export function ActiveChainProvider({ children }: { children: React.ReactNode }) {
  const [key, setKey] = useState<string>(DEFAULT_CHAIN_KEY);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
    if (saved && chainByKey(saved)) setKey(saved);
  }, []);

  const setActiveChainKey = useCallback((k: string) => {
    if (!chainByKey(k)) return;
    setKey(k);
    try { window.localStorage.setItem(LS_KEY, k); } catch { /* ignore */ }
  }, []);

  const activeChain = chainByKey(key) ?? CHAINS[0];
  return <Ctx.Provider value={{ activeChain, setActiveChainKey }}>{children}</Ctx.Provider>;
}

export function useActiveChain(): ActiveChainCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useActiveChain must be used within ActiveChainProvider");
  return c;
}
