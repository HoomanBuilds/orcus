import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const FEE = 3000;
const SLIPPAGE_BPS = 100; // 1%

async function deployFixture() {
  const [owner, user, agent, attacker] = await ethers.getSigners();

  const USDC = await ethers.getContractFactory("OrcusUSDC");
  const usdc = await USDC.deploy(owner.address);

  const WN = await ethers.getContractFactory("WrappedNative");
  const wnative = await WN.deploy();

  const Router = await ethers.getContractFactory("OrcusRouter");
  const router = await Router.deploy(await usdc.getAddress(), owner.address);
  await usdc.connect(owner).mint(await router.getAddress(), ethers.parseEther("1000000"));

  const Oracle = await ethers.getContractFactory("OrcusOracle");
  const oracle = await Oracle.deploy();

  // agent is also the attestor in v1
  const Vault = await ethers.getContractFactory("StrategyVault");
  const vault = await Vault.deploy(
    agent.address, agent.address,
    await router.getAddress(), await oracle.getAddress(),
    await wnative.getAddress(), owner.address,
  );

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
