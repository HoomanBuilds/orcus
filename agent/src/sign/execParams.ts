import { Wallet } from "ethers";

export interface ExecParams {
  user: string;
  tokenOut: string;
  fee: number;
  agentMinOut: bigint;
  deadline: number;
  receiptHash: string;
  nonce: bigint;
}

const TYPES = {
  ExecParams: [
    { name: "user", type: "address" },
    { name: "tokenOut", type: "address" },
    { name: "fee", type: "uint24" },
    { name: "agentMinOut", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "receiptHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
  ],
};

export async function signExecParams(
  wallet: Wallet,
  chainId: number,
  vault: string,
  p: ExecParams,
): Promise<string> {
  const domain = { name: "Orcus", version: "1", chainId, verifyingContract: vault };
  return wallet.signTypedData(domain, TYPES, p);
}
