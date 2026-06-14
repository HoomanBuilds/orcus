import { JsonRpcProvider, Wallet, zeroPadValue } from "ethers";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import { env } from "../env.js";
import { decryptIntent } from "../crypto/ecies.js";
import { sealedDecide } from "../tee/sealedDecide.js";
import { buildMarketSnapshot } from "../indicators.js";
import { buildDecisionReceipt } from "../receipt.js";
import { writeReceipt } from "../storage/writeReceipt.js";
import { resolveSuiConfig } from "./config.js";
import { resolveSuiKeys } from "./keys.js";
import { executeSuiTrade } from "./execute.js";
import type { SuiExecParams } from "../sign/suiExec.js";

const TEE_PROVIDER = "0x3feE5a4dd5FDb8a32dDA97Bed899830605dBD9D3";
const ZG_RPC = process.env.ZG_RPC ?? "https://evmrpc-testnet.0g.ai"; // 0G Storage settles on Galileo
const BINANCE_SYMBOL = process.env.SUI_BINANCE_SYMBOL ?? "SUIUSDT";
const COINGECKO_ID = process.env.SUI_COINGECKO_ID ?? "sui";
const POLL_MS = Number(process.env.SUI_POLL_INTERVAL_MS ?? 5000);

function log(tag: string, msg: string) {
  console.log(`[${new Date().toISOString()}] [sui:${tag}] ${msg}`);
}
function err(tag: string, msg: string, e?: unknown) {
  console.error(`[${new Date().toISOString()}] [sui:${tag}] ${msg}`, e ?? "");
}

function bytesToHex(v: unknown): string {
  if (Array.isArray(v)) return `0x${Buffer.from(v as number[]).toString("hex")}`;
  if (typeof v === "string") {
    if (v.startsWith("0x")) return v;
    return `0x${Buffer.from(v, "base64").toString("hex")}`;
  }
  throw new Error("unexpected byte field type");
}

