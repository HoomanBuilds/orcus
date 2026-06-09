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

  it("uses mock price mode on galileo", () => {
    process.env.CHAIN = "galileo";
    expect(resolveChain().priceMode).toBe("mock");
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

  it("lists the testnet chains", () => {
    for (const c of ["galileo", "arbitrum-sepolia", "base-sepolia", "avalanche-fuji", "mantle-sepolia"]) {
      expect(chainKeys()).toContain(c);
    }
  });

  it("every chain is mock price mode with a native Binance symbol", () => {
    const addr = "0x3333333333333333333333333333333333333333";
    const envs: Record<string, [string, string]> = {
      "galileo": ["VAULT_ADDRESS", "USDC_ADDRESS"],
      "arbitrum-sepolia": ["ARBITRUM_SEPOLIA_VAULT", "ARBITRUM_SEPOLIA_USDC"],
      "base-sepolia": ["BASE_SEPOLIA_VAULT", "BASE_SEPOLIA_USDC"],
      "avalanche-fuji": ["FUJI_VAULT", "FUJI_USDC"],
      "mantle-sepolia": ["MANTLE_SEPOLIA_VAULT", "MANTLE_SEPOLIA_USDC"],
    };
    for (const [c, [ve, ue]] of Object.entries(envs)) {
      process.env.CHAIN = c;
      process.env[ve] = addr;
      process.env[ue] = addr;
      const cfg = resolveChain();
      expect(cfg.priceMode).toBe("mock");
      expect(cfg.binanceSymbol.endsWith("USDT")).toBe(true);
    }
  });

  it("throws when the settlement token is unset", () => {
    process.env.CHAIN = "arbitrum-sepolia";
    process.env.ARBITRUM_SEPOLIA_VAULT = "0x3333333333333333333333333333333333333333";
    delete process.env.ARBITRUM_SEPOLIA_USDC;
    expect(() => resolveChain()).toThrow(/settlement token/);
  });

  it("falls back to shared ZG creds when no per-chain override is set", () => {
    process.env.CHAIN = "galileo";
    delete process.env.GALILEO_ZG_SERVICE_URL;
    delete process.env.GALILEO_ZG_API_SECRET;
    process.env.ZG_SERVICE_URL = "https://shared.tee.example";
    process.env.ZG_API_SECRET = "shared-secret";
    const cfg = resolveChain();
    expect(cfg.zgServiceUrl).toBe("https://shared.tee.example");
    expect(cfg.zgApiSecret).toBe("shared-secret");
  });

  it("uses per-chain ZG creds when set, overriding the shared fallback", () => {
    process.env.CHAIN = "galileo";
    process.env.GALILEO_ZG_SERVICE_URL = "https://galileo.tee.example";
    process.env.GALILEO_ZG_API_SECRET = "galileo-secret";
    process.env.ZG_SERVICE_URL = "https://shared.tee.example";
    process.env.ZG_API_SECRET = "shared-secret";
    const cfg = resolveChain();
    expect(cfg.zgServiceUrl).toBe("https://galileo.tee.example");
    expect(cfg.zgApiSecret).toBe("galileo-secret");
  });

  it("defaults zgModel to the allotted 7B, overridable per chain then shared", () => {
    process.env.CHAIN = "galileo";
    delete process.env.GALILEO_ZG_MODEL;
    delete process.env.ZG_MODEL;
    expect(resolveChain().zgModel).toBe("qwen/qwen2.5-omni-7b");
    process.env.ZG_MODEL = "shared-model";
    expect(resolveChain().zgModel).toBe("shared-model");
    process.env.GALILEO_ZG_MODEL = "0GM-1.0-35B-A3B";
    expect(resolveChain().zgModel).toBe("0GM-1.0-35B-A3B");
  });
});
