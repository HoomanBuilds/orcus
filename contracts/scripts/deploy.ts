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
  // Verified deploy addresses (primary sources + live APIs, 2026-06-09). ROUTER_KIND:
  // 0 = original Uniswap V3 SwapRouter (exactInputSingle WITH deadline); 1 = SwapRouter02 (no deadline).
  //
  //  Arbitrum (42161)  ROUTER_KIND=0  SWAP_ROUTER=0xE592427A0AEce92De3Edee1F18E0157C05861564 (original)
  //                    USDC=0xaf88d065e77c8cC2239327C5EDb3A432268e5831  WETH=0x82aF49447D8a07e3bd95BD0d56f35241523fBab1
  //                    PYTH=0xff1a0f4744e8582DF1aE09D5611b887B6a12925C  FEED(ETH/USD)=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace  (pool fee 500)
  //  Base (8453)       ROUTER_KIND=1  SWAP_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481 (SwapRouter02; no original on Base)
  //                    USDC=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913  WETH=0x4200000000000000000000000000000000000006
  //                    PYTH=0xbC16aee60f64864882BC6C4E428e148Fc0E272F5 (upgraded)  FEED(ETH/USD)=same as Arbitrum
  //  Avalanche (43114) ROUTER_KIND=1  SWAP_ROUTER=0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE (SwapRouter02; no original)
  //                    USDC=0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E  WAVAX=0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7
  //                    PYTH=0x4305FB66699C3B2702D4d05CF36551390A4c69C6  FEED(AVAX/USD)=0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7
  //  Mantle (5000)     ROUTER_KIND=0  SWAP_ROUTER=0x319B69888b0d11cEC22caA5034e25FfFBDc88421 (Agni; Uni V3 fork, has deadline)
  //                    USDC=0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9 (bridged)  WMNT=0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8
  //                    PYTH=0xA2aa501b19aff244D90cc15a4Cf739D2725B5729  FEED(MNT/USD)=0x4e3037c822d852d79af3ac80e35eb420ee3b870dca49f9344a38ef4773fb0585
  const swapRouter = req("SWAP_ROUTER");
  const usdc = req("USDC");              // native/canonical USDC
  const weth = req("WETH");              // wrapped native (tokenIn)
  const pyth = req("PYTH");              // Pyth contract on this chain
  const feedId = req("PYTH_FEED_ID");    // tokenIn/USD feed id
  const maxAge = process.env.PYTH_MAX_AGE ?? "60";
  const routerKind = Number(process.env.ROUTER_KIND ?? "0");

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

  if (routerKind === 1) {
    await (await vault.setRouterKind(1)).wait();
    console.log("routerKind set to 1 (SwapRouter02, no deadline)");
  } else {
    console.log("routerKind 0 (original SwapRouter, with deadline)");
  }
  console.log("USDC (tokenOut):", usdc);
  console.log("NOTE: fund the agent EOA with gas; PythPriceOracle.updatePrice is permissionless (no setUpdater needed).");
  return vaultAddr;
}

// realpush: a real external Uniswap V3 DEX (existing liquid pool) + our push oracle,
// settling in the chain's REAL token. For Sepolia (addresses in .env.example).
async function deployRealPush(deployer: { address: string }, agent: string) {
  const swapRouter = req("SWAP_ROUTER");
  const weth = req("WETH");            // wrapped native (tokenIn); vault wraps deposits into it
  const usdc = req("USDC");            // real settlement token (tokenOut); external, not deployed
  const routerKind = Number(process.env.ROUTER_KIND ?? "1");

  const oracle = await (await ethers.getContractFactory("OrcusOracle"))
    .deploy(deployer.address, deployer.address, 0);
  await oracle.waitForDeployment();
  console.log("OrcusOracle:  ", await oracle.getAddress());

  const vault = await (await ethers.getContractFactory("StrategyVault")).deploy(
    agent, agent, swapRouter, await oracle.getAddress(), weth, deployer.address,
  );
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("StrategyVault:", vaultAddr);

  if (routerKind === 1) {
    await (await vault.setRouterKind(1)).wait();
    console.log("routerKind set to 1 (SwapRouter02, no deadline)");
  } else {
    console.log("routerKind 0 (original SwapRouter, with deadline)");
  }
  await (await oracle.setUpdater(vaultAddr)).wait();
  console.log("Oracle updater set to vault");
  console.log("SWAP_ROUTER:   ", swapRouter);
  console.log("WETH (tokenIn):", weth);
  console.log("USDC (tokenOut):", usdc);
  console.log("NOTE: fund the agent EOA with gas; the existing Uniswap pool provides liquidity (no minting).");
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
    : mode === "realpush"
    ? await deployRealPush(deployer, agent)
    : await deployMock(deployer, agent);

  console.log("Explorer:", `https://chainscan-galileo.0g.ai/address/${vaultAddr}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
