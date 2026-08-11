import { bcs } from "@mysten/sui/bcs";
import type { SuiClientTypes } from "@mysten/sui/client";
import { SuiGrpcClient } from "@mysten/sui/grpc";

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
const intentSetBcs = bcs.struct("IntentSet", {
  user: bcs.Address,
  amountIn: bcs.u64(),
});

export function createSuiClient(grpcUrl: string): SuiGrpcClient {
  return new SuiGrpcClient({ network: "testnet", baseUrl: grpcUrl });
}

export function encodeSuiAddressKey(address: string): Uint8Array {
  return bcs.Address.serialize(address).toBytes();
}

export function parseSuiAddressKey(bytes: Uint8Array): string {
  return bcs.Address.parse(bytes);
}

export function parseVaultTableIds(bytes: Uint8Array): { intents: string; nonces: string } {
  const vault = vaultBcs.parse(bytes);
  return {
    intents: vault.intents.id.id,
    nonces: vault.nonces.id.id,
  };
}

export function parseIntent(bytes: Uint8Array): {
  encryptedGoal: Uint8Array;
  amountIn: string;
  maxSlippageBps: string;
} {
  const intent = intentBcs.parse(bytes);
  return {
    encryptedGoal: Uint8Array.from(intent.encryptedGoal),
    amountIn: intent.deposit.value,
    maxSlippageBps: intent.maxSlippageBps,
  };
}

export function parseIntentSetEvent(bytes: Uint8Array): { user: string; amountIn: string } {
  const event = intentSetBcs.parse(bytes);
  return { user: event.user, amountIn: event.amountIn };
}

export function parseSuiU64(bytes: Uint8Array): bigint {
  return BigInt(bcs.u64().parse(bytes));
}

export function isSuiNotFoundError(error: unknown): boolean {
  return error instanceof Error && /\bnot found\b/i.test(error.message);
}

type SuiTransactionResult =
  | { $kind: "Transaction"; Transaction: Pick<SuiClientTypes.Transaction, "digest" | "status"> }
  | { $kind: "FailedTransaction"; FailedTransaction: Pick<SuiClientTypes.Transaction, "digest" | "status"> };

export function requireSuccessfulSuiTransaction(
  result: SuiTransactionResult,
): Pick<SuiClientTypes.Transaction, "digest" | "status"> {
  const transaction = result.$kind === "Transaction" ? result.Transaction : result.FailedTransaction;
  if (result.$kind === "FailedTransaction" || !transaction.status.success) {
    const detail = transaction.status.error ? JSON.stringify(transaction.status.error) : "unknown error";
    throw new Error(`Sui transaction ${transaction.digest} failed: ${detail}`);
  }
  return transaction;
}
