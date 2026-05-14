import { Contract, JsonRpcProvider, Wallet, zeroPadValue } from "ethers";
import { createZGComputeNetworkBroker } from "@0glabs/0g-serving-broker";
import { ZgFile, Indexer } from "@0glabs/0g-ts-sdk";
import { env } from "./env.js";
import { decryptIntent } from "./crypto/ecies.js";
import { sealedDecide } from "./tee/sealedDecide.js";
import { writeReceipt } from "./storage/writeReceipt.js";
import { getMarketSnapshot } from "./market.js";
import {
  buildSwapCalldata,
  getLiquidPairs,
  TESTNET_TOKENS,
  DEFAULT_POOL_FEE,
} from "./dex/jaine.js";
import vaultAbi from "./abi/strategyVault.json" with { type: "json" };

const TEE_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";

async function main() {
  const provider = new JsonRpcProvider(env.rpc);
  const wallet = new Wallet(env.agentPk, provider);
  const vault = new Contract(env.vault, vaultAbi as never[], wallet);
  const broker = await createZGComputeNetworkBroker(wallet);
  const indexer = new Indexer(env.storageIndexer);

  // Log all live pools at startup
  const livePairs = await getLiquidPairs(provider);
  console.log("orcus agent listening on vault", env.vault);
  console.log(
    "live pools on Zer0:",
    livePairs.map((p) => `${p.tokenIn}→${p.tokenOut} (${p.poolAddress})`),
  );

  // Primary swap: vault holds native OG → wrap → USDT
  const primaryPair = livePairs.find(
    (p) => p.tokenIn === "WOGN" && p.tokenOut === "USDT",
  );
  if (!primaryPair) {
    throw new Error("WOGN/USDT pool not found on Zer0 — cannot proceed");
  }

  vault.on("IntentSet", async (user: string, amount: bigint) => {
    try {
      console.log("intent from", user, "amount", amount.toString());
      const intent = await vault["intents"](user) as { encryptedGoal: string; maxSlippage: bigint };
      const plain = decryptIntent<{ goal: string; tokenOut?: string; maxSlippage: number }>(
        env.agentEciesSk,
        intent.encryptedGoal,
      );
      const market = await getMarketSnapshot();
      const decision = await sealedDecide(broker as never, TEE_PROVIDER, JSON.stringify(plain), market);

      if (decision.action !== "EXECUTE") {
        console.log("WAIT:", decision.reason);
        return;
      }

      const receiptHashRaw = await writeReceipt(
        indexer as never,
        ZgFile as never,
        wallet,
        { user, decision, ts: Date.now() },
        env.rpc,
      );

      const receiptHash = zeroPadValue(
        receiptHashRaw.startsWith("0x") ? receiptHashRaw : `0x${receiptHashRaw}`,
        32,
      ) as `0x${string}`;

      // Resolve tokenOut: use intent preference if a live pool exists, else fall back to USDT
      const wantedSymbol = (plain.tokenOut ?? "USDT") as keyof typeof TESTNET_TOKENS;
      const resolvedPair =
        livePairs.find((p) => p.tokenIn === "WOGN" && p.tokenOut === wantedSymbol) ??
        primaryPair;

      if (resolvedPair.tokenOut !== wantedSymbol) {
        console.warn(`no live pool for WOGN→${wantedSymbol}, falling back to USDT`);
      }

      const deadline = Math.floor(Date.now() / 1000) + 300;
      // Apply maxSlippage from intent (bps): minAmountOut = amount * (10000 - slippage) / 10000
      const slippageBps = intent.maxSlippage ?? 50n;
      const minAmountOut = (amount * (10000n - slippageBps)) / 10000n;

      const tradeData = buildSwapCalldata({
        tokenIn: TESTNET_TOKENS.WOGN,
        tokenOut: TESTNET_TOKENS[resolvedPair.tokenOut],
        amountIn: amount,
        minAmountOut,
        recipient: user,
        deadline,
        fee: DEFAULT_POOL_FEE,
      });

      const tx = await vault["executeTradeWithProof"](
        user,
        tradeData,
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
