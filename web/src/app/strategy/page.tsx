"use client";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { encryptIntentBrowser } from "@/lib/encrypt";
import { vaultAbi } from "@/lib/vaultAbi";
import { SWAP_TARGETS, DEFAULT_TOKEN_OUT, type SwapTargetSymbol } from "@/lib/tokens";
import Link from "next/link";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;
const AGENT_PUB = process.env.NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY || "";

export default function StrategyPage() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [goal, setGoal] = useState("");
  const [tokenOut, setTokenOut] = useState<SwapTargetSymbol>(DEFAULT_TOKEN_OUT);
  const [amount, setAmount] = useState("0.01");
  const [maxSlippage, setMaxSlippage] = useState(50);
  const [stopLoss, setStopLoss] = useState(500);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!address || !VAULT || !AGENT_PUB) return;
    setError(null);
    try {
      const ciphertext = encryptIntentBrowser(AGENT_PUB, {
        goal,
        tokenOut,
        ts: Date.now(),
      });
      const tx = await writeContractAsync({
        abi: vaultAbi,
        address: VAULT,
        functionName: "depositAndSetIntent",
        args: [ciphertext, BigInt(maxSlippage), BigInt(stopLoss)],
        value: parseEther(amount),
      });
      setHash(tx);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transaction failed");
    }
  }

  const selectedTarget = SWAP_TARGETS.find((t) => t.symbol === tokenOut);

  return (
    <main className="mx-auto max-w-xl p-8 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Set Strategy</h1>
        <ConnectButton />
      </div>

      {!address && (
        <p className="text-gray-500 text-sm">Connect your wallet to set a strategy.</p>
      )}

      <div>
        <label className="text-xs text-gray-500 block mb-1">Goal (encrypted — agent reads this inside TEE)</label>
        <textarea
          className="w-full border rounded p-2 font-mono text-sm"
          rows={2}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. swap when price dips 1%"
        />
      </div>

      <div>
        <label className="text-xs text-gray-500 block mb-1">Swap OG → (select output token)</label>
        <div className="grid grid-cols-3 gap-2">
          {SWAP_TARGETS.map((t) => (
            <button
              key={t.symbol}
              onClick={() => setTokenOut(t.symbol)}
              className={`border rounded p-2 text-sm text-left transition-colors ${
                tokenOut === t.symbol
                  ? "border-black bg-black text-white"
                  : "border-gray-300 hover:border-gray-500"
              }`}
            >
              <div className="font-semibold">{t.symbol}</div>
              <div className="text-xs opacity-70 truncate">{t.label}</div>
            </button>
          ))}
        </div>
        {selectedTarget && (
          <p className="text-xs text-gray-400 mt-1 font-mono">
            pool: {selectedTarget.pool.slice(0, 10)}…{selectedTarget.pool.slice(-6)}
            {" · "}
            <a
              href={`https://chainscan-galileo.0g.ai/address/${selectedTarget.pool}`}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              verify
            </a>
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-gray-500">Amount (OG)</label>
          <input
            className="w-full border rounded p-2 text-sm"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Max slippage (bps)</label>
          <input
            className="w-full border rounded p-2 text-sm"
            type="number"
            value={maxSlippage}
            onChange={(e) => setMaxSlippage(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Stop loss (bps)</label>
          <input
            className="w-full border rounded p-2 text-sm"
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(Number(e.target.value))}
          />
        </div>
      </div>

      <button
        disabled={isPending || !address || !VAULT || !AGENT_PUB}
        onClick={submit}
        className="w-full rounded bg-black text-white px-4 py-2 disabled:opacity-40 hover:bg-gray-800 transition-colors"
      >
        {isPending ? "Submitting…" : `Encrypt & Deposit → ${tokenOut}`}
      </button>

      {!VAULT && <p className="text-red-500 text-xs">NEXT_PUBLIC_VAULT_ADDRESS not set.</p>}
      {!AGENT_PUB && <p className="text-red-500 text-xs">NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY not set.</p>}

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {hash && (
        <p className="text-sm break-all">
          tx:{" "}
          <a
            className="underline text-blue-600"
            href={`https://chainscan-galileo.0g.ai/tx/${hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {hash}
          </a>
        </p>
      )}

      <nav className="flex gap-4 text-sm pt-2 border-t">
        <Link href="/" className="underline text-blue-600">Home</Link>
        <Link href="/dashboard" className="underline text-blue-600">Dashboard</Link>
      </nav>
    </main>
  );
}
