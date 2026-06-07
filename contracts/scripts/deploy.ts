import { ethers } from "hardhat";

// Deploys the Orcus v2 stack.
//   DEPLOY_MODE=mock (default): Galileo demo - deploys mock USDC, WrappedNative,
//                               OrcusOracle (push), OrcusRouter, and the vault.
//   DEPLOY_MODE=real:           production chain - wires the chain's real Uniswap V3
//                               SwapRouter02 + real USDC + WETH, and deploys a
//                               PythPriceOracle. Set the addresses via env (below).
// AGENT_ADDRESS is the executor EOA (also the attestor; on Galileo it seeds nothing,
// the vault is the oracle updater).
function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} env required`);
  return v;
}

async function deployMock(deployer: { address: string }, agent: string) {
  const usdc = await (await ethers.getContractFactory("OrcusUSDC")).deploy(deployer.address);
  await usdc.waitForDeployment();
  console.log("OrcusUSDC:    ", await usdc.getAddress());

  const wnative = await (await ethers.getContractFactory("WrappedNative")).deploy();
  await wnative.waitForDeployment();
  console.log("WrappedNative:", await wnative.getAddress());

  const oracle = await (await ethers.getContractFactory("OrcusOracle")).deploy(deployer.address, deployer.address, 0);
  await oracle.waitForDeployment();
  console.log("OrcusOracle:  ", await oracle.getAddress());
  await (await oracle.setPrice(ethers.parseEther("0.30"))).wait();
  console.log("Seeded oracle price 0.30");

  const router = await (await ethers.getContractFactory("OrcusRouter"))
    .deploy(await usdc.getAddress(), await oracle.getAddress(), deployer.address);
  await router.waitForDeployment();
  console.log("OrcusRouter:  ", await router.getAddress());

  await (await usdc.mint(await router.getAddress(), ethers.parseEther("1000000"))).wait();
  console.log("Minted 1,000,000 oUSDC to router");

  const vault = await (await ethers.getContractFactory("StrategyVault")).deploy(
    agent, agent,
    await router.getAddress(), await oracle.getAddress(),
    await wnative.getAddress(), deployer.address,
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("StrategyVault:", vaultAddr);

  await (await oracle.setUpdater(vaultAddr)).wait();
  console.log("Oracle updater set to vault");
  return vaultAddr;
}

async function deployReal(deployer: { address: string }, agent: string) {
  // Real chain addresses (verify on the chain explorer before use):
  // SWAP_ROUTER must be the ORIGINAL Uniswap V3 SwapRouter (selector 0x414bf389, struct
  // WITH deadline) - our ISwapRouter matches it, NOT SwapRouter02 (0x68b3..., no deadline).
  // On Arbitrum/Ethereum/Optimism/Polygon the original is 0xE592427A0AEce92De3Edee1F18E0157C05861564.
  const swapRouter = req("SWAP_ROUTER");
  const usdc = req("USDC");              // native USDC (Circle)
  const weth = req("WETH");              // wrapped native (tokenIn)
  const pyth = req("PYTH");              // Pyth contract on this chain
  const feedId = req("PYTH_FEED_ID");    // tokenIn/USD feed id
  const maxAge = process.env.PYTH_MAX_AGE ?? "60";

  const oracle = await (await ethers.getContractFactory("PythPriceOracle"))
    .deploy(pyth, feedId, maxAge);
  await oracle.waitForDeployment();
  console.log("PythPriceOracle:", await oracle.getAddress());

  const vault = await (await ethers.getContractFactory("StrategyVault")).deploy(
    agent, agent,
    swapRouter, await oracle.getAddress(),
    weth, deployer.address,
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("StrategyVault:  ", vaultAddr);
  console.log("USDC (tokenOut):", usdc);
  console.log("NOTE: fund the agent EOA with gas; PythPriceOracle.updatePrice is permissionless (no setUpdater needed).");
  return vaultAddr;
}

async function main() {
  const agent = req("AGENT_ADDRESS");
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  const mode = process.env.DEPLOY_MODE ?? "mock";
  console.log("Mode:", mode);

  const vaultAddr = mode === "real"
    ? await deployReal(deployer, agent)
    : await deployMock(deployer, agent);

  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${vaultAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
