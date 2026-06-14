"use client";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { formatUnits } from "viem";
import { vaultAbi } from "@/lib/vaultAbi";
import { useActiveChain } from "@/lib/active-chain";
import { fetchSuiIntent, suiWithdrawTx, suiRequestCancelTx } from "@/lib/sui";
import { CHAINS } from "@/lib/chains";
import { ChainIcon, ChainBadge } from "@/components/chain-icon";
import { useToast } from "@/components/toast";
import Link from "next/link";
import { WalletConnectPrompt } from "@/components/wallet-gate";

export default function VaultPage() {
  const { toast } = useToast();
  const { activeChain } = useActiveChain();
  const isSui = activeChain.vm === "sui";
  const dec = activeChain.nativeDecimals;
  const sym = activeChain.nativeSymbol;

  const { address: evmAddress } = useAccount();
  const suiAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutateAsync: suiSignExec } = useSignAndExecuteTransaction();
  const address = isSui ? suiAccount?.address : evmAddress;

  const { data: evmIntent, refetch: refetchEvm } = useReadContract({
    abi: vaultAbi, address: activeChain.vault as `0x${string}`, functionName: "intents",
    args: evmAddress ? [evmAddress] : undefined,
    chainId: activeChain.evmChainId,
    query: { enabled: !isSui && !!evmAddress && !!activeChain.evmChainId, refetchInterval: 8_000 },
  });
  const { data: suiIntent, refetch: refetchSui } = useQuery({
    queryKey: ["sui-intent", activeChain.key, suiAccount?.address],
    queryFn: () => fetchSuiIntent(suiClient, activeChain, suiAccount!.address),
    enabled: isSui && !!suiAccount?.address, refetchInterval: 8_000,
  });

  const balance = isSui ? (suiIntent?.amountMist ?? 0n) : ((evmIntent?.[2] ?? 0n) as bigint);
  const isActive = isSui ? (suiIntent?.active ?? false) : (evmIntent?.[4] === true);
  const slippage = !isSui && isActive && evmIntent ? `${evmIntent[3].toString()} bps` : "-";

  const { writeContract, data: evmTx, isPending, error: writeError, reset: resetWrite } = useWriteContract();
  const { writeContractAsync: writeCancelAsync } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: evmTx, chainId: activeChain.evmChainId });
  const [suiWithdrawing, setSuiWithdrawing] = useState(false);
  const [suiTx, setSuiTx] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

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

  // Escape hatch: after the 1h cooldown the agent can no longer execute, so the user can safely withdraw.
  async function requestCancel() {
    try {
      setCancelling(true);
      if (isSui) {
        await suiSignExec({ transaction: suiRequestCancelTx(activeChain) });
        refetchSui();
      } else {
        await writeCancelAsync({ abi: vaultAbi, address: activeChain.vault as `0x${string}`, functionName: "requestCancel", chainId: activeChain.evmChainId });
      }
      toast({ type: "success", title: "Cancel requested", description: "Agent locked out after the cooldown - then withdraw" });
    } catch (e) {
      toast({ type: "error", title: "Request failed", description: e instanceof Error ? e.message.slice(0, 80) : "" });
    } finally { setCancelling(false); }
  }

  if (!address) return <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}><WalletConnectPrompt page="vault" /></div>;

  const hasBalance = balance > 0n;
  const withdrawing = isSui ? suiWithdrawing : (isPending || isConfirming);
  const canWithdraw = hasBalance && !withdrawing;
  const withdrawTxUrl = isSui ? (suiTx ? `${activeChain.explorerTx}${suiTx}` : null) : (evmTx ? `${activeChain.explorerTx}${evmTx}` : null);

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-8">

          <div className="flex items-end justify-between">
            <div>
              <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / VAULT</p>
              <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Your vault</h1>
              <p className="mt-2 text-[12px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>{address.slice(0, 10)}…{address.slice(-6)}</p>
            </div>
            <div className="flex items-center gap-3">
              <ChainBadge chainKey={activeChain.key} />
              <a href={`${activeChain.explorerAddr}${activeChain.vault}`} target="_blank" rel="noreferrer"
                className="text-[11px] text-black/30 hover:text-black/60 transition-colors underline" style={{ fontFamily: "var(--font-data)" }}>
                {`${activeChain.vault.slice(0, 8)}…${activeChain.vault.slice(-6)}`}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Balance", value: `${(+formatUnits(balance, dec)).toFixed(4)} ${sym}` },
              { label: "Intent", value: isActive ? "Active" : "None", green: isActive },
              { label: "Slippage", value: slippage },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-black/[0.07] bg-white p-6">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>{s.label}</p>
                <p className={`mt-3 text-3xl font-light tracking-tight ${s.green ? "text-[#16a34a]" : "text-[#111]"}`} style={{ fontFamily: "var(--font-data)", fontVariantNumeric: "tabular-nums" }}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-black/[0.07] bg-white min-h-[200px] flex flex-col justify-end">
              <img src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/researcher-CvhqOuV6irGwBOnJoTGFlXdbyYBRjb.png" alt="" aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover object-center" style={{ maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)", WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)" }} />
              <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 50%, transparent 100%)" }} />
              <div className="relative z-10 p-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest text-black/40 border border-black/[0.07]">NON-CUSTODIAL</span>
                <h3 className="mt-3 text-lg font-light text-[#111]">Only you can withdraw.</h3>
                <p className="mt-1 text-sm text-black/40 leading-relaxed">The vault enforces an escape hatch - the agent cannot touch your funds after you request cancel.</p>
              </div>
            </div>

            <div className="lg:col-span-3 rounded-2xl border border-black/[0.07] bg-white overflow-hidden">
              <div className="px-6 py-4 border-b border-black/[0.05] flex items-center justify-between">
                <p className="text-[10px] tracking-[0.14em] uppercase text-black/30" style={{ fontFamily: "var(--font-data)" }}>Position detail</p>
                {isActive && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-[#16a34a] border border-[#16a34a]/20 bg-[#16a34a]/05">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] animate-[dot-pulse_2s_ease-in-out_infinite]" />Intent active
                  </span>
                )}
              </div>
              <div className="divide-y divide-black/[0.04]">
                {[
                  { label: "Chain", value: activeChain.name },
                  { label: "Vault", value: `${activeChain.vault.slice(0, 12)}…${activeChain.vault.slice(-6)}` },
                  { label: "Your address", value: `${address.slice(0, 12)}…${address.slice(-6)}` },
                  { label: "Deposited", value: `${(+formatUnits(balance, dec)).toFixed(6)} ${sym}` },
                  ...(slippage !== "-" ? [{ label: "Max slippage", value: slippage }] : []),
                ].map((f) => (
                  <div key={f.label} className="flex justify-between items-center px-6 py-4">
                    <span className="text-sm text-black/40">{f.label}</span>
                    <span className="text-sm text-[#111]" style={{ fontFamily: "var(--font-data)" }}>{f.value}</span>
                  </div>
                ))}
              </div>
              <div className="px-6 py-5 border-t border-black/[0.05] flex items-center gap-3 flex-wrap">
                <button onClick={withdraw} disabled={!canWithdraw} className="px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: canWithdraw ? "#111" : "rgba(0,0,0,0.04)", color: canWithdraw ? "#fff" : "rgba(0,0,0,0.25)", border: canWithdraw ? "none" : "1px solid rgba(0,0,0,0.07)", cursor: canWithdraw ? "pointer" : "not-allowed", opacity: withdrawing ? 0.6 : 1 }}>
                  {withdrawing ? "Withdrawing…" : "Withdraw all"}
                </button>
                <Link href="/strategy" className="px-5 py-2.5 text-sm text-black/50 rounded-xl border border-black/[0.07] hover:border-black/20 hover:text-black/80 transition-all">New intent</Link>
                {isActive && (
                  <button onClick={requestCancel} disabled={cancelling}
                    className="px-5 py-2.5 text-sm rounded-xl border border-amber-200 text-amber-700 bg-amber-50/40 hover:bg-amber-100/60 transition-all"
                    style={{ cursor: cancelling ? "not-allowed" : "pointer", opacity: cancelling ? 0.6 : 1 }}>
                    {cancelling ? "Requesting…" : "Request cancel"}
                  </button>
                )}
                {!hasBalance && <span className="text-xs text-black/30">No balance to withdraw</span>}
                {withdrawTxUrl && <a href={withdrawTxUrl} target="_blank" rel="noreferrer" className="text-xs text-black/40 underline hover:text-black/70 transition-colors">View tx</a>}
              </div>
              {writeError && <div className="mx-6 mb-5 rounded-xl border border-red-200 bg-red-50/50 px-4 py-3"><p className="text-xs text-red-600">{writeError.message}</p></div>}
            </div>
          </div>

          {/* Supported chains */}
          <div>
            <p className="text-[10px] tracking-[0.16em] uppercase text-black/30 mb-4" style={{ fontFamily: "var(--font-data)" }}>Vaults across chains</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {CHAINS.map((c) => (
                <a key={c.key} href={`${c.explorerAddr}${c.vault}`} target="_blank" rel="noreferrer"
                  className="flex flex-col gap-2 p-4 rounded-2xl border border-black/[0.07] bg-white hover:border-black/[0.15] hover:bg-[#fafaf8] transition-all" style={{ textDecoration: "none" }}>
                  <ChainIcon chain={c} size={22} />
                  <span className="text-sm font-medium text-[#111]">{c.shortLabel}</span>
                  <span className="text-[10px] text-black/20 truncate" style={{ fontFamily: "var(--font-data)" }}>{c.vault.slice(0, 6)}…{c.vault.slice(-4)}</span>
                </a>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 pt-4 border-t border-black/[0.06]">
            {[{ label: "Dashboard", href: "/dashboard" }, { label: "Strategy Terminal", href: "/strategy" }, { label: "Trade History", href: "/history" }, { label: "Protocol Activity", href: "/activity" }].map((l) => (
              <Link key={l.label} href={l.href} className="text-xs text-black/35 hover:text-black/65 transition-colors tracking-wide">{l.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
