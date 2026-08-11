import { JsonRpcProvider, Wallet, zeroPadValue } from "ethers";
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
import {
  createSuiClient,
  encodeSuiAddressKey,
  isSuiNotFoundError,
  parseIntent,
  parseIntentSetEvent,
  parseSuiAddressKey,
  parseSuiU64,
  parseVaultTableIds,
} from "./client.js";

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

async function main() {
  const cfg = resolveSuiConfig();
  const { agentKeypair, attestorKeypair } = resolveSuiKeys();
  const client = createSuiClient(cfg.grpcUrl);
  const indexer = new Indexer(env.storageIndexer);
  const zgWallet = new Wallet(env.agentPk, new JsonRpcProvider(ZG_RPC));

  const zgServiceUrl = process.env.SUI_ZG_SERVICE_URL ?? process.env.ZG_SERVICE_URL ?? "";
  const zgApiSecret = process.env.SUI_ZG_API_SECRET ?? process.env.ZG_API_SECRET ?? "";
  const zgModel = process.env.SUI_ZG_MODEL ?? process.env.ZG_MODEL ?? "qwen/qwen2.5-omni-7b";

  log("boot", `vault=${cfg.vaultId} pkg=${cfg.packageId}`);
  log("boot", `agent=${agentKeypair.toSuiAddress()} attestor=${attestorKeypair.getPublicKey().toSuiAddress()}`);

  const latestEvent = await client.listEvents({ order: "descending", limit: 1 });
  let eventCursor = latestEvent.startCursor;
  if (!eventCursor) throw new Error("could not establish the current Sui event cursor");

  const { object: vault } = await client.getObject({ objectId: cfg.vaultId, include: { content: true } });
  const { intents: intentsTableId, nonces: noncesTableId } = parseVaultTableIds(vault.content);

  async function readEncryptedGoalHex(user: string): Promise<string | null> {
    try {
      const { dynamicField } = await client.getDynamicField({
        parentId: intentsTableId,
        name: { type: "address", bcs: encodeSuiAddressKey(user) },
      });
      return `0x${Buffer.from(parseIntent(dynamicField.value.bcs).encryptedGoal).toString("hex")}`;
    } catch (error) {
      if (isSuiNotFoundError(error)) return null;
      throw error;
    }
  }

  async function readNonce(user: string): Promise<bigint> {
    try {
      const { dynamicField } = await client.getDynamicField({
        parentId: noncesTableId,
        name: { type: "address", bcs: encodeSuiAddressKey(user) },
      });
      return parseSuiU64(dynamicField.value.bcs);
    } catch (error) {
      if (isSuiNotFoundError(error)) return 0n;
      throw error;
    }
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
        chainKey: "sui",
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
        settlement: { venue: "DeepBook v3", pool: cfg.suiDbusdcPool, token: cfg.dbusdcType },
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

  const eventType = `${cfg.eventsPkg}::vault::IntentSet`;

  const activeIntents: Array<{ user: string; amountIn: string }> = [];
  let stateCursor: string | null = null;
  do {
    const page: {
      dynamicFields: Array<{ name: { bcs: Uint8Array }; value: { bcs: Uint8Array } }>;
      cursor: string | null;
      hasNextPage: boolean;
    } = await client.listDynamicFields<{ value: true }>({
      parentId: intentsTableId,
      cursor: stateCursor,
      limit: 50,
      include: { value: true },
    });
    for (const field of page.dynamicFields) {
      activeIntents.push({
        user: parseSuiAddressKey(field.name.bcs),
        amountIn: parseIntent(field.value.bcs).amountIn,
      });
    }
    stateCursor = page.cursor;
    if (page.hasNextPage && !stateCursor) throw new Error("Sui intent table pagination returned no cursor");
  } while (stateCursor);

  log("backfill", `found ${activeIntents.length} active intent(s) in vault state`);
  for (const intent of activeIntents) {
    await processIntent(intent.user, intent.amountIn, `state:${intent.user}`);
  }

  let polling = false;
  async function pollEvents() {
    if (polling) return;
    polling = true;
    try {
      let after = eventCursor;
      do {
        const page = await client.listEvents({
          filter: { eventType },
          after,
          order: "ascending",
          limit: 50,
        });
        if (page.events.length > 0) log("poll", `${page.events.length} new event(s)`);
        for (const event of page.events) {
          const intent = parseIntentSetEvent(event.bcs);
          await processIntent(
            intent.user,
            intent.amountIn,
            `${event.transactionDigest}:${event.eventIndex}`,
          );
        }
        const nextCursor = page.endCursor;
        if (!nextCursor || nextCursor === after) break;
        eventCursor = nextCursor;
        after = nextCursor;
        if (!page.hasNextPage) break;
      } while (true);
    } catch (e) {
      err("poll", "poll error", e);
    } finally {
      polling = false;
    }
  }

  await pollEvents();
  log("poll", `polling IntentSet every ${POLL_MS}ms`);
  setInterval(() => void pollEvents(), POLL_MS);
}

main().catch((e) => {
  err("fatal", "unhandled error", e);
  process.exit(1);
});
