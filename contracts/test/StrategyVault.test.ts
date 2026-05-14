import { expect } from "chai";
import { ethers } from "hardhat";

// exactInputSingle selector — must match contract constant
const EXACT_INPUT_SINGLE = "0x414bf389";

// Minimal tradeData: correct selector + 7 zero-padded params (224 bytes)
function mockTradeData(): string {
  return EXACT_INPUT_SINGLE + "00".repeat(32 * 7);
}

describe("StrategyVault", () => {
  async function deploy() {
    const [owner, user, agent, attacker] = await ethers.getSigners();
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();
    const Vault = await ethers.getContractFactory("StrategyVault");
    const vault = await Vault.deploy(agent.address, await mockRouter.getAddress());
    await vault.waitForDeployment();
    return { vault, mockRouter, owner, user, agent, attacker };
  }

  // ── constructor ──────────────────────────────────────────────────────────
  it("constructor sets owner, agent, and router", async () => {
    const { vault, mockRouter, owner, agent } = await deploy();
    expect(await vault.teeAgentAddress()).to.equal(agent.address);
    expect(await vault.jaineRouter()).to.equal(await mockRouter.getAddress());
    expect(await vault.owner()).to.equal(owner.address);
  });

  it("constructor reverts on zero addresses", async () => {
    const Vault = await ethers.getContractFactory("StrategyVault");
    const [, , agent] = await ethers.getSigners();
    const MockRouter = await ethers.getContractFactory("MockRouter");
    const mockRouter = await MockRouter.deploy();
    await mockRouter.waitForDeployment();
    await expect(Vault.deploy(ethers.ZeroAddress, await mockRouter.getAddress())).to.be.revertedWith("zero agent");
    await expect(Vault.deploy(agent.address, ethers.ZeroAddress)).to.be.revertedWith("zero router");
  });

  // ── pause ────────────────────────────────────────────────────────────────
  it("owner can pause and unpause", async () => {
    const { vault, owner, user } = await deploy();
    await vault.connect(owner).pause();
    expect(await vault.paused()).to.equal(true);
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    await expect(
      vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("paused");
    await vault.connect(owner).unpause();
    expect(await vault.paused()).to.equal(false);
  });

  it("non-owner cannot pause", async () => {
    const { vault, user } = await deploy();
    await expect(vault.connect(user).pause()).to.be.revertedWith("not owner");
  });

  // ── setAgent ─────────────────────────────────────────────────────────────
  it("owner can rotate agent address", async () => {
    const { vault, owner, attacker } = await deploy();
    await expect(vault.connect(owner).setAgent(attacker.address))
      .to.emit(vault, "AgentUpdated");
    expect(await vault.teeAgentAddress()).to.equal(attacker.address);
  });

  it("non-owner cannot rotate agent", async () => {
    const { vault, attacker } = await deploy();
    await expect(vault.connect(attacker).setAgent(attacker.address)).to.be.revertedWith("not owner");
  });

  // ── depositAndSetIntent ───────────────────────────────────────────────────
  it("depositAndSetIntent stores intent, credits balance, emits IntentSet with hash", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("ciphertext"));
    const value = ethers.parseEther("0.01");

    const tx = vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value });
    await expect(tx).to.emit(vault, "IntentSet");

    expect(await vault.balances(user.address)).to.equal(value);
    const intent = await vault.intents(user.address);
    expect(intent.maxSlippage).to.equal(50);
    expect(intent.stopLoss).to.equal(500);
    expect(intent.depositAmount).to.equal(value);
    expect(intent.active).to.equal(true);
  });

  it("reverts deposit with zero value", async () => {
    const { vault, user } = await deploy();
    await expect(
      vault.connect(user).depositAndSetIntent(ethers.hexlify(ethers.toUtf8Bytes("c")), 50, 500, { value: 0 })
    ).to.be.revertedWith("Must deposit funds");
  });

  it("reverts deposit with empty encryptedGoal", async () => {
    const { vault, user } = await deploy();
    await expect(
      vault.connect(user).depositAndSetIntent("0x", 50, 500, { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("empty intent");
  });

  it("reverts deposit when intent already active", async () => {
    const { vault, user } = await deploy();
    const encryptedGoal = ethers.hexlify(ethers.toUtf8Bytes("c"));
    const value = ethers.parseEther("0.01");
    await vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value });
    await expect(
      vault.connect(user).depositAndSetIntent(encryptedGoal, 50, 500, { value })
    ).to.be.revertedWith("intent already active");
  });

  // ── executeTradeWithProof ─────────────────────────────────────────────────
  it("only TEE agent can call executeTradeWithProof", async () => {
    const { vault, user, attacker } = await deploy();
    await vault
      .connect(user)
      .depositAndSetIntent(ethers.hexlify(ethers.toUtf8Bytes("c")), 50, 500, { value: ethers.parseEther("0.01") });
    await expect(
      vault.connect(attacker).executeTradeWithProof(user.address, mockTradeData(), "0x", ethers.ZeroHash, 0)
    ).to.be.revertedWith("Unauthorized");
  });

  it("rejects invalid calldata selector", async () => {
    const { vault, user, agent } = await deploy();
    await vault
      .connect(user)
      .depositAndSetIntent(ethers.hexlify(ethers.toUtf8Bytes("c")), 50, 500, { value: ethers.parseEther("0.01") });
    const badData = "0xdeadbeef" + "00".repeat(32 * 7);
    await expect(
      vault.connect(agent).executeTradeWithProof(user.address, badData, "0x", ethers.ZeroHash, 0)
    ).to.be.revertedWith("invalid selector");
  });

  it("rejects minAmountOut below slippage limit", async () => {
    const { vault, user, agent } = await deploy();
    const value = ethers.parseEther("0.01");
    // maxSlippage = 100 bps → floor = value * 9900 / 10000
    await vault.connect(user).depositAndSetIntent(ethers.hexlify(ethers.toUtf8Bytes("c")), 100, 500, { value });
    const floor = (value * 9900n) / 10000n;
    await expect(
      vault.connect(agent).executeTradeWithProof(user.address, mockTradeData(), "0x", ethers.ZeroHash, floor - 1n)
    ).to.be.revertedWith("minAmountOut below slippage limit");
  });

  it("agent executes: emits TradeExecuted, clears balance and intent, router receives ETH", async () => {
    const { vault, mockRouter, user, agent } = await deploy();
    const value = ethers.parseEther("0.01");
    // maxSlippage=0 → no floor check; minAmountOut=0 passes through
    await vault.connect(user).depositAndSetIntent(ethers.hexlify(ethers.toUtf8Bytes("c")), 0, 500, { value });

    const receiptHash = ethers.id("receipt-1");
    await expect(
      vault.connect(agent).executeTradeWithProof(user.address, mockTradeData(), "0xdeadbeef", receiptHash, 0)
    )
      .to.emit(vault, "TradeExecuted")
      .withArgs(user.address, receiptHash, "0xdeadbeef");

    expect(await vault.balances(user.address)).to.equal(0n);
    const intent = await vault.intents(user.address);
    expect(intent.active).to.equal(false);
    expect(await ethers.provider.getBalance(await mockRouter.getAddress())).to.equal(value);
  });

  // ── withdraw ──────────────────────────────────────────────────────────────
  it("withdraw refunds balance, emits Withdrawn, clears intent", async () => {
    const { vault, user } = await deploy();
    const value = ethers.parseEther("0.01");
    await vault.connect(user).depositAndSetIntent(ethers.hexlify(ethers.toUtf8Bytes("c")), 50, 500, { value });

    const tx = vault.connect(user).withdraw();
    await expect(tx).to.changeEtherBalance(user, value);
    await expect(tx).to.emit(vault, "Withdrawn").withArgs(user.address, value);

    expect(await vault.balances(user.address)).to.equal(0n);
    expect((await vault.intents(user.address)).active).to.equal(false);
  });

  it("withdraw reverts when nothing to withdraw", async () => {
    const { vault, user } = await deploy();
    await expect(vault.connect(user).withdraw()).to.be.revertedWith("Nothing to withdraw");
  });
});
