const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  console.log("\n1. Deploying OrcusUSDC...");
  const USDC = await ethers.getContractFactory("OrcusUSDC");
  const usdc = await USDC.deploy();
  await usdc.waitForDeployment();
  const usdcAddr = await usdc.getAddress();
  console.log("   OrcusUSDC:", usdcAddr);

  console.log("\n2. Deploying OrcusRouter...");
  const Router = await ethers.getContractFactory("OrcusRouter");
  const router = await Router.deploy(usdcAddr);
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("   OrcusRouter:", routerAddr);

  console.log("\n3. Minting 1,000,000 oUSDC to router...");
  const mintTx = await usdc.mint(routerAddr, ethers.parseEther("1000000"));
  await mintTx.wait();
  console.log("   Done");

  console.log("\n4. Deploying StrategyVault...");
  const Vault = await ethers.getContractFactory("StrategyVault");
  const vault = await Vault.deploy(deployer.address, routerAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("   StrategyVault:", vaultAddr);

  console.log("\n=== DEPLOYED ===");
  console.log("OrcusUSDC:     ", usdcAddr);
  console.log("OrcusRouter:   ", routerAddr);
  console.log("StrategyVault: ", vaultAddr);
}

main().catch(console.error);
