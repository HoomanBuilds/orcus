import { AbiCoder, Contract, JsonRpcProvider, Wallet, zeroPadValue } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import { env } from "./env.js";
import { resolveChain } from "./chains.js";
import { decryptIntent } from "./crypto/ecies.js";
import { sealedDecide } from "./tee/sealedDecide.js";
import { writeReceipt } from "./storage/writeReceipt.js";
import { buildMarketSnapshot } from "./indicators.js";
import { buildDecisionReceipt, type StrategyTrail } from "./receipt.js";
import { isStrategy } from "./strategy/schema.js";
import { evaluateStrategy } from "./strategy/evaluate.js";
import { buildIndicators } from "./strategy/indicators-adapter.js";
import { narrate } from "./strategy/narrate.js";
import { signExecParams } from "./sign/execParams.js";
import { getOgPriceScaled } from "./price/binance.js";
import { buildPythPriceUpdate } from "./price/pyth.js";
import vaultAbi from "./abi/strategyVault.json" with { type: "json" };

const TEE_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";
const ZG_RPC = process.env.ZG_RPC ?? "https://evmrpc-testnet.0g.ai"; // 0G Storage settles on Galileo, not the trading chain

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
  const zgWallet = chain.rpc === ZG_RPC ? wallet : new Wallet(env.agentPk, new JsonRpcProvider(ZG_RPC));

  log("boot", `chain=${chain.name} (${chain.chainId}) vault=${chain.vault}`);
  log("boot", `agent=${wallet.address}`);
  log("boot", `settlement token = ${chain.usdc} | priceMode=${chain.priceMode}`);

  const settlementToken = chain.usdc;

  // Watchdog
  setInterval(async () => {
    try { await provider.getBlockNumber(); }
    catch (e) { err("watchdog", "RPC unreachable - exiting for restart", e); process.exit(1); }
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
      const plain = decryptIntent<unknown>(env.agentEciesSk, intent.encryptedGoal);

      log("market", "building structured snapshot...");
      const market = await buildMarketSnapshot(chain.binanceSymbol, chain.coingeckoId);
      const mkt = JSON.parse(market) as { price?: number; trend?: string; indicators?: { rsi14?: number | null } };
      log("market", `price=${mkt.price} trend=${mkt.trend} rsi14=${mkt.indicators?.rsi14 ?? "n/a"}`);

      let action: string;
      let reason: string;
      let strategyTrail: StrategyTrail | undefined;

      if (isStrategy(plain)) {
        // Typed strategy: code computes indicators + evaluates conditions (authoritative);
        // the sealed AI only writes the reason (with code fallback).
        log("strategy", `typed strategy: ${plain.conditions.length} condition(s) logic=${plain.logic}`);
        const ind = await buildIndicators(chain.binanceSymbol, chain.coingeckoId);
        const ev = evaluateStrategy(plain, ind);
        log("strategy", `code verdict=${ev.action} [${ev.evaluated.map((e) => `${e.desc}:${e.pass ? "✓" : "✗"}`).join(", ")}]`);
        const narration = await narrate(chain.zgServiceUrl, chain.zgApiSecret, chain.zgModel, plain, ev);
        action = ev.action;
        reason = narration.reason;
        strategyTrail = { conditions: plain.conditions, logic: plain.logic, evaluated: ev.evaluated, action: ev.action, reason: narration.reason, aiReason: narration.aiReason };
      } else {
        // Legacy free-text {goal}: one-shot sealed decision.
        const legacy = plain as { goal?: string };
        log("decrypt", `legacy free-text goal="${legacy.goal ?? ""}"`);
        const decision = await sealedDecide(chain.zgServiceUrl, chain.zgApiSecret, chain.zgModel, JSON.stringify(plain), market);
        action = decision.action;
        reason = decision.reason;
      }
      log("tee", `action=${action} reason="${reason}"`);

      if (action !== "EXECUTE") {
        log("decision", "WAIT - skipping execution");
        return;
      }

      // Build the fresh price update applied atomically inside executeTrade.
      let priceScaled: bigint | null = null;
      let priceUpdate = "0x";
      let priceUpdateValue = 0n;
      if (chain.priceMode === "mock") {
        priceScaled = await getOgPriceScaled(chain.binanceSymbol, chain.coingeckoId, chain.usdcDecimals);
        priceUpdate = AbiCoder.defaultAbiCoder().encode(["uint256"], [priceScaled]);
      }
      const oracleAddr = await vault["oracle"]() as string;
      if (chain.priceMode === "pyth") {
        const built = await buildPythPriceUpdate(provider, wallet, oracleAddr);
        priceUpdate = built.priceUpdate;
        priceUpdateValue = built.value;
        log("price", `pyth update fetched (fee=${priceUpdateValue} wei, mode=pyth)`);
      }
      log("price", `0G/USD=${priceScaled?.toString() ?? "n/a"} (mode=${chain.priceMode})`);

      log("storage", "writing decision receipt to 0G Storage...");
      const receipt = buildDecisionReceipt({
        chainKey: chain.key,
        chainId: chain.chainId,
        user,
        ts: Date.now(),
        marketJson: market,
        oracleMode: chain.priceMode,
        oracleAddress: oracleAddr,
        priceScaled: priceScaled === null ? null : priceScaled.toString(),
        teeProvider: TEE_PROVIDER,
        action,
        reason,
        strategy: strategyTrail,
      });
      const receiptHashRaw = await writeReceipt(
        indexer as never,
        null,
        zgWallet,
        receipt,
        ZG_RPC,
      );
      const raw = receiptHashRaw.startsWith("0x") ? receiptHashRaw : `0x${receiptHashRaw}`;
      const rawBytes = Buffer.from(raw.replace(/^0x/, ""), "hex");
      if (rawBytes.length > 32) throw new Error(`rootHash too long: ${rawBytes.length} bytes`);
      const receiptHash = zeroPadValue(raw, 32) as `0x${string}`;
      log("storage", `receipt=${receiptHash}`);

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

      log("swap", `executeTrade settle=${tokenOut} (${chain.usdcDecimals}dec) fee=${chain.poolFee} nonce=${nonce}`);
      const tx = await vault["executeTrade"](params, signature, priceUpdate, { value: priceUpdateValue });
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
