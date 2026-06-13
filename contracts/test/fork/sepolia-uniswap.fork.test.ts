import { expect } from "chai";
import { ethers, network } from "hardhat";

// Fork test of the real Uniswap V3 path on Ethereum Sepolia, which has a deep WETH/USDC
// 0.05% pool. Swaps through the REAL SwapRouter02 and settles in REAL USDC (6dec). Sepolia
// only has SwapRouter02, so the vault runs routerKind=1 (first real-chain exercise of it).
// Self-skips unless SEPOLIA_RPC is set. Needs an archive RPC that serves historical state;
// pin a recent block to keep it shallow (load-balanced public endpoints do NOT work):
//   SEPOLIA_RPC=https://sepolia.drpc.org SEPOLIA_FORK_BLOCK=<recent> npx hardhat test test/fork/sepolia-uniswap.fork.test.ts
// NOTE: testnet pools aren't arbitraged - this one overvalues WETH ~10x, so selling WETH
// for USDC overpays and the conservative OrcusOracle floor clears easily.
const RPC = process.env.SEPOLIA_RPC;
const run = RPC ? describe : describe.skip;

const SWAP_ROUTER = "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"; // Uniswap SwapRouter02 (Sepolia)
const WETH = "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14";
const USDC = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // test USDC (6dec) in the deep pool
const FEE = 500; // deepest WETH/USDC tier on Sepolia (~$747k)

run("StrategyVault fork: real Uniswap V3 WETH->USDC (Sepolia, SwapRouter02)", () => {
  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: RPC,
          ...(process.env.SEPOLIA_FORK_BLOCK ? { blockNumber: Number(process.env.SEPOLIA_FORK_BLOCK) } : {}),
        },
      }],
    });
  });

  after(async () => {
    await network.provider.request({ method: "hardhat_reset", params: [] });
  });

  it("deposits native, swaps through real SwapRouter02, credits the user real USDC above the floor", async () => {
    const [owner, user, agent] = await ethers.getSigners();
    const usdc = await ethers.getContractAt(
      "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
      USDC,
    );

    const oracle = await (await ethers.getContractFactory("OrcusOracle"))
      .deploy(owner.address, owner.address, 0);
    await oracle.waitForDeployment();

    const vault = await (await ethers.getContractFactory("StrategyVault")).deploy(
      agent.address, agent.address, SWAP_ROUTER, await oracle.getAddress(), WETH, owner.address,
    );
    await vault.waitForDeployment();
    await (await vault.connect(owner).setRouterKind(1)).wait(); // SwapRouter02 (no deadline)
    await (await oracle.connect(owner).setUpdater(await vault.getAddress())).wait();

    const amountIn = ethers.parseEther("0.001");
    await (await vault.connect(user).depositNative("0x11", 500, { value: amountIn })).wait();

    const latest = await ethers.provider.getBlock("latest");
    const deadline = (latest!.timestamp) + 600;
    const params = {
      user: user.address, tokenOut: USDC, fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("sepolia-fork"), nonce: 0n,
    };
    const net = await ethers.provider.getNetwork();
    const domain = { name: "Orcus", version: "1", chainId: Number(net.chainId), verifyingContract: await vault.getAddress() };
    const typeDef = {
      ExecParams: [
        { name: "user", type: "address" }, { name: "tokenOut", type: "address" },
        { name: "fee", type: "uint24" }, { name: "agentMinOut", type: "uint256" },
        { name: "deadline", type: "uint256" }, { name: "receiptHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const sig = await agent.signTypedData(domain, typeDef, params);

    // Conservative floor: $100/WETH scaled for 6dec USDC (priceScaled = price_usd * 1e6).
    // Well below the real pool output, so the assertion is robust to any fork block / pool drift.
    const priceUpdate = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [100_000_000n]);

    const before = await usdc.balanceOf(user.address);
    await (await vault.connect(agent).executeTrade(params, sig, priceUpdate)).wait();
    const got = (await usdc.balanceOf(user.address)) - before;

    console.log("        real Sepolia swap output:", got.toString(), "USDC (6dec)");
    expect(got).to.be.greaterThan(100_000n); // > $0.10 floor; real pool pays far more
  });
});
