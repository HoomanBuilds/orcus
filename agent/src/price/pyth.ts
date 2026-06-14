import { AbiCoder, Contract, JsonRpcProvider, Wallet } from "ethers";

const HERMES = "https://hermes.pyth.network";

const ADAPTER_ABI = [
  "function pyth() view returns (address)",
  "function feedId() view returns (bytes32)",
];
const PYTH_ABI = ["function getUpdateFee(bytes[] updateData) view returns (uint256)"];

/** Fetch the latest Hermes price-update VAA(s) for a feed; returns 0x-prefixed bytes. */
export async function fetchHermesUpdateData(feedId: string): Promise<string[]> {
  const id = feedId.replace(/^0x/, "");
  const url = `${HERMES}/v2/updates/price/latest?ids[]=${id}&encoding=hex`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`hermes ${res.status}`);
  const body = (await res.json()) as { binary?: { data?: string[] } };
  const data = body.binary?.data;
  if (!data || data.length === 0) throw new Error("hermes: no update data");
  return data.map((d) => (d.startsWith("0x") ? d : `0x${d}`));
}

/** ABI-encode Hermes update data as the `priceUpdate` bytes the vault forwards to Pyth. */
export function encodePythPriceUpdate(updateData: string[]): string {
  return AbiCoder.defaultAbiCoder().encode(["bytes[]"], [updateData]);
}

/**
 * Build the priceUpdate payload + fee for a Pyth-backed chain.
 * Reads the adapter's pyth()/feedId(), fetches the Hermes VAA, prices the update fee.
 * NOTE: requires a live Pyth deployment + Hermes; not exercised on Galileo (mock mode).
 */
export async function buildPythPriceUpdate(
  provider: JsonRpcProvider,
  wallet: Wallet,
  oracleAddr: string,
): Promise<{ priceUpdate: string; value: bigint }> {
  const adapter = new Contract(oracleAddr, ADAPTER_ABI, provider);
  const [pythAddr, feedId] = await Promise.all([
    adapter["pyth"]() as Promise<string>,
    adapter["feedId"]() as Promise<string>,
  ]);
  const updateData = await fetchHermesUpdateData(feedId);
  const pyth = new Contract(pythAddr, PYTH_ABI, provider);
  const value = (await pyth["getUpdateFee"](updateData)) as bigint;
  return { priceUpdate: encodePythPriceUpdate(updateData), value };
}
