import { createDAppKit } from "@mysten/dapp-kit-react";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { SUI_CHAIN } from "./chains";

export const suiDAppKit = createDAppKit({
  networks: ["testnet"],
  defaultNetwork: "testnet",
  createClient: () => new SuiGrpcClient({ network: "testnet", baseUrl: SUI_CHAIN.rpcUrls[0] }),
});

declare module "@mysten/dapp-kit-react" {
  interface Register {
    dAppKit: typeof suiDAppKit;
  }
}
