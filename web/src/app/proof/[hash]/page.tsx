import Link from "next/link";

interface Props {
  params: Promise<{ hash: string }>;
}

export default async function ProofViewer({ params }: Props) {
  const { hash } = await params;
  const storageScanUrl = `https://storagescan-galileo.0g.ai/file/${hash}`;

  return (
    <main className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Proof Viewer</h1>

      <div className="border rounded p-4 space-y-2 font-mono text-sm break-all">
        <p className="text-gray-500 text-xs uppercase tracking-wide">Storage receipt hash</p>
        <p>{hash}</p>
      </div>

      <div className="space-y-3">
        <a
          href={storageScanUrl}
          target="_blank"
          rel="noreferrer"
          className="block w-full text-center rounded border border-black px-4 py-2 hover:bg-gray-50 transition-colors text-sm"
        >
          View on 0G StorageScan →
        </a>

        <div className="border rounded overflow-hidden" style={{ height: 480 }}>
          <iframe
            src={storageScanUrl}
            className="w-full h-full"
            title="0G StorageScan receipt"
          />
        </div>
      </div>

      <div className="border rounded p-4 space-y-2">
        <p className="text-gray-500 text-xs uppercase tracking-wide">TEE attestation</p>
        <p className="text-gray-400 text-sm italic">
          On-chain attestation bytes are stored in the TradeExecuted event. Full attestation
          verification (Intel TDX DCAP) is post-MVP — raw bytes are preserved on-chain for
          independent audit.
        </p>
      </div>

      <nav className="flex gap-4 text-sm">
        <Link href="/history" className="underline text-blue-600">← Trade History</Link>
        <Link href="/dashboard" className="underline text-blue-600">Dashboard</Link>
      </nav>
    </main>
  );
}
