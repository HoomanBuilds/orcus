import { expect } from "chai";
import { ethers, network } from "hardhat";

// Mainnet-fork test of the real Uniswap V3 path (plan Part 3). Self-skips unless
// ARBITRUM_RPC is set, so `npm test` stays green without an archive node. Run with:
//   ARBITRUM_RPC=https://arb-mainnet.g.alchemy.com/v2/<key> npx hardhat test test/fork/arbitrum-uniswap.fork.test.ts
//
// IMPORTANT: our ISwapRouter struct includes `deadline`, which matches the ORIGINAL
// Uniswap V3 SwapRouter (selector 0x414bf389) - NOT SwapRouter02 (0x68b3..., no deadline).
// So real EVM deploys must point SWAP_ROUTER at the original router below.
const RPC = process.env.ARBITRUM_RPC;
const run = RPC ? describe : describe.skip;

const SWAP_ROUTER = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 SwapRouter (original)
const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831"; // native USDC on Arbitrum
const FEE = 500; // deepest WETH/USDC pool tier on Arbitrum

run("StrategyVault fork: real Uniswap V3 WETH->USDC (Arbitrum)", () => {
  before(async () => {
    await network.provider.request({
      method: "hardhat_reset",
      params: [{
        forking: {
          jsonRpcUrl: RPC,
          ...(process.env.ARBITRUM_FORK_BLOCK ? { blockNumber: Number(process.env.ARBITRUM_FORK_BLOCK) } : {}),
        },
      }],
    });
  });

  after(async () => {
    await network.provider.request({ method: "hardhat_reset", params: [] });
  });

  it("deposits native, runs a real swap, credits the user USDC above the floor", async () => {
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
    await (await oracle.connect(owner).setUpdater(await vault.getAddress())).wait();

    const amountIn = ethers.parseEther("0.01");
    await (await vault.connect(user).depositNative("0x11", 0, { value: amountIn })).wait();

    const latest = await ethers.provider.getBlock("latest");
    const deadline = (latest!.timestamp) + 600;
    const params = {
      user: user.address, tokenOut: USDC, fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("fork"), nonce: 0n,
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

    // Conservative price ($100/ETH scaled 1e6) so the floor is well below the real swap output,
    // making the assertion robust to ETH price at any fork block.
    const priceUpdate = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [100_000_000n]);

    const before = await usdc.balanceOf(user.address);
    await (await vault.connect(agent).executeTrade(params, sig, priceUpdate)).wait();
    const got = (await usdc.balanceOf(user.address)) - before;

    console.log("        real swap output:", got.toString(), "USDC (6dec)");
    expect(got).to.be.greaterThan(1_000_000n); // > $1, above the ~$1 floor; real ~0.01 ETH worth
  });
});
