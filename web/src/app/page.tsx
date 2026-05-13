"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Home() {
  return (
    <main className="mx-auto max-w-xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Orcus</h1>
        <ConnectButton />
      </div>
      <p className="text-gray-500 text-sm">
        MEV-resistant dark pool trading agent — sealed TEE inference on 0G Galileo.
      </p>
      <nav className="flex flex-col gap-2">
        <Link href="/strategy" className="underline text-blue-600 hover:text-blue-800">
          Set Strategy
        </Link>
        <Link href="/dashboard" className="underline text-blue-600 hover:text-blue-800">
          Dashboard
        </Link>
        <Link href="/history" className="underline text-blue-600 hover:text-blue-800">
          Trade History
        </Link>
      </nav>
    </main>
  );
}
