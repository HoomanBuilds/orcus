"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther } from "viem";
import { useRouter } from "next/navigation";
import { encryptIntentBrowser } from "@/lib/encrypt";
import { vaultAbi } from "@/lib/vaultAbi";
import { VAULT } from "@/lib/vaultEvents";
import { SWAP_TARGETS, DEFAULT_TOKEN_OUT, type SwapTargetSymbol } from "@/lib/tokens";
import { useToast } from "@/components/toast";
import Link from "next/link";
import { WalletConnectPrompt } from "@/components/wallet-gate";

const AGENT_PUB = process.env.NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY || "";

type Phase = "idle" | "encrypting" | "submitting" | "done" | "error";

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

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest text-black/40 border border-black/[0.07]">
      {children}
    </span>
  );
}

export default function StrategyPage() {
  const { address } = useAccount();
  const router = useRouter();
  const { toast } = useToast();
  const { writeContractAsync } = useWriteContract();

  const [goal, setGoal]         = useState("");
  const [tokenOut, setTokenOut] = useState<SwapTargetSymbol>(DEFAULT_TOKEN_OUT);
  const [amount, setAmount]     = useState("0.01");
  const [slippage, setSlippage] = useState(0);
  const [phase, setPhase]       = useState<Phase>("idle");
  const [cipher, setCipher]     = useState<string | null>(null);
  const [txHash, setTxHash]     = useState<string | null>(null);
  const [errMsg, setErrMsg]     = useState<string | null>(null);

  const { data: balance } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "balances",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT, refetchInterval: 10_000 },
  });

  const { data: intent } = useReadContract({
    abi: vaultAbi, address: VAULT, functionName: "intents",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!VAULT, refetchInterval: 10_000 },
  });

  const { isSuccess: txConfirmed } = useWaitForTransactionReceipt({ hash: txHash as `0x${string}` | undefined });

  useEffect(() => {
    if (txConfirmed && txHash) {
      toast({ type: "success", title: "Intent submitted", description: "TEE agent will pick it up shortly", txHash });
      router.push("/dashboard?intent=submitted");
    }
  }, [txConfirmed, txHash, toast, router]);

  const hasActive = intent?.[4] === true;
  const amountValid = !!amount && !isNaN(+amount) && +amount > 0;
  const canSubmit = !!address && !!VAULT && !!AGENT_PUB && !hasActive && phase === "idle" && amountValid;

  async function submit() {
    if (!canSubmit) return;
    setErrMsg(null);
    try {
      setPhase("encrypting");
      const ciphertext = encryptIntentBrowser(AGENT_PUB, { goal, tokenOut, ts: Date.now() });
      setCipher(ciphertext.slice(0, 96) + "...");
      await new Promise((r) => setTimeout(r, 400));
      setCipher(null);
      setPhase("submitting");
      const hash = await writeContractAsync({
        abi: vaultAbi, address: VAULT,
        functionName: "depositAndSetIntent",
        args: [ciphertext, BigInt(slippage), BigInt(500)],
        value: parseEther(amount),
      });
      setTxHash(hash);
      setPhase("done");
    } catch (e) {
      setCipher(null);
      setErrMsg(e instanceof Error ? e.message : "Transaction failed");
      setPhase("error");
    }
  }

  const submitLabel = () => {
    if (!address)               return "Connect wallet first";
    if (hasActive)              return "Active intent — withdraw from vault first";
    if (phase === "encrypting") return "Encrypting intent…";
    if (phase === "submitting") return "Confirm in wallet…";
    if (phase === "done")       return "Intent submitted ✓";
    return `Encrypt & submit  ↗  OG → ${tokenOut}`;
  };

  const STEPS = [
    { n: "01", label: "ENCRYPT",  desc: "ECIES-256 in-browser",   done: phase !== "idle" },
    { n: "02", label: "SUBMIT",   desc: "On-chain sealed intent",  done: phase === "submitting" || phase === "done" || phase === "error" },
    { n: "03", label: "EXECUTE",  desc: "Intel TDX → Jaine DEX",  done: phase === "done" },
  ];

  if (!address) return <WalletConnectPrompt page="strategy" />;

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div>
            <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / STRATEGY</p>
            <div className="flex items-end gap-5 mt-2">
              <h1 className="text-4xl font-light tracking-tight text-[#111]">Strategy terminal</h1>
              <div className="flex items-center gap-1.5 mb-1 px-3 py-1 rounded-full border border-[#16a34a]/20 bg-[#16a34a]/05">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />
                <span className="text-[11px] text-[#16a34a]">TEE sealed</span>
              </div>
            </div>
          </div>

          {/* Encryption flow steps */}
          <div className="grid grid-cols-3 gap-3">
            {STEPS.map((step, i) => (
              <Card key={step.n} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-black/20 tracking-widest" style={{ fontFamily: "var(--font-data)" }}>{step.n}</span>
                  <div className={`w-2 h-2 rounded-full transition-all duration-500 ${step.done ? "bg-[#16a34a] shadow-[0_0_6px_rgba(22,163,74,0.5)]" : "bg-black/10"}`} />
                </div>
                <p className="text-sm font-medium text-[#111] tracking-wide">{step.label}</p>
                <p className="text-[11px] text-black/35 mt-1" style={{ fontFamily: "var(--font-data)" }}>{step.desc}</p>
              </Card>
            ))}
          </div>

          {/* Image banner */}
          <Card className="relative overflow-hidden min-h-[120px] flex items-end">
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/analyst-Ysxnqg7Fpy2cfA56PiIttv1KximMhT.png"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{
                maskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)",
              }}
            />
            <div className="absolute inset-0" style={{
              background: "linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 50%, transparent 100%)"
            }} />
            <div className="relative z-10 p-8">
              <Tag>DARK POOL</Tag>
              <h2 className="mt-3 text-2xl font-light text-[#111] leading-tight">
                Your intent is invisible to validators<br />until settlement is final.
              </h2>
            </div>
          </Card>

          {/* Main 2-col layout */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Left: position + recent */}
            <div className="lg:col-span-2 flex flex-col gap-5">

              {/* Position */}
              <Card>
                <div className="px-5 py-3 border-b border-black/[0.05] flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Your position</p>
                  {address && <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>{address.slice(0, 6)}…{address.slice(-4)}</span>}
                </div>

                {!address ? (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm text-black/30">Connect wallet to view</p>
                  </div>
                ) : (
                  <>
                    <div className="px-5 py-5 border-b border-black/[0.05]">
                      <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>Vault balance</p>
                      <p className="text-3xl font-light tracking-tight text-[#111]" style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>
                        {balance !== undefined ? `${(+formatEther(balance)).toFixed(4)}` : "…"}
                        <span className="text-xl text-black/30 ml-2">OG</span>
                      </p>
                    </div>
                    {[
                      { label: "Intent", value: hasActive ? "Active" : "None", green: hasActive },
                      { label: "Slippage", value: hasActive && intent ? `${intent[1].toString()} bps` : "—" },
                    ].map((f) => (
                      <div key={f.label} className="px-5 py-3 flex items-center justify-between border-b border-black/[0.04]">
                        <span className="text-sm text-black/40">{f.label}</span>
                        <span className={`text-sm font-medium ${f.green ? "text-[#16a34a]" : "text-[#111]"}`}
                          style={{ fontFamily: "var(--font-data)" }}>
                          {f.value}
                        </span>
                      </div>
                    ))}
                    {hasActive && (
                      <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100">
                        <p className="text-[11px] text-amber-700">Intent active — withdraw to set a new one</p>
                      </div>
                    )}
                  </>
                )}
              </Card>

              {/* Link to dashboard */}
              <Card className="flex-1 flex items-center justify-center p-8">
                <Link href="/dashboard" className="text-sm text-black/40 hover:text-black/70 transition-colors">
                  View executions on Dashboard →
                </Link>
              </Card>
            </div>

            {/* Right: trade form */}
            <Card className="lg:col-span-3" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.03), 0 8px 32px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-3 border-b border-black/[0.05]">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Intent configuration</p>
              </div>

              <div className="p-6 flex flex-col gap-6">

                {/* Goal textarea */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>
                    Strategy goal
                  </label>
                  {cipher ? (
                    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 text-[12px] min-h-[90px] leading-relaxed break-all"
                      style={{ fontFamily: "var(--font-data)", color: "#111" }}>
                      {cipher}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                      placeholder="e.g. swap when OG dips below the 1h moving average and momentum is positive"
                      className="w-full rounded-xl border border-black/10 bg-white p-4 text-[13px] leading-relaxed resize-none outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]"
                      style={{ fontFamily: "inherit", color: "#111" }}
                    />
                  )}
                  <p className="text-[11px] text-black/25">ECIES-256 encrypted in-browser. Only the TEE can read this.</p>
                </div>

                {/* Token selector */}
                <div className="flex flex-col gap-3">
                  <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>
                    Swap OG to
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {SWAP_TARGETS.map((t) => {
                      const active = tokenOut === t.symbol;
                      return (
                        <button key={t.symbol} onClick={() => setTokenOut(t.symbol)}
                          className="text-left rounded-xl border p-3 transition-all"
                          style={{
                            border: active ? "1px solid rgba(0,0,0,0.25)" : "1px solid rgba(0,0,0,0.07)",
                            background: active ? "rgba(0,0,0,0.04)" : "white",
                            cursor: "pointer",
                          }}>
                          <p className="text-[13px] font-medium text-[#111]">{t.symbol}</p>
                          <p className="text-[10px] text-black/30 mt-0.5 truncate">{t.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Amount + slippage */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Amount (OG)</label>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[13px] outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]"
                      style={{ fontFamily: "var(--font-data)", color: "#111", fontVariantNumeric: "tabular-nums" }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Slippage (bps)</label>
                    <input type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[13px] outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]"
                      style={{ fontFamily: "var(--font-data)", color: "#111", fontVariantNumeric: "tabular-nums" }}
                    />
                  </div>
                </div>

                {/* Submit */}
                <button
                  disabled={!canSubmit}
                  onClick={submit}
                  className="w-full py-4 rounded-xl text-[13px] font-medium tracking-wide transition-all"
                  style={{
                    background: canSubmit ? "#111" : "rgba(0,0,0,0.04)",
                    color: canSubmit ? "#fff" : "rgba(0,0,0,0.25)",
                    border: canSubmit ? "none" : "1px solid rgba(0,0,0,0.07)",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    opacity: phase === "submitting" || phase === "encrypting" ? 0.7 : 1,
                    letterSpacing: "0.04em",
                  }}>
                  {submitLabel()}
                </button>

                {/* Status messages */}
                {phase === "done" && txHash && (
                  <div className="rounded-xl border border-[#16a34a]/20 bg-[#16a34a]/[0.04] p-4 text-[12px] text-[#16a34a] leading-relaxed">
                    Intent submitted.{txConfirmed && " Confirmed. TEE agent will pick it up shortly. "}
                    <a href={`https://chainscan-galileo.0g.ai/tx/${txHash}`} target="_blank" rel="noreferrer"
                      className="underline ml-1">View tx ↗</a>
                  </div>
                )}
                {phase === "error" && errMsg && (
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-[12px] text-red-600 leading-relaxed">
                    {errMsg}
                  </div>
                )}

                {/* Validation warnings */}
                {!VAULT && <p className="text-[12px] text-red-500">NEXT_PUBLIC_VAULT_ADDRESS not set.</p>}
                {!AGENT_PUB && <p className="text-[12px] text-red-500">NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY not set.</p>}

                {/* Pool address */}
                {(() => {
                  const t = SWAP_TARGETS.find((x) => x.symbol === tokenOut);
                  return t ? (
                    <p className="text-[11px] text-black/20" style={{ fontFamily: "var(--font-data)" }}>
                      Pool {t.pool.slice(0, 10)}…{t.pool.slice(-6)}{" "}
                      <a href={`https://chainscan-galileo.0g.ai/address/${t.pool}`} target="_blank" rel="noreferrer"
                        className="text-black/35 underline hover:text-black/60 transition-colors">verify ↗</a>
                    </p>
                  ) : null;
                })()}
              </div>
            </Card>
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[
              { label: "Dashboard", href: "/dashboard" },
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
