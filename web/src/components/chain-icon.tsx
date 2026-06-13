"use client";
import {
  NetworkArbitrumSepolia,
  NetworkBaseSepolia,
  NetworkAvalancheFuji,
  NetworkSui,
} from "@web3icons/react";
import { chainByKey, type ChainMeta } from "@/lib/chains";

type IconCmp = React.ComponentType<{ size?: number; variant?: "mono" | "branded" | "background"; className?: string }>;

// 0G Galileo + Mantle Sepolia have no usable (visible) branded web3icon -> letter-badge fallback.
const ICONS: Record<string, IconCmp> = {
  "arbitrum-sepolia": NetworkArbitrumSepolia,
  "base-sepolia": NetworkBaseSepolia,
  "avalanche-fuji": NetworkAvalancheFuji,
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

export function ChainBadge({ chainKey, size = 14 }: { chainKey: string; size?: number }) {
  const c = chainByKey(chainKey);
  if (!c) return <span className="text-[11px] text-black/30">{chainKey}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <ChainIcon chain={c} size={size} />
      <span className="text-[11px] text-black/55" style={{ fontFamily: "var(--font-data)" }}>{c.shortLabel}</span>
    </span>
  );
}
