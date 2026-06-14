"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction, ConnectButton as SuiConnectButton } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { parseUnits, formatUnits, erc20Abi, isAddress } from "viem";
import { useRouter } from "next/navigation";
import { encryptIntentBrowser } from "@/lib/encrypt";
import { vaultAbi } from "@/lib/vaultAbi";
import { useActiveChain } from "@/lib/active-chain";
import { suiDepositTx, fetchSuiIntent } from "@/lib/sui";
import { ChainIcon } from "@/components/chain-icon";
import { StrategyBuilder, type BuilderState } from "@/components/strategy-builder";
import type { Strategy } from "@/lib/strategy-schema";
import { useToast } from "@/components/toast";
import { WalletConnectPrompt } from "@/components/wallet-gate";
import Link from "next/link";

const AGENT_PUB = process.env.NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY || "";

type Phase = "idle" | "encrypting" | "approving" | "submitting" | "done" | "error";

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
  const { activeChain } = useActiveChain();
  const isSui = activeChain.vm === "sui";
  const router = useRouter();
  const { toast } = useToast();

  const { address: evmAddress } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: activeChain.evmChainId });
  const suiAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: suiSignExec } = useSignAndExecuteTransaction();

  const address = isSui ? suiAccount?.address : evmAddress;
  const dec = activeChain.nativeDecimals;
  const sym = activeChain.nativeSymbol;

  const [builderState, setBuilderState] = useState<BuilderState>({ conditions: [], logic: "AND", immediate: false, valid: false });
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [cipher, setCipher] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  // Input asset: native (depositNative) or an ERC20 (approve -> depositToken). EVM only.
  const [inputMode, setInputMode] = useState<"native" | "erc20">("native");
  const [tokenAddr, setTokenAddr] = useState("");
  const erc20 = !isSui && inputMode === "erc20";
  const validToken = erc20 && isAddress(tokenAddr);

  // Reset transient state when the active chain changes.
  useEffect(() => { setPhase("idle"); setTxHash(null); setErrMsg(null); setCipher(null); setInputMode("native"); setTokenAddr(""); }, [activeChain.key]);

  // ERC20 reads (when an ERC20 input asset is selected).
  const tokenCfg = { abi: erc20Abi, address: tokenAddr as `0x${string}`, chainId: activeChain.evmChainId } as const;
  const tokenEnabled = { enabled: !!validToken };
  const { data: tokenDecimals } = useReadContract({ ...tokenCfg, functionName: "decimals", query: tokenEnabled });
  const { data: tokenSymbol } = useReadContract({ ...tokenCfg, functionName: "symbol", query: tokenEnabled });
  const { data: tokenBalance } = useReadContract({ ...tokenCfg, functionName: "balanceOf", args: evmAddress ? [evmAddress] : undefined, query: { enabled: !!validToken && !!evmAddress, refetchInterval: 10_000 } });
  const { data: tokenAllowance, refetch: refetchAllowance } = useReadContract({ ...tokenCfg, functionName: "allowance", args: evmAddress ? [evmAddress, activeChain.vault as `0x${string}`] : undefined, query: { enabled: !!validToken && !!evmAddress, refetchInterval: 10_000 } });

  const { data: evmIntent } = useReadContract({
    abi: vaultAbi, address: activeChain.vault as `0x${string}`, functionName: "intents",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: activeChain.evmChainId,
    query: { enabled: !isSui && !!evmAddress && !!activeChain.evmChainId, refetchInterval: 10_000 },
  });

  const { data: suiIntent } = useQuery({
    queryKey: ["sui-intent", activeChain.key, suiAccount?.address],
    queryFn: () => fetchSuiIntent(suiClient, activeChain, suiAccount!.address),
    enabled: isSui && !!suiAccount?.address,
    refetchInterval: 10_000,
  });

  const balance = isSui ? (suiIntent?.amountMist ?? 0n) : ((evmIntent?.[2] ?? 0n) as bigint);
  const hasActive = isSui ? (suiIntent?.active ?? false) : (evmIntent?.[4] === true);
  const slippageDisplay = !isSui && hasActive && evmIntent ? `${evmIntent[3].toString()} bps` : "-";

  // Effective input asset (native vs ERC20).
  const effDec = erc20 ? Number(tokenDecimals ?? 18) : dec;
  const effSym = erc20 ? (tokenSymbol ?? "TOKEN") : sym;
  let needsApprove = false;
  try {
    if (erc20 && amount && +amount > 0) needsApprove = ((tokenAllowance ?? 0n) as bigint) < parseUnits(amount, effDec);
  } catch { needsApprove = false; }

  useEffect(() => {
    if (phase === "done" && txHash) {
      toast({ type: "success", title: "Intent submitted", description: "TEE agent will pick it up shortly", txHash, explorerTx: activeChain.explorerTx });
      router.push("/dashboard?intent=submitted");
    }
  }, [phase, txHash, toast, router]);

  const amountValid = !!amount && !isNaN(+amount) && +amount > 0;
  const canSubmit = !!address && !!AGENT_PUB && !hasActive && phase === "idle" && amountValid && builderState.valid && (!erc20 || validToken);

  async function submit() {
    if (!canSubmit) return;
    setErrMsg(null);
    try {
      setPhase("encrypting");
      /* immediate swap (no conditions) goes as a free-text goal so the TEE decides; a
         conditional strategy goes as the typed schema the agent evaluates in code */
      const payload: Strategy | { goal: string } = builderState.immediate
        ? { goal: builderState.notes || "swap now" }
        : {
            version: 1,
            conditions: builderState.conditions,
            logic: builderState.logic,
            notes: builderState.notes,
            trade: { inputAsset: erc20 ? tokenAddr : "native", amountIn: amount, outputToken: "oUSDC", slippageBps: Number(slippage) || 0 },
          };
      const ciphertext = encryptIntentBrowser(AGENT_PUB, payload);
      setCipher(ciphertext.slice(0, 96) + "...");
      await new Promise((r) => setTimeout(r, 350));
      setCipher(null);
      const amt = parseUnits(amount, effDec);
      if (isSui) {
        setPhase("submitting");
        const res = await suiSignExec({ transaction: suiDepositTx(activeChain, ciphertext, Number(slippage), amt) });
        setTxHash(res.digest);
      } else if (erc20) {
        if (((tokenAllowance ?? 0n) as bigint) < amt) {
          setPhase("approving");
          const approveHash = await writeContractAsync({
            abi: erc20Abi, address: tokenAddr as `0x${string}`,
            functionName: "approve", args: [activeChain.vault as `0x${string}`, amt],
            chainId: activeChain.evmChainId,
          });
          if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveHash });
          await refetchAllowance();
        }
        setPhase("submitting");
        const hash = await writeContractAsync({
          abi: vaultAbi, address: activeChain.vault as `0x${string}`,
          functionName: "depositToken", args: [tokenAddr as `0x${string}`, amt, ciphertext, Number(slippage)],
          chainId: activeChain.evmChainId,
        });
        setTxHash(hash);
      } else {
        setPhase("submitting");
        const hash = await writeContractAsync({
          abi: vaultAbi, address: activeChain.vault as `0x${string}`,
          functionName: "depositNative", args: [ciphertext, Number(slippage)],
          value: amt, chainId: activeChain.evmChainId,
        });
        setTxHash(hash);
      }
      setPhase("done");
    } catch (e) {
      setCipher(null);
      setErrMsg(e instanceof Error ? e.message : "Transaction failed");
      setPhase("error");
    }
  }

  const submitLabel = () => {
    if (!address)               return "Connect wallet first";
    if (hasActive)              return "Active intent - withdraw first";
    if (erc20 && !validToken)   return "Enter a valid token address";
    if (phase === "encrypting") return "Encrypting intent…";
    if (phase === "approving")  return `Approving ${effSym}…`;
    if (phase === "submitting") return "Confirm in wallet…";
    if (phase === "done")       return "Intent submitted ✓";
    return `${needsApprove ? "Approve & submit" : "Encrypt & submit"} ${effSym} to oUSDC`;
  };

  const STEPS = [
    { n: "01", label: "ENCRYPT",  desc: "ECIES-256 in-browser",       done: phase !== "idle" },
    { n: "02", label: "SUBMIT",   desc: `Sealed intent on ${activeChain.shortLabel}`, done: phase === "submitting" || phase === "done" || phase === "error" },
    { n: "03", label: "EXECUTE",  desc: "Intel TDX to Orcus router",   done: phase === "done" },
  ];

  if (!address) {
    if (!isSui) return <WalletConnectPrompt page="strategy" />;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "#F5F4F0", paddingTop: 88 }}>
        <div className="max-w-sm w-full text-center flex flex-col items-center gap-6">
          <ChainIcon chain={activeChain} size={48} />
          <div>
            <p className="text-[10px] tracking-[0.25em] text-black/30 uppercase mb-1" style={{ fontFamily: "var(--font-data)" }}>ORCUS / STRATEGY · SUI</p>
            <h1 className="text-2xl font-light text-[#111] tracking-tight">Connect your Sui wallet</h1>
            <p className="text-sm text-black/40 leading-relaxed mt-3">Connect a Sui wallet to encrypt and submit a sealed intent on Sui.</p>
          </div>
          <SuiConnectButton connectText="Connect Sui wallet" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          {/* Header */}
          <div>
            <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / STRATEGY</p>
            <div className="flex items-end gap-5 mt-2 flex-wrap">
              <h1 className="text-4xl font-light tracking-tight text-[#111]">Strategy terminal</h1>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-black/[0.08] bg-white">
                  <ChainIcon chain={activeChain} size={14} />
                  <span className="text-[11px] text-black/55">{activeChain.name}</span>
                </span>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#16a34a]/20 bg-[#16a34a]/05">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />
                  <span className="text-[11px] text-[#16a34a]">TEE sealed</span>
                </span>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="grid grid-cols-3 gap-3">
            {STEPS.map((step) => (
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

          {/* Banner */}
          <Card className="relative overflow-hidden min-h-[120px] flex items-end">
            <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/analyst-Ysxnqg7Fpy2cfA56PiIttv1KximMhT.png" alt="" aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover object-center"
              style={{ maskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 50%, transparent 100%)" }} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.7) 50%, transparent 100%)" }} />
            <div className="relative z-10 p-8">
              <Tag>DARK POOL</Tag>
              <h2 className="mt-3 text-2xl font-light text-[#111] leading-tight">Your intent is invisible to validators<br />until settlement is final.</h2>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Left: position */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              <Card>
                <div className="px-5 py-3 border-b border-black/[0.05] flex items-center justify-between">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Your position</p>
                  <span className="text-[11px] text-black/25" style={{ fontFamily: "var(--font-data)" }}>{address.slice(0, 6)}…{address.slice(-4)}</span>
                </div>
                <div className="px-5 py-5 border-b border-black/[0.05]">
                  <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>Vault balance</p>
                  <p className="text-3xl font-light tracking-tight text-[#111]" style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>
                    {(+formatUnits(balance, dec)).toFixed(4)}
                    <span className="text-xl text-black/30 ml-2">{sym}</span>
                  </p>
                </div>
                {[
                  { label: "Intent", value: hasActive ? "Active" : "None", green: hasActive },
                  { label: "Slippage", value: slippageDisplay },
                ].map((f) => (
                  <div key={f.label} className="px-5 py-3 flex items-center justify-between border-b border-black/[0.04]">
                    <span className="text-sm text-black/40">{f.label}</span>
                    <span className={`text-sm font-medium ${f.green ? "text-[#16a34a]" : "text-[#111]"}`} style={{ fontFamily: "var(--font-data)" }}>{f.value}</span>
                  </div>
                ))}
                {hasActive && (
                  <div className="px-5 py-3 bg-amber-50/50 border-t border-amber-100">
                    <p className="text-[11px] text-amber-700">Intent active - withdraw to set a new one</p>
                  </div>
                )}
              </Card>
              <Card className="flex-1 flex items-center justify-center p-8">
                <Link href="/dashboard" className="text-sm text-black/40 hover:text-black/70 transition-colors">View executions on Dashboard</Link>
              </Card>
            </div>

            {/* Right: form */}
            <Card className="lg:col-span-3" style={{ boxShadow: "0 0 0 1px rgba(0,0,0,0.03), 0 8px 32px rgba(0,0,0,0.06)" }}>
              <div className="px-5 py-3 border-b border-black/[0.05]">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Intent configuration</p>
              </div>
              <div className="p-6 flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Strategy</label>
                  {cipher ? (
                    <div className="rounded-xl border border-black/10 bg-black/[0.02] p-4 text-[12px] min-h-[90px] leading-relaxed break-all" style={{ fontFamily: "var(--font-data)", color: "#111" }}>{cipher}</div>
                  ) : (
                    <StrategyBuilder onChange={setBuilderState} />
                  )}
                  <p className="text-[11px] text-black/25">Conditions are ECIES-256 encrypted in-browser. Only the TEE can read them.</p>
                </div>

                {/* Input asset: native vs ERC20 (EVM only; Sui deposits native SUI) */}
                {!isSui && (
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Deposit asset</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([["native", `Native ${sym}`], ["erc20", "ERC-20 token"]] as const).map(([m, lbl]) => (
                        <button key={m} onClick={() => setInputMode(m)} type="button"
                          className="rounded-xl border p-3 text-left transition-all"
                          style={{ border: inputMode === m ? "1px solid rgba(0,0,0,0.25)" : "1px solid rgba(0,0,0,0.07)", background: inputMode === m ? "rgba(0,0,0,0.04)" : "white", cursor: "pointer" }}>
                          <p className="text-[13px] font-medium text-[#111]">{lbl}</p>
                        </button>
                      ))}
                    </div>
                    {erc20 && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        <input value={tokenAddr} onChange={(e) => setTokenAddr(e.target.value.trim())} placeholder="ERC-20 token address (0x…)"
                          className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[12px] outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]"
                          style={{ fontFamily: "var(--font-data)", color: "#111" }} />
                        {tokenAddr && !validToken && <p className="text-[11px] text-red-500">Not a valid address.</p>}
                        {validToken && (
                          <p className="text-[11px] text-black/35" style={{ fontFamily: "var(--font-data)" }}>
                            {tokenSymbol ? `${tokenSymbol} · ` : ""}balance {(+formatUnits((tokenBalance ?? 0n) as bigint, effDec)).toFixed(4)}
                            {needsApprove ? " · approval required" : (tokenAllowance !== undefined ? " · approved" : "")}
                          </p>
                        )}
                        <p className="text-[11px] text-black/25">Testnet note: deposit any ERC-20; the mock stack only has oUSDC + wrapped-native, so this is mainly for real-token chains.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Settlement note (agent settles in the chain's oUSDC) */}
                <div className="flex items-center gap-2.5 rounded-xl border border-black/[0.07] bg-black/[0.015] px-4 py-3">
                  <ChainIcon chain={activeChain} size={18} />
                  <p className="text-[12px] text-black/55">Deposits {effSym}; the sealed agent settles into <span className="text-black/80 font-medium">oUSDC</span> on {activeChain.name}.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Amount ({effSym})</label>
                    <input value={amount} onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[13px] outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]"
                      style={{ fontFamily: "var(--font-data)", color: "#111", fontVariantNumeric: "tabular-nums" }} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Slippage (bps)</label>
                    <input type="number" value={slippage} onChange={(e) => setSlippage(Number(e.target.value))}
                      className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-[13px] outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]"
                      style={{ fontFamily: "var(--font-data)", color: "#111", fontVariantNumeric: "tabular-nums" }} />
                  </div>
                </div>

                <button disabled={!canSubmit} onClick={submit}
                  className="w-full py-4 rounded-xl text-[13px] font-medium tracking-wide transition-all"
                  style={{ background: canSubmit ? "#111" : "rgba(0,0,0,0.04)", color: canSubmit ? "#fff" : "rgba(0,0,0,0.25)",
                    border: canSubmit ? "none" : "1px solid rgba(0,0,0,0.07)", cursor: canSubmit ? "pointer" : "not-allowed",
                    opacity: phase === "submitting" || phase === "encrypting" ? 0.7 : 1, letterSpacing: "0.04em" }}>
                  {submitLabel()}
                </button>

                {phase === "done" && txHash && (
                  <div className="rounded-xl border border-[#16a34a]/20 bg-[#16a34a]/[0.04] p-4 text-[12px] text-[#16a34a] leading-relaxed">
                    Intent submitted. TEE agent will pick it up shortly.
                    <a href={`${activeChain.explorerTx}${txHash}`} target="_blank" rel="noreferrer" className="underline ml-1">View tx</a>
                  </div>
                )}
                {phase === "error" && errMsg && (
                  <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 text-[12px] text-red-600 leading-relaxed break-words">{errMsg}</div>
                )}
                {!AGENT_PUB && <p className="text-[12px] text-red-500">NEXT_PUBLIC_AGENT_ECIES_PUBLIC_KEY not set.</p>}
              </div>
            </Card>
          </div>

          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[{ label: "Dashboard", href: "/dashboard" }, { label: "Trade History", href: "/history" }, { label: "Protocol Activity", href: "/activity" }].map((l) => (
              <Link key={l.label} href={l.href} className="text-xs text-black/35 hover:text-black/65 transition-colors tracking-wide">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
