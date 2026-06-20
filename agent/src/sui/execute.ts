import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { signSuiExec, type SuiExecParams } from "../sign/suiExec.js";
import { SUI_TYPE, type SuiConfig } from "./config.js";

// Sui counterpart of the EVM agent's executeTrade, composed in ONE PTB:
//   1. split a little DEEP (held by the agent, topped up via `npm run deep:acquire`) for the fee
//   2. vault.release_for_swap: AgentCap-gated, attestor-signed, applies the fresh price and
//      returns the user's SUI + a hot-potato ticket carrying the oracle floor
//   3. real DeepBook swap SUI -> DBUSDC, fee paid with the DEEP from step 1
//   4. vault.settle_swap: enforces the floor, sends DBUSDC to the user, emits TradeExecuted
// The vault never names the recipient/amount to the agent and the floor is enforced on-chain,
// so routing through DeepBook keeps the dark-pool guarantees while using real liquidity.
// NOTE: the SUI/DBUSDC pool has a 1 SUI min order size, so deposits must be >= 1 SUI.
export async function executeSuiTrade(
  client: SuiJsonRpcClient,
  agentKeypair: Ed25519Keypair,
  attestorKeypair: Ed25519Keypair,
  cfg: SuiConfig,
  p: SuiExecParams,
  newPriceScaled: bigint,
): Promise<string> {
  const { signature } = await signSuiExec(attestorKeypair, p);
  const receiptBytes = Array.from(Uint8Array.from(Buffer.from(p.receiptHash.replace(/^0x/, ""), "hex")));
  const agentAddr = agentKeypair.toSuiAddress();

  const deepCoins = await client.getCoins({ owner: agentAddr, coinType: cfg.deepType });
  if (deepCoins.data.length === 0) throw new Error("agent holds no DEEP for DeepBook fees; run `npm run deep:acquire`");

  const tx = new Transaction();
  const deepSrc = tx.object(deepCoins.data[0].coinObjectId);
  if (deepCoins.data.length > 1) {
    tx.mergeCoins(deepSrc, deepCoins.data.slice(1).map((c) => tx.object(c.coinObjectId)));
  }
  const deepFee = tx.splitCoins(deepSrc, [tx.pure.u64(cfg.deepFeePerSwap)]);

  const [userSui, ticket] = tx.moveCall({
    target: `${cfg.packageId}::vault::release_for_swap`,
    arguments: [
      tx.object(cfg.agentCapId),
      tx.object(cfg.vaultId),
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

  // SUI/DBUSDC is base=SUI, quote=DBUSDC: swap the user's base(SUI) for quote(DBUSDC).
  // min_out 0 here; the vault's settle_swap enforces the real oracle floor and reverts the PTB.
  const [userSuiRem, dbusdc, deepRem] = tx.moveCall({
    target: `${cfg.deepbookPkg}::pool::swap_exact_base_for_quote`,
    typeArguments: [SUI_TYPE, cfg.dbusdcType],
    arguments: [tx.object(cfg.suiDbusdcPool), userSui, deepFee, tx.pure.u64(0), tx.object(SUI_CLOCK_OBJECT_ID)],
  });

  tx.moveCall({
    target: `${cfg.packageId}::vault::settle_swap`,
    typeArguments: [cfg.dbusdcType],
    arguments: [ticket, dbusdc],
  });

  tx.transferObjects([userSuiRem, deepRem], tx.pure.address(agentAddr));

  const res = await client.signAndExecuteTransaction({ signer: agentKeypair, transaction: tx });
  return res.digest;
}
