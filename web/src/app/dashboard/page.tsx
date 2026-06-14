"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { useSearchParams } from "next/navigation";
import { vaultAbi } from "@/lib/vaultAbi";
import { useActiveChain } from "@/lib/active-chain";
import { usePortfolio } from "@/lib/use-portfolio";
import { fetchSuiIntent, suiWithdrawTx } from "@/lib/sui";
import { chainByKey, CHAINS } from "@/lib/chains";
import { ChainIcon, ChainBadge } from "@/components/chain-icon";
import { Skeleton } from "@/components/skeleton";
import { useToast } from "@/components/toast";
import { IntentStatusBanner } from "@/components/intent-status-banner";
import Link from "next/link";
import { WalletConnectPrompt } from "@/components/wallet-gate";

const SPARK_RAW = [38, 41, 39, 44, 48, 45, 52, 55, 51, 58, 62, 57, 63, 60, 67, 71, 68, 74, 78, 73, 79, 77, 83, 80, 86];

function Sparkline({ positive = true }: { positive?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setDrawn(true), 200); return () => clearTimeout(t); }, []);
  const W = 300, H = 56;
  const min = Math.min(...SPARK_RAW), max = Math.max(...SPARK_RAW), range = max - min;
  const pts = SPARK_RAW.map((v, i) => [(i / (SPARK_RAW.length - 1)) * W, H - ((v - min) / range) * (H * 0.75) - H * 0.1]);
  const line = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
    const [px, py] = pts[i - 1];
    const cx = ((px + x) / 2).toFixed(1);
    return `${acc} C ${cx} ${py.toFixed(1)} ${cx} ${y.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, "");
  const fill = `${line} L ${W} ${H} L 0 ${H} Z`;
  const color = positive ? "rgba(22,163,74,1)" : "rgba(220,38,38,1)";
  const fillColor = positive ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.06)";
  return (
    <svg ref={ref} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full" style={{ height: H }}>
      <path d={fill} fill={drawn ? fillColor : "transparent"} style={{ transition: "fill 0.8s ease" }} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="1000" strokeDashoffset={drawn ? 0 : 1000} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }} />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.4s ease 1s" }} />
    </svg>
  );
}

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
  return (
    <div ref={ref} onMouseMove={onMove} className={`group relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white ${className}`} style={style}>
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" style={{ background: "radial-gradient(380px circle at var(--mx,50%) var(--my,50%), rgba(0,0,0,0.025), transparent 65%)" }} />
      {children}
    </div>
  );
}

export default function DashboardPage() {
  return <Suspense><DashboardContent /></Suspense>;
}

function DashboardContent() {
  const params = useSearchParams();
  const { toast } = useToast();
  const { activeChain } = useActiveChain();
  const isSui = activeChain.vm === "sui";
  const dec = activeChain.nativeDecimals;
  const sym = activeChain.nativeSymbol;

  const { address: evmAddress } = useAccount();
  const suiAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: suiSignExec } = useSignAndExecuteTransaction();
  const posAddress = isSui ? suiAccount?.address : evmAddress;

  // Protocol feed (VM-aggregated, public fallback).
  const { vm, rows, isLoading: loading } = usePortfolio({ userScoped: false, publicFallback: true });
  const uniqueTraders = useMemo(() => new Set(rows.map((e) => e.user)).size, [rows]);

  // Active-chain position.
  const { data: evmIntent, refetch: refetchEvm } = useReadContract({
    abi: vaultAbi, address: activeChain.vault as `0x${string}`, functionName: "intents",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: activeChain.evmChainId,
    query: { enabled: !isSui && !!evmAddress && !!activeChain.evmChainId, refetchInterval: 8_000 },
  });
  const { data: suiIntent, refetch: refetchSui } = useQuery({
    queryKey: ["sui-intent", activeChain.key, suiAccount?.address],
    queryFn: () => fetchSuiIntent(suiClient, activeChain, suiAccount!.address),
    enabled: isSui && !!suiAccount?.address,
    refetchInterval: 8_000,
  });

  const balance = isSui ? (suiIntent?.amountMist ?? 0n) : ((evmIntent?.[2] ?? 0n) as bigint);
  const isActive = isSui ? (suiIntent?.active ?? false) : (evmIntent?.[4] === true);
  const slippage = !isSui && isActive && evmIntent ? `${evmIntent[3].toString()} bps` : "-";

  // EVM withdraw.
  const { writeContract, data: evmTx, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: evmTx, chainId: activeChain.evmChainId });
  // Sui withdraw.
  const [suiWithdrawing, setSuiWithdrawing] = useState(false);
  const [suiTx, setSuiTx] = useState<string | null>(null);

  useEffect(() => {
    if (isSuccess && evmTx) { toast({ type: "success", title: "Withdrawn", description: "Balance returned to wallet", txHash: evmTx, explorerTx: activeChain.explorerTx }); refetchEvm(); resetWrite(); }
  }, [isSuccess, evmTx, toast, refetchEvm, resetWrite]);

  async function withdraw() {
    if (isSui) {
      try {
        setSuiWithdrawing(true);
        const res = await suiSignExec({ transaction: suiWithdrawTx(activeChain) });
        setSuiTx(res.digest);
        toast({ type: "success", title: "Withdrawn", description: "Balance returned to wallet" });
        refetchSui();
      } catch (e) {
        toast({ type: "error", title: "Withdraw failed", description: e instanceof Error ? e.message.slice(0, 80) : "" });
      } finally { setSuiWithdrawing(false); }
    } else {
      writeContract({ abi: vaultAbi, address: activeChain.vault as `0x${string}`, functionName: "withdraw", chainId: activeChain.evmChainId });
    }
  }

  if (!posAddress) return <WalletConnectPrompt page="dashboard" />;

  const hasBalance = balance > 0n;
  const withdrawing = isSui ? suiWithdrawing : (isPending || isConfirming);
  const canWithdraw = hasBalance && !withdrawing;
  const lastTrade = rows.find((r) => r.user.toLowerCase() === posAddress.toLowerCase());
  const lifecycle = isActive ? "pending" : lastTrade ? "executed" : "none";
  const withdrawTxUrl = isSui ? (suiTx ? `${activeChain.explorerTx}${suiTx}` : null) : (evmTx ? `${activeChain.explorerTx}${evmTx}` : null);

  const stats = [
    { label: `Vault balance (${activeChain.shortLabel})`, value: `${(+formatUnits(balance, dec)).toFixed(4)} ${sym}`, sub: "deposited collateral" },
    { label: "Intent", value: isActive ? "Active" : "None", sub: isActive ? "TEE agent processing" : "no active order", green: isActive },
    { label: "Protocol trades", value: loading ? "…" : rows.length.toString(), sub: vm === "sui" ? "Sui" : "all EVM chains" },
    { label: "Unique traders", value: loading ? "…" : uniqueTraders.toString(), sub: "distinct addresses" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / DASHBOARD</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Vault overview</h1>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-[#16a34a] border border-[#16a34a]/20 bg-[#16a34a]/05">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />
              Live
            </span>
          </div>

          <IntentStatusBanner
            lifecycle={params.get("intent") === "submitted" && lifecycle === "none" ? "pending" : lifecycle}
            receiptHash={lastTrade?.receiptHash}
            txHash={lastTrade?.txHash}
            explorerTx={lastTrade ? chainByKey(lastTrade.chainKey)?.explorerTx : undefined}
          />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <Card key={s.label} className="p-5">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{s.label}</p>
                <p className={`mt-2 text-2xl font-light tracking-tight ${s.green ? "text-[#16a34a]" : "text-[#111]"}`} style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
                <p className="mt-1 text-[11px] text-black/25">{s.sub}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-3 flex flex-col gap-5">
              <Card>
                <div className="px-6 pt-6 pb-2 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Protocol activity</p>
                    <p className="mt-1.5 text-2xl font-light tracking-tight text-[#111]">{loading ? <Skeleton className="w-16 h-7" /> : `${rows.length} trades`}</p>
                  </div>
                  <span className="text-[11px] text-[#16a34a] mt-1" style={{ fontFamily: "var(--font-data)" }}>{vm === "sui" ? "Sui" : "EVM ×5"}</span>
                </div>
                <div className="px-4 pb-4"><Sparkline positive /></div>
              </Card>

              <Card>
                <div className="px-5 py-3 flex items-center justify-between border-b border-black/[0.05]">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Your position</p>
                  <span className="flex items-center gap-2">
                    <ChainBadge chainKey={activeChain.key} />
                    <span className="text-[11px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>{posAddress.slice(0, 6)}…{posAddress.slice(-4)}</span>
                  </span>
                </div>
                <div className="px-5 py-5 border-b border-black/[0.05]">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>Balance</p>
                  <p className="text-4xl font-light tracking-tight text-[#111]" style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>
                    {(+formatUnits(balance, dec)).toFixed(4)}<span className="text-2xl text-black/30 ml-2">{sym}</span>
                  </p>
                </div>
                <div className="grid grid-cols-2 divide-x divide-black/[0.05]">
                  {[{ label: "Intent", value: isActive ? "Active" : "None", green: isActive }, { label: "Slippage", value: slippage }].map((f) => (
                    <div key={f.label} className="px-4 py-4">
                      <p className="text-[10px] tracking-[0.14em] uppercase text-black/25" style={{ fontFamily: "var(--font-data)" }}>{f.label}</p>
                      <p className={`mt-1.5 text-sm font-medium ${f.green ? "text-[#16a34a]" : "text-[#111]"}`} style={{ fontFamily: "var(--font-data)" }}>{f.value}</p>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4 border-t border-black/[0.05] flex items-center gap-3 flex-wrap">
                  <button onClick={withdraw} disabled={!canWithdraw} className="px-5 py-2 text-sm font-medium rounded-xl transition-all"
                    style={{ background: canWithdraw ? "#111" : "rgba(0,0,0,0.04)", color: canWithdraw ? "#fff" : "rgba(0,0,0,0.25)", border: canWithdraw ? "none" : "1px solid rgba(0,0,0,0.07)", cursor: canWithdraw ? "pointer" : "not-allowed", opacity: withdrawing ? 0.6 : 1 }}>
                    {withdrawing ? "Withdrawing…" : "Withdraw all"}
                  </button>
                  <Link href="/strategy" className="px-5 py-2 text-sm text-black/50 rounded-xl border border-black/[0.07] hover:border-black/20 hover:text-black/80 transition-all">New intent</Link>
                  {withdrawTxUrl && <a href={withdrawTxUrl} target="_blank" rel="noreferrer" className="text-xs text-black/40 underline hover:text-black/70 transition-colors">View tx</a>}
                  {writeError && <p className="text-xs text-red-500 ml-2">{writeError.message.slice(0, 60)}</p>}
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-5">
              <Card className="overflow-hidden relative min-h-[140px] flex flex-col justify-between">
                <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/researcher-CvhqOuV6irGwBOnJoTGFlXdbyYBRjb.png" alt="" aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover object-center" style={{ maskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 80%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 80%)" }} />
                <div className="relative z-10 p-6"><div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest text-black/50 bg-white/60 border border-black/[0.07]">ECIES-256</div></div>
                <div className="relative z-10 p-6 pt-0"><h3 className="text-lg font-light text-[#111]">TEE-sealed execution</h3><p className="text-sm text-black/40 mt-1 leading-relaxed">Your intent stays encrypted until the Intel TDX enclave decrypts it in hardware.</p></div>
              </Card>

              <Card className="flex-1">
                <div className="px-5 py-3 flex items-center justify-between border-b border-black/[0.05]">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Protocol feed</p>
                  <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>{loading ? "…" : `${rows.length} total`}</span>
                </div>
                {loading && <div className="p-5 flex flex-col gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="w-full h-10" />)}</div>}
                {!loading && rows.length === 0 && (
                  <div className="px-5 py-12 text-center"><p className="text-sm text-black/30">No executions on-chain yet</p><p className="text-xs text-black/20 mt-1"><Link href="/strategy" className="underline">Set an intent</Link> to be first</p></div>
                )}
                {rows.slice(0, 8).map((ex, i) => {
                  const c = chainByKey(ex.chainKey);
                  return (
                    <div key={ex.txHash || i} className="group px-5 py-3 hover:bg-black/[0.015] transition-colors" style={{ borderBottom: i < Math.min(rows.length, 8) - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] text-black/50" style={{ fontFamily: "var(--font-data)" }}>{ex.user.slice(0, 6)}…{ex.user.slice(-4)}</span>
                        <ChainBadge chainKey={ex.chainKey} size={13} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <Link href={`/proof/${ex.receiptHash}`} className="text-[11px] text-black/35 hover:text-black/70 transition-colors" style={{ fontFamily: "var(--font-data)" }}>{ex.receiptHash.slice(0, 10)}…{ex.receiptHash.slice(-6)}</Link>
                        <div className="flex gap-3">
                          <a href={`${c?.explorerTx ?? ""}${ex.txHash}`} target="_blank" rel="noreferrer" className="text-[11px] text-black/40 hover:text-black/70 transition-colors underline">tx</a>
                          <Link href={`/proof/${ex.receiptHash}`} className="text-[11px] text-black/25 hover:text-black/55 transition-colors underline">proof</Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </div>
          </div>

          {/* Supported chains */}
          <div>
            <p className="text-[10px] tracking-[0.16em] uppercase text-black/30 mb-4" style={{ fontFamily: "var(--font-data)" }}>Supported chains - one sealed agent, six deployments</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {CHAINS.map((c) => (
                <a key={c.key} href={`${c.explorerAddr}${c.vault}`} target="_blank" rel="noreferrer"
                  className="group flex flex-col gap-2 p-4 rounded-2xl border border-black/[0.07] bg-white hover:border-black/[0.15] hover:bg-[#fafaf8] transition-all" style={{ textDecoration: "none" }}>
                  <ChainIcon chain={c} size={22} />
                  <span className="text-sm font-medium text-[#111]">{c.shortLabel}</span>
                  <span className="text-[10px] text-black/30 truncate leading-tight">{c.name}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[{ label: "Strategy Terminal", href: "/strategy" }, { label: "Trade History", href: "/history" }, { label: "Protocol Activity", href: "/activity" }, { label: "Vault", href: "/vault" }].map((l) => (
              <Link key={l.label} href={l.href} className="text-xs text-black/35 hover:text-black/65 transition-colors tracking-wide">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
