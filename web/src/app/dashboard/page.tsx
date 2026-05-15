"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { vaultAbi } from "@/lib/vaultAbi";
import { SWAP_TARGETS } from "@/lib/tokens";
import { Skeleton } from "@/components/skeleton";
import Link from "next/link";
import { WalletConnectPrompt } from "@/components/wallet-gate";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;

// ── Seeded sparkline ──────────────────────────────────────────────────────────
const SPARK_RAW = [38, 41, 39, 44, 48, 45, 52, 55, 51, 58, 62, 57, 63, 60, 67, 71, 68, 74, 78, 73, 79, 77, 83, 80, 86];

function Sparkline({ positive = true }: { positive?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 200);
    return () => clearTimeout(t);
  }, []);

  const W = 300; const H = 56;
  const min = Math.min(...SPARK_RAW);
  const max = Math.max(...SPARK_RAW);
  const range = max - min;

  const pts = SPARK_RAW.map((v, i) => [
    (i / (SPARK_RAW.length - 1)) * W,
    H - ((v - min) / range) * (H * 0.75) - H * 0.1,
  ]);

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
      <path
        d={line} fill="none" stroke={color} strokeWidth="1.5"
        strokeDasharray="1000" strokeDashoffset={drawn ? 0 : 1000}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)" }}
      />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color}
        style={{ opacity: drawn ? 1 : 0, transition: "opacity 0.4s ease 1s" }}
      />
    </svg>
  );
}

