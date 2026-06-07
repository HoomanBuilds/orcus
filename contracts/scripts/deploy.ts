import { ethers } from "hardhat";

// Deploys the full Orcus v2 stack to the configured network (Galileo).
// AGENT_ADDRESS is the executor EOA (also the attestor and the oracle price updater in v1).
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

  // updater = agent (pushes the live Binance price); maxAge = 0 (no staleness revert on the demo)
  const oracle = await (await ethers.getContractFactory("OrcusOracle")).deploy(deployer.address, deployer.address, 0);
  await oracle.waitForDeployment();
  console.log("OrcusOracle:  ", await oracle.getAddress());

  // seed an initial price (~0G/USD); the agent overwrites this live before each trade
  const seed = await oracle.setPrice(ethers.parseEther("0.30"));
  await seed.wait();
  console.log("Seeded oracle price 0.30");

  const router = await (await ethers.getContractFactory("OrcusRouter"))
    .deploy(await usdc.getAddress(), await oracle.getAddress(), deployer.address);
  await router.waitForDeployment();
  console.log("OrcusRouter:  ", await router.getAddress());

  const mint = await usdc.mint(await router.getAddress(), ethers.parseEther("1000000"));
  await mint.wait();
  console.log("Minted 1,000,000 oUSDC to router");

  const vault = await (await ethers.getContractFactory("StrategyVault")).deploy(
    agent, agent,
    await router.getAddress(), await oracle.getAddress(),
    await wnative.getAddress(), deployer.address,
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("StrategyVault:", vaultAddr);

  const setUpd = await oracle.setUpdater(vaultAddr);
  await setUpd.wait();
  console.log("Oracle updater set to vault");

  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${vaultAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
