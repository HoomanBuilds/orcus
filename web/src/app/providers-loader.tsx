"use client";

import dynamic from "next/dynamic";

const ClientProviders = dynamic(
  () => import("./providers").then((module) => module.Providers),
  { ssr: false },
);

export function ProvidersLoader({ children }: { children: React.ReactNode }) {
  return <ClientProviders>{children}</ClientProviders>;
}
