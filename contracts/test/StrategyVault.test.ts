import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

const FEE = 3000;
const SLIPPAGE_BPS = 100; // 1%

// price update payload for the mock oracle: ABI-encoded priceScaled (0.5 oUSDC per wnative)
const PRICE_UPDATE = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("0.5")]);

async function deployFixture() {
  const [owner, user, agent, attacker] = await ethers.getSigners();

  const USDC = await ethers.getContractFactory("OrcusUSDC");
  const usdc = await USDC.deploy(owner.address);

  const WN = await ethers.getContractFactory("WrappedNative");
  const wnative = await WN.deploy();

  const Oracle = await ethers.getContractFactory("OrcusOracle");
  const oracle = await Oracle.deploy(owner.address, owner.address, 0);
  await oracle.connect(owner).setPrice(ethers.parseEther("0.5")); // 0.5 oUSDC per wnative

  const Router = await ethers.getContractFactory("OrcusRouter");
  const router = await Router.deploy(await usdc.getAddress(), await oracle.getAddress(), owner.address);
  await usdc.connect(owner).mint(await router.getAddress(), ethers.parseEther("1000000"));

  // agent is also the attestor in v1
  const Vault = await ethers.getContractFactory("StrategyVault");
  const vault = await Vault.deploy(
    agent.address, agent.address,
    await router.getAddress(), await oracle.getAddress(),
    await wnative.getAddress(), owner.address,
  );

  // the vault is the oracle's price updater (it calls updatePrice during executeTrade)
  await oracle.connect(owner).setUpdater(await vault.getAddress());

  return { vault, usdc, wnative, router, oracle, owner, user, agent, attacker };
}

// EIP-712 signer for ExecParams. `signer` is the attestor key.
async function signExec(
  vault: any, signer: HardhatEthersSigner,
  p: { user: string; tokenOut: string; fee: number; agentMinOut: bigint; deadline: number; receiptHash: string; nonce: bigint },
) {
  const net = await ethers.provider.getNetwork();
  const domain = {
    name: "Orcus", version: "1",
    chainId: Number(net.chainId),
    verifyingContract: await vault.getAddress(),
  };
  const types = {
    ExecParams: [
      { name: "user", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "agentMinOut", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "receiptHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
    ],
  };
  return signer.signTypedData(domain, types, p);
}

const goal = () => ethers.hexlify(ethers.toUtf8Bytes("ciphertext"));

describe("StrategyVault: deposits & withdraw", () => {
  it("depositNative wraps native, records intent, emits IntentSet", async () => {
    const { vault, wnative, user } = await deployFixture();
    const value = ethers.parseEther("1");
    await expect(vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value }))
      .to.emit(vault, "IntentSet");
    const it = await vault.intents(user.address);
    expect(it.tokenIn).to.equal(await wnative.getAddress());
    expect(it.amountIn).to.equal(value);
    expect(it.maxSlippageBps).to.equal(SLIPPAGE_BPS);
    expect(it.active).to.equal(true);
    expect(await wnative.balanceOf(await vault.getAddress())).to.equal(value);
  });

  it("rejects depositNative with zero value / empty goal / slippage > 10000", async () => {
    const { vault, user } = await deployFixture();
    await expect(vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value: 0 }))
      .to.be.revertedWith("no value");
    await expect(vault.connect(user).depositNative("0x", SLIPPAGE_BPS, { value: 1n }))
      .to.be.revertedWith("empty intent");
    await expect(vault.connect(user).depositNative(goal(), 10001, { value: 1n }))
      .to.be.revertedWith("slippage too high");
  });

  it("rejects a second active intent", async () => {
    const { vault, user } = await deployFixture();
    const value = ethers.parseEther("1");
    await vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value });
    await expect(vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value }))
      .to.be.revertedWith("active intent");
  });

  it("depositToken pulls ERC20 via transferFrom", async () => {
    const { vault, usdc, owner, user } = await deployFixture();
    await usdc.connect(owner).mint(user.address, ethers.parseEther("5"));
    await usdc.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(user).depositToken(await usdc.getAddress(), ethers.parseEther("5"), goal(), SLIPPAGE_BPS);
    const it = await vault.intents(user.address);
    expect(it.tokenIn).to.equal(await usdc.getAddress());
    expect(it.amountIn).to.equal(ethers.parseEther("5"));
  });

  it("withdraw unwraps native and returns funds, clears intent", async () => {
    const { vault, user } = await deployFixture();
    const value = ethers.parseEther("1");
    await vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value });
    await expect(vault.connect(user).withdraw()).to.changeEtherBalance(user, value);
    expect((await vault.intents(user.address)).active).to.equal(false);
  });

  it("withdraw reverts when nothing", async () => {
    const { vault, user } = await deployFixture();
    await expect(vault.connect(user).withdraw()).to.be.revertedWith("nothing");
  });
});

