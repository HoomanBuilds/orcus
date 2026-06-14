import { sma, rsi, realizedVolatility, fetchKlineCloses } from "../indicators.js";
import { getMarketSnapshot } from "../market.js";
import type { Indicators } from "./evaluate.js";

// Builds the Indicators accessor the evaluator needs, from Binance 1h klines.
// All values are public market data computed here - the AI never computes them.
export async function buildIndicators(symbol: string, coingeckoId: string): Promise<Indicators> {
  const base = JSON.parse(await getMarketSnapshot(symbol, coingeckoId)) as {
    price: number; change24h: string; trend: string;
  };
  const closes = await fetchKlineCloses(symbol, "1h", 120);
  const prevCloses = closes.slice(0, -1);
  const prev = prevCloses.length > 1
    ? { price: prevCloses[prevCloses.length - 1], ma: (p: number) => sma(prevCloses, p) }
    : undefined;

  return {
    price: base.price,
    rsi: (p: number) => (closes.length > p ? rsi(closes, p) : null),
    ma: (p: number) => sma(closes, p),
    volatility: closes.length >= 3 ? realizedVolatility(closes.slice(-24)) : null,
    change24h: base.change24h !== undefined && base.change24h !== "" ? Number(base.change24h) : null,
    trend: base.trend ?? "flat",
    prev,
  };
}
