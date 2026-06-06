import { expect } from "chai";
import { ethers } from "hardhat";

describe("OrcusOracle", () => {
  it("returns expected out at the same fixed rate as the router (0.5)", async () => {
    const O = await ethers.getContractFactory("OrcusOracle");
    const oracle = await O.deploy();
    await oracle.waitForDeployment();
    const a = ethers.parseEther("4");
    const out = await oracle.getExpectedOut(
      "0x0000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000002",
      a,
    );
    expect(out).to.equal(a / 2n);
  });
});
