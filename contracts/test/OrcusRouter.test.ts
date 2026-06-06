import { expect } from "chai";
import { ethers } from "hardhat";

describe("OrcusRouter", () => {
  async function deploy() {
    const [owner, caller, recipient, attacker] = await ethers.getSigners();
    const USDC = await ethers.getContractFactory("OrcusUSDC");
    const usdc = await USDC.deploy(owner.address);
    const W = await ethers.getContractFactory("WrappedNative");
    const wnative = await W.deploy();
    const Oracle = await ethers.getContractFactory("OrcusOracle");
    const oracle = await Oracle.deploy(owner.address, owner.address, 0);
    await oracle.connect(owner).setPrice(ethers.parseEther("0.5")); // 0.5 oUSDC per wnative
    const Router = await ethers.getContractFactory("OrcusRouter");
    const router = await Router.deploy(await usdc.getAddress(), await oracle.getAddress(), owner.address);
    await usdc.connect(owner).mint(await router.getAddress(), ethers.parseEther("1000000"));
    await wnative.connect(caller).deposit({ value: ethers.parseEther("10") });
    await wnative.connect(caller).approve(await router.getAddress(), ethers.MaxUint256);
    return { router, usdc, wnative, oracle, owner, caller, recipient, attacker };
  }

  function params(wnative: string, usdc: string, recipient: string, amountIn: bigint, minOut: bigint) {
    return {
      tokenIn: wnative, tokenOut: usdc, fee: 3000, recipient,
      deadline: Math.floor(Date.now() / 1000) + 300,
      amountIn, amountOutMinimum: minOut, sqrtPriceLimitX96: 0n,
    };
  }

  it("pulls tokenIn via transferFrom and pays tokenOut at the oracle price (0.5)", async () => {
    const { router, usdc, wnative, caller, recipient } = await deploy();
    const amountIn = ethers.parseEther("2");
    await router.connect(caller).exactInputSingle(
      params(await wnative.getAddress(), await usdc.getAddress(), recipient.address, amountIn, 0n),
    );
    expect(await usdc.balanceOf(recipient.address)).to.equal(amountIn / 2n);
    expect(await wnative.balanceOf(await router.getAddress())).to.equal(amountIn);
  });

  it("reverts when output below amountOutMinimum", async () => {
    const { router, usdc, wnative, caller, recipient } = await deploy();
    const amountIn = ethers.parseEther("2");
    await expect(router.connect(caller).exactInputSingle(
      params(await wnative.getAddress(), await usdc.getAddress(), recipient.address, amountIn, amountIn),
    )).to.be.revertedWith("slippage");
  });

  it("withdraw is owner-only", async () => {
    const { router, usdc, attacker, owner } = await deploy();
    await expect(router.connect(attacker).withdraw(await usdc.getAddress(), 1n))
      .to.be.revertedWith("not owner");
    await expect(router.connect(owner).withdraw(await usdc.getAddress(), 1n)).to.not.be.reverted;
  });
});
