import "dotenv/config";

// Sui chain config for the Orcus agent. Filled from env after publishing the Move
// package (`sui client publish`) and the post-publish setup:
//   1. publish, capture the package id + the created shared object ids
//      (Vault, PriceOracle) and the owned AgentCap id.
//   2. set the attestor pubkey (vault::set_attestor); the agent settles real swaps
//      through DeepBook, so the mock dex Pool no longer needs funding.
//   3. set SUI_PACKAGE_ID / SUI_VAULT_ID / SUI_ORACLE_ID / SUI_AGENT_CAP_ID.
// DeepBook testnet addresses default to the live deployment (verified on-chain); override
// via env if the protocol upgrades.
export interface SuiConfig {
  rpcUrl: string;
  packageId: string;
  eventsPkg: string; // original package id; event/struct types keep it across upgrades
  vaultId: string;
  oracleId: string;
  agentCapId: string;
  // DeepBook v3 (real swap venue)
  deepbookPkg: string;
  suiDbusdcPool: string;
  deepSuiPool: string;
  dbusdcType: string;
  deepType: string;
  deepFeePerSwap: bigint; // DEEP units split per swap to pay the pool fee (unused part is returned)
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export const SUI_TYPE = "0x2::sui::SUI";

export function resolveSuiConfig(): SuiConfig {
  return {
    rpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
    packageId: req("SUI_PACKAGE_ID"),
    eventsPkg: process.env.SUI_EVENTS_PKG ?? "0x07e3af4c0e5389fe27b9fc2519cd5ccdfaae772085ce1a9e754aeb55519f9dc8",
    vaultId: req("SUI_VAULT_ID"),
    oracleId: req("SUI_ORACLE_ID"),
    agentCapId: req("SUI_AGENT_CAP_ID"),
    deepbookPkg: process.env.DEEPBOOK_PKG ?? "0x22be4cade64bf2d02412c7e8d0e8beea2f78828b948118d46735315409371a3c",
    suiDbusdcPool: process.env.DEEPBOOK_SUI_DBUSDC_POOL ?? "0x1c19362ca52b8ffd7a33cee805a67d40f31e6ba303753fd3a4cfdfacea7163a5",
    deepSuiPool: process.env.DEEPBOOK_DEEP_SUI_POOL ?? "0x48c95963e9eac37a316b7ae04a0deb761bcdcc2b67912374d6036e7f0e9bae9f",
    dbusdcType: process.env.DEEPBOOK_DBUSDC_TYPE ?? "0xf7152c05930480cd740d7311b5b8b45c6f488e3a53a11c3f74a6fac36a52e0d7::DBUSDC::DBUSDC",
    deepType: process.env.DEEPBOOK_DEEP_TYPE ?? "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP",
    deepFeePerSwap: BigInt(process.env.DEEPBOOK_FEE_DEEP_UNITS ?? "100000"),
  };
}
