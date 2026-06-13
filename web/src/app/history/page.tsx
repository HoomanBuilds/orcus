"use client";
import Link from "next/link";
import { usePortfolio } from "@/lib/use-portfolio";
import { chainByKey } from "@/lib/chains";
import { ChainBadge } from "@/components/chain-icon";
import { WalletConnectPrompt } from "@/components/wallet-gate";

export default function HistoryPage() {
  const { vm, rows, isLoading, address } = usePortfolio({ userScoped: true });

  if (vm === "none") {
    return (
      <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
        <WalletConnectPrompt page="history" />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / HISTORY</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Trade history</h1>
              <p className="mt-2 text-[12px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>
                {address ? `${address.slice(0, 10)}…${address.slice(-6)}` : ""} · {vm === "evm" ? "all EVM chains" : "Sui"}
              </p>
            </div>
            {rows.length > 0 && (
              <div className="text-right">
                <p className="text-3xl font-light text-[#111]" style={{ fontFamily: "var(--font-data)" }}>{rows.length}</p>
                <p className="text-[11px] text-black/30 mt-0.5">total trades</p>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white min-h-[110px] flex items-end">
            <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/coder-9bItvCegU6TXUqbX3tUXGBAtvkBkXp.png" alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ maskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 85%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 40%, transparent 85%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(255,255,255,0.97) 0%, rgba(255,255,255,0.55) 50%, transparent 100%)" }} />
            <div className="relative z-10 p-8">
              <h2 className="text-xl font-light text-[#111]">On-chain proof for every trade.</h2>
              <p className="mt-1 text-sm text-black/40">Each receipt is stored permanently on 0G Storage. Click any receipt hash to verify.</p>
            </div>
          </div>

          {isLoading && (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-12 text-center">
              <p className="text-sm text-black/30">Fetching your trade history…</p>
            </div>
          )}

          {!isLoading && rows.length === 0 && (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-16 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full border border-black/[0.07] bg-black/[0.02] flex items-center justify-center"><span className="text-black/20">0</span></div>
              <p className="text-sm text-black/35">No trades executed yet{vm === "evm" ? " across your EVM chains" : " on Sui"}</p>
              <Link href="/strategy" className="mt-2 inline-flex items-center gap-1 text-xs text-black/40 border border-black/[0.07] rounded-xl px-4 py-2 hover:border-black/20 hover:text-black/70 transition-all">
                Set your first intent →
              </Link>
            </div>
          )}

          {rows.length > 0 && (
            <div className="rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
              <div className="grid px-6 py-3 border-b border-black/[0.05]" style={{ gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "1rem" }}>
                {["Chain", "Receipt hash", "Transaction", "Proof"].map((h) => (
                  <span key={h} className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{h}</span>
                ))}
              </div>
              {rows.map((row, i) => {
                const c = chainByKey(row.chainKey);
                return (
                  <div key={row.txHash || i} className="group grid px-6 py-4 items-center hover:bg-black/[0.015] transition-colors"
                    style={{ gridTemplateColumns: "1fr 2fr 1fr 1fr", gap: "1rem", borderBottom: i < rows.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                    <ChainBadge chainKey={row.chainKey} />
                    <Link href={`/proof/${row.receiptHash}`}
                      className="text-[12px] text-[#111] hover:text-black/60 transition-colors underline overflow-hidden text-ellipsis whitespace-nowrap block"
                      style={{ fontFamily: "var(--font-data)" }}>
                      {row.receiptHash.slice(0, 16)}…{row.receiptHash.slice(-6)}
                    </Link>
                    <a href={`${c?.explorerTx ?? ""}${row.txHash}`} target="_blank" rel="noreferrer"
                      className="text-[12px] text-black/40 hover:text-black/70 transition-colors underline" style={{ fontFamily: "var(--font-data)" }}>
                      {row.txHash.slice(0, 8)}… ↗
                    </a>
                    <Link href={`/proof/${row.receiptHash}`} className="inline-flex items-center gap-1 text-[12px] text-black/30 hover:text-black/60 transition-colors" style={{ fontFamily: "var(--font-data)" }}>
                      View ↗
                    </Link>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[{ label: "Dashboard", href: "/dashboard" }, { label: "Strategy Terminal", href: "/strategy" }, { label: "Protocol Activity", href: "/activity" }].map((l) => (
              <Link key={l.label} href={l.href} className="text-xs text-black/35 hover:text-black/65 transition-colors tracking-wide">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
