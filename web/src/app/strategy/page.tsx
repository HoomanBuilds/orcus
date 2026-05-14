"use client";
import { useState } from "react";
import { useAccount, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { encryptIntentBrowser } from "@/lib/encrypt";
import { vaultAbi } from "@/lib/vaultAbi";
import { SWAP_TARGETS, DEFAULT_TOKEN_OUT, type SwapTargetSymbol } from "@/lib/tokens";
import Link from "next/link";

const VAULT   = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;
const AGENT_PUB = process.env.NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY || "";

const inputStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  color: "var(--text)",
  borderRadius: 4,
  padding: "8px 10px",
  fontSize: 13,
  width: "100%",
  outline: "none",
};

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

  const selectedTarget = SWAP_TARGETS.find((t) => t.symbol === tokenOut);

  async function submit() {
    if (!address || !VAULT || !AGENT_PUB) return;
    setError(null);
    try {
      const ciphertext = encryptIntentBrowser(AGENT_PUB, { goal, tokenOut, ts: Date.now() });
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
    <div className="mx-auto max-w-xl px-6 py-12 flex flex-col gap-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Set Strategy</h1>

      {!address && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>Connect your wallet to set a strategy.</p>
      )}

      {/* Goal */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs" style={{ color: "var(--muted)" }}>
          Goal — encrypted in-browser, only readable inside the TEE
        </label>
        <textarea
          rows={2}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="e.g. swap when price dips 1%"
          style={{ ...inputStyle, fontFamily: "var(--font-geist-mono)", resize: "vertical" }}
        />
      </div>

      {/* Token selector */}
      <div className="flex flex-col gap-2">
        <label className="text-xs" style={{ color: "var(--muted)" }}>Swap OG to</label>
        <div className="grid grid-cols-3 gap-2">
          {SWAP_TARGETS.map((t) => {
            const active = tokenOut === t.symbol;
            return (
              <button
                key={t.symbol}
                onClick={() => setTokenOut(t.symbol)}
                className="flex flex-col gap-0.5 p-3 rounded text-left transition-colors"
                style={{
                  border: active ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: active ? "rgba(79,142,247,0.08)" : "var(--surface)",
                  color: active ? "var(--accent)" : "var(--text)",
                }}
              >
                <span className="text-sm font-semibold">{t.symbol}</span>
                <span className="text-xs truncate" style={{ color: active ? "var(--accent)" : "var(--muted)", opacity: 0.8 }}>
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
        {selectedTarget && (
          <p className="text-xs font-mono" style={{ color: "var(--muted)" }}>
            pool {selectedTarget.pool.slice(0, 10)}…{selectedTarget.pool.slice(-6)}
            {" · "}
            <a
              href={`https://chainscan-galileo.0g.ai/address/${selectedTarget.pool}`}
              target="_blank" rel="noreferrer"
              style={{ color: "var(--accent)" }}
              className="underline"
            >
              verify ↗
            </a>
          </p>
        )}
      </div>

      {/* Params */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Amount (OG)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Max slippage (bps)</label>
          <input type="number" value={maxSlippage} onChange={(e) => setMaxSlippage(Number(e.target.value))} style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs" style={{ color: "var(--muted)" }}>Stop loss (bps)</label>
          <input type="number" value={stopLoss} onChange={(e) => setStopLoss(Number(e.target.value))} style={inputStyle} />
        </div>
      </div>

      <button
        disabled={isPending || !address || !VAULT || !AGENT_PUB}
        onClick={submit}
        className="w-full py-2.5 text-sm font-medium rounded transition-opacity"
        style={{
          background: "var(--accent)",
          color: "#fff",
          opacity: (isPending || !address) ? 0.4 : 1,
          cursor: (isPending || !address) ? "not-allowed" : "pointer",
          border: "none",
        }}
      >
        {isPending ? "Submitting…" : `Encrypt & Deposit → ${tokenOut}`}
      </button>

      {!VAULT    && <p className="text-xs" style={{ color: "#ef4444" }}>NEXT_PUBLIC_VAULT_ADDRESS not set.</p>}
      {!AGENT_PUB && <p className="text-xs" style={{ color: "#ef4444" }}>NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY not set.</p>}
      {error     && <p className="text-xs" style={{ color: "#ef4444" }}>{error}</p>}

      {hash && (
        <p className="text-xs font-mono break-all" style={{ color: "var(--muted)" }}>
          tx{" "}
          <a
            href={`https://chainscan-galileo.0g.ai/tx/${hash}`}
            target="_blank" rel="noreferrer"
            style={{ color: "var(--accent)" }}
            className="underline"
          >
            {hash} ↗
          </a>
        </p>
      )}

      <nav className="flex gap-4 text-xs pt-2" style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
        <Link href="/dashboard" className="underline hover:text-white transition-colors">Dashboard</Link>
        <Link href="/history"   className="underline hover:text-white transition-colors">Trade History</Link>
      </nav>
    </div>
  );
}
