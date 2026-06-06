import { expect } from "chai";
import { ethers } from "hardhat";

describe("WrappedNative", () => {
  async function deploy() {
    const [user] = await ethers.getSigners();
    const W = await ethers.getContractFactory("WrappedNative");
    const w = await W.deploy();
    await w.waitForDeployment();
    return { w, user };
  }

  it("deposit mints wrapped 1:1 and increases backing", async () => {
    const { w, user } = await deploy();
    await w.connect(user).deposit({ value: 1000n });
    expect(await w.balanceOf(user.address)).to.equal(1000n);
    expect(await ethers.provider.getBalance(await w.getAddress())).to.equal(1000n);
  });

  it("withdraw burns wrapped and returns native", async () => {
    const { w, user } = await deploy();
    await w.connect(user).deposit({ value: 1000n });
    await expect(w.connect(user).withdraw(400n)).to.changeEtherBalance(user, 400n);
    expect(await w.balanceOf(user.address)).to.equal(600n);
  });

  it("withdraw reverts when over balance", async () => {
    const { w, user } = await deploy();
    await w.connect(user).deposit({ value: 100n });
    await expect(w.connect(user).withdraw(200n))
      .to.be.revertedWithCustomError(w, "ERC20InsufficientBalance");
  });
});
