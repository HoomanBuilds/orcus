import { expect } from "chai";
import { ethers } from "hardhat";

describe("OrcusUSDC", () => {
  async function deploy() {
    const [owner, alice, bob] = await ethers.getSigners();
    const USDC = await ethers.getContractFactory("OrcusUSDC");
    const usdc = await USDC.deploy(owner.address);
    await usdc.waitForDeployment();
    return { usdc, owner, alice, bob };
  }

  it("has name, symbol, 18 decimals", async () => {
    const { usdc } = await deploy();
    expect(await usdc.name()).to.equal("Orcus USDC");
    expect(await usdc.symbol()).to.equal("oUSDC");
    expect(await usdc.decimals()).to.equal(18);
  });

  it("owner can mint before finishMinting", async () => {
    const { usdc, owner, alice } = await deploy();
    await usdc.connect(owner).mint(alice.address, 1000n);
    expect(await usdc.balanceOf(alice.address)).to.equal(1000n);
  });

  it("non-owner cannot mint", async () => {
    const { usdc, alice } = await deploy();
    await expect(usdc.connect(alice).mint(alice.address, 1n))
      .to.be.revertedWithCustomError(usdc, "OwnableUnauthorizedAccount");
  });

  it("mint reverts after finishMinting (one-way)", async () => {
    const { usdc, owner, alice } = await deploy();
    await usdc.connect(owner).finishMinting();
    expect(await usdc.mintingFinished()).to.equal(true);
    await expect(usdc.connect(owner).mint(alice.address, 1n))
      .to.be.revertedWith("minting finished");
  });

  it("standard ERC20 transfer works", async () => {
    const { usdc, owner, alice, bob } = await deploy();
    await usdc.connect(owner).mint(alice.address, 100n);
    await usdc.connect(alice).transfer(bob.address, 40n);
    expect(await usdc.balanceOf(bob.address)).to.equal(40n);
  });
});
