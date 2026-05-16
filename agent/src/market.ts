export async function getMarketSnapshot(): Promise<string> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=zero-gravity&vs_currencies=usd&include_24hr_change=true",
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = await res.json() as Record<string, { usd?: number; usd_24h_change?: number }>;
      const entry = data["zero-gravity"];
      if (entry?.usd !== undefined) {
        const change = entry.usd_24h_change ?? 0;
        return JSON.stringify({
          ts: Date.now(),
          price: entry.usd,
          change24h: change.toFixed(2),
          trend: change > 1 ? "up" : change < -1 ? "down" : "flat",
        });
      }
    }
  } catch {
    // fall through to stub
  }

  // Fallback: allow execution with stub so hackathon demo isn't blocked
  return JSON.stringify({
    ts: Date.now(),
    price: 1.0,
    change24h: "0.00",
    trend: "flat",
    note: "stub — coingecko unavailable",
  });
}
