import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const enc = (v: bigint) => ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [v]);

describe("OrcusOracle", () => {
  async function deploy(maxAge = 0) {
    const [owner, updater, other] = await ethers.getSigners();
    const O = await ethers.getContractFactory("OrcusOracle");
    const oracle = await O.deploy(owner.address, updater.address, maxAge);
    await oracle.waitForDeployment();
    return { oracle, owner, updater, other };
  }

  it("setPrice by updater; getExpectedOut = amountIn * price / 1e18", async () => {
    const { oracle, updater } = await deploy();
    await oracle.connect(updater).setPrice(ethers.parseEther("0.5"));
    const a = ethers.parseEther("4");
    expect(await oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, a)).to.equal(a / 2n);
  });

  it("updatePrice decodes ABI uint256 and stores it", async () => {
    const { oracle, updater } = await deploy();
    await oracle.connect(updater).updatePrice(enc(ethers.parseEther("0.25")));
    expect(await oracle.priceScaled()).to.equal(ethers.parseEther("0.25"));
    const a = ethers.parseEther("8");
    expect(await oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, a)).to.equal(a / 4n);
  });

  it("updatePrice rejects malformed data length", async () => {
    const { oracle, updater } = await deploy();
    await expect(oracle.connect(updater).updatePrice("0x1234")).to.be.revertedWith("bad price data");
  });

  it("updatePrice rejects zero price", async () => {
    const { oracle, updater } = await deploy();
    await expect(oracle.connect(updater).updatePrice(enc(0n))).to.be.revertedWith("zero price");
  });

  it("non-updater/non-owner cannot updatePrice or setPrice", async () => {
    const { oracle, other } = await deploy();
    await expect(oracle.connect(other).updatePrice(enc(1n))).to.be.revertedWith("not updater");
    await expect(oracle.connect(other).setPrice(1n)).to.be.revertedWith("not updater");
  });

  it("owner can also update", async () => {
    const { oracle, owner } = await deploy();
    await oracle.connect(owner).setPrice(ethers.parseEther("1"));
    expect(await oracle.priceScaled()).to.equal(ethers.parseEther("1"));
  });

  it("setUpdater changes who may update", async () => {
    const { oracle, owner, other } = await deploy();
    await expect(oracle.connect(other).updatePrice(enc(1n))).to.be.revertedWith("not updater");
    await oracle.connect(owner).setUpdater(other.address);
    await oracle.connect(other).updatePrice(enc(ethers.parseEther("2")));
    expect(await oracle.priceScaled()).to.equal(ethers.parseEther("2"));
  });

  it("reverts before any price is set", async () => {
    const { oracle } = await deploy();
    await expect(oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, 1n)).to.be.revertedWith("no price");
  });

  it("enforces staleness when maxAge > 0", async () => {
    const { oracle, updater } = await deploy(60);
    await oracle.connect(updater).setPrice(ethers.parseEther("1"));
    await time.increase(61);
    await expect(oracle.getExpectedOut(ethers.ZeroAddress, ethers.ZeroAddress, 1n)).to.be.revertedWith("stale price");
  });
});
