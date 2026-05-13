import { describe, it, expect } from "vitest";
import { generateKeyPair, encryptIntent, decryptIntent } from "./ecies.js";

describe("ecies", () => {
  it("round-trips an intent payload", () => {
    const { privateKey, publicKey } = generateKeyPair();
    const intent = { goal: "swap 1 OG to USDC", maxSlippage: 50 };
    const cipher = encryptIntent(publicKey, intent);
    expect(cipher).toMatch(/^0x[0-9a-f]+$/i);
    const plain = decryptIntent(privateKey, cipher);
    expect(plain).toEqual(intent);
  });

  it("decrypt with wrong key throws", () => {
    const { publicKey } = generateKeyPair();
    const other = generateKeyPair();
    const cipher = encryptIntent(publicKey, { goal: "x" });
    expect(() => decryptIntent(other.privateKey, cipher)).toThrow();
  });
});
