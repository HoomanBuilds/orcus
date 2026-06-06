import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveChain, chainKeys } from "./chains.js";

const SAVED = { ...process.env };

describe("resolveChain", () => {
  beforeEach(() => {
    process.env = { ...SAVED };
    process.env.VAULT_ADDRESS = "0x1111111111111111111111111111111111111111";
    process.env.USDC_ADDRESS = "0x2222222222222222222222222222222222222222";
  });
  afterEach(() => {
    process.env = { ...SAVED };
  });

  it("defaults to galileo", () => {
    delete process.env.CHAIN;
    expect(resolveChain().key).toBe("galileo");
    expect(resolveChain().chainId).toBe(16602);
  });

  it("uses agent-push price mode on galileo", () => {
    process.env.CHAIN = "galileo";
    expect(resolveChain().priceMode).toBe("agent-push");
  });

  it("throws on unknown chain", () => {
    process.env.CHAIN = "nope";
    expect(() => resolveChain()).toThrow(/Unknown CHAIN/);
  });

  it("throws when the vault address is unset", () => {
    process.env.CHAIN = "galileo";
    delete process.env.VAULT_ADDRESS;
    expect(() => resolveChain()).toThrow(/no vault address/);
  });

  it("lists known chains", () => {
    expect(chainKeys()).toContain("galileo");
    expect(chainKeys()).toContain("arbitrum-sepolia");
  });
});
