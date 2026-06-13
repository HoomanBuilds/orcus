import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { galileo, arbitrumSepolia, baseSepolia, avalancheFuji, mantleSepoliaTestnet } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Orcus",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "orcus-dev",
  chains: [galileo, arbitrumSepolia, baseSepolia, avalancheFuji, mantleSepoliaTestnet],
  ssr: true,
});
