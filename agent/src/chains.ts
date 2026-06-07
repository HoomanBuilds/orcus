import "dotenv/config";

export type PriceMode = "mock" | "pyth";

export interface ChainConfig {
  key: string;
  name: string;
  chainId: number;
  rpc: string;
  vault: string;        // deployed StrategyVault (v2)
  usdc: string;         // settlement token used as ExecParams.tokenOut
  poolFee: number;      // Uniswap V3 fee tier for ExecParams.fee
  priceMode: PriceMode; // "mock": agent ABI-encodes the Binance price into priceUpdate (testnet).
                        // "pyth": agent fetches a Hermes VAA into priceUpdate + sends the update fee (mainnet).
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
    priceMode: "mock",
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
    priceMode: "pyth",
    explorerTx: "https://sepolia.arbiscan.io/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "ARBITRUM_SEPOLIA_RPC",
    rpcDefault: "https://sepolia-rollup.arbitrum.io/rpc",
    vaultEnv: "ARBITRUM_SEPOLIA_VAULT",
    usdcEnv: "ARBITRUM_SEPOLIA_USDC",
    usdcDefault: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Circle test USDC (verified)
  },
  // Mainnet EVM chains (priceMode "pyth"). Verify usdcDefault + the deepest pool's
  // fee tier on each explorer before deploying value; set the vault env after deploy.
  base: {
    key: "base",
    name: "Base",
    chainId: 8453,
    poolFee: 3000,
    priceMode: "pyth",
    explorerTx: "https://basescan.org/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "BASE_RPC",
    rpcDefault: "https://mainnet.base.org",
    vaultEnv: "BASE_VAULT",
    usdcEnv: "BASE_USDC",
    usdcDefault: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // native USDC on Base
  },
  avalanche: {
    key: "avalanche",
    name: "Avalanche C-Chain",
    chainId: 43114,
    poolFee: 3000,
    priceMode: "pyth",
    explorerTx: "https://snowtrace.io/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "AVALANCHE_RPC",
    rpcDefault: "https://api.avax.network/ext/bc/C/rpc",
    vaultEnv: "AVALANCHE_VAULT",
    usdcEnv: "AVALANCHE_USDC",
    usdcDefault: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // native USDC on Avalanche
  },
  mantle: {
    key: "mantle",
    name: "Mantle",
    chainId: 5000,
    poolFee: 3000,
    priceMode: "pyth",
    explorerTx: "https://explorer.mantle.xyz/tx/",
    lookbackBlocks: 5000,
    pollIntervalMs: 4000,
    rpcEnv: "MANTLE_RPC",
    rpcDefault: "https://rpc.mantle.xyz",
    vaultEnv: "MANTLE_VAULT",
    usdcEnv: "MANTLE_USDC",
    usdcDefault: "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9", // USDC on Mantle (verify)
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
