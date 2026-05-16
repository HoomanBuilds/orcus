"use client";
import { useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { vaultAbi } from "@/lib/vaultAbi";
import { VAULT } from "@/lib/vaultEvents";
import { SWAP_TARGETS } from "@/lib/tokens";
import { useToast } from "@/components/toast";
import Link from "next/link";
import { WalletConnectPrompt } from "@/components/wallet-gate";

export default function VaultPage() {
  const { address } = useAccount();
  const { toast } = useToast();
  const { writeContract, data: txHash, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: balance, refetch: refetchBalance } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT, refetchInterval: 8_000 },
  });

  const { data: intent, refetch: refetchIntent } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "intents",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT, refetchInterval: 8_000 },
  });

  const { data: paused } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "paused",
    query: { enabled: !!VAULT },
  });

  useEffect(() => {
    if (isSuccess && txHash) {
      toast({ type: "success", title: "Withdrawn", description: "Balance returned to wallet", txHash });
      refetchBalance();
      refetchIntent();
      resetWrite();
    }
  }, [isSuccess, txHash, toast, refetchBalance, refetchIntent, resetWrite]);

  const isActive = intent?.[4] === true;
  const hasBalance = balance !== undefined && balance > 0n;
  const canWithdraw = !!address && !!VAULT && hasBalance && !isPending && !isConfirming;

  if (!address) return <WalletConnectPrompt page="vault" />;

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / VAULT</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Your vault</h1>
              {address && (
                <p className="mt-2 text-[12px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>
                  {address.slice(0, 10)}…{address.slice(-6)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {paused && (
                <span className="px-3 py-1.5 rounded-full text-[11px] border border-red-200 text-red-600 bg-red-50/50">
                  Protocol paused
                </span>
              )}
              <a
                href={`https://chainscan-galileo.0g.ai/address/${VAULT}`}
                target="_blank" rel="noreferrer"
                className="text-[11px] text-black/30 hover:text-black/60 transition-colors underline"
                style={{ fontFamily: "var(--font-data)" }}>
                {VAULT ? `${VAULT.slice(0, 8)}…${VAULT.slice(-6)} ↗` : "Contract not set"}
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Balance",   value: address && balance !== undefined ? `${(+formatEther(balance)).toFixed(4)} OG` : "—" },
              { label: "Intent",    value: !address ? "—" : isActive ? "Active" : "None", green: isActive },
              { label: "Slippage",  value: isActive && intent ? `${intent[1].toString()} bps` : "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-black/[0.07] bg-white p-6">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{s.label}</p>
                <p className={`mt-3 text-3xl font-light tracking-tight ${s.green ? "text-[#16a34a]" : "text-[#111]"}`}
                  style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>

          {/* Image + position grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Image card */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white min-h-[200px] flex flex-col justify-end">
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/researcher-CvhqOuV6irGwBOnJoTGFlXdbyYBRjb.png"
                alt="" aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center"
                style={{
                  maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)",
                  WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)",
                }}
              />
              <div className="absolute inset-0" style={{
                background: "linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 50%, transparent 100%)"
              }} />
              <div className="relative z-10 p-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest text-black/40 border border-black/[0.07]">
                  NON-CUSTODIAL
                </span>
                <h3 className="mt-3 text-lg font-light text-[#111]">Only you can withdraw.</h3>
                <p className="mt-1 text-sm text-black/40 leading-relaxed">The vault contract is immutable. No admin can touch your funds.</p>
              </div>
            </div>

            {/* Position detail */}
            <div className="lg:col-span-3 rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-black/[0.05] flex items-center justify-between">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Position detail</p>
                {address && isActive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-[#16a34a] border border-[#16a34a]/20 bg-[#16a34a]/05">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />
                    Intent active
                  </span>
                )}
              </div>

              {!address ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-black/30">Connect wallet to view your position</p>
                </div>
              ) : !VAULT ? (
                <div className="p-6">
                  <p className="text-sm text-red-500">NEXT_PUBLIC_VAULT_ADDRESS not set.</p>
                </div>
              ) : (
                <>
                  <div className="divide-y divide-black/[0.04]">
                    {[
                      { label: "Vault contract",  value: `${VAULT.slice(0, 12)}…${VAULT.slice(-6)}` },
                      { label: "Your address",    value: `${address.slice(0, 12)}…${address.slice(-6)}` },
                      { label: "Deposited",       value: balance !== undefined ? `${(+formatEther(balance)).toFixed(6)} OG` : "Loading…" },
                      ...(isActive && intent ? [
                        { label: "Max slippage",  value: `${intent[1].toString()} bps` },
                        { label: "Stop loss",     value: `${intent[2].toString()} bps` },
                      ] : []),
                    ].map((f) => (
                      <div key={f.label} className="flex justify-between items-center px-6 py-4">
                        <span className="text-sm text-black/40">{f.label}</span>
                        <span className="text-sm text-[#111]" style={{ fontFamily: "var(--font-data)" }}>{f.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="px-6 py-5 border-t border-black/[0.05] flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => writeContract({ abi: vaultAbi, address: VAULT, functionName: "withdraw" })}
                      disabled={!canWithdraw}
                      className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: canWithdraw ? "#111" : "rgba(0,0,0,0.04)",
                        color: canWithdraw ? "#fff" : "rgba(0,0,0,0.25)",
                        border: canWithdraw ? "none" : "1px solid rgba(0,0,0,0.07)",
                        cursor: canWithdraw ? "pointer" : "not-allowed",
                        opacity: isPending || isConfirming ? 0.6 : 1,
                      }}>
                      {isPending ? "Confirm in wallet…" : isConfirming ? "Confirming…" : isSuccess ? "Withdrawn ✓" : "Withdraw all"}
                    </button>

                    <Link href="/strategy"
                      className="px-5 py-2.5 text-sm text-black/50 rounded-xl border border-black/[0.07] hover:border-black/20 hover:text-black/80 transition-all">
                      New intent
                    </Link>

                    {!hasBalance && (
                      <span className="text-xs text-black/30">No balance to withdraw</span>
                    )}
                    {isSuccess && txHash && (
                      <a href={`https://chainscan-galileo.0g.ai/tx/${txHash}`} target="_blank" rel="noreferrer"
                        className="text-xs text-black/40 underline hover:text-black/70 transition-colors">
                        View tx ↗
                      </a>
                    )}
                  </div>
                  {writeError && (
                    <div className="mx-6 mb-5 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3">
                      <p className="text-xs text-red-600">{writeError.message}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Token pairs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.16em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Liquid pairs — Jaine DEX · fee 0.3%</p>
              <a href="https://chainscan-galileo.0g.ai/address/0x2d94e151fe547d9f97cf139cd1283ca14cce042b"
                target="_blank" rel="noreferrer"
                className="text-[11px] text-black/30 hover:text-black/60 transition-colors underline"
                style={{ fontFamily: "var(--font-data)" }}>
                SwapRouter ↗
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {SWAP_TARGETS.map((t) => (
                <a key={t.symbol}
                  href={`https://chainscan-galileo.0g.ai/address/${t.pool}`}
                  target="_blank" rel="noreferrer"
                  className="flex flex-col gap-1.5 p-4 rounded-2xl border border-black/[0.07] bg-white hover:border-black/[0.15] hover:bg-[#fafaf8] transition-all"
                  style={{ textDecoration: "none" }}>
                  <span className="text-sm font-medium text-[#111]">{t.symbol}</span>
                  <span className="text-[11px] text-black/35 truncate leading-tight">{t.label}</span>
                  <span className="text-[10px] text-black/20 mt-0.5" style={{ fontFamily: "var(--font-data)" }}>
                    {t.pool.slice(0, 6)}…{t.pool.slice(-4)}
                  </span>
                </a>
              ))}
            </div>
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Strategy Terminal", href: "/strategy" },
              { label: "Trade History", href: "/history" },
              { label: "Protocol Activity", href: "/activity" },
            ].map((l) => (
              <Link key={l.label} href={l.href}
                className="text-xs text-black/35 hover:text-black/65 transition-colors tracking-wide">
                {l.label}
              </Link>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}
