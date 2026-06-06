import { Contract, JsonRpcProvider, Wallet, zeroPadValue } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import { env } from "./env.js";
import { resolveChain } from "./chains.js";
import { decryptIntent } from "./crypto/ecies.js";
import { sealedDecide } from "./tee/sealedDecide.js";
import { writeReceipt } from "./storage/writeReceipt.js";
import { getMarketSnapshot } from "./market.js";
import { signExecParams } from "./sign/execParams.js";
import { getOgPriceScaled } from "./price/binance.js";
import vaultAbi from "./abi/strategyVault.json" with { type: "json" };

const TEE_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";

function log(tag: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [${tag}] ${msg}`);
}

function err(tag: string, msg: string, e?: unknown) {
  console.error(`[${new Date().toISOString()}] [${tag}] ${msg}`, e ?? "");
}

async function main() {
  const chain = resolveChain();
  const provider = new JsonRpcProvider(chain.rpc);
  const wallet = new Wallet(env.agentPk, provider);
  const vault = new Contract(chain.vault, vaultAbi as never[], wallet);
  const indexer = new Indexer(env.storageIndexer);

  log("boot", `chain=${chain.name} (${chain.chainId}) vault=${chain.vault}`);
  log("boot", `agent=${wallet.address}`);
  log("boot", `settlement token = ${chain.usdc} | priceMode=${chain.priceMode}`);

  const settlementToken = chain.usdc;

  // Watchdog
  setInterval(async () => {
    try { await provider.getBlockNumber(); }
    catch (e) { err("watchdog", "RPC unreachable — exiting for restart", e); process.exit(1); }
  }, 30_000);

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

      const intent = await vault["intents"](user) as { encryptedGoal: string };
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
        chain.rpc,
      );
      const raw = receiptHashRaw.startsWith("0x") ? receiptHashRaw : `0x${receiptHashRaw}`;
      const rawBytes = Buffer.from(raw.replace(/^0x/, ""), "hex");
      if (rawBytes.length > 32) throw new Error(`rootHash too long: ${rawBytes.length} bytes`);
      const receiptHash = zeroPadValue(raw, 32) as `0x${string}`;
      log("storage", `receipt=${receiptHash}`);

      if (chain.priceMode === "agent-push") {
        const oracleAddr = await vault["oracle"]() as string;
        const oracle = new Contract(oracleAddr, ["function setPrice(uint256)"], wallet);
        const priceScaled = await getOgPriceScaled();
        log("price", `pushing 0G/USD=${priceScaled.toString()} to oracle ${oracleAddr}`);
        await (await oracle["setPrice"](priceScaled) as { wait(): Promise<unknown> }).wait();
      }

      // The mock router settles only in the deployed oUSDC; the user's tokenOut
      // preference is cosmetic on the mock (real multi-token only on real DEX chains).
      const requested = plain.tokenOut ?? "USDC";
      const tokenOut = settlementToken;

      const deadline = Math.floor(Date.now() / 1000) + 300;
      const nonce = await vault["intentNonce"](user) as bigint;
      const params = {
        user,
        tokenOut,
        fee: chain.poolFee,
        agentMinOut: 0n,
        deadline,
        receiptHash,
        nonce,
      };
      const signature = await signExecParams(wallet, chain.chainId, chain.vault, params);

      log("swap", `executeTrade requested=${requested} settle=oUSDC(${tokenOut}) nonce=${nonce}`);
      const tx = await vault["executeTrade"](params, signature);
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
  const LOOKBACK = chain.lookbackBlocks;
  log("backfill", `scanning last ${LOOKBACK} blocks in ${CHUNK}-block chunks`);
  const usersFound = new Set<string>();
  try {
    for (let hi = currentBlock; hi > currentBlock - LOOKBACK; hi -= CHUNK) {
      const lo = Math.max(0, hi - CHUNK + 1);
      const pastLogs = await provider.getLogs({
        address: chain.vault,
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
        const onChain = await vault["intents"](user) as { active: boolean; amountIn: bigint };
        if (!onChain.active) { log("backfill", `${user} already settled`); continue; }
        log("backfill", `active intent for ${user}`);
        await processIntentEvent(user, onChain.amountIn, log_.transactionHash);
      }
    }
  } catch (e) {
    err("backfill", "scan failed", e);
  }

  // Fallback: directly check agent wallet (covers case where agent == user in testing)
  if (!usersFound.has(wallet.address)) {
    const selfIntent = await vault["intents"](wallet.address) as { active: boolean; amountIn: bigint };
    if (selfIntent.active) {
      log("backfill", `direct check: active intent on agent wallet ${wallet.address}`);
      await processIntentEvent(wallet.address, selfIntent.amountIn, `self-${Date.now()}`);
    }
  }

  log("poll", "starting 4s poll loop for new IntentSet events");
  setInterval(async () => {
    try {
      const toBlock = await provider.getBlockNumber();
      if (toBlock < fromBlock) return;
      const logs = await provider.getLogs({
        address: chain.vault,
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
  }, chain.pollIntervalMs);
}

main().catch((e) => {
  err("fatal", "unhandled error", e);
  process.exit(1);
});
