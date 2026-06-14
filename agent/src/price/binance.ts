import { parseUnits } from "ethers";

// Native/USD price scaled to 10^outDecimals. OrcusOracle.getExpectedOut does
// amountIn(18dec) * priceScaled / 1e18, so priceScaled must carry the OUTPUT token's
// decimals (18 for mock oUSDC, 6 for real USDC). Binance primary, CoinGecko fallback.
export async function getOgPriceScaled(
  symbol = "0GUSDT",
  coingeckoId = "zero-gravity",
  outDecimals = 18,
): Promise<bigint> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const d = (await res.json()) as { price?: string };
      if (d.price && Number(d.price) > 0) return parseUnits(d.price, outDecimals);
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
      if (p && p > 0) return parseUnits(p.toString(), outDecimals);
    }
  } catch {
    // fall through to throw
  }
  throw new Error(`no price source for ${symbol}/${coingeckoId} (binance + coingecko failed)`);
}
