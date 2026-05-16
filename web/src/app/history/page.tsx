"use client";
import { useAccount } from "wagmi";
import { useUserTradeExecuted } from "@/hooks/useVaultEvents";
import { VAULT } from "@/lib/vaultEvents";
import Link from "next/link";
import { WalletConnectPrompt } from "@/components/wallet-gate";

export default function HistoryPage() {
  const { address } = useAccount();
  const { data: trades = [], isLoading: loading, error: queryError } = useUserTradeExecuted(address);
  const rows = trades.map((t) => ({ blockNumber: t.blockNumber, txHash: t.txHash, receiptHash: t.receiptHash }));
  const error = queryError ? (queryError instanceof Error ? queryError.message : "fetch failed") : null;

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / HISTORY</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Trade history</h1>
              {address && (
                <p className="mt-2 text-[12px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>
                  {address.slice(0, 10)}…{address.slice(-6)}
                </p>
              )}
            </div>
            {address && rows.length > 0 && (
              <div className="text-right">
                <p className="text-3xl font-light text-[#111]" style={{ fontFamily: "var(--font-data)" }}>{rows.length}</p>
                <p className="text-[11px] text-black/30 mt-0.5">total trades</p>
              </div>
            )}
          </div>

          {/* Image banner */}
          <div className="relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white min-h-[110px] flex items-end">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/coder-9bItvCegU6TXUqbX3tUXGBAtvkBkXp.png"
              alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 85%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 85%)",
              }}
            />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.55) 50%, transparent 100%)" }} />
            <div className="relative z-10 p-8">
              <h2 className="text-xl font-light text-[#111]">On-chain proof for every trade.</h2>
              <p className="mt-1 text-sm text-black/40">Each receipt is stored permanently on 0G Storage. Click any receipt hash to verify.</p>
            </div>
          </div>

          {/* States */}
          {!address && <WalletConnectPrompt page="history" />}

          {address && !VAULT && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
              <p className="text-sm text-red-600">NEXT_PUBLIC_VAULT_ADDRESS not set.</p>
            </div>
          )}

          {loading && (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-12 text-center">
              <p className="text-sm text-black/30">Fetching your trade history…</p>
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50/50 p-5">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {address && VAULT && !loading && rows.length === 0 && !error && (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-16 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border border-black/[0.07] bg-black/[0.02] flex items-center justify-center">
                <span className="text-black/20">0</span>
              </div>
              <p className="text-sm text-black/35">No trades executed yet</p>
              <Link href="/strategy"
                className="mt-2 inline-flex items-center gap-1 text-xs text-black/40 border border-black/[0.07] rounded-xl px-4 py-2 hover:border-black/20 hover:text-black/70 transition-all">
                Set your first intent →
              </Link>
            </div>
          )}

          {/* Table */}
          {rows.length > 0 && (
            <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
              <div className="grid px-6 py-3 border-b border-black/[0.05]"
                style={{ gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "1rem" }}>
                {["Block", "Receipt hash", "Transaction", "Proof"].map((h) => (
                  <span key={h} className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{h}</span>
                ))}
              </div>

              {rows.map((row, i) => (
                <div key={i}
                  className="group grid px-6 py-4 items-center hover:bg-black/[0.015] transition-colors"
                  style={{
                    gridTemplateColumns: "1fr 2fr 1fr 1fr",
                    gap: "1rem",
                    borderBottom: i < rows.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                  }}>
                  <span className="text-[12px] text-black/35" style={{ fontFamily: "var(--font-data)" }}>
                    {row.blockNumber.toString()}
                  </span>
                  <Link href={`/proof/${row.receiptHash}`}
                    className="text-[12px] text-[#111] hover:text-black/60 transition-colors underline overflow-hidden text-ellipsis whitespace-nowrap block"
                    style={{ fontFamily: "var(--font-data)" }}>
                    {row.receiptHash.slice(0, 16)}…{row.receiptHash.slice(-6)}
                  </Link>
                  <a href={`https://chainscan-galileo.0g.ai/tx/${row.txHash}`}
                    target="_blank" rel="noreferrer"
                    className="text-[12px] text-black/40 hover:text-black/70 transition-colors underline"
                    style={{ fontFamily: "var(--font-data)" }}>
                    {row.txHash.slice(0, 8)}… ↗
                  </a>
                  <a href={`https://storagescan-galileo.0g.ai/file/${row.receiptHash}`}
                    target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] text-black/30 hover:text-black/60 transition-colors"
                    style={{ fontFamily: "var(--font-data)" }}>
                    StorageScan ↗
                  </a>
                </div>
              ))}
            </div>
          )}

          {/* Footer nav */}
          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[
              { label: "Dashboard", href: "/dashboard" },
              { label: "Strategy Terminal", href: "/strategy" },
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