// ── Glow card ─────────────────────────────────────────────────────────────────
function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - r.left}px`);
    el.style.setProperty("--my", `${e.clientY - r.top}px`);
  }, []);
  return (
    <div ref={ref} onMouseMove={onMove} className={`group relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white ${className}`} style={style}>
      <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(380px circle at var(--mx,50%) var(--my,50%), rgba(0,0,0,0.025), transparent 65%)" }} />
      {children}
    </div>
  );
}

interface Execution { blockNumber: bigint; txHash: string; receiptHash: string; user: string; }

export default function DashboardPage() {
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

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

  const fetchEvents = useCallback(async () => {
    if (!client || !VAULT) return;
    try {
      const logs = await client.getContractEvents({ address: VAULT, abi: vaultAbi, eventName: "TradeExecuted", fromBlock: BigInt(0) });
      setExecutions(logs.reverse().slice(0, 20).map((l) => ({
        blockNumber: l.blockNumber ?? BigInt(0),
        txHash: l.transactionHash ?? "",
        receiptHash: (l.args as { receiptHash?: string }).receiptHash ?? "",
        user: (l.args as { user?: string }).user ?? "",
      })));
      setLastPoll(new Date());
    } catch {}
    finally { setLoading(false); }
  }, [client]);

  useEffect(() => { fetchEvents(); const id = setInterval(fetchEvents, 15_000); return () => clearInterval(id); }, [fetchEvents]);
  if (isSuccess) { refetchBalance(); refetchIntent(); }

  if (!address) return <WalletConnectPrompt page="dashboard" />;

  const isActive = intent?.[4] === true;
  const hasBalance = balance !== undefined && balance > 0n;
  const canWithdraw = !!address && !!VAULT && hasBalance && !isPending && !isConfirming;
  const uniqueTraders = useMemo(() => new Set(executions.map((e) => e.user)).size, [executions]);

  const stats = [
    { label: "Vault balance", value: address && balance !== undefined ? `${(+formatEther(balance)).toFixed(4)} OG` : "—", sub: "your deposited collateral" },
    { label: "Intent", value: !address ? "—" : isActive ? "Active" : "None", sub: isActive ? "TEE agent processing" : "no active order", green: isActive },
    { label: "Protocol trades", value: loading ? "…" : executions.length.toString(), sub: "TradeExecuted events" },
    { label: "Unique traders", value: loading ? "…" : uniqueTraders.toString(), sub: "distinct vault users" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / DASHBOARD</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Vault overview</h1>
            </div>
            <div className="flex items-center gap-2">
              {lastPoll && (
                <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>{lastPoll.toLocaleTimeString()}</span>
              )}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] text-[#16a34a] border border-[#16a34a]/20 bg-[#16a34a]/05">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />
                Live
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {stats.map((s) => (
              <Card key={s.label} className="p-5">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{s.label}</p>
                <p className={`mt-2 text-2xl font-light tracking-tight ${s.green ? "text-[#16a34a]" : "text-[#111]"}`}
                  style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>
                  {s.value}
                </p>
                <p className="mt-1 text-[11px] text-black/25">{s.sub}</p>
              </Card>
            ))}
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: Position + chart */}
            <div className="lg:col-span-3 flex flex-col gap-5">

              {/* Chart card */}
              <Card>
                <div className="px-6 pt-6 pb-2 flex items-start justify-between">
                  <div>
                    <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Protocol activity</p>
                    <p className="mt-1.5 text-2xl font-light tracking-tight text-[#111]">
                      {loading ? <Skeleton className="w-16 h-7" /> : `${executions.length} trades`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-[#16a34a]" style={{ fontFamily: "var(--font-data)" }}>+{Math.max(0, executions.length)} all time</span>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <Sparkline positive={true} />
                </div>
              </Card>

              {/* Position card */}
              <Card>
                <div className="px-5 py-3 flex items-center justify-between border-b border-black/[0.05]">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Your position</p>
                  {address && (
                    <span className="text-[11px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>
                      {address.slice(0, 6)}…{address.slice(-4)}
                    </span>
                  )}
                </div>

                {!address ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-black/35">Connect your wallet to view position</p>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-5 border-b border-black/[0.05]">
                      <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>Balance</p>
                      <p className="text-4xl font-light tracking-tight text-[#111]" style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>
                        {balance !== undefined ? `${(+formatEther(balance)).toFixed(4)}` : <Skeleton className="w-24 h-10" />}
                        <span className="text-2xl text-black/30 ml-2">OG</span>
                      </p>
                    </div>

                    <div className="grid grid-cols-3 divide-x divide-black/[0.05]">
                      {[
                        { label: "Intent", value: isActive ? "Active" : "None", green: isActive },
                        { label: "Slippage", value: isActive && intent ? `${intent[1].toString()} bps` : "—" },
                        { label: "Stop loss", value: isActive && intent ? `${intent[2].toString()} bps` : "—" },
                      ].map((f) => (
                        <div key={f.label} className="px-4 py-4">
                          <p className="text-[10px] tracking-[0.14em] uppercase text-black/25" style={{ fontFamily: "var(--font-data)" }}>{f.label}</p>
                          <p className={`mt-1.5 text-sm font-medium ${f.green ? "text-[#16a34a]" : "text-[#111]"}`}
                            style={{ fontFamily: "var(--font-data)" }}>
                            {f.value}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="px-5 py-4 border-t border-black/[0.05] flex items-center gap-3">
                      <button
                        onClick={() => writeContract({ abi: vaultAbi, address: VAULT, functionName: "withdraw" })}
                        disabled={!canWithdraw}
                        className="px-5 py-2 text-sm font-medium rounded-xl transition-all"
                        style={{
                          background: canWithdraw ? "#111" : "rgba(0,0,0,0.04)",
                          color: canWithdraw ? "#fff" : "rgba(0,0,0,0.25)",
                          border: canWithdraw ? "none" : "1px solid rgba(0,0,0,0.07)",
                          cursor: canWithdraw ? "pointer" : "not-allowed",
                          opacity: isPending || isConfirming ? 0.6 : 1,
                        }}
                      >
                        {isPending ? "Confirm in wallet…" : isConfirming ? "Confirming…" : isSuccess ? "Withdrawn" : "Withdraw all"}
                      </button>
                      <Link href="/strategy" className="px-5 py-2 text-sm text-black/50 rounded-xl border border-black/[0.07] hover:border-black/20 hover:text-black/80 transition-all">
                        New intent
                      </Link>
                      {isSuccess && txHash && (
                        <a href={`https://chainscan-galileo.0g.ai/tx/${txHash}`} target="_blank" rel="noreferrer"
                          className="text-xs text-black/40 underline hover:text-black/70 transition-colors">
                          View tx ↗
                        </a>
                      )}
                      {writeError && <p className="text-xs text-red-500 ml-2">{writeError.message.slice(0, 60)}</p>}
                    </div>
                  </>
                )}
              </Card>

            </div>

            {/* Right: Protocol feed */}
            <div className="lg:col-span-2 flex flex-col gap-5">

              {/* Encrypted intent card with image */}
              <Card className="overflow-hidden relative min-h-[140px] flex flex-col justify-between">
                <img
                  src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/researcher-CvhqOuV6irGwBOnJoTGFlXdbyYBRjb.png"
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                  style={{
                    maskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 80%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 80%)",
                  }}
                />
                <div className="relative z-10 p-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest text-black/50 bg-white/60 border border-black/[0.07]">
                    ECIES-256
                  </div>
                </div>
                <div className="relative z-10 p-6 pt-0">
                  <h3 className="text-lg font-light text-[#111]">TEE-sealed execution</h3>
                  <p className="text-sm text-black/40 mt-1 leading-relaxed">Your intent stays encrypted until the Intel TDX enclave decrypts it in hardware.</p>
                </div>
              </Card>

              {/* Activity feed */}
              <Card className="flex-1">
                <div className="px-5 py-3 flex items-center justify-between border-b border-black/[0.05]">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Protocol feed</p>
                  <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>
                    {loading ? "…" : `${executions.length} total`}
                  </span>
                </div>

                {loading && (
                  <div className="p-5 flex flex-col gap-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="w-full h-10" />)}
                  </div>
                )}

                {!loading && executions.length === 0 && (
                  <div className="px-5 py-12 text-center">
                    <p className="text-sm text-black/30">No executions on-chain yet</p>
                    <p className="text-xs text-black/20 mt-1">
                      <Link href="/strategy" className="underline">Set an intent</Link> to be first
                    </p>
                  </div>
                )}

                {executions.slice(0, 8).map((ex, i) => (
                  <div key={ex.txHash || i} className="group px-5 py-3 hover:bg-black/[0.015] transition-colors"
                    style={{ borderBottom: i < Math.min(executions.length, 8) - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-black/50" style={{ fontFamily: "var(--font-data)" }}>
                        {ex.user.slice(0, 6)}…{ex.user.slice(-4)}
                      </span>
                      <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>
                        #{ex.blockNumber.toString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <Link href={`/proof/${ex.receiptHash}`}
                        className="text-[11px] text-black/35 hover:text-black/70 transition-colors"
                        style={{ fontFamily: "var(--font-data)" }}>
                        {ex.receiptHash.slice(0, 10)}…{ex.receiptHash.slice(-6)}
                      </Link>
                      <div className="flex gap-3">
                        <a href={`https://chainscan-galileo.0g.ai/tx/${ex.txHash}`} target="_blank" rel="noreferrer"
                          className="text-[11px] text-black/40 hover:text-black/70 transition-colors underline">tx</a>
                        <a href={`https://storagescan-galileo.0g.ai/file/${ex.receiptHash}`} target="_blank" rel="noreferrer"
                          className="text-[11px] text-black/25 hover:text-black/55 transition-colors underline">proof</a>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          </div>

          {/* Token pairs */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.16em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Available pairs — OG → X via Jaine DEX</p>
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
                  className="group flex flex-col gap-1.5 p-4 rounded-2xl border border-black/[0.07] bg-white hover:border-black/[0.15] hover:bg-[#fafaf8] transition-all"
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
              { label: "Strategy Terminal", href: "/strategy" },
              { label: "Trade History", href: "/history" },
              { label: "Protocol Activity", href: "/activity" },
              { label: "Vault", href: "/vault" },
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
