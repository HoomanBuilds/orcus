import { expect } from "chai";
import { ethers } from "hardhat";

describe("StrategyVault", () => {
  async function deploy() {
    const [owner, user, agent, attacker] = await ethers.getSigners();
    const Vault = await ethers.getContractFactory("StrategyVault");
    const vault = await Vault.deploy(agent.address);
    await vault.waitForDeployment();
    return { vault, owner, user, agent, attacker };
  }

  it("constructor sets the TEE agent address", async () => {
    const { vault, agent } = await deploy();
    expect(await vault.teeAgentAddress()).to.equal(agent.address);
  });

  it("depositAndSetIntent stores encrypted intent and credits balance", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("ciphertext"));
    const value = ethers.parseEther("0.01");

    await expect(
      vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value })
    )
      .to.emit(vault, "IntentSet")
      .withArgs(user.address, value);

    expect(await vault.balances(user.address)).to.equal(value);
    const intent = await vault.intents(user.address);
    expect(intent.maxSlippage).to.equal(50);
    expect(intent.stopLoss).to.equal(500);
    expect(intent.active).to.equal(true);
  });

  it("reverts deposit with zero value", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await expect(
      vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value: 0 })
    ).to.be.revertedWith("Must deposit funds");
  });

  it("only TEE agent can call executeTradeWithProof", async () => {
    const { vault, user, attacker } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await vault
      .connect(user)
      .depositAndSetIntent(encryptedGoal, 50, 500, { value: ethers.parseEther("0.01") });

    await expect(
      vault
        .connect(attacker)
        .executeTradeWithProof(user.address, "0x", "0x", ethers.ZeroHash)
    ).to.be.revertedWith("Unauthorized");
  });

  it("agent can execute and emits TradeExecuted", async () => {
    const { vault, user, agent } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await vault
      .connect(user)
      .depositAndSetIntent(encryptedGoal, 50, 500, { value: ethers.parseEther("0.01") });

    const receiptHash = ethers.id("receipt-1");
    await expect(
      vault
        .connect(agent)
        .executeTradeWithProof(user.address, "0x", "0xdeadbeef", receiptHash)
    )
      .to.emit(vault, "TradeExecuted")
      .withArgs(user.address, receiptHash, "0xdeadbeef");
  });

  it("user can withdraw their balance and clears intent", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    const value = ethers.parseEther("0.01");
    await vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value });

    await expect(vault.connect(user).withdraw()).to.changeEtherBalance(user, value);
    expect(await vault.balances(user.address)).to.equal(0n);
    const intent = await vault.intents(user.address);
    expect(intent.active).to.equal(false);
  });

  it("withdraw reverts when nothing to withdraw", async () => {
    const { vault, user } = await deploy();
    await expect(vault.connect(user).withdraw()).to.be.revertedWith("Nothing to withdraw");
  });
});
