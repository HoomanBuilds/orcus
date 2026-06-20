import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { resolveSuiConfig } from "../sui/config.js";
import { resolveSuiKeys } from "../sui/keys.js";
import { executeSuiTrade } from "../sui/execute.js";
import type { SuiExecParams } from "../sign/suiExec.js";

async function main() {
  const cfg = resolveSuiConfig();
  const { agentKeypair, attestorKeypair } = resolveSuiKeys();
  const client = new SuiJsonRpcClient({ url: cfg.rpcUrl, network: "testnet" });
  const user = agentKeypair.toSuiAddress();

  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SUIUSDT");
  const price = Number(((await res.json()) as { price: string }).price);
  const priceScaled = BigInt(Math.round(price * 1000));
  console.log(`SUI/USD=${price} priceScaled=${priceScaled}`);

  const tx = new Transaction();
  tx.moveCall({ target: `${cfg.packageId}::vault::nonce_of`, arguments: [tx.object(cfg.vaultId), tx.pure.address(user)] });
  const ins = await client.devInspectTransactionBlock({ sender: user, transactionBlock: tx });
  const rb = ins.results?.[0]?.returnValues?.[0]?.[0] ?? [0];
  let nonce = 0n; for (let i = rb.length - 1; i >= 0; i--) nonce = (nonce << 8n) + BigInt(rb[i]);
  console.log("nonce:", nonce.toString());

  const params: SuiExecParams = {
    user,
    agentMinOut: 0n,
    deadlineMs: BigInt(Date.now() + 300_000),
    receiptHash: "0x" + "11".repeat(32),
    nonce,
  };
  const digest = await executeSuiTrade(client, agentKeypair, attestorKeypair, cfg, params, priceScaled);
  console.log("EXECUTED digest:", digest);
}
main().catch((e) => { console.error("FAILED:", String(e)); process.exit(1); });
