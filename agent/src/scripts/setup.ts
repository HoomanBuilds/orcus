/**
 * One-time agent setup script.
 *
 * Run once before starting the agent for the first time:
 *   npm run setup
 *
 * What it does:
 *   1. Creates the 0G Compute ledger (requires 3 OG minimum)
 *   2. Lists available inference providers
 *   3. Transfers funds to the chosen provider
 *   4. Acknowledges the provider
 *   5. Generates an API key (app-sk-...)
 *   6. Prints the values you need to add to agent/.env
 *
 * Prerequisites:
 *   - AGENT_PRIVATE_KEY set in agent/.env
 *   - At least 5 OG in the wallet (3 for ledger + 1 for provider + gas)
 *   - npm install -g @0gfoundation/0g-compute-ts-sdk (for 0g-compute-cli)
 */

import { execFileSync } from "child_process";
import { JsonRpcProvider, Wallet } from "ethers";
import "dotenv/config";

const RPC          = process.env.GALILEO_RPC ?? "https://evmrpc-testnet.0g.ai";
const PRIVATE_KEY  = process.env.AGENT_PRIVATE_KEY ?? "";
const LEDGER_CA    = "0xE70830508dAc0A97e6c087c75f402f9Be669E406";
const INFERENCE_CA = "0xa79F4c8311FF93C06b8CfB403690cc987c93F91E";
const FT_CA        = "0xC6C075D8039763C8f1EbE580be5ADdf2fd6941bA";

function cli(args: string[], input?: string): string {
  try {
    return execFileSync("0g-compute-cli", args, {
      encoding: "utf8",
      env: { ...process.env, PRIVATE_KEY },
      input,
    });
  } catch (e: any) {
    return (e.stdout ?? "") + (e.stderr ?? "") || String(e);
  }
}

function section(title: string) {
  console.log(`\n${"-".repeat(60)}\n  ${title}\n${"-".repeat(60)}`);
}

async function main() {
  if (!PRIVATE_KEY) {
    console.error("AGENT_PRIVATE_KEY not set in agent/.env");
    process.exit(1);
  }

  const provider = new JsonRpcProvider(RPC);
  const wallet = new Wallet(PRIVATE_KEY, provider);
  const balance = await provider.getBalance(wallet.address);
  const og = Number(balance) / 1e18;

  section("1 / Wallet");
  console.log(`  Address : ${wallet.address}`);
  console.log(`  Balance : ${og.toFixed(4)} OG`);
  if (og < 4) {
    console.warn(`  ⚠  Low balance. Need at least 4 OG.`);
    console.warn(`  Faucets: https://faucet.0g.ai | https://faucets.chain.link/0g-testnet-galileo`);
  }

  section("2 / Create ledger (deposit 3 OG)");
  const depositOut = cli([
    "deposit", "--amount", "3",
    "--rpc", RPC,
    "--ledger-ca", LEDGER_CA,
    "--inference-ca", INFERENCE_CA,
    "--fine-tuning-ca", FT_CA,
  ]);
  console.log(depositOut.trim());

  section("3 / List inference providers");
  const listOut = cli(["inference", "list-providers", "--rpc", RPC, "--inference-ca", INFERENCE_CA]);
  console.log(listOut.trim());

  const providerMatch = listOut.match(/0x[0-9a-fA-F]{40}/);
  if (!providerMatch) {
    console.error("  Could not parse a provider address. Check list output above.");
    process.exit(1);
  }
  const providerAddress = providerMatch[0];
  console.log(`\n  Using provider: ${providerAddress}`);

  section("4 / Transfer 1 OG to provider");
  const transferOut = cli([
    "transfer-fund",
    "--provider", providerAddress,
    "--amount", "1",
    "--rpc", RPC,
    "--ledger-ca", LEDGER_CA,
    "--inference-ca", INFERENCE_CA,
    "--fine-tuning-ca", FT_CA,
  ], "\n");
  console.log(transferOut.trim());

  section("5 / Acknowledge provider");
  const ackOut = cli([
    "inference", "acknowledge-provider",
    "--provider", providerAddress,
    "--rpc", RPC,
    "--ledger-ca", LEDGER_CA,
    "--inference-ca", INFERENCE_CA,
  ], "\n");
  console.log(ackOut.trim());

  section("6 / Generate API key (never expires)");
  const secretOut = cli([
    "inference", "get-secret",
    "--provider", providerAddress,
    "--rpc", RPC,
    "--ledger-ca", LEDGER_CA,
    "--inference-ca", INFERENCE_CA,
  ], "\n");
  console.log(secretOut.trim());

  const urlMatch   = secretOut.match(/curl (https:\/\/[^\s]+)\/v1\/proxy/);
  const keyMatch   = secretOut.match(/Bearer (app-sk-[^\s"]+)/);
  const serviceUrl = urlMatch?.[1] ?? "";
  const apiSecret  = keyMatch?.[1] ?? "";

  section("7 / Add these to agent/.env");
  console.log(`  ZG_SERVICE_URL=${serviceUrl || "<paste service URL from curl example above>"}`);
  console.log(`  ZG_API_SECRET=${apiSecret || "<paste app-sk-... from above>"}`);
  console.log("\n  Then run: npm run dev");
}

main().catch((e) => { console.error(e); process.exit(1); });
