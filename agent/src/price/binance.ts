import { parseUnits } from "ethers";

// Native/USD price scaled to 1e18 (USD per 1 wrapped-native, * 1e18). Per-chain symbol
// (e.g. ETHUSDT on Arbitrum Sepolia, 0GUSDT on Galileo). Primary: Binance public API
// (no key). Fallback: CoinGecko by coin id. Throws if both fail.
export async function getOgPriceScaled(
  symbol = "0GUSDT",
  coingeckoId = "zero-gravity",
): Promise<bigint> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const d = (await res.json()) as { price?: string };
      if (d.price && Number(d.price) > 0) return parseUnits(d.price, 18);
    }
  } catch {
    // fall through to coingecko
  }
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const d = (await res.json()) as Record<string, { usd?: number }>;
      const p = d[coingeckoId]?.usd;
      if (p && p > 0) return parseUnits(p.toString(), 18);
    }
  } catch {
    // fall through to throw
  }
  throw new Error(`no price source for ${symbol}/${coingeckoId} (binance + coingecko failed)`);
}
