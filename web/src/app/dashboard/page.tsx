"use client";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { vaultAbi } from "@/lib/vaultAbi";
import Link from "next/link";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;

export default function Dashboard() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: vaultAbi,
    address: VAULT,
    functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT },
  });

  const { data: intent, refetch: refetchIntent } = useReadContract({
    abi: vaultAbi,
    address: VAULT,
    functionName: "intents",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT },
  });

  function withdraw() {
    writeContract({ abi: vaultAbi, address: VAULT, functionName: "withdraw" });
  }

  if (isSuccess) {
    refetchBalance();
    refetchIntent();
  }

  return (
    <main className="mx-auto max-w-xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <ConnectButton />
      </div>

      {!address && (
        <p className="text-gray-500 text-sm">Connect your wallet to view your vault position.</p>
      )}

      {address && !VAULT && (
        <p className="text-red-500 text-sm">NEXT_PUBLIC_VAULT_ADDRESS not set.</p>
      )}

      {address && VAULT && (
        <div className="space-y-4">
          <div className="border rounded p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vault balance</span>
              <span className="font-mono font-semibold">
                {balance !== undefined ? `${formatEther(balance)} OG` : "—"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Intent active</span>
              {/* intents() returns a tuple: [encryptedGoal, maxSlippage, stopLoss, depositAmount, active] */}
              <span className={intent?.[4] ? "text-green-600 font-semibold" : "text-gray-400"}>
                {intent ? (intent[4] ? "Yes" : "No") : "—"}
              </span>
            </div>
            {intent?.[4] && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Max slippage</span>
                  <span className="font-mono">{intent[1]?.toString()} bps</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Stop loss</span>
                  <span className="font-mono">{intent[2]?.toString()} bps</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={withdraw}
            disabled={isPending || isConfirming || !balance || balance === BigInt(0)}
            className="w-full rounded bg-black text-white px-4 py-2 disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            {isPending ? "Confirm in wallet…" : isConfirming ? "Confirming…" : "Withdraw"}
          </button>

          {isSuccess && (
            <p className="text-green-600 text-sm">
              Withdrawn.{" "}
              <a
                href={`https://chainscan-galileo.0g.ai/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                View tx
              </a>
            </p>
          )}

          {writeError && (
            <p className="text-red-500 text-sm">{writeError.message}</p>
          )}
        </div>
      )}

      <nav className="flex gap-4 text-sm">
        <Link href="/" className="underline text-blue-600">Home</Link>
        <Link href="/strategy" className="underline text-blue-600">Set Strategy</Link>
        <Link href="/history" className="underline text-blue-600">Trade History</Link>
      </nav>
    </main>
  );
}
