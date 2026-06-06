import { getMarketSnapshot } from "./market.js";

// --- pure indicator math (unit-tested) ---

/** Simple moving average of the last `period` values. null if not enough data. */
export function sma(values: number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** Wilder's RSI over `period`. 50 when flat, 100 all-up, 0 all-down. null if not enough data. */
export function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Realized volatility = stddev of simple returns, in percent. null if not enough data. */
export function realizedVolatility(values: number[]): number | null {
  if (values.length < 3) return null;
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] === 0) continue;
    returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }
  if (returns.length < 2) return null;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

// --- data fetch + snapshot ---

/** Fetch Binance kline close prices (oldest -> newest). Empty array on failure. */
export async function fetchKlineCloses(
  symbol = "0GUSDT",
  interval = "1h",
  limit = 120,
): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as unknown[];
    // each row is an array; close price is index 4 (string)
    return rows
      .map((r) => Number((r as unknown[])[4]))
      .filter((n) => Number.isFinite(n) && n > 0);
  } catch {
    return [];
  }
}

/**
 * Structured market snapshot for the TEE decision: base price/trend (from
 * market.ts, Binance-first) enriched with agent-computed MA / RSI / volatility.
 * Indicator fields are null when klines are unavailable.
 */
export async function buildMarketSnapshot(symbol = "0GUSDT"): Promise<string> {
  const base = JSON.parse(await getMarketSnapshot()) as {
    ts: number; price: number; change24h: string; trend: string; source?: string; note?: string;
  };
  const closes = await fetchKlineCloses(symbol, "1h", 120);
  let ma: { ma7: number | null; ma25: number | null; ma99: number | null } | null = null;
  let rsi14: number | null = null;
  let volatilityPct: number | null = null;
  if (closes.length >= 15) {
    ma = { ma7: sma(closes, 7), ma25: sma(closes, 25), ma99: sma(closes, 99) };
    rsi14 = rsi(closes, 14);
    volatilityPct = realizedVolatility(closes.slice(-24));
  }
  const round = (n: number | null) => (n === null ? null : Number(n.toFixed(6)));
  return JSON.stringify({
    ...base,
    indicators: {
      ma: ma ? { ma7: round(ma.ma7), ma25: round(ma.ma25), ma99: round(ma.ma99) } : null,
      rsi14: round(rsi14),
      volatilityPct: round(volatilityPct),
      candles: closes.length,
    },
  });
}
