import { bcs } from "@mysten/sui/bcs";
import type { SuiClientTypes } from "@mysten/sui/client";
import { describe, expect, it } from "vitest";
import {
  encodeSuiAddressKey,
  isSuiNotFoundError,
  parseIntent,
  parseIntentSetEvent,
  parseSuiAddressKey,
  parseSuiU64,
  parseVaultTableIds,
  requireSuccessfulSuiTransaction,
} from "./client.js";

const address = `0x${"12".repeat(32)}`;
const secondAddress = `0x${"34".repeat(32)}`;
const thirdAddress = `0x${"56".repeat(32)}`;
const fourthAddress = `0x${"78".repeat(32)}`;
const maxU64 = "18446744073709551615";

describe("Sui BCS codecs", () => {
  it("round-trips address dynamic-field keys", () => {
    expect(parseSuiAddressKey(encodeSuiAddressKey(address))).toBe(address);
  });

  it("parses an intent including empty bytes and u64 boundaries", () => {
    const schema = bcs.struct("Intent", {
      encryptedGoal: bcs.vector(bcs.u8()),
      deposit: bcs.struct("Balance", { value: bcs.u64() }),
      maxSlippageBps: bcs.u64(),
    });
    const intent = parseIntent(schema.serialize({
      encryptedGoal: [],
      deposit: { value: maxU64 },
      maxSlippageBps: maxU64,
    }).toBytes());

    expect(intent.encryptedGoal).toEqual(new Uint8Array());
    expect(intent.amountIn).toBe(maxU64);
    expect(intent.maxSlippageBps).toBe(maxU64);
  });

  it("parses vault table ids", () => {
    const uid = bcs.struct("UID", { id: bcs.Address });
    const table = bcs.struct("Table", { id: uid, size: bcs.u64() });
    const vault = bcs.struct("Vault", {
      id: uid,
      intents: table,
      nonces: table,
      cancelAt: table,
      attestor: bcs.vector(bcs.u8()),
    });
    const bytes = vault.serialize({
      id: { id: address },
      intents: { id: { id: secondAddress }, size: "0" },
      nonces: { id: { id: thirdAddress }, size: "1" },
      cancelAt: { id: { id: fourthAddress }, size: "0" },
      attestor: [],
    }).toBytes();

    expect(parseVaultTableIds(bytes)).toEqual({ intents: secondAddress, nonces: thirdAddress });
  });

  it("parses intent events and u64 values", () => {
    const event = bcs.struct("IntentSet", { user: bcs.Address, amountIn: bcs.u64() });
    expect(parseIntentSetEvent(event.serialize({ user: address, amountIn: maxU64 }).toBytes())).toEqual({
      user: address,
      amountIn: maxU64,
    });
    expect(parseSuiU64(bcs.u64().serialize(maxU64).toBytes())).toBe(BigInt(maxU64));
  });
});

describe("Sui client results", () => {
  const transaction = {
    digest: "digest",
    signatures: [],
    epoch: null,
    status: { success: true, error: null },
    balanceChanges: undefined,
    effects: undefined,
    events: undefined,
    objectTypes: undefined,
    transaction: undefined,
    bcs: undefined,
  } satisfies SuiClientTypes.Transaction;

  it("returns a successful transaction", () => {
    expect(requireSuccessfulSuiTransaction({ $kind: "Transaction", Transaction: transaction })).toBe(transaction);
  });

  it("throws the execution error from a failed transaction", () => {
    const failed = {
      ...transaction,
      status: { success: false as const, error: { message: "insufficient gas", $kind: "Unknown" as const, Unknown: null } },
    } satisfies SuiClientTypes.Transaction;
    expect(() => requireSuccessfulSuiTransaction({ $kind: "FailedTransaction", FailedTransaction: failed }))
      .toThrow("Sui transaction digest failed");
  });

  it("recognizes only not-found errors as absent state", () => {
    expect(isSuiNotFoundError(new Error("Object 0x1 not found"))).toBe(true);
    expect(isSuiNotFoundError(new Error("connection unavailable"))).toBe(false);
    expect(isSuiNotFoundError("not found")).toBe(false);
  });
});
