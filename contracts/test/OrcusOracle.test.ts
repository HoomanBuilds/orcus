import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("OrcusOracle", () => {
  async function deploy(maxAge = 0) {
    const [owner, updater, other] = await ethers.getSigners();
    const O = await ethers.getContractFactory("OrcusOracle");
    const oracle = await O.deploy(owner.address, updater.address, maxAge);
    await oracle.waitForDeployment();
    return { oracle, owner, updater, other };
  }

  it("updater pushes price; getExpectedOut = amountIn * price / 1e18", async () => {
    const { oracle, updater } = await deploy();
    await oracle.connect(updater).setPrice(ethers.parseEther("0.5"));
    const a = ethers.parseEther("4");
    expect(await oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, a)).to.equal(a / 2n);
  });

  it("reverts before any price is set", async () => {
    const { oracle } = await deploy();
    await expect(oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, 1n)).to.be.revertedWith("no price");
  });

  it("non-updater/non-owner cannot setPrice", async () => {
    const { oracle, other } = await deploy();
    await expect(oracle.connect(other).setPrice(1n)).to.be.revertedWith("not updater");
  });

  it("owner can also setPrice", async () => {
    const { oracle, owner } = await deploy();
    await oracle.connect(owner).setPrice(ethers.parseEther("1"));
    expect(await oracle.priceScaled()).to.equal(ethers.parseEther("1"));
  });

  it("rejects zero price", async () => {
    const { oracle, updater } = await deploy();
    await expect(oracle.connect(updater).setPrice(0)).to.be.revertedWith("zero price");
  });

  it("enforces staleness when maxAge > 0", async () => {
    const { oracle, updater } = await deploy(60);
    await oracle.connect(updater).setPrice(ethers.parseEther("1"));
    await time.increase(61);
    await expect(oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, 1n)).to.be.revertedWith("stale price");
  });
});
