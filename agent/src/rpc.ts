import { FallbackProvider, JsonRpcProvider } from "ethers";

export function createRpcProvider(rpcUrls: string[], chainId: number, stallTimeout = 750): FallbackProvider {
  const urls = [...new Set(rpcUrls.map((url) => url.trim()).filter(Boolean))];
  if (urls.length === 0) throw new Error("At least one RPC URL is required");

  const providers = urls.map((url, index) => ({
    provider: new JsonRpcProvider(url, chainId, { staticNetwork: true }),
    priority: index + 1,
    stallTimeout,
    weight: 1,
  }));

  return new FallbackProvider(providers, chainId, { quorum: 1 });
}

export function stableRpcBlock(latestBlock: number, providerCount: number): number {
  return Math.max(0, latestBlock - (providerCount > 1 ? 2 : 0));
}
