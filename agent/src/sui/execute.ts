import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { signSuiExec, type SuiExecParams } from "../sign/suiExec.js";
import type { SuiConfig } from "./config.js";

// Sui counterpart of the EVM agent's executeTrade call. The vault applies the price
// atomically and builds the swap; the agent only supplies validated params + the
// attestor's ed25519 signature (verified on-chain). `agentKeypair` holds the AgentCap
// and pays gas; `attestorKeypair` is the registered attestor (v1: same key; mainnet: TEE key).
// `newPriceScaled` is the fresh price (USD * 1e6) the mock oracle applies this trade;
// on a real Sui deployment a Pyth-on-Sui price object replaces it.
export async function executeSuiTrade(
  client: SuiJsonRpcClient,
  agentKeypair: Ed25519Keypair,
  attestorKeypair: Ed25519Keypair,
  cfg: SuiConfig,
  p: SuiExecParams,
  newPriceScaled: bigint,
): Promise<string> {
  const { signature } = await signSuiExec(attestorKeypair, p);
  const receiptBytes = Array.from(
    Uint8Array.from(Buffer.from(p.receiptHash.replace(/^0x/, ""), "hex")),
  );

  const tx = new Transaction();
  tx.moveCall({
    target: `${cfg.packageId}::vault::execute_trade`,
    arguments: [
      tx.object(cfg.agentCapId),
      tx.object(cfg.vaultId),
      tx.object(cfg.poolId),
      tx.object(cfg.oracleId),
      tx.object(SUI_CLOCK_OBJECT_ID),
      tx.pure.address(p.user),
      tx.pure.u128(newPriceScaled),
      tx.pure.u64(p.agentMinOut),
      tx.pure.u64(p.deadlineMs),
      tx.pure.vector("u8", receiptBytes),
      tx.pure.u64(p.nonce),
      tx.pure.vector("u8", Array.from(signature)),
    ],
  });

  const res = await client.signAndExecuteTransaction({
    signer: agentKeypair,
    transaction: tx,
  });
  return res.digest;
}
