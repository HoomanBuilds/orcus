import { ethers } from "hardhat";

async function main() {
  const agentAddress = process.env.AGENT_ADDRESS;
  if (!agentAddress) throw new Error("AGENT_ADDRESS env required");
  const jaineRouter = process.env.JAINE_ROUTER ?? "0x2d94e151fe547d9f97cf139cd1283ca14cce042b";

  const Vault = await ethers.getContractFactory("StrategyVault");
  const vault = await Vault.deploy(agentAddress, jaineRouter);
  await vault.waitForDeployment();

  const addr = await vault.getAddress();
  console.log("StrategyVault deployed to:", addr);
  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${addr}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
