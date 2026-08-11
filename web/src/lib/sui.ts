import { bcs } from "@mysten/sui/bcs";
import type { SuiClientTypes } from "@mysten/sui/client";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import type { ChainMeta } from "./chains";

const uidBcs = bcs.struct("UID", { id: bcs.Address });
const tableBcs = bcs.struct("Table", { id: uidBcs, size: bcs.u64() });
const vaultBcs = bcs.struct("Vault", {
  id: uidBcs,
  intents: tableBcs,
  nonces: tableBcs,
  cancelAt: tableBcs,
  attestor: bcs.vector(bcs.u8()),
});
const intentBcs = bcs.struct("Intent", {
  encryptedGoal: bcs.vector(bcs.u8()),
  deposit: bcs.struct("Balance", { value: bcs.u64() }),
  maxSlippageBps: bcs.u64(),
});
const tradeExecutedBcs = bcs.struct("TradeExecuted", {
  user: bcs.Address,
  amountOut: bcs.u64(),
  receiptHash: bcs.vector(bcs.u8()),
});

function hexToBytes(hex: string): number[] {
  const h = hex.replace(/^0x/, "");
  const out: number[] = [];
  for (let i = 0; i < h.length; i += 2) out.push(parseInt(h.slice(i, i + 2), 16));
  return out;
}

function isSuiNotFoundError(error: unknown): boolean {
  return error instanceof Error && /\bnot found\b/i.test(error.message);
}

// Browser-wallet version of scripts/create-sui-intent.ts: deposit SUI + encrypted goal.
export function suiDepositTx(chain: ChainMeta, ciphertextHex: string, slippageBps: number, amountMist: bigint): Transaction {
  if (!chain.sui) throw new Error("not a Sui chain");
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.moveCall({
    target: `${chain.sui.packageId}::vault::deposit`,
    arguments: [
      tx.object(chain.vault),
      coin,
      tx.pure.vector("u8", hexToBytes(ciphertextHex)),
      tx.pure.u64(BigInt(slippageBps)),
    ],
  });
  return tx;
}

export function suiWithdrawTx(chain: ChainMeta): Transaction {
  if (!chain.sui) throw new Error("not a Sui chain");
  const tx = new Transaction();
  tx.moveCall({ target: `${chain.sui.packageId}::vault::withdraw`, arguments: [tx.object(chain.vault)] });
  return tx;
}

export function suiRequestCancelTx(chain: ChainMeta): Transaction {
  if (!chain.sui) throw new Error("not a Sui chain");
  const tx = new Transaction();
  tx.moveCall({ target: `${chain.sui.packageId}::vault::request_cancel`, arguments: [tx.object(chain.vault), tx.object(SUI_CLOCK_OBJECT_ID)] });
  return tx;
}

export interface SuiIntent { active: boolean; amountMist: bigint; }

export async function fetchSuiIntent(client: SuiGrpcClient, chain: ChainMeta, user: string): Promise<SuiIntent> {
  if (!chain.sui) return { active: false, amountMist: 0n };
  const { object: vault } = await client.getObject({ objectId: chain.vault, include: { content: true } });
  const tableId = vaultBcs.parse(vault.content).intents.id.id;
  try {
    const { dynamicField } = await client.getDynamicField({
      parentId: tableId,
      name: { type: "address", bcs: bcs.Address.serialize(user).toBytes() },
    });
    const intent = intentBcs.parse(dynamicField.value.bcs);
    return { active: true, amountMist: BigInt(intent.deposit.value) };
  } catch (error) {
    if (isSuiNotFoundError(error)) return { active: false, amountMist: 0n };
    throw error;
  }
}

export interface TradeRow {
  chainKey: string;
  vm: "evm" | "sui";
  user: string;
  amountOut: string;
  receiptHash: string;
  txHash: string;
  ts: number;
}

export async function fetchSuiTrades(client: SuiGrpcClient, chain: ChainMeta, user?: string): Promise<TradeRow[]> {
  if (!chain.sui) return [];
  const rows: TradeRow[] = [];
  let before: string | null = null;
  for (let pageNumber = 0; pageNumber < 20 && rows.length < 50; pageNumber += 1) {
    const page = await client.listEvents({
      filter: { eventType: `${chain.sui.eventsPkg}::vault::TradeExecuted` },
      before,
      limit: 50,
      order: "descending",
    });
    for (const event of page.events) {
      const trade = tradeExecutedBcs.parse(event.bcs);
      rows.push({
        chainKey: chain.key,
        vm: "sui",
        user: trade.user,
        amountOut: trade.amountOut,
        receiptHash: `0x${Array.from(trade.receiptHash, (byte) => byte.toString(16).padStart(2, "0")).join("")}`,
        txHash: event.transactionDigest,
        ts: 0,
      });
    }
    const nextCursor = page.endCursor;
    if (!page.hasNextPage || !nextCursor || nextCursor === before) break;
    before = nextCursor;
  }
  return user ? rows.filter((row) => row.user.toLowerCase() === user.toLowerCase()) : rows;
}

type SuiTransactionResult =
  | { $kind: "Transaction"; Transaction: Pick<SuiClientTypes.Transaction, "digest" | "status"> }
  | { $kind: "FailedTransaction"; FailedTransaction: Pick<SuiClientTypes.Transaction, "digest" | "status"> };

export function requireSuiTransactionDigest(result: SuiTransactionResult): string {
  const transaction = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  if (result.$kind === "FailedTransaction" || !transaction.status.success) {
    const detail = transaction.status.error ? JSON.stringify(transaction.status.error) : "unknown error";
    throw new Error(`Sui transaction ${transaction.digest} failed: ${detail}`);
  }
  return transaction.digest;
}
