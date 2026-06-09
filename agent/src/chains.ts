import "dotenv/config";

export type PriceMode = "mock" | "pyth";

export interface ChainConfig {
  key: string;
  name: string;
  chainId: number;
  rpc: string;
  vault: string;          // deployed StrategyVault (v2)
  usdc: string;           // settlement token used as ExecParams.tokenOut (the deployed oUSDC on testnets)
  poolFee: number;        // Uniswap V3 fee tier for ExecParams.fee (ignored by the mock router)
  priceMode: PriceMode;   // "mock": agent ABI-encodes a Binance price into priceUpdate (testnets).
                          // "pyth": agent fetches a Hermes VAA + fee (mainnet, real Pyth).
  binanceSymbol: string;  // the chain native / USD pair the agent prices (e.g. ETHUSDT)
  coingeckoId: string;    // fallback price source id (e.g. ethereum)
  explorerTx: string;
  lookbackBlocks: number;
  pollIntervalMs: number;
  zgServiceUrl: string;
  zgApiSecret: string;
}

interface ChainMeta {
  key: string;
  name: string;
  chainId: number;
  poolFee: number;
  priceMode: PriceMode;
  binanceSymbol: string;
  coingeckoId: string;
  explorerTx: string;
  lookbackBlocks: number;
  pollIntervalMs: number;
  rpcEnv: string;
  rpcDefault: string;
  vaultEnv: string;
  usdcEnv: string;
  zgUrlEnv: string;
  zgSecretEnv: string;
}

// TESTNET deployments. Every chain runs the self-contained MOCK stack (deploy DEPLOY_MODE=mock):
// oUSDC + WrappedNative + OrcusOracle (Binance push) + OrcusRouter, so no real-DEX liquidity or
// on-chain oracle is required. `usdc` is the deployed oUSDC on that testnet (set the env after deploy).
// For a real mainnet (real Uniswap + Pyth) add an entry with priceMode "pyth" and a real usdc.
const META: Record<string, ChainMeta> = {
  galileo: {
    key: "galileo",
    name: "0G Galileo",
    chainId: 16602,
    poolFee: 3000,
    priceMode: "mock",
    binanceSymbol: "0GUSDT",
    coingeckoId: "zero-gravity",
    explorerTx: "https://chainscan-galileo.0g.ai/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "GALILEO_RPC",
    rpcDefault: "https://evmrpc-testnet.0g.ai",
    vaultEnv: "VAULT_ADDRESS",
    usdcEnv: "USDC_ADDRESS",
    zgUrlEnv: "GALILEO_ZG_SERVICE_URL",
    zgSecretEnv: "GALILEO_ZG_API_SECRET",
  },
  "arbitrum-sepolia": {
    key: "arbitrum-sepolia",
    name: "Arbitrum Sepolia",
    chainId: 421614,
    poolFee: 3000,
    priceMode: "mock",
    binanceSymbol: "ETHUSDT",
    coingeckoId: "ethereum",
    explorerTx: "https://sepolia.arbiscan.io/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "ARBITRUM_SEPOLIA_RPC",
    rpcDefault: "https://sepolia-rollup.arbitrum.io/rpc",
    vaultEnv: "ARBITRUM_SEPOLIA_VAULT",
    usdcEnv: "ARBITRUM_SEPOLIA_USDC",
    zgUrlEnv: "ARBITRUM_SEPOLIA_ZG_SERVICE_URL",
    zgSecretEnv: "ARBITRUM_SEPOLIA_ZG_API_SECRET",
  },
  "base-sepolia": {
    key: "base-sepolia",
    name: "Base Sepolia",
    chainId: 84532,
    poolFee: 3000,
    priceMode: "mock",
    binanceSymbol: "ETHUSDT",
    coingeckoId: "ethereum",
    explorerTx: "https://sepolia.basescan.org/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "BASE_SEPOLIA_RPC",
    rpcDefault: "https://sepolia.base.org",
    vaultEnv: "BASE_SEPOLIA_VAULT",
    usdcEnv: "BASE_SEPOLIA_USDC",
    zgUrlEnv: "BASE_SEPOLIA_ZG_SERVICE_URL",
    zgSecretEnv: "BASE_SEPOLIA_ZG_API_SECRET",
  },
  "avalanche-fuji": {
    key: "avalanche-fuji",
    name: "Avalanche Fuji",
    chainId: 43113,
    poolFee: 3000,
    priceMode: "mock",
    binanceSymbol: "AVAXUSDT",
    coingeckoId: "avalanche-2",
    explorerTx: "https://testnet.snowtrace.io/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "FUJI_RPC",
    rpcDefault: "https://api.avax-test.network/ext/bc/C/rpc",
    vaultEnv: "FUJI_VAULT",
    usdcEnv: "FUJI_USDC",
    zgUrlEnv: "FUJI_ZG_SERVICE_URL",
    zgSecretEnv: "FUJI_ZG_API_SECRET",
  },
  "mantle-sepolia": {
    key: "mantle-sepolia",
    name: "Mantle Sepolia",
    chainId: 5003,
    poolFee: 3000,
    priceMode: "mock",
    binanceSymbol: "MNTUSDT",
    coingeckoId: "mantle",
    explorerTx: "https://explorer.sepolia.mantle.xyz/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "MANTLE_SEPOLIA_RPC",
    rpcDefault: "https://rpc.sepolia.mantle.xyz",
    vaultEnv: "MANTLE_SEPOLIA_VAULT",
    usdcEnv: "MANTLE_SEPOLIA_USDC",
    zgUrlEnv: "MANTLE_SEPOLIA_ZG_SERVICE_URL",
    zgSecretEnv: "MANTLE_SEPOLIA_ZG_API_SECRET",
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
  const usdc = process.env[m.usdcEnv] ?? "";
  if (!vault) {
    throw new Error(`CHAIN="${key}" has no vault address. Deploy the v2 stack and set ${m.vaultEnv} in .env.`);
  }
  if (!usdc) {
    throw new Error(`CHAIN="${key}" has no settlement token. Set ${m.usdcEnv} to the deployed oUSDC in .env.`);
  }
  const zgServiceUrl = process.env[m.zgUrlEnv] ?? process.env.ZG_SERVICE_URL ?? "";
  const zgApiSecret  = process.env[m.zgSecretEnv] ?? process.env.ZG_API_SECRET ?? "";
  return {
    key: m.key, name: m.name, chainId: m.chainId, rpc, vault, usdc,
    poolFee: m.poolFee, priceMode: m.priceMode,
    binanceSymbol: m.binanceSymbol, coingeckoId: m.coingeckoId,
    explorerTx: m.explorerTx, lookbackBlocks: m.lookbackBlocks, pollIntervalMs: m.pollIntervalMs,
    zgServiceUrl, zgApiSecret,
  };
}
