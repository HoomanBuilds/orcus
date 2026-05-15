import Link from "next/link";

interface Props {
  params: Promise<{ hash: string }>;
}

export default async function ProofViewer({ params }: Props) {
  const { hash } = await params;
  const storageScanUrl = `https://storagescan-galileo.0g.ai/file/${hash}`;

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
              Storage receipt hash
            </p>
            <p className="font-mono text-sm break-all text-[#111] leading-relaxed" style={{ fontFamily: "var(--font-data)" }}>
              {hash}
            </p>
          </div>

          {/* StorageScan link */}
          <a
            href={storageScanUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 py-3 text-sm font-medium rounded-2xl border border-black/10 text-[#111] bg-white hover:border-black/25 hover:bg-[#fafaf8] transition-all"
          >
            View on 0G StorageScan ↗
          </a>

          {/* iframe */}
          <div className="rounded-2xl overflow-hidden border border-black/[0.07]" style={{ height: 480 }}>
            <iframe src={storageScanUrl} className="w-full h-full" title="0G StorageScan receipt" />
          </div>

          {/* TEE attestation note */}
          <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
            <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>
              TEE attestation
            </p>
            <p className="text-sm text-black/45 leading-relaxed">
              Raw attestation bytes are stored in the on-chain{" "}
              <code className="text-[12px] text-black/60 bg-black/[0.04] px-1.5 py-0.5 rounded" style={{ fontFamily: "var(--font-data)" }}>TradeExecuted</code>
              {" "}event. Full Intel TDX DCAP verification is post-MVP — bytes are preserved on-chain for independent audit.
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
