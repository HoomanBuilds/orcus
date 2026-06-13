"use client";
import {
  NetworkArbitrumSepolia,
  NetworkBaseSepolia,
  NetworkAvalancheFuji,
  NetworkMantleSepolia,
  NetworkSui,
} from "@web3icons/react";
import type { ChainMeta } from "@/lib/chains";

type IconCmp = React.ComponentType<{ size?: number; variant?: "mono" | "branded" | "background"; className?: string }>;

// 0G Galileo has no web3icons entry -> letter-badge fallback.
const ICONS: Record<string, IconCmp> = {
  "arbitrum-sepolia": NetworkArbitrumSepolia,
  "base-sepolia": NetworkBaseSepolia,
  "avalanche-fuji": NetworkAvalancheFuji,
  "mantle-sepolia": NetworkMantleSepolia,
  "sui": NetworkSui,
};

export function ChainIcon({ chain, size = 18 }: { chain: ChainMeta; size?: number }) {
  const Icon = ICONS[chain.key];
  if (Icon) return <Icon size={size} variant="branded" />;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-black/[0.07] text-black/55 font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), fontFamily: "var(--font-data)" }}
    >
      {chain.shortLabel.slice(0, 2)}
    </span>
  );
}
