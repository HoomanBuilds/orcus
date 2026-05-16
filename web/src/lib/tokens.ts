// Token addresses on 0G Galileo testnet (Chain ID 16602)
// Verified via Zer0/Jaine factory getPool() calls - all have non-zero liquidity

export const WOGN_ADDRESS = "0x0fE9B43625fA7EdD663aDcEC0728DD635e4AbF7c";

// All tokens available for swap output
export const SWAP_TARGETS = [
  {
    symbol: "USDC",
    address: "0xf63c7CC79CD0b76399E56a432cd2aF9eD36D8740",
    label: "Orcus USDC",
    pool: "0xA8325455Daa5A0150174bD2d7A7f80828627D4Ff",
  },
  {
    symbol: "USDT",
    address: "0xed0103a53069a347ed40290e0a069b46fd50ba05",
    label: "Tether USD",
    pool: "0xb3ec2336feceb01c289cc13d17d1c455de37dbca",
  },
] as const;

export type SwapTargetSymbol = (typeof SWAP_TARGETS)[number]["symbol"];

export const DEFAULT_TOKEN_OUT: SwapTargetSymbol = "USDC";
