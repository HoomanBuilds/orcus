import "dotenv/config";

export type PriceMode = "agent-push" | "onchain";

export interface ChainConfig {
  key: string;
  name: string;
  chainId: number;
  rpc: string;
  vault: string;        // deployed StrategyVault (v2)
  usdc: string;         // settlement token used as ExecParams.tokenOut
  poolFee: number;      // Uniswap V3 fee tier for ExecParams.fee
  priceMode: PriceMode; // "agent-push": agent feeds Binance price to the push oracle (Galileo).
                        // "onchain": chain has a real oracle (Pyth/Chainlink); no push.
  explorerTx: string;
  lookbackBlocks: number;
  pollIntervalMs: number;
}

interface ChainMeta {
  key: string;
  name: string;
  chainId: number;
  poolFee: number;
  priceMode: PriceMode;
  explorerTx: string;
  lookbackBlocks: number;
  pollIntervalMs: number;
  rpcEnv: string;
  rpcDefault: string;
  vaultEnv: string;
  usdcEnv: string;
  usdcDefault?: string;
}

// Static per-chain metadata. Deploy-specific addresses (vault, usdc) and rpc are
// resolved from env at call time so a fresh deploy needs only env, not code edits.
const META: Record<string, ChainMeta> = {
  galileo: {
    key: "galileo",
    name: "0G Galileo",
    chainId: 16602,
    poolFee: 3000,
    priceMode: "agent-push",
    explorerTx: "https://chainscan-galileo.0g.ai/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "GALILEO_RPC",
    rpcDefault: "https://evmrpc-testnet.0g.ai",
    vaultEnv: "VAULT_ADDRESS",
    usdcEnv: "USDC_ADDRESS",
  },
  "arbitrum-sepolia": {
    key: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    chainId: 421614,
    poolFee: 3000,
    priceMode: "onchain",
    explorerTx: "https://sepolia.arbiscan.io/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "ARBITRUM_SEPOLIA_RPC",
    rpcDefault: "https://sepolia-rollup.arbitrum.io/rpc",
    vaultEnv: "ARBITRUM_SEPOLIA_VAULT",
    usdcEnv: "ARBITRUM_SEPOLIA_USDC",
    usdcDefault: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Circle test USDC (verified)
  },
};

export function chainKeys(): string[] {
  return Object.keys(META);
}

export function resolveChain(): ChainConfig {
  const key = process.env.CHAIN ?? "galileo";
  const m = META[key];
  if (!m) throw new Error(`Unknown CHAIN="${key}". Known: ${chainKeys().join(", ")}`);
  const rpc = process.env[m.rpcEnv] ?? m.rpcDefault;
  const vault = process.env[m.vaultEnv] ?? "";
  const usdc = process.env[m.usdcEnv] ?? m.usdcDefault ?? "";
  if (!vault) {
    throw new Error(`CHAIN="${key}" has no vault address. Deploy the v2 stack and set ${m.vaultEnv} in .env.`);
  }
  if (!usdc) {
    throw new Error(`CHAIN="${key}" has no settlement token. Set ${m.usdcEnv} in .env.`);
  }
  return {
    key: m.key, name: m.name, chainId: m.chainId, rpc, vault, usdc,
    poolFee: m.poolFee, priceMode: m.priceMode, explorerTx: m.explorerTx,
    lookbackBlocks: m.lookbackBlocks, pollIntervalMs: m.pollIntervalMs,
  };
}
