"use client";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { vaultAbi } from "@/lib/vaultAbi";
import Link from "next/link";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;

interface TradeRow {
  blockNumber: bigint;
  txHash: string;
  receiptHash: string;
  teeAttestation: string;
}

export default function History() {
  const { address } = useAccount();
  const client = usePublicClient();
  const [rows, setRows] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !client || !VAULT) return;
    setLoading(true);
    setError(null);

    client
      .getContractEvents({
        address: VAULT,
        abi: vaultAbi,
        eventName: "TradeExecuted",
        args: { user: address },
        fromBlock: BigInt(0),
      })
      .then((logs) => {
        setRows(
          logs.map((log) => ({
            blockNumber: log.blockNumber ?? BigInt(0),
            txHash: log.transactionHash ?? "",
            receiptHash: (log.args as { receiptHash?: string }).receiptHash ?? "",
            teeAttestation: (log.args as { teeAttestation?: string }).teeAttestation ?? "",
          }))
        );
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fetch failed"))
      .finally(() => setLoading(false));
  }, [address, client]);

  return (
    <main className="mx-auto max-w-3xl p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trade History</h1>
        <ConnectButton />
      </div>

      {!address && (
        <p className="text-gray-500 text-sm">Connect your wallet to view trade history.</p>
      )}

      {address && !VAULT && (
        <p className="text-red-500 text-sm">NEXT_PUBLIC_VAULT_ADDRESS not set.</p>
      )}

      {loading && <p className="text-gray-500 text-sm">Loading events…</p>}
      {error && <p className="text-red-500 text-sm">{error}</p>}

      {address && VAULT && !loading && rows.length === 0 && !error && (
        <p className="text-gray-500 text-sm">No trades executed yet.</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 pr-4">Block</th>
                <th className="pb-2 pr-4">Receipt hash</th>
                <th className="pb-2 pr-4">Tx</th>
                <th className="pb-2">Proof</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{row.blockNumber.toString()}</td>
                  <td className="py-2 pr-4 font-mono max-w-[160px] truncate">
                    <Link
                      href={`/proof/${row.receiptHash}`}
                      className="underline text-blue-600 hover:text-blue-800"
                      title={row.receiptHash}
                    >
                      {row.receiptHash.slice(0, 10)}…{row.receiptHash.slice(-6)}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <a
                      href={`https://chainscan-galileo.0g.ai/tx/${row.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-600 hover:text-blue-800"
                    >
                      {row.txHash.slice(0, 8)}…
                    </a>
                  </td>
                  <td className="py-2">
                    <a
                      href={`https://storagescan-galileo.0g.ai/file/${row.receiptHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="underline text-blue-600 hover:text-blue-800"
                    >
                      StorageScan
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="flex gap-4 text-sm">
        <Link href="/" className="underline text-blue-600">Home</Link>
        <Link href="/dashboard" className="underline text-blue-600">Dashboard</Link>
      </nav>
    </main>
  );
}
