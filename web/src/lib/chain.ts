import { defineChain, type Chain } from "viem";
import {
  sepolia as upstreamSepolia,
  arbitrumSepolia,
  baseSepolia as upstreamBaseSepolia,
  avalancheFuji,
  mantleSepoliaTestnet,
} from "viem/chains";
import { chainByKey } from "./chains";

export { arbitrumSepolia, avalancheFuji, mantleSepoliaTestnet };

function withRpcUrls(chain: Chain, key: string): Chain {
  const rpcUrls = chainByKey(key)?.rpcUrls;
  if (!rpcUrls) throw new Error(`Missing chain registry entry for ${key}`);
  return {
    ...chain,
    rpcUrls: {
      ...chain.rpcUrls,
      default: { ...chain.rpcUrls.default, http: rpcUrls },
    },
  };
}

export const sepolia = withRpcUrls(upstreamSepolia, "sepolia");
export const baseSepolia = withRpcUrls(upstreamBaseSepolia, "base-sepolia");

export const galileo = defineChain({
  id: 16602,
  name: "0G Galileo",
  nativeCurrency: { name: "OG", symbol: "OG", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: {
    default: { name: "ChainScan", url: "https://chainscan-galileo.0g.ai" },
  },
  testnet: true,
});
