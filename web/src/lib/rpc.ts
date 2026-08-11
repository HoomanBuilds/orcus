import { fallback, http } from "viem";

export function createEvmTransport(rpcUrls: readonly [string, ...string[]]) {
  return fallback(
    rpcUrls.map((url) => http(url, { retryCount: 0, timeout: 5_000 })),
    { rank: false, retryCount: 0 },
  );
}
