"use client";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { encryptIntentBrowser } from "@/lib/encrypt";
import { vaultAbi } from "@/lib/vaultAbi";

const VAULT = process.env.NEXT_PUBLIC_VAULT_ADDRESS as `0x${string}`;
const AGENT_PUB = process.env.NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY as string;

export default function StrategyPage() {
  const { address } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [goal, setGoal] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [maxSlippage, setMaxSlippage] = useState(50);
  const [stopLoss, setStopLoss] = useState(500);
  const [hash, setHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!address || !VAULT || !AGENT_PUB) return;
    setError(null);
    try {
      const ciphertext = encryptIntentBrowser(AGENT_PUB, { goal, ts: Date.now() });
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

  return (
    <main className="mx-auto max-w-xl p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Set Strategy</h1>
        <ConnectButton />
      </div>

      <textarea
        className="w-full border rounded p-2 font-mono text-sm"
        rows={3}
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder='e.g. swap 0.01 OG to USDT when price dips 1%'
      />

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
        disabled={isPending || !address}
        onClick={submit}
        className="w-full rounded bg-black text-white px-4 py-2 disabled:opacity-40 hover:bg-gray-800 transition-colors"
      >
        {isPending ? "Submitting…" : "Encrypt & Deposit"}
      </button>

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
    </main>
  );
}
