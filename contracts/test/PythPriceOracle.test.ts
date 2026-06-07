import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Arbitrary feed id used throughout the test suite
const FEED = "0x" + "11".repeat(32);

// ABI-encode updateData array as expected by PythPriceOracle.updatePrice
const encUpdateData = (arr: string[]) =>
  ethers.AbiCoder.defaultAbiCoder().encode(["bytes[]"], [arr]);

async function setup(maxAge = 60) {
  // MockPyth(uint validTimePeriod, uint singleUpdateFeeInWei)
  const Mock = await ethers.getContractFactory("MockPyth");
  const pyth = await Mock.deploy(maxAge, 1n);
  await pyth.waitForDeployment();

  const ERC = await ethers.getContractFactory("MockERC20");
  const tokenIn18 = await ERC.deploy("In18", "IN18", 18);
  const tokenOut6 = await ERC.deploy("Out6", "OUT6", 6);
  const tokenOut18 = await ERC.deploy("Out18", "OUT18", 18);
  await Promise.all([
    tokenIn18.waitForDeployment(),
    tokenOut6.waitForDeployment(),
    tokenOut18.waitForDeployment(),
  ]);

  const Oracle = await ethers.getContractFactory("PythPriceOracle");
  const oracle = await Oracle.deploy(await pyth.getAddress(), FEED, maxAge);
  await oracle.waitForDeployment();

  return { pyth, oracle, tokenIn18, tokenOut6, tokenOut18 };
}

// Named fixtures for loadFixture (each maxAge variant is a distinct fixture function)
async function baseFixture() { return setup(60); }
async function staleFixture() { return setup(30); }

// Build a MockPyth price feed update bytes for the given price / expo / publishTime.
// createPriceFeedUpdateData(bytes32 id, int64 price, uint64 conf, int32 expo,
//                           int64 emaPrice, uint64 emaConf, uint64 publishTime, uint64 prevPublishTime)
async function buildUpdateData(
  pyth: Awaited<ReturnType<typeof setup>>["pyth"],
  price: bigint,
  expo: number,
  publishTime: number
): Promise<string> {
  return pyth.createPriceFeedUpdateData(
    FEED,
    price,
    10n,
    expo,
    price,
    10n,
    BigInt(publishTime),
    0n
  );
}

