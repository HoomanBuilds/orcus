// Per-chain native market snapshot (Binance keyless, CoinGecko fallback, then a stub).
export async function getMarketSnapshot(
  symbol = "0GUSDT",
  coingeckoId = "zero-gravity",
): Promise<string> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const d = (await res.json()) as { lastPrice?: string; priceChangePercent?: string };
      if (d.lastPrice && Number(d.lastPrice) > 0) {
        const price = Number(d.lastPrice);
        const change = Number(d.priceChangePercent ?? "0");
        return JSON.stringify({
          ts: Date.now(),
          price,
          change24h: change.toFixed(2),
          trend: change > 1 ? "up" : change < -1 ? "down" : "flat",
          source: "binance",
        });
      }
    }
  } catch {
    // fall through to coingecko
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = (await res.json()) as Record<string, { usd?: number; usd_24h_change?: number }>;
      const entry = data[coingeckoId];
      if (entry?.usd !== undefined) {
        const change = entry.usd_24h_change ?? 0;
        return JSON.stringify({
          ts: Date.now(),
          price: entry.usd,
          change24h: change.toFixed(2),
          trend: change > 1 ? "up" : change < -1 ? "down" : "flat",
          source: "coingecko",
        });
      }
    }
  } catch {
    // fall through to stub
  }

  return JSON.stringify({
    ts: Date.now(),
    price: 1.0,
    change24h: "0.00",
    trend: "flat",
    note: "stub - price sources unavailable",
  });
}
