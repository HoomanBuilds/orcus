"use client";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { vaultAbi } from "@/lib/vaultAbi";
import { SWAP_TARGETS } from "@/lib/tokens";
import { Skeleton } from "@/components/skeleton";
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

  if (isSuccess) { refetchBalance(); refetchIntent(); }

  const isActive = intent?.[4];

  return (
    <div className="mx-auto max-w-xl px-6 py-12 flex flex-col gap-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Dashboard</h1>

      {!address && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Connect your wallet to view your vault position.</p>
      )}
      {address && !VAULT && (
        <p className="text-sm" style={{ color: "#ef4444" }}>NEXT_PUBLIC_VAULT_ADDRESS not set.</p>
      )}

      {address && VAULT && (
        <div className="flex flex-col gap-4">
          {/* Position card */}
          <div className="rounded p-5 flex flex-col gap-3" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
            <div className="flex justify-between items-baseline">
              <span className="text-xs" style={{ color: "var(--muted)" }}>Vault balance</span>
              <span className="font-mono text-lg font-semibold" style={{ color: "var(--text)" }}>
                {balance !== undefined ? `${formatEther(balance)} OG` : <Skeleton className="w-24 h-5" />}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs" style={{ color: "var(--muted)" }}>Intent</span>
              {intent === undefined ? (
                <Skeleton className="w-12 h-4" />
              ) : (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={isActive
                    ? { background: "rgba(79,142,247,0.12)", color: "var(--accent)", border: "1px solid rgba(79,142,247,0.3)" }
                    : { background: "var(--border)", color: "var(--muted)" }
                  }
                >
                  {isActive ? "Active" : "Inactive"}
                </span>
              )}
            </div>
            {isActive && (
              <div className="pt-2 flex flex-col gap-1.5" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--muted)" }}>Max slippage</span>
                  <span className="font-mono" style={{ color: "var(--text)" }}>{intent[1]?.toString()} bps</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--muted)" }}>Stop loss</span>
                  <span className="font-mono" style={{ color: "var(--text)" }}>{intent[2]?.toString()} bps</span>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={withdraw}
            disabled={isPending || isConfirming || !balance || balance === BigInt(0)}
            className="w-full py-2.5 text-sm font-medium rounded transition-colors"
            style={{
              background: (!balance || balance === BigInt(0)) ? "var(--surface)" : "var(--accent)",
              color: (!balance || balance === BigInt(0)) ? "var(--muted)" : "#fff",
              border: "1px solid var(--border)",
              cursor: (!balance || balance === BigInt(0)) ? "not-allowed" : "pointer",
            }}
          >
            {isPending ? "Confirm in wallet…" : isConfirming ? "Confirming…" : "Withdraw"}
          </button>

          {isSuccess && (
            <p className="text-xs" style={{ color: "#4ade80" }}>
              Withdrawn.{" "}
              <a href={`https://chainscan-galileo.0g.ai/tx/${txHash}`} target="_blank" rel="noreferrer" className="underline">
                View tx
              </a>
            </p>
          )}
          {writeError && <p className="text-xs" style={{ color: "#ef4444" }}>{writeError.message}</p>}
        </div>
      )}

      {/* Live pairs */}
      <div className="rounded p-5 flex flex-col gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Available pairs — OG → X on Zer0 DEX
        </p>
        <div className="grid grid-cols-3 gap-2">
          {SWAP_TARGETS.map((t) => (
            <a
              key={t.symbol}
              href={`https://chainscan-galileo.0g.ai/address/${t.pool}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col gap-1 p-3 rounded transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--text)" }}
            >
              <span className="text-sm font-semibold">{t.symbol}</span>
              <span className="text-xs truncate" style={{ color: "var(--muted)" }}>{t.label}</span>
              <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>
                {t.pool.slice(0, 6)}…{t.pool.slice(-4)}
              </span>
            </a>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          Routed via{" "}
          <a
            href="https://chainscan-galileo.0g.ai/address/0x2d94e151fe547d9f97cf139cd1283ca14cce042b"
            target="_blank" rel="noreferrer" className="underline"
          >
            Zer0 SwapRouter
          </a>
          {" "}· fee tier 0.3%
        </p>
      </div>

      <nav className="flex gap-4 text-xs" style={{ color: "var(--muted)" }}>
        <Link href="/strategy" className="underline hover:text-white transition-colors">Set Strategy</Link>
        <Link href="/history"  className="underline hover:text-white transition-colors">Trade History</Link>
      </nav>
    </div>
  );
}
