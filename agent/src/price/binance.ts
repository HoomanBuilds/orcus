import { parseUnits } from "ethers";

// Real 0G/USD price scaled to 1e18 (USD per 1 wrapped-native, * 1e18).
// Primary: Binance public API (no key). Fallback: CoinGecko. Throws if both fail.
export async function getOgPriceScaled(): Promise<bigint> {
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=0GUSDT",
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
      "https://api.coingecko.com/api/v3/simple/price?ids=zero-gravity&vs_currencies=usd",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const d = (await res.json()) as Record<string, { usd?: number }>;
      const p = d["zero-gravity"]?.usd;
      if (p && p > 0) return parseUnits(p.toString(), 18);
    }
  } catch {
    // fall through to throw
  }
  throw new Error("no price source (binance + coingecko failed)");
}