describe("PythPriceOracle", () => {
  // ── constructor ──────────────────────────────────────────────────────────
  it("reverts on zero pyth address", async () => {
    const Oracle = await ethers.getContractFactory("PythPriceOracle");
    await expect(
      Oracle.deploy(ethers.ZeroAddress, FEED, 60)
    ).to.be.revertedWith("zero pyth");
  });

  it("reverts on zero feed id", async () => {
    const { pyth } = await loadFixture(baseFixture);
    const Oracle = await ethers.getContractFactory("PythPriceOracle");
    await expect(
      Oracle.deploy(await pyth.getAddress(), ethers.ZeroHash, 60)
    ).to.be.revertedWith("zero feed");
  });

  it("reverts on zero maxAge", async () => {
    const { pyth } = await loadFixture(baseFixture);
    const Oracle = await ethers.getContractFactory("PythPriceOracle");
    await expect(
      Oracle.deploy(await pyth.getAddress(), FEED, 0)
    ).to.be.revertedWith("zero maxAge");
  });

  // ── updatePrice forwards to Pyth ─────────────────────────────────────────
  it("updatePrice forwards VAA and subsequent getExpectedOut returns value", async () => {
    const { pyth, oracle, tokenIn18, tokenOut6 } = await loadFixture(baseFixture);
    const now = await time.latest();

    // price = 0.3 USD: price=30000000, expo=-8 → 30000000 * 10^-8 = 0.3
    const updateData = await buildUpdateData(pyth, 30000000n, -8, now);
    const encoded = encUpdateData([updateData]);
    const fee = await pyth.getUpdateFee([updateData]);

    await oracle.updatePrice(encoded, { value: fee });

    // 1 tokenIn (1e18) @ 0.3 USD → 300000 tokenOut (6 dec)
    const out = await oracle.getExpectedOut(
      await tokenIn18.getAddress(),
      await tokenOut6.getAddress(),
      ethers.parseUnits("1", 18)
    );
    expect(out).to.equal(300000n);
  });

  // ── 18-dec tokenIn → 6-dec tokenOut (H-05 decimals check) ──────────────
  it("18->6 dec: price=0.3 USD, amountIn=1e18 → expectedOut=300000", async () => {
    const { pyth, oracle, tokenIn18, tokenOut6 } = await loadFixture(baseFixture);
    const now = await time.latest();

    // price=30000000, expo=-8 → 30000000 * 1e-8 = 0.3
    const updateData = await buildUpdateData(pyth, 30000000n, -8, now);
    const fee = await pyth.getUpdateFee([updateData]);
    await pyth.updatePriceFeeds([updateData], { value: fee });

    const amountIn = ethers.parseUnits("1", 18); // 1e18
    const out = await oracle.getExpectedOut(
      await tokenIn18.getAddress(),
      await tokenOut6.getAddress(),
      amountIn
    );
    // expectedOut = 1e18 * 30000000 * 1e6 / (1e18 * 1e8) = 3e13 / 1e8 = 300000
    expect(out).to.equal(300000n);
  });

  // ── 18-dec tokenIn → 18-dec tokenOut ────────────────────────────────────
  it("18->18 dec: price=0.3 USD, amountIn=2e18 → expectedOut=6e17", async () => {
    const { pyth, oracle, tokenIn18, tokenOut18 } = await loadFixture(baseFixture);
    const now = await time.latest();

    // price=30000000, expo=-8 → 0.3
    const updateData = await buildUpdateData(pyth, 30000000n, -8, now);
    const fee = await pyth.getUpdateFee([updateData]);
    await pyth.updatePriceFeeds([updateData], { value: fee });

    const amountIn = ethers.parseUnits("2", 18); // 2e18
    const out = await oracle.getExpectedOut(
      await tokenIn18.getAddress(),
      await tokenOut18.getAddress(),
      amountIn
    );
    // expectedOut = 2e18 * 30000000 * 1e18 / (1e18 * 1e8) = 6e26 / 1e8 = 6e17
    expect(out).to.equal(ethers.parseUnits("0.6", 18));
  });

  // ── staleness — uses loadFixture so time.increase is rolled back afterward ──
  it("getExpectedOut reverts with StalePrice after maxAge", async () => {
    const { pyth, oracle, tokenIn18, tokenOut6 } = await loadFixture(staleFixture);
    const now = await time.latest();

    const updateData = await buildUpdateData(pyth, 30000000n, -8, now);
    const fee = await pyth.getUpdateFee([updateData]);
    await pyth.updatePriceFeeds([updateData], { value: fee });

    // advance time beyond maxAge (30s); loadFixture snapshot reverts this after the test
    await time.increase(31);

    await expect(
      oracle.getExpectedOut(
        await tokenIn18.getAddress(),
        await tokenOut6.getAddress(),
        ethers.parseUnits("1", 18)
      )
    ).to.be.revertedWithCustomError(pyth, "StalePrice");
  });

  // ── positive expo ────────────────────────────────────────────────────────
  it("positive expo: price=3, expo=0 (multiplied by 10^0), 18->6 dec", async () => {
    const { pyth, oracle, tokenIn18, tokenOut6 } = await loadFixture(baseFixture);
    const now = await time.latest();

    // price=3, expo=0 → $3 per token
    const updateData = await buildUpdateData(pyth, 3n, 0, now);
    const fee = await pyth.getUpdateFee([updateData]);
    await pyth.updatePriceFeeds([updateData], { value: fee });

    const amountIn = ethers.parseUnits("1", 18); // 1e18
    const out = await oracle.getExpectedOut(
      await tokenIn18.getAddress(),
      await tokenOut6.getAddress(),
      amountIn
    );
    // expectedOut = 1e18 * 3 * 1e6 * 1 / 1e18 = 3e6
    expect(out).to.equal(3_000_000n);
  });
});
