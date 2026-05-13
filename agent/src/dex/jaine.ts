import { Interface, JsonRpcProvider, Wallet } from "ethers";
import abi from "./jaine.abi.json" with { type: "json" };

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
  const data = buildSwapCalldata(params);
  const tx = await wallet.sendTransaction({ to: router, data, value: 0n });
  const receipt = await tx.wait();
  return receipt!.hash;
}
