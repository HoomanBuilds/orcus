import { Contract, Interface, JsonRpcProvider, Wallet } from "ethers";
import abi from "./jaine.abi.json" with { type: "json" };

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];

export const TESTNET_TOKENS = {
  USDT: "0x3ec8a8705be1d5ca90066b37ba62c4183b024ebf",
  ETH:  "0x0fe9b43625fa7edd663adcec0728dd635e4abf7c",
  BTC:  "0x36f6414ff1df609214ddaba71c84f18bcf00f67d",
} as const;

export const DEFAULT_POOL_FEE = 3000;

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

export async function executeSwap(
  rpc: string,
  signer: Wallet,
  router: string,
  params: SwapParams,
): Promise<string> {
  const provider = new JsonRpcProvider(rpc);
  const wallet = signer.connect(provider);

  // ERC20 approval required before calling exactInputSingle
  const token = new Contract(params.tokenIn, ERC20_ABI, wallet);
  await (await token["approve"](router, params.amountIn)).wait();

  const data = buildSwapCalldata(params);
  const tx = await wallet.sendTransaction({ to: router, data, value: 0n });
  const receipt = await tx.wait();
  return receipt!.hash;
}
