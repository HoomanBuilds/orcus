import { Contract, JsonRpcProvider, Wallet, zeroPadValue } from "ethers";
import { Indexer } from "@0glabs/0g-ts-sdk";
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

function log(tag: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${tag}] ${msg}`);
}

function err(tag: string, msg: string, e?: unknown) {
  console.error(`[${new Date().toISOString()}] [${tag}] ${msg}`, e ?? "");
}

async function main() {
  const provider = new JsonRpcProvider(env.rpc);
  const wallet = new Wallet(env.agentPk, provider);
  const vault = new Contract(env.vault, vaultAbi as never[], wallet);
  const indexer = new Indexer(env.storageIndexer);

  log("boot", `vault=${env.vault}`);
  log("boot", `agent=${wallet.address}`);

  // Watchdog
  setInterval(async () => {
    try { await provider.getBlockNumber(); }
    catch (e) { err("watchdog", "RPC unreachable — exiting for restart", e); process.exit(1); }
  }, 30_000);

  const livePairs = await getLiquidPairs(provider).catch(() => []);
  log("boot", `live pools: ${livePairs.length > 0 ? livePairs.map(p => `${p.tokenIn}→${p.tokenOut}`).join(", ") : "(using OrcusRouter)"}`);

  const inFlight = new Set<string>();
  const seen = new Set<string>();

  async function processIntentEvent(user: string, amount: bigint, txHash: string) {
    if (seen.has(txHash)) return;
    seen.add(txHash);
    if (inFlight.has(user)) {
      log("skip", `${user} already in-flight`);
      return;
    }
    inFlight.add(user);
    try {
      log("intent", `user=${user} amount=${amount.toString()}`);

      const intent = await vault["intents"](user) as { encryptedGoal: string; maxSlippage: bigint };
      const plain = decryptIntent<{ goal: string; tokenOut?: string; maxSlippage: number }>(
        env.agentEciesSk,
        intent.encryptedGoal,
      );
      log("decrypt", `goal="${plain.goal}" tokenOut=${plain.tokenOut ?? "USDT"}`);

      log("market", "fetching snapshot...");
      const market = await getMarketSnapshot();
      const mkt = JSON.parse(market) as { price?: number; trend?: string };
      log("market", `price=${mkt.price} trend=${mkt.trend}`);

      log("tee", "calling sealed inference...");
      const decision = await sealedDecide(null, TEE_PROVIDER, JSON.stringify(plain), market);
      log("tee", `action=${decision.action} reason="${decision.reason}"`);

      if (decision.action !== "EXECUTE") {
        log("tee", "decision is WAIT — skipping execution");
        return;
      }

      log("storage", "writing receipt to 0G Storage...");
      const receiptHashRaw = await writeReceipt(
        indexer as never,
        null,
        wallet,
        { user, decision, ts: Date.now() },
        env.rpc,
      );
      const raw = receiptHashRaw.startsWith("0x") ? receiptHashRaw : `0x${receiptHashRaw}`;
      const rawBytes = Buffer.from(raw.replace(/^0x/, ""), "hex");
      if (rawBytes.length > 32) throw new Error(`rootHash too long: ${rawBytes.length} bytes`);
      const receiptHash = zeroPadValue(raw, 32) as `0x${string}`;
      log("storage", `receipt=${receiptHash}`);

      const wantedSymbol = (plain.tokenOut ?? "USDC") as keyof typeof TESTNET_TOKENS;
      const tokenOut = TESTNET_TOKENS[wantedSymbol] ?? TESTNET_TOKENS.USDC;

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const minAmountOut = 0n;

      log("swap", `WOGN→${wantedSymbol} amount=${amount} minOut=${minAmountOut}`);

      const tradeData = buildSwapCalldata({
        tokenIn: TESTNET_TOKENS.WOGN,
        tokenOut: tokenOut,
        amountIn: amount,
        minAmountOut,
        recipient: user,
        deadline,
        fee: DEFAULT_POOL_FEE,
      });

      log("swap", "sending executeTradeWithProof...");
      const tx = await vault["executeTradeWithProof"](user, tradeData, "0x", receiptHash, minAmountOut);
      const r = await (tx as { wait(): Promise<{ hash: string }> }).wait();
      log("swap", `executed tx=${r?.hash}`);
    } catch (e) {
      err("error", `failed for user=${user}`, e);
    } finally {
      inFlight.delete(user);
    }
  }

  const intentSetTopic = vault.interface.getEvent("IntentSet")!.topicHash;
  const currentBlock = await provider.getBlockNumber();
  let fromBlock = currentBlock + 1;

  // Backfill: scan in 500-block chunks (Galileo RPC silently caps large ranges)
  const CHUNK = 500;
  const LOOKBACK = 5_000;
  log("backfill", `scanning last ${LOOKBACK} blocks in ${CHUNK}-block chunks`);
  const usersFound = new Set<string>();
  try {
    for (let hi = currentBlock; hi > currentBlock - LOOKBACK; hi -= CHUNK) {
      const lo = Math.max(0, hi - CHUNK + 1);
      const pastLogs = await provider.getLogs({
        address: env.vault,
        topics: [intentSetTopic],
        fromBlock: lo,
        toBlock: hi,
      });
      if (pastLogs.length > 0) log("backfill", `found ${pastLogs.length} event(s) in blocks ${lo}..${hi}`);
      for (const log_ of pastLogs) {
        const parsed = vault.interface.parseLog(log_);
        if (!parsed) continue;
        const user = parsed.args[0] as string;
        if (usersFound.has(user)) continue;
        usersFound.add(user);
        const onChain = await vault["intents"](user) as { active: boolean; depositAmount: bigint };
        if (!onChain.active) { log("backfill", `${user} already settled`); continue; }
        log("backfill", `active intent for ${user}`);
        await processIntentEvent(user, onChain.depositAmount, log_.transactionHash);
      }
    }
  } catch (e) {
    err("backfill", "scan failed", e);
  }

  // Fallback: directly check agent wallet (covers case where agent == user in testing)
  if (!usersFound.has(wallet.address)) {
    const selfIntent = await vault["intents"](wallet.address) as { active: boolean; depositAmount: bigint };
    if (selfIntent.active) {
      log("backfill", `direct check: active intent on agent wallet ${wallet.address}`);
      await processIntentEvent(wallet.address, selfIntent.depositAmount, `self-${Date.now()}`);
    }
  }

  log("poll", "starting 4s poll loop for new IntentSet events");
  setInterval(async () => {
    try {
      const toBlock = await provider.getBlockNumber();
      if (toBlock < fromBlock) return;
      const logs = await provider.getLogs({
        address: env.vault,
        topics: [intentSetTopic],
        fromBlock,
        toBlock,
      });
      if (logs.length > 0) log("poll", `${logs.length} new event(s) in blocks ${fromBlock}..${toBlock}`);
      for (const log_ of logs) {
        const parsed = vault.interface.parseLog(log_);
        if (!parsed) continue;
        const user = parsed.args[0] as string;
        const amount = parsed.args[1] as bigint;
        await processIntentEvent(user, amount, log_.transactionHash);
      }
      fromBlock = toBlock + 1;
    } catch (e) {
      err("poll", "poll error", e);
    }
  }, 4_000);
}

main().catch((e) => {
  err("fatal", "unhandled error", e);
  process.exit(1);
});
