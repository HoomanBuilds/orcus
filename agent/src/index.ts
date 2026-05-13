import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
import { env } from "./env.js";
import { decryptIntent } from "./crypto/ecies.js";
import { sealedDecide } from "./tee/sealedDecide.js";
import { writeReceipt } from "./storage/writeReceipt.js";
import { getMarketSnapshot } from "./market.js";
import vaultAbi from "./abi/strategyVault.json" with { type: "json" };

const TEE_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";

async function main() {
  const provider = new JsonRpcProvider(env.rpc);
  const wallet = new Wallet(env.agentPk, provider);
  const vault = new Contract(env.vault, vaultAbi as never[], wallet);
  const broker = await createZGComputeNetworkBroker(wallet);
  const indexer = new Indexer(env.storageIndexer);

  console.log("orcus agent listening on vault", env.vault);

  vault.on("IntentSet", async (user: string, amount: bigint) => {
    try {
      console.log("intent from", user, "amount", amount.toString());
      const intent = await vault["intents"](user) as { encryptedGoal: string };
      const plain = decryptIntent<{ goal: string; maxSlippage: number }>(
        env.agentEciesSk,
        intent.encryptedGoal,
      );
      const market = await getMarketSnapshot();
      const decision = await sealedDecide(broker as never, TEE_PROVIDER, JSON.stringify(plain), market);

      if (decision.action !== "EXECUTE") {
        console.log("WAIT:", decision.reason);
        return;
      }

      const receiptHash = await writeReceipt(
        indexer as never,
        ZgFile as never,
        wallet,
        { user, decision, ts: Date.now() },
        env.rpc,
      );

      const tx = await vault["executeTradeWithProof"](
        user,
        "0x",
        "0x",
        receiptHash,
      );
      const r = await (tx as { wait(): Promise<{ hash: string }> }).wait();
      console.log("executed", r?.hash);
    } catch (e) {
      console.error("loop error", e);
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