describe("StrategyVault: execution (C-01, happy path)", () => {
  async function setup() {
    const f = await deployFixture();
    const value = ethers.parseEther("2");
    await f.vault.connect(f.user).depositNative(goal(), SLIPPAGE_BPS, { value });
    return { ...f, value };
  }

  it("agent executes; output (0.5x) credited to USER, never to agent", async () => {
    const { vault, usdc, agent, user, value } = await setup();
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE))
      .to.emit(vault, "TradeExecuted")
      .withArgs(user.address, await usdc.getAddress(), value / 2n, p.receiptHash);
    expect(await usdc.balanceOf(user.address)).to.equal(value / 2n);
    expect(await usdc.balanceOf(agent.address)).to.equal(0n);
    expect((await vault.intents(user.address)).active).to.equal(false);
    expect(await vault.intentNonce(user.address)).to.equal(1n);
  });

  it("agent cannot redirect output: recipient is hardwired to the vault", async () => {
    const { vault, usdc, agent, user, attacker, value } = await setup();
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE);
    expect(await usdc.balanceOf(attacker.address)).to.equal(0n);
    expect(await usdc.balanceOf(user.address)).to.equal(value / 2n);
  });

  it("non-agent cannot call executeTrade", async () => {
    const { vault, usdc, agent, user, attacker } = await setup();
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(attacker).executeTrade(p, sig, PRICE_UPDATE)).to.be.revertedWith("not agent");
  });
});

describe("StrategyVault: slippage floor (C-02, H-04, H-07)", () => {
  async function setup(slippageBps: number) {
    const f = await deployFixture();
    const value = ethers.parseEther("2");
    await f.vault.connect(f.user).depositNative(goal(), slippageBps, { value });
    return { ...f, value };
  }

  it("oracle-grounded floor passes an honest 0.5x trade at 1% slippage", async () => {
    const { vault, usdc, agent, user, value } = await setup(SLIPPAGE_BPS);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.emit(vault, "TradeExecuted");
    expect(await usdc.balanceOf(user.address)).to.equal(value / 2n);
  });

  it("reverts when realised output is below the oracle floor", async () => {
    const { vault, usdc, agent, user, value } = await setup(0);
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: value, // demand 1:1 — impossible at 0.5x
      deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.be.revertedWith("slippage");
  });

  it("deadline in the past reverts (H-07)", async () => {
    const { vault, usdc, agent, user } = await setup(SLIPPAGE_BPS);
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline: 1, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.be.revertedWith("expired");
  });

  it("maxSlippageBps > 10000 is rejected at deposit (H-04)", async () => {
    const { vault, user } = await deployFixture();
    await expect(vault.connect(user).depositNative(goal(), 10001, { value: ethers.parseEther("1") }))
      .to.be.revertedWith("slippage too high");
  });
});

