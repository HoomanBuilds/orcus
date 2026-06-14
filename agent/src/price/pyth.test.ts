import { describe, it, expect } from "vitest";
import { AbiCoder } from "ethers";
import { encodePythPriceUpdate } from "./pyth.js";

describe("encodePythPriceUpdate", () => {
  it("ABI-encodes update data as bytes[]", () => {
    const data = ["0xdead", "0xbeef"];
    const encoded = encodePythPriceUpdate(data);
    const [decoded] = AbiCoder.defaultAbiCoder().decode(["bytes[]"], encoded);
    expect(decoded).to.deep.equal(data);
  });

  it("round-trips a single update", () => {
    const data = ["0x504e4155"];
    const [decoded] = AbiCoder.defaultAbiCoder().decode(["bytes[]"], encodePythPriceUpdate(data));
    expect(decoded[0]).to.equal("0x504e4155");
  });
});
