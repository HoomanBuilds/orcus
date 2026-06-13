import { PrivateKey } from "eciesjs";
import { Contract, JsonRpcProvider, Wallet, parseUnits } from "ethers";
import { env } from "../env.js";
import { encryptIntent } from "../crypto/ecies.js";
import { resolveChain } from "../chains.js";
import vaultAbi from "../abi/strategyVault.json" with { type: "json" };

// Local test helper: deposits an encrypted intent on an EVM vault so the agent
// loop (src/index.ts, same CHAIN) has something to process. Encrypts to the agent's
// own ECIES key so the agent can decrypt it. CHAIN selects the vault (e.g. CHAIN=sepolia).
async function main() {
  const chain = resolveChain();
  const provider = new JsonRpcProvider(chain.rpc);
  const wallet = new Wallet(env.agentPk, provider);

  const sk = new PrivateKey(Buffer.from(env.agentEciesSk.replace(/^0x/, ""), "hex"));
  const agentEciesPub = `0x${sk.publicKey.toHex()}`;

  const goal = process.env.EVM_TEST_GOAL ?? "swap now";
  const encrypted = encryptIntent(agentEciesPub, { goal });
  const value = parseUnits(process.env.EVM_TEST_DEPOSIT ?? "0.001", 18);
  const slippageBps = Number(process.env.EVM_TEST_SLIPPAGE_BPS ?? "500");

  const vault = new Contract(chain.vault, vaultAbi as never[], wallet);
  const tx = await vault["depositNative"](encrypted, slippageBps, { value });
  const r = await tx.wait();
  console.log(`deposit tx: ${chain.explorerTx}${r.hash}`);
  console.log(`chain=${chain.key} user=${wallet.address} goal="${goal}" deposit=${value} slippage=${slippageBps}bps`);
}

main().catch((e) => {
  console.error("create-evm-intent failed:", e);
  process.exit(1);
});
