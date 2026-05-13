"use client";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { galileo } from "./chain";

export const wagmiConfig = getDefaultConfig({
  appName: "Orcus",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID ?? "orcus-dev",
  chains: [galileo],
  ssr: true,
});
