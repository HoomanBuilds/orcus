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
  settlementToken: string;   // oUSDC address (evm) / oUSDC coin type (sui)
  nativeSymbol: string;
  nativeDecimals: number;
  explorerTx: string;        // base url, append <hash>
  explorerAddr: string;      // base url, append <address>
  iconNetwork?: string;      // @web3icons/react NetworkIcon `name`; undefined -> letter badge
  sui?: { packageId: string; poolId: string; oracleId: string };
}

const SUI_PKG = "0x07e3af4c0e5389fe27b9fc2519cd5ccdfaae772085ce1a9e754aeb55519f9dc8";

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
    settlementToken: `${SUI_PKG}::orcus_usdc::ORCUS_USDC`,
    nativeSymbol: "SUI", nativeDecimals: 9,
    explorerTx: "https://suiscan.xyz/testnet/tx/",
    explorerAddr: "https://suiscan.xyz/testnet/object/",
    iconNetwork: "sui",
    sui: {
      packageId: SUI_PKG,
      poolId: "0x4bd52b1b7817b13432eb49daf6afdbccfe7808f6498cf93bb8e2302d67110973",
      oracleId: "0xc00b3ad57a1f0bf64bc4f51aae31d4a7820f3d13b956dc866c149c72d729b826",
    },
  },
];

export const EVM_CHAINS = CHAINS.filter((c) => c.vm === "evm");
export const SUI_CHAIN = CHAINS.find((c) => c.vm === "sui")!;
export const DEFAULT_CHAIN_KEY = "galileo";

export function chainByKey(key: string): ChainMeta | undefined {
  return CHAINS.find((c) => c.key === key);
}

export function evmChainById(id: number): ChainMeta | undefined {
  return CHAINS.find((c) => c.evmChainId === id);
}
