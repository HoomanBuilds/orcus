import Link from "next/link";
import { fetchReceipt } from "@/lib/receipt";
import { ReceiptViewer } from "@/components/receipt-viewer";

interface Props {
  params: Promise<{ hash: string }>;
}

export default async function ProofViewer({ params }: Props) {
  const { hash } = await params;
  const receipt = await fetchReceipt(hash);
  const storageScanUrl = "https://storagescan-galileo.0g.ai/submissions";
  const chainScanUrl = `https://chainscan-galileo.0g.ai/address/0xc624fFC2c9069a53e0D62CF5172fB10aDDA2D205`;

  return (
    <div className="min-h-screen" style={{ background: "#F5F4F0", paddingTop: 88 }}>
      <div className="px-6 md:px-12 lg:px-20 py-12">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">

          {/* Header */}
          <div>
            <p className="text-[11px] tracking-[0.16em] text-black/30" style={{ fontFamily: "var(--font-data)" }}>ORCUS / PROOF VIEWER</p>
            <h1 className="mt-2 text-4xl font-light tracking-tight text-[#111]">Execution proof</h1>
          </div>

          {/* Hash card */}
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>
              Storage receipt hash (merkle root)
            </p>
            <p className="font-mono text-sm break-all text-[#111] leading-relaxed" style={{ fontFamily: "var(--font-data)" }}>
              {hash}
            </p>
            <p className="mt-3 text-[11px] text-black/30">
              This merkle root anchors the TEE decision receipt on 0G Storage. The full JSON receipt is permanently stored and verifiable.
            </p>
          </div>

          {/* Decoded receipt (fetched from 0G Storage by root) */}
          {receipt ? (
            <ReceiptViewer receipt={receipt} />
          ) : (
            <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
              <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>
                Receipt
              </p>
              <p className="text-sm text-black/45 leading-relaxed">
                Not yet retrievable from 0G Storage — it may still be propagating across storage nodes, or this root predates the current deployment. The merkle root above is the on-chain proof; the full JSON renders here once the file is indexed.
              </p>
            </div>
          )}

          {/* Links */}
          <div className="grid grid-cols-2 gap-3">
            <a
              href={storageScanUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-2xl border border-black/10 text-[#111] bg-white hover:border-black/25 hover:bg-[#fafaf8] transition-all"
            >
              0G StorageScan ↗
            </a>
            <a
              href={chainScanUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-2xl border border-black/10 text-[#111] bg-white hover:border-black/25 hover:bg-[#fafaf8] transition-all"
            >
              Vault on ChainScan ↗
            </a>
          </div>

          {/* How it works */}
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-4" style={{ fontFamily: "var(--font-data)" }}>
              Verification steps
            </p>
            <div className="flex flex-col gap-3 text-sm text-black/50 leading-relaxed">
              <div className="flex gap-3">
                <span className="text-[10px] text-black/25 mt-0.5" style={{ fontFamily: "var(--font-data)" }}>01</span>
                <p>The receipt hash above is the merkle root of the decision JSON uploaded to 0G Storage.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-[10px] text-black/25 mt-0.5" style={{ fontFamily: "var(--font-data)" }}>02</span>
                <p>This hash is stored on-chain in the <code className="text-[12px] text-black/60 bg-black/[0.04] px-1.5 py-0.5 rounded" style={{ fontFamily: "var(--font-data)" }}>TradeExecuted</code> event, binding the execution to its proof.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-[10px] text-black/25 mt-0.5" style={{ fontFamily: "var(--font-data)" }}>03</span>
                <p>Anyone can download the receipt from 0G Storage using this root hash and verify the TEE agent&apos;s decision was legitimate.</p>
              </div>
            </div>
          </div>

          {/* TEE attestation note */}
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>
              TEE attestation
            </p>
            <p className="text-sm text-black/45 leading-relaxed">
              The TEE inference runs inside an Intel TDX enclave via 0G Compute. Full DCAP attestation verification is post-MVP — the sealed execution guarantee is enforced by the 0G Compute network.
            </p>
          </div>

          {/* Footer nav */}
          <div className="flex items-center gap-6 pt-2 border-t border-black/[0.06]">
            {[
              { label: "Trade History", href: "/history" },
              { label: "Dashboard", href: "/dashboard" },
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
