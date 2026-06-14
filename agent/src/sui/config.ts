import "dotenv/config";

// Sui chain config for the Orcus agent. Filled from env after publishing the Move
// package (`sui client publish`) and the post-publish setup:
//   1. publish -> capture the package id + the created shared object ids
//      (Vault, Pool, PriceOracle) and the owned AgentCap id.
//   2. fund the Pool with oUSDC (dex::fund), set the attestor pubkey (vault::set_attestor),
//      and transfer the AgentCap to the agent address.
//   3. set SUI_PACKAGE_ID / SUI_VAULT_ID / SUI_POOL_ID / SUI_ORACLE_ID / SUI_AGENT_CAP_ID.
export interface SuiConfig {
  rpcUrl: string;
  packageId: string;
  vaultId: string;
  poolId: string;
  oracleId: string;
  agentCapId: string;
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export function resolveSuiConfig(): SuiConfig {
  return {
    rpcUrl: process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443",
    packageId: req("SUI_PACKAGE_ID"),
    vaultId: req("SUI_VAULT_ID"),
    poolId: req("SUI_POOL_ID"),
    oracleId: req("SUI_ORACLE_ID"),
    agentCapId: req("SUI_AGENT_CAP_ID"),
  };
}
