import { ethers } from "hardhat";

// Deploys the full Orcus v2 stack to the configured network (Galileo).
// AGENT_ADDRESS is the executor EOA (also the attestor in v1).
async function main() {
  const agent = process.env.AGENT_ADDRESS;
  if (!agent) throw new Error("AGENT_ADDRESS env required");
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const usdc = await (await ethers.getContractFactory("OrcusUSDC")).deploy(deployer.address);
  await usdc.waitForDeployment();
  console.log("OrcusUSDC:    ", await usdc.getAddress());

  const wnative = await (await ethers.getContractFactory("WrappedNative")).deploy();
  await wnative.waitForDeployment();
  console.log("WrappedNative:", await wnative.getAddress());

  const router = await (await ethers.getContractFactory("OrcusRouter"))
    .deploy(await usdc.getAddress(), deployer.address);
  await router.waitForDeployment();
  console.log("OrcusRouter:  ", await router.getAddress());

  const mint = await usdc.mint(await router.getAddress(), ethers.parseEther("1000000"));
  await mint.wait();
  console.log("Minted 1,000,000 oUSDC to router");

  const oracle = await (await ethers.getContractFactory("OrcusOracle")).deploy();
  await oracle.waitForDeployment();
  console.log("OrcusOracle:  ", await oracle.getAddress());

  const vault = await (await ethers.getContractFactory("StrategyVault")).deploy(
    agent, agent,
    await router.getAddress(), await oracle.getAddress(),
    await wnative.getAddress(), deployer.address,
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("StrategyVault:", vaultAddr);
  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${vaultAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
