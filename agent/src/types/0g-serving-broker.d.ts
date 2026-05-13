declare module "@0glabs/0g-serving-broker" {
  import type { Wallet } from "ethers";
  export function createZGComputeNetworkBroker(wallet: Wallet): Promise<unknown>;
}
