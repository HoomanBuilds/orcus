// Frontend chain registry - single source of truth for the multi-chain UI.
// Mirrors the agent's deployed stack (verified on-chain 2026-06-13). Addresses are
// public + immutable per deployment, so they live here rather than in env sprawl.

export type Vm = "evm" | "sui";

export interface ChainMeta {
  key: string;
  name: string;
  shortLabel: string;
  vm: Vm;
  evmChainId?: number;        // evm only
  rpcUrl: string;
  vault: string;             // evm vault address OR sui Vault object id
  settlementToken: string;   // oUSDC/USDC address (evm) / DeepBook DBUSDC coin type (sui)
  nativeSymbol: string;
  nativeDecimals: number;
  explorerTx: string;        // base url, append <hash>
  explorerAddr: string;      // base url, append <address>
  iconNetwork?: string;      // @web3icons/react NetworkIcon `name`; undefined -> letter badge
  minNativeDeposit?: number; // UI-enforced min deposit in native units; Sui = DeepBook 1 SUI min order
  minSlippageBps?: number;   // UI-enforced min slippage; Sui needs headroom for the DeepBook spread/fee
  sui?: { packageId: string; eventsPkg: string; oracleId: string };
}

// packageId = upgraded package (function calls); eventsPkg = original package, whose id
// every event/struct type keeps across upgrades, so event queries must use it.
const SUI_PKG = "0xd90464f6f643309be4f424338067bd847e0b53d258a5421585afc6b9d8823861";
const SUI_EVENTS_PKG = "0x07e3af4c0e5389fe27b9fc2519cd5ccdfaae772085ce1a9e754aeb55519f9dc8";
const SUI_DBUSDC = "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC";

export const CHAINS: ChainMeta[] = [
  {
    key: "galileo", name: "0G Galileo", shortLabel: "0G", vm: "evm", evmChainId: 16602,
    rpcUrl: "https://evmrpc-testnet.0g.ai",
    vault: "0x21D50633853DDbecA1920C553f1D89b2d3E9847f",
    settlementToken: "0x58F995999cae47d39e987e393b9fdd422f43cec5",
    nativeSymbol: "OG", nativeDecimals: 18,
    explorerTx: "https://chainscan-galileo.0g.ai/tx/",
    explorerAddr: "https://chainscan-galileo.0g.ai/address/",
    // 0G has no web3icons entry -> letter badge fallback
  },
  {
    key: "arbitrum-sepolia", name: "Arbitrum Sepolia", shortLabel: "ARB", vm: "evm", evmChainId: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    vault: "0x3d1360f91521f99C913962ab6fcB15B62653CAEF",
    settlementToken: "0xD5bdd124De482d3e0244F6122E403983A4E25D62",
    nativeSymbol: "ETH", nativeDecimals: 18,
    explorerTx: "https://sepolia.arbiscan.io/tx/",
    explorerAddr: "https://sepolia.arbiscan.io/address/",
    iconNetwork: "arbitrum-one",
  },
  {
    key: "base-sepolia", name: "Base Sepolia", shortLabel: "BASE", vm: "evm", evmChainId: 84532,
    rpcUrl: "https://sepolia.base.org",
    vault: "0x3d1360f91521f99C913962ab6fcB15B62653CAEF",
    settlementToken: "0xD5bdd124De482d3e0244F6122E403983A4E25D62",
    nativeSymbol: "ETH", nativeDecimals: 18,
    explorerTx: "https://sepolia.basescan.org/tx/",
    explorerAddr: "https://sepolia.basescan.org/address/",
    iconNetwork: "base",
  },
  {
    key: "avalanche-fuji", name: "Avalanche Fuji", shortLabel: "FUJI", vm: "evm", evmChainId: 43113,
    rpcUrl: "https://api.avax-test.network/ext/bc/C/rpc",
    vault: "0x3d1360f91521f99C913962ab6fcB15B62653CAEF",
    settlementToken: "0xD5bdd124De482d3e0244F6122E403983A4E25D62",
    nativeSymbol: "AVAX", nativeDecimals: 18,
    explorerTx: "https://testnet.snowtrace.io/tx/",
    explorerAddr: "https://testnet.snowtrace.io/address/",
    iconNetwork: "avalanche",
  },
  {
    key: "mantle-sepolia", name: "Mantle Sepolia", shortLabel: "MNT", vm: "evm", evmChainId: 5003,
    rpcUrl: "https://rpc.sepolia.mantle.xyz",
    vault: "0x1D97662e187D8964B6a0783865326FEde8d14b8C",
    settlementToken: "0x5Bd4ea1D03a73c67f40C1dbF02a1ffb38b7d66d0",
    nativeSymbol: "MNT", nativeDecimals: 18,
    explorerTx: "https://explorer.sepolia.mantle.xyz/tx/",
    explorerAddr: "https://explorer.sepolia.mantle.xyz/address/",
    iconNetwork: "mantle",
  },
  {
    key: "sepolia", name: "Ethereum Sepolia", shortLabel: "ETH", vm: "evm", evmChainId: 11155111,
    rpcUrl: "https://sepolia.drpc.org",
    vault: "0x5e08CEd8e3b901B6A46e1488b7a7F52576ceb411",
    settlementToken: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // real USDC (6dec) via real Uniswap V3
    nativeSymbol: "ETH", nativeDecimals: 18,
    explorerTx: "https://sepolia.etherscan.io/tx/",
    explorerAddr: "https://sepolia.etherscan.io/address/",
    iconNetwork: "ethereum",
  },
  {
    key: "sui", name: "Sui Testnet", shortLabel: "SUI", vm: "sui",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    vault: "0x47e998d5b287f123e128f54b5b23f6f38a2bde1bf1fa8ad288a74d81b0b154f1",
    settlementToken: SUI_DBUSDC,
    nativeSymbol: "SUI", nativeDecimals: 9,
    explorerTx: "https://suiscan.xyz/testnet/tx/",
    explorerAddr: "https://suiscan.xyz/testnet/object/",
    iconNetwork: "sui",
    minNativeDeposit: 1, // DeepBook SUI/DBUSDC minimum order size; sub-1-SUI deposits revert at settlement
    minSlippageBps: 300, // DeepBook fills ~1% under mid (fee + spread); 0 slippage makes the oracle floor unmeetable
    sui: {
      packageId: SUI_PKG,
      eventsPkg: SUI_EVENTS_PKG,
      oracleId: "0xc00b3ad57a1f0bf64bc4f51aae31d4a7820f3d13b956dc866c149c72d729b826",
    },
  },
];

export const EVM_CHAINS = CHAINS.filter((c) => c.vm === "evm");
export const SUI_CHAIN = CHAINS.find((c) => c.vm === "sui")!;
export const DEFAULT_CHAIN_KEY = "galileo";

// Older agent builds (and receipts already on 0G Storage) tag the Sui chain "sui-testnet";
// the registry key is "sui". Alias so proof pages resolve the Sui vault, not the fallback.
const CHAIN_KEY_ALIASES: Record<string, string> = { "sui-testnet": "sui" };

export function chainByKey(key: string): ChainMeta | undefined {
  const k = CHAIN_KEY_ALIASES[key] ?? key;
  return CHAINS.find((c) => c.key === k);
}

export function evmChainById(id: number): ChainMeta | undefined {
  return CHAINS.find((c) => c.evmChainId === id);
}
