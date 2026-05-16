import { Contract, Interface, JsonRpcProvider, ZeroAddress } from "ethers";
import abi from "./jaine.abi.json" with { type: "json" };

// Verified on Galileo (16602) via chainscan-galileo.0g.ai + cast call
export const ZER0_SWAP_ROUTER = "0x2d94e151fe547d9f97cf139cd1283ca14cce042b";
export const ZER0_FACTORY     = "0x36f6414FF1df609214dDAbA71c84f18bcf00F67d";

export const TESTNET_TOKENS = {
  // Native wrapped OG (WETH9 equivalent)
  WOGN: "0x0fE9B43625fA7EdD663aDcEC0728DD635e4AbF7c",
  // Stablecoins
  USDT: "0xed0103a53069a347ed40290e0a069b46fd50ba05",
  USDC: "0xf63c7CC79CD0b76399E56a432cd2aF9eD36D8740",
  // Cross-chain bridged assets
  BTC:  "0x8d5e064d2ef44c29ee349e71cf70f751ecd62892",
  ETH:  "0xb95b5953ff8ee5d5d9818cdbefe363ff2191318c",
  // Community / hackathon tokens (liquid pools exist but smaller)
  DEEPSEEKR1: "0x3af1c220228e643d2d9661a09e1dca64dbc095ea",
  DOGE:       "0x88d749370d9af8dfd3c6f32b9b4a51b52566f7d7",
  SPLOPENDAT: "0xd6014a4b6c3aaf4da2d3db3bb8f2335eab5f3100",
  SAT:        "0xaca81fe7b7d655ce9e8e32fca64086ab964ae2f2",
  ZIMAGE:     "0xe9f94f17f885bc75cb0f0c9a7fb4c3f927cf99cd",
  L2SCAN:     "0x773e1efa90f8025374083933377f61aa8fdbc4a2",
  WAWA:       "0x712a1d02dedd5d23113719a31f31686f03b5de1a",
  CUA:        "0xbb2778bc7ed302d046c0eee2c0c675c312cecc2f",
} as const;

export type TokenSymbol = keyof typeof TESTNET_TOKENS;

export const DEFAULT_POOL_FEE = 3000;

// All pairs confirmed to have non-zero liquidity on Galileo (fee=3000)
export const LIQUID_PAIRS: Array<{ tokenIn: TokenSymbol; tokenOut: TokenSymbol }> = [
  { tokenIn: "WOGN", tokenOut: "USDT" },
  { tokenIn: "BTC",  tokenOut: "USDT" },
  { tokenIn: "ETH",  tokenOut: "USDT" },
  { tokenIn: "WOGN", tokenOut: "DEEPSEEKR1" },
  { tokenIn: "WOGN", tokenOut: "DOGE" },
  { tokenIn: "WOGN", tokenOut: "SPLOPENDAT" },
  { tokenIn: "WOGN", tokenOut: "SAT" },
  { tokenIn: "WOGN", tokenOut: "ZIMAGE" },
  { tokenIn: "WOGN", tokenOut: "L2SCAN" },
  { tokenIn: "WOGN", tokenOut: "WAWA" },
  { tokenIn: "WOGN", tokenOut: "CUA" },
];

const FACTORY_ABI = [
  "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)",
];

export async function poolExists(
  provider: JsonRpcProvider,
  tokenA: string,
  tokenB: string,
  fee: number = DEFAULT_POOL_FEE,
): Promise<boolean> {
  const factory = new Contract(ZER0_FACTORY, FACTORY_ABI, provider);
  const pool = await factory["getPool"](tokenA, tokenB, fee) as string;
  return pool !== ZeroAddress;
}

export interface LivePair {
  tokenIn: TokenSymbol;
  tokenOut: TokenSymbol;
  poolAddress: string;
}

export async function getLiquidPairs(provider: JsonRpcProvider): Promise<LivePair[]> {
  const factory = new Contract(ZER0_FACTORY, FACTORY_ABI, provider);
  const results = await Promise.all(
    LIQUID_PAIRS.map(async ({ tokenIn, tokenOut }) => {
      const pool = await factory["getPool"](
        TESTNET_TOKENS[tokenIn],
        TESTNET_TOKENS[tokenOut],
        DEFAULT_POOL_FEE,
      ) as string;
      return pool !== ZeroAddress ? { tokenIn, tokenOut, poolAddress: pool } : null;
    }),
  );
  return results.filter((r): r is LivePair => r !== null);
}

export interface SwapParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  recipient: string;
  deadline: number;
  fee: number;
}

export function buildSwapCalldata(params: SwapParams): string {
  const iface = new Interface(abi as never[]);
  return iface.encodeFunctionData("exactInputSingle", [
    {
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      fee: params.fee,
      recipient: params.recipient,
      deadline: BigInt(params.deadline),
      amountIn: params.amountIn,
      amountOutMinimum: params.minAmountOut,
      sqrtPriceLimitX96: 0n,
    },
  ]);
}
