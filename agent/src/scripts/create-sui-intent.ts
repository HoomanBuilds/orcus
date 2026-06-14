import { PrivateKey } from "eciesjs";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Transaction } from "@mysten/sui/transactions";
import { env } from "../env.js";
import { encryptIntent } from "../crypto/ecies.js";
import { resolveSuiConfig } from "../sui/config.js";
import { resolveSuiKeys } from "../sui/keys.js";

// Local test helper: deposits an encrypted intent on the Sui vault so the Sui
// listener (src/sui/index.ts) has something to process. Encrypts to the agent's
// own ECIES key (derived from AGENT_ECIES_PRIVATE_KEY) so the agent can decrypt it.
async function main() {
  const cfg = resolveSuiConfig();
  const { agentKeypair } = resolveSuiKeys();
  const client = new SuiJsonRpcClient({ url: cfg.rpcUrl, network: "testnet" });

  const sk = new PrivateKey(Buffer.from(env.agentEciesSk.replace(/^0x/, ""), "hex"));
  const agentEciesPub = `0x${sk.publicKey.toHex()}`;

  const goal = process.env.SUI_TEST_GOAL ?? "swap now";
  const encrypted = encryptIntent(agentEciesPub, { goal });
  const egBytes = Array.from(Buffer.from(encrypted.replace(/^0x/, ""), "hex"));
  const depositMist = BigInt(process.env.SUI_TEST_DEPOSIT_MIST ?? "100000000"); // 0.1 SUI
  const maxSlippageBps = BigInt(process.env.SUI_TEST_SLIPPAGE_BPS ?? "500");

  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [depositMist]);
  tx.moveCall({
    target: `${cfg.packageId}::vault::deposit`,
    arguments: [tx.object(cfg.vaultId), coin, tx.pure.vector("u8", egBytes), tx.pure.u64(maxSlippageBps)],
  });

  const res = await client.signAndExecuteTransaction({
    signer: agentKeypair,
    transaction: tx,
    options: { showEffects: true },
  });
  console.log(`deposit digest: ${res.digest}`);
  console.log(`status: ${res.effects?.status?.status}`);
  console.log(`user (depositor): ${agentKeypair.toSuiAddress()}`);
  console.log(`goal="${goal}" deposit=${depositMist} MIST slippage=${maxSlippageBps}bps`);
}

main().catch((e) => {
  console.error("create-sui-intent failed:", e);
  process.exit(1);
});
