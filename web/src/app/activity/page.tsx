"use client";
import { useEffect, useState, useCallback } from "react";
import { usePublicClient } from "wagmi";
import { vaultAbi } from "@/lib/vaultAbi";
import Link from "next/link";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;
const POLL_MS = 15_000;

interface Execution { blockNumber: bigint; txHash: string; receiptHash: string; user: string; }

export default function ActivityPage() {
  const client = usePublicClient();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

  const fetchEvents = useCallback(async () => {
    if (!client || !VAULT) return;
    try {
      const logs = await client.getContractEvents({ address: VAULT, abi: vaultAbi, eventName: "TradeExecuted", fromBlock: BigInt(0) });
      setExecutions(
        logs.reverse().slice(0, 50).map((l) => ({
          blockNumber: l.blockNumber ?? BigInt(0),
          txHash: l.transactionHash ?? "",
          receiptHash: (l.args as { receiptHash?: string }).receiptHash ?? "",
          user: (l.args as { user?: string }).user ?? "",
        }))
      );
      setLastPoll(new Date());
    } catch {}
    finally { setLoading(false); }
  }, [client]);

  useEffect(() => {
    fetchEvents();
    const id = setInterval(fetchEvents, POLL_MS);
    return () => clearInterval(id);
  }, [fetchEvents]);

  const uniqueTraders = new Set(executions.map((e) => e.user)).size;
  const isEmpty = !loading && executions.length === 0;

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / ACTIVITY</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Protocol activity</h1>
              <p className="mt-2 text-sm text-black/40 max-w-sm">Live protocol-wide execution feed. No wallet required. Every trade verified on-chain.</p>
            </div>
            <div className="flex items-center gap-3">
              {lastPoll && (
                <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>
                  {lastPoll.toLocaleTimeString()}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-[#16a34a] border border-[#16a34a]/20 bg-[#16a34a]/05">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />
                Live · {POLL_MS / 1000}s refresh
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total executions",  value: loading ? "…" : executions.length.toString(),   sub: "TradeExecuted events" },
              { label: "Unique traders",    value: loading ? "…" : uniqueTraders.toString(),       sub: "distinct wallet addresses" },
              { label: "Chain",             value: "0G Galileo",                                    sub: "Chain ID 16602" },
              { label: "Proof storage",     value: "0G Storage",                                   sub: "permanent cryptographic receipts" },
            ].map((s) => (
              <div key={s.label} className="group relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white p-5">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{s.label}</p>
                <p className="mt-2 text-2xl font-light tracking-tight text-[#111]" style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
                <p className="mt-1 text-[11px] text-black/25">{s.sub}</p>
              </div>
            ))}
          </div>

          {/* Image card */}
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white min-h-[130px] flex items-end">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/executor-o1q6509qMLXMtpBIGo49vcgOu34sI1.png"
              alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 90%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 90%)",
              }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.6) 55%, transparent 100%)" }} />
            <div className="relative z-10 p-8">
              <p className="text-[11px] tracking-[0.16em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Execution stack</p>
              <h2 className="mt-2 text-2xl font-light text-[#111]">
                ECIES-256 → Intel TDX → Jaine DEX → 0G Storage
              </h2>
              <p className="mt-2 text-sm text-black/40">Every execution on this feed passed through all four sealed layers.</p>
            </div>
          </div>

          {/* Main table */}
          <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">

            {/* Table header */}
            <div className="grid px-6 py-3 border-b border-black/[0.05]"
              style={{ gridTemplateColumns: "1fr 1.5fr 2fr 64px 64px", gap: "1rem" }}>
              {["Block", "Trader", "Receipt hash", "Tx", "Proof"].map((h) => (
                <span key={h} className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{h}</span>
              ))}
            </div>

            {loading && (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-black/30">Fetching on-chain events…</p>
              </div>
            )}

            {isEmpty && (
              <div className="px-6 py-20 text-center flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full border border-black/[0.07] bg-black/[0.02] flex items-center justify-center">
                  <span className="text-black/20">0</span>
                </div>
                <p className="text-sm text-black/30">No executions on-chain yet</p>
                <p className="text-xs text-black/20">
                  <Link href="/strategy" className="underline">Set an intent</Link> to be the first
                </p>
              </div>
            )}

            {executions.map((ex, i) => (
              <div key={ex.txHash || i}
                className="group grid px-6 py-3.5 items-center hover:bg-black/[0.015] transition-colors"
                style={{
                  gridTemplateColumns: "1fr 1.5fr 2fr 64px 64px",
                  gap: "1rem",
                  borderBottom: i < executions.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                }}>
                <span className="text-[12px] text-black/40" style={{ fontFamily: "var(--font-data)" }}>
                  {ex.blockNumber.toString()}
                </span>
                <span className="text-[12px] text-black/50" style={{ fontFamily: "var(--font-data)" }}>
                  {ex.user.slice(0, 6)}…{ex.user.slice(-4)}
                </span>
                <Link href={`/proof/${ex.receiptHash}`}
                  className="text-[12px] text-black/50 hover:text-black/80 transition-colors overflow-hidden text-ellipsis whitespace-nowrap block underline"
                  style={{ fontFamily: "var(--font-data)" }}>
                  {ex.receiptHash.slice(0, 14)}…{ex.receiptHash.slice(-6)}
                </Link>
                <a href={`https://chainscan-galileo.0g.ai/tx/${ex.txHash}`} target="_blank" rel="noreferrer"
                  className="text-[12px] text-black/40 hover:text-black/70 transition-colors underline"
                  style={{ fontFamily: "var(--font-data)" }}>tx ↗</a>
                <a href={`https://storagescan-galileo.0g.ai/file/${ex.receiptHash}`} target="_blank" rel="noreferrer"
                  className="text-[12px] text-black/25 hover:text-black/55 transition-colors underline"
                  style={{ fontFamily: "var(--font-data)" }}>proof ↗</a>
              </div>
            ))}
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Strategy Terminal", href: "/strategy" },
              { label: "My History", href: "/history" },
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
