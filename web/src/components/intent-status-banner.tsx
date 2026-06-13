"use client";
import Link from "next/link";

export type IntentLifecycle = "none" | "pending" | "executed" | "withdrawn";

interface Props {
  lifecycle: IntentLifecycle;
  receiptHash?: string;
  txHash?: string;
  explorerTx?: string; // per-chain explorer base; falls back to Galileo
}

export function IntentStatusBanner({ lifecycle, receiptHash, txHash, explorerTx }: Props) {
  if (lifecycle === "none" || lifecycle === "withdrawn") return null;

  if (lifecycle === "pending") {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/50 px-6 py-4 flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-amber-500 animate-[dot-pulse_2s_ease-in-out_infinite]" />
        <div>
          <p className="text-sm font-medium text-amber-800">TEE agent processing your intent</p>
          <p className="text-[11px] text-amber-600/70 mt-0.5">Sealed inference running — swap will execute automatically</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[#16a34a]/20 bg-[#16a34a]/[0.04] px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="w-2 h-2 rounded-full bg-[#16a34a]" />
        <div>
          <p className="text-sm font-medium text-[#16a34a]">Trade executed</p>
          <p className="text-[11px] text-[#16a34a]/60 mt-0.5">Intent fulfilled — settled on-chain</p>
        </div>
      </div>
      <div className="flex gap-3">
        {receiptHash && (
          <Link href={`/proof/${receiptHash}`}
            className="text-[11px] text-[#16a34a] underline hover:text-[#16a34a]/70">
            View proof ↗
          </Link>
        )}
        {txHash && (
          <a href={`${explorerTx ?? "https://chainscan-galileo.0g.ai/tx/"}${txHash}`} target="_blank" rel="noreferrer"
            className="text-[11px] text-[#16a34a]/60 underline hover:text-[#16a34a]/80">
            tx ↗
          </a>
        )}
      </div>
    </div>
  );
}
