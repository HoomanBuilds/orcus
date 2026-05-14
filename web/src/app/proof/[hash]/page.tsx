import Link from "next/link";

interface Props {
  params: Promise<{ hash: string }>;
}

export default async function ProofViewer({ params }: Props) {
  const { hash } = await params;
  const storageScanUrl = `https://storagescan-galileo.0g.ai/file/${hash}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 flex flex-col gap-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Proof Viewer</h1>

      {/* Receipt hash */}
      <div className="rounded p-4 flex flex-col gap-1" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          Storage receipt hash
        </p>
        <p className="font-mono text-sm break-all mt-1" style={{ color: "var(--text)" }}>{hash}</p>
      </div>

      {/* StorageScan link */}
      <a
        href={storageScanUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded transition-colors"
        style={{
          border: "1px solid var(--accent)",
          color: "var(--accent)",
          background: "rgba(79,142,247,0.06)",
        }}
      >
        View on 0G StorageScan ↗
      </a>

      {/* iframe */}
      <div
        className="rounded overflow-hidden"
        style={{ border: "1px solid var(--border)", height: 480 }}
      >
        <iframe src={storageScanUrl} className="w-full h-full" title="0G StorageScan receipt" />
      </div>

      {/* Attestation note */}
      <div className="rounded p-4 flex flex-col gap-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--muted)" }}>
          TEE attestation
        </p>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Raw attestation bytes are stored in the on-chain TradeExecuted event.
          Full Intel TDX DCAP verification is post-MVP — bytes are preserved on-chain for independent audit.
        </p>
      </div>

      <nav className="flex gap-4 text-xs" style={{ color: "var(--muted)" }}>
        <Link href="/history"   className="underline hover:text-white transition-colors">Trade History</Link>
        <Link href="/dashboard" className="underline hover:text-white transition-colors">Dashboard</Link>
      </nav>
    </div>
  );
}
