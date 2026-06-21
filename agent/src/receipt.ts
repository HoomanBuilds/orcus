/**
 * Verifiable decision receipt (plan Part 5.3). Records the data inputs the agent
 * used and the TEE verdict, so a third party can audit WHY a trade ran - without
 * exposing the user's sealed strategy. The plaintext strategy never appears here
 * (it stays inside the TEE enclave; see plan Part 6).
 */
import type { Condition } from "./strategy/schema.js";
import type { Evaluated } from "./strategy/evaluate.js";

export interface StrategyTrail {
  conditions: Condition[];
  logic: "AND" | "OR";
  evaluated: Evaluated[];   // each condition's computed value + pass/fail (code)
  action: string;          // code-decided EXECUTE/WAIT
  reason: string;          // AI reason or code fallback
  aiReason: string | null; // the raw AI sentence, null if it fell back
}

export interface DecisionReceipt {
  version: "1";
  ts: number;
  chain: { key: string; chainId: number };
  user: string;
  inputs: {
    market: unknown; // structured public market snapshot (price/trend + MA/RSI/volatility)
    oracle: {
      mode: string;               // "mock" | "pyth"
      address: string | null;     // oracle contract used for the slippage floor
      priceScaled: string | null; // price applied on-chain this trade (1e18), if mock mode
    };
  };
  tee: { provider: string; verifiability: "TeeML" };
  verdict: { action: string; reason: string };
  settlement?: { venue: string; pool: string | null; token: string | null }; // real-DEX routing, e.g. DeepBook v3 on Sui
  strategy?: StrategyTrail;        // present for typed-strategy intents (not legacy free-text)
}

export function buildDecisionReceipt(p: {
  chainKey: string;
  chainId: number;
  user: string;
  ts: number;
  marketJson: string;
  oracleMode: string;
  oracleAddress: string | null;
  priceScaled: string | null;
  teeProvider: string;
  action: string;
  reason: string;
  settlement?: { venue: string; pool: string | null; token: string | null };
  strategy?: StrategyTrail;
}): DecisionReceipt {
  let market: unknown;
  try {
    market = JSON.parse(p.marketJson);
  } catch {
    market = { raw: p.marketJson };
  }
  return {
    version: "1",
    ts: p.ts,
    chain: { key: p.chainKey, chainId: p.chainId },
    user: p.user,
    inputs: {
      market,
      oracle: { mode: p.oracleMode, address: p.oracleAddress, priceScaled: p.priceScaled },
    },
    tee: { provider: p.teeProvider, verifiability: "TeeML" },
    verdict: { action: p.action, reason: p.reason },
    ...(p.settlement ? { settlement: p.settlement } : {}),
    ...(p.strategy ? { strategy: p.strategy } : {}),
  };
}
