import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { galileo, sepolia, arbitrumSepolia, baseSepolia, avalancheFuji, mantleSepoliaTestnet } from "./chain";
import { evmChainById } from "./chains";
import { createEvmTransport } from "./rpc";

function transportFor(chainId: number) {
  const chain = evmChainById(chainId);
  if (!chain) throw new Error(`Missing RPC configuration for chain ${chainId}`);
  return createEvmTransport(chain.rpcUrls);
}

export const wagmiConfig = getDefaultConfig({
  appName: "Orcus",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "orcus-dev",
  chains: [galileo, sepolia, arbitrumSepolia, baseSepolia, avalancheFuji, mantleSepoliaTestnet],
  transports: {
    [galileo.id]: transportFor(galileo.id),
    [sepolia.id]: transportFor(sepolia.id),
    [arbitrumSepolia.id]: transportFor(arbitrumSepolia.id),
    [baseSepolia.id]: transportFor(baseSepolia.id),
    [avalancheFuji.id]: transportFor(avalancheFuji.id),
    [mantleSepoliaTestnet.id]: transportFor(mantleSepoliaTestnet.id),
  },
  ssr: true,
});