async function main() {
  const cfg = resolveSuiConfig();
  const { agentKeypair, attestorKeypair } = resolveSuiKeys();
  const client = new SuiJsonRpcClient({ url: cfg.rpcUrl, network: "testnet" });
  const indexer = new Indexer(env.storageIndexer);
  const zgWallet = new Wallet(env.agentPk, new JsonRpcProvider(ZG_RPC));

  const zgServiceUrl = process.env.SUI_ZG_SERVICE_URL ?? process.env.ZG_SERVICE_URL ?? "";
  const zgApiSecret = process.env.SUI_ZG_API_SECRET ?? process.env.ZG_API_SECRET ?? "";
  const zgModel = process.env.SUI_ZG_MODEL ?? process.env.ZG_MODEL ?? "qwen/qwen2.5-omni-7b";

  log("boot", `vault=${cfg.vaultId} pkg=${cfg.packageId}`);
  log("boot", `agent=${agentKeypair.toSuiAddress()} attestor=${attestorKeypair.getPublicKey().toSuiAddress()}`);

  // Table object ids are stable; fetch once.
  const vaultObj = await client.getObject({ id: cfg.vaultId, options: { showContent: true } });
  const vfields = (vaultObj.data?.content as { fields?: Record<string, { fields: { id: { id: string } } }> } | undefined)?.fields;
  const intentsTableId = vfields?.intents?.fields?.id?.id;
  const noncesTableId = vfields?.nonces?.fields?.id?.id;
  if (!intentsTableId || !noncesTableId) throw new Error("could not read vault Table ids");

  async function readEncryptedGoalHex(user: string): Promise<string | null> {
    const res = await client.getDynamicFieldObject({
      parentId: intentsTableId!,
      name: { type: "address", value: user },
    });
    if (!res.data) return null; // executed / withdrawn / never existed
    const content = res.data.content as { fields?: { value?: { fields?: { encrypted_goal?: unknown } } } };
    const eg = content.fields?.value?.fields?.encrypted_goal;
    if (eg === undefined) return null;
    return bytesToHex(eg);
  }

  async function readNonce(user: string): Promise<bigint> {
    const res = await client.getDynamicFieldObject({
      parentId: noncesTableId!,
      name: { type: "address", value: user },
    });
    if (!res.data) return 0n;
    const content = res.data.content as { fields?: { value?: unknown } };
    const v = content.fields?.value;
    return BigInt((v as string | number) ?? 0);
  }

  const inFlight = new Set<string>();
  const seen = new Set<string>();

  async function processIntent(user: string, amountIn: string, eventId: string) {
    if (seen.has(eventId)) return;
    seen.add(eventId);
    if (inFlight.has(user)) { log("skip", `${user} already in-flight`); return; }
    inFlight.add(user);
    try {
      const goalHex = await readEncryptedGoalHex(user);
      if (!goalHex) { log("intent", `${user} has no active intent (settled) - skip`); return; }
      log("intent", `user=${user} amount=${amountIn}`);

      const plain = decryptIntent<{ goal: string; tokenOut?: string }>(env.agentEciesSk, goalHex);
      log("decrypt", `goal="${plain.goal}"`);

      const market = await buildMarketSnapshot(BINANCE_SYMBOL, COINGECKO_ID);
      const mkt = JSON.parse(market) as { price?: number; trend?: string };
      log("market", `price=${mkt.price} trend=${mkt.trend}`);

      const decision = await sealedDecide(zgServiceUrl, zgApiSecret, zgModel, JSON.stringify(plain), market);
      log("tee", `action=${decision.action} reason="${decision.reason}"`);
      if (decision.action !== "EXECUTE") { log("tee", "WAIT - skipping execution"); return; }

      const price = Number(mkt.price ?? 0);
      if (!(price > 0)) throw new Error("no price for SUI/USD");
      // Oracle: expected_out = amount_in * priceScaled / 1e6, with amount_in in MIST (SUI 9 dec)
      // and output in oUSDC (6 dec). priceScaled = price * 1e3 bridges the 9->6 decimal gap so
      // 1 SUI -> price oUSDC (raw), not 1000x. (price*1e6 over-paid by 1000x.)
      const priceScaled = BigInt(Math.round(price * 1_000));

      const receipt = buildDecisionReceipt({
        chainKey: "sui-testnet",
        chainId: 0,
        user,
        ts: Date.now(),
        marketJson: market,
        oracleMode: "mock",
        oracleAddress: cfg.oracleId,
        priceScaled: priceScaled.toString(),
        teeProvider: TEE_PROVIDER,
        action: decision.action,
        reason: decision.reason,
      });
      const root = await writeReceipt(indexer as never, null, zgWallet, receipt, ZG_RPC);
      const receiptHash = zeroPadValue(root.startsWith("0x") ? root : `0x${root}`, 32);
      log("storage", `receipt=${receiptHash}`);

      const nonce = await readNonce(user);
      const params: SuiExecParams = {
        user,
        agentMinOut: 0n,
        deadlineMs: BigInt(Date.now() + 300_000),
        receiptHash,
        nonce,
      };
      const digest = await executeSuiTrade(client, agentKeypair, attestorKeypair, cfg, params, priceScaled);
      log("swap", `executed digest=${digest}`);
    } catch (e) {
      err("error", `failed for user=${user}`, e);
    } finally {
      inFlight.delete(user);
    }
  }

  const eventType = `${cfg.packageId}::vault::IntentSet`;

  // Backfill: scan recent IntentSet events, process any still-active intent.
  try {
    const recent = await client.queryEvents({ query: { MoveEventType: eventType }, limit: 50, order: "descending" });
    log("backfill", `found ${recent.data.length} recent IntentSet event(s)`);
    const usersDone = new Set<string>();
    for (const ev of recent.data) {
      const pj = ev.parsedJson as { user?: string; amount_in?: string };
      const user = pj.user;
      if (!user || usersDone.has(user)) continue;
      usersDone.add(user);
      await processIntent(user, pj.amount_in ?? "0", `${ev.id.txDigest}:${ev.id.eventSeq}`);
    }
  } catch (e) {
    err("backfill", "scan failed", e);
  }

  // Poll forward for new events.
  let cursor: { txDigest: string; eventSeq: string } | null = null;
  try {
    const latest = await client.queryEvents({ query: { MoveEventType: eventType }, limit: 1, order: "descending" });
    cursor = latest.data[0]?.id ?? null;
  } catch { /* start from null */ }

  log("poll", `polling IntentSet every ${POLL_MS}ms`);
  setInterval(async () => {
    try {
      const res = await client.queryEvents({ query: { MoveEventType: eventType }, cursor, order: "ascending", limit: 50 });
      if (res.data.length > 0) log("poll", `${res.data.length} new event(s)`);
      for (const ev of res.data) {
        const pj = ev.parsedJson as { user?: string; amount_in?: string };
        if (pj.user) await processIntent(pj.user, pj.amount_in ?? "0", `${ev.id.txDigest}:${ev.id.eventSeq}`);
        cursor = ev.id;
      }
    } catch (e) {
      err("poll", "poll error", e);
    }
  }, POLL_MS);
}

main().catch((e) => {
  err("fatal", "unhandled error", e);
  process.exit(1);
});
