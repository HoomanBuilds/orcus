import { Transaction } from "@mysten/sui/transactions";
import { resolveSuiConfig } from "../sui/config.js";
import { resolveSuiKeys } from "../sui/keys.js";
import { executeSuiTrade } from "../sui/execute.js";
import type { SuiExecParams } from "../sign/suiExec.js";
import { createSuiClient, parseSuiU64, requireSuccessfulSuiTransaction } from "../sui/client.js";

async function main() {
  const cfg = resolveSuiConfig();
  const { agentKeypair, attestorKeypair } = resolveSuiKeys();
  const client = createSuiClient(cfg.grpcUrl);
  const user = agentKeypair.toSuiAddress();

  const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=SUIUSDT");
  const price = Number(((await res.json()) as { price: string }).price);
  const priceScaled = BigInt(Math.round(price * 1000));
  console.log(`SUI/USD=${price} priceScaled=${priceScaled}`);

  const tx = new Transaction();
  tx.setSender(user);
  tx.moveCall({ target: `${cfg.packageId}::vault::nonce_of`, arguments: [tx.object(cfg.vaultId), tx.pure.address(user)] });
  const simulation = await client.simulateTransaction({
    transaction: tx,
    checksEnabled: false,
    include: { commandResults: true },
  });
  requireSuccessfulSuiTransaction(simulation);
  const nonceBytes = simulation.commandResults?.[0]?.returnValues[0]?.bcs;
  if (!nonceBytes) throw new Error("nonce_of returned no value");
  const nonce = parseSuiU64(nonceBytes);
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
