import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { resolveSuiConfig, SUI_TYPE } from "../sui/config.js";
import { resolveSuiKeys } from "../sui/keys.js";

/// Buys DEEP for swap fees from the whitelisted (0-fee) DEEP/SUI pool. DeepBook's
/// non-whitelisted pools (SUI/DBUSDC) charge fees in DEEP, which the agent splits a
/// little of per swap. The DEEP/SUI pool minimum order is 10 DEEP, so ~0.25 SUI buys
/// ~10 DEEP, enough for hundreds of swaps. Run again to top up when DEEP runs low.
async function main() {
  const cfg = resolveSuiConfig();
  const { agentKeypair } = resolveSuiKeys();
  const client = new SuiJsonRpcClient({ url: cfg.rpcUrl, network: "testnet" });
  const agent = agentKeypair.toSuiAddress();

  const spendMist = BigInt(process.env.DEEP_SPEND_MIST ?? "250000000");
  const minDeepOut = BigInt(process.env.DEEP_MIN_OUT ?? "9000000");

  const tx = new Transaction();
  const [quoteIn] = tx.splitCoins(tx.gas, [spendMist]);
  const zeroDeep = tx.moveCall({ target: "0x2::coin::zero", typeArguments: [cfg.deepType] });
  const [deepOut, suiRem, deepRem] = tx.moveCall({
    target: `${cfg.deepbookPkg}::pool::swap_exact_quote_for_base`,
    typeArguments: [cfg.deepType, SUI_TYPE],
    arguments: [tx.object(cfg.deepSuiPool), quoteIn, zeroDeep, tx.pure.u64(minDeepOut), tx.object(SUI_CLOCK_OBJECT_ID)],
  });
  tx.transferObjects([deepOut, suiRem, deepRem], tx.pure.address(agent));

  const res = await client.signAndExecuteTransaction({ signer: agentKeypair, transaction: tx, options: { showEffects: true } });
  console.log("acquire-deep digest:", res.digest, "status:", res.effects?.status?.status);
  const bal = await client.getBalance({ owner: agent, coinType: cfg.deepType });
  console.log("agent DEEP balance:", Number(bal.totalBalance) / 1e6, "DEEP");
}
main().catch((e) => { console.error("acquire-deep failed:", String(e)); process.exit(1); });