describe("StrategyVault: attestation & replay (H-01)", () => {
  async function setup() {
    const f = await deployFixture();
    await f.vault.connect(f.user).depositNative(goal(), SLIPPAGE_BPS, { value: ethers.parseEther("2") });
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const p = {
      user: f.user.address, tokenOut: await f.usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    return { ...f, p };
  }

  it("rejects a signature from a non-attestor key", async () => {
    const { vault, agent, attacker, p } = await setup();
    const badSig = await signExec(vault, attacker, p); // attacker != attestor(agent)
    await expect(vault.connect(agent).executeTrade(p, badSig, PRICE_UPDATE)).to.be.revertedWith("bad attestation");
  });

  it("rejects a wrong-chainId domain signature", async () => {
    const { vault, agent, p } = await setup();
    const domain = {
      name: "Orcus", version: "1", chainId: 999999,
      verifyingContract: await vault.getAddress(),
    };
    const types = {
      ExecParams: [
        { name: "user", type: "address" }, { name: "tokenOut", type: "address" },
        { name: "fee", type: "uint24" }, { name: "agentMinOut", type: "uint256" },
        { name: "deadline", type: "uint256" }, { name: "receiptHash", type: "bytes32" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const wrongChainSig = await agent.signTypedData(domain, types, p);
    await expect(vault.connect(agent).executeTrade(p, wrongChainSig, PRICE_UPDATE)).to.be.revertedWith("bad attestation");
  });

  it("nonce replay reverts (each execution bumps the nonce)", async () => {
    const { vault, agent, p } = await setup();
    const sig = await signExec(vault, agent, p);
    await vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE); // nonce 0 consumed
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.be.revertedWith("bad nonce");
  });
});

describe("StrategyVault: escape hatch & admin (M-06, H-03, H-06)", () => {
  it("requestCancel then cooldown blocks agent execution; user can withdraw", async () => {
    const { vault, usdc, agent, user } = await deployFixture();
    await vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value: ethers.parseEther("2") });
    await vault.connect(user).requestCancel();
    await time.increase(3601); // > CANCEL_COOLDOWN (1h)
    const deadline = (await time.latest()) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.be.revertedWith("cancelling");
    await expect(vault.connect(user).withdraw()).to.changeEtherBalance(user, ethers.parseEther("2"));
  });

  it("owner transfer is 2-step (Ownable2Step)", async () => {
    const { vault, owner, attacker } = await deployFixture();
    await vault.connect(owner).transferOwnership(attacker.address);
    expect(await vault.owner()).to.equal(owner.address); // not yet
    await vault.connect(attacker).acceptOwnership();
    expect(await vault.owner()).to.equal(attacker.address);
  });

  it("setAgent/setAttestor owner-only and reject zero", async () => {
    const { vault, owner, attacker, user } = await deployFixture();
    await expect(vault.connect(attacker).setAgent(attacker.address))
      .to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");
    await expect(vault.connect(owner).setAgent(ethers.ZeroAddress)).to.be.revertedWith("zero agent");
    await expect(vault.connect(owner).setAgent(user.address)).to.emit(vault, "AgentUpdated");
  });

  it("setSwapRouter rejects an EOA (code.length check, H-06)", async () => {
    const { vault, owner, attacker } = await deployFixture();
    await expect(vault.connect(owner).setSwapRouter(attacker.address)).to.be.revertedWith("router not contract");
  });

  it("paused blocks deposit and execute", async () => {
    const { vault, owner, user } = await deployFixture();
    await vault.connect(owner).pause();
    await expect(vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value: 1n }))
      .to.be.revertedWithCustomError(vault, "EnforcedPause");
  });
});

describe("StrategyVault: additional coverage", () => {
  it("withdraw returns an ERC20 tokenIn (depositToken path)", async () => {
    const { vault, owner, user } = await deployFixture();
    // a generic ERC20 acting as tokenIn (a second WrappedNative used as a plain token)
    const Tok = await ethers.getContractFactory("WrappedNative");
    const tok = await Tok.deploy();
    await tok.connect(user).deposit({ value: ethers.parseEther("3") });
    await tok.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(user).depositToken(await tok.getAddress(), ethers.parseEther("3"), goal(), SLIPPAGE_BPS);
    const before = await tok.balanceOf(user.address);
    await vault.connect(user).withdraw();
    expect(await tok.balanceOf(user.address)).to.equal(before + ethers.parseEther("3"));
    expect((await vault.intents(user.address)).active).to.equal(false);
  });

  it("executeTrade reverts 'no intent' when the user has none", async () => {
    const { vault, usdc, agent, user } = await deployFixture();
    const deadline = (await time.latest()) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.be.revertedWith("no intent");
  });

  it("double withdraw: second call reverts 'nothing'", async () => {
    const { vault, user } = await deployFixture();
    await vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value: ethers.parseEther("1") });
    await vault.connect(user).withdraw();
    await expect(vault.connect(user).withdraw()).to.be.revertedWith("nothing");
  });

  it("executes an ERC20-in swap and credits oUSDC to the user", async () => {
    const { vault, usdc, agent, user } = await deployFixture();
    const Tok = await ethers.getContractFactory("WrappedNative");
    const tok = await Tok.deploy();
    const amt = ethers.parseEther("4");
    await tok.connect(user).deposit({ value: amt });
    await tok.connect(user).approve(await vault.getAddress(), ethers.MaxUint256);
    await vault.connect(user).depositToken(await tok.getAddress(), amt, goal(), SLIPPAGE_BPS);
    const deadline = (await time.latest()) + 300;
    const p = {
      user: user.address, tokenOut: await usdc.getAddress(), fee: FEE,
      agentMinOut: 0n, deadline, receiptHash: ethers.id("r1"), nonce: 0n,
    };
    const sig = await signExec(vault, agent, p);
    await expect(vault.connect(agent).executeTrade(p, sig, PRICE_UPDATE)).to.emit(vault, "TradeExecuted");
    expect(await usdc.balanceOf(user.address)).to.equal(amt / 2n);
  });

  it("requestCancel cannot be called twice", async () => {
    const { vault, user } = await deployFixture();
    await vault.connect(user).depositNative(goal(), SLIPPAGE_BPS, { value: ethers.parseEther("1") });
    await vault.connect(user).requestCancel();
    await expect(vault.connect(user).requestCancel()).to.be.revertedWith("already requested");
  });
});
