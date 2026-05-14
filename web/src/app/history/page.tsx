"use client";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { vaultAbi } from "@/lib/vaultAbi";
import Link from "next/link";

const VAULT = (process.env.NEXT_PUBLIC_VAULT_ADDRESS || "") as `0x${string}`;

interface TradeRow {
  blockNumber: bigint;
  txHash: string;
  receiptHash: string;
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
          }))
        );
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "fetch failed"))
      .finally(() => setLoading(false));
  }, [address, client]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 flex flex-col gap-6">
      <h1 className="text-xl font-semibold" style={{ color: "var(--text)" }}>Trade History</h1>

      {!address && <p className="text-sm" style={{ color: "var(--muted)" }}>Connect your wallet to view history.</p>}
      {address && !VAULT && <p className="text-sm" style={{ color: "#ef4444" }}>NEXT_PUBLIC_VAULT_ADDRESS not set.</p>}
      {loading && <p className="text-sm" style={{ color: "var(--muted)" }}>Loading events…</p>}
      {error && <p className="text-sm" style={{ color: "#ef4444" }}>{error}</p>}
      {address && VAULT && !loading && rows.length === 0 && !error && (
        <p className="text-sm" style={{ color: "var(--muted)" }}>No trades executed yet.</p>
      )}

      {rows.length > 0 && (
        <div
          className="rounded overflow-hidden"
          style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
        >
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Block", "Receipt hash", "Tx", "Proof"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: "var(--muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td className="px-4 py-3 font-mono" style={{ color: "var(--muted)" }}>{row.blockNumber.toString()}</td>
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/proof/${row.receiptHash}`} style={{ color: "var(--accent)" }} className="underline">
                      {row.receiptHash.slice(0, 10)}…{row.receiptHash.slice(-6)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <a
                      href={`https://chainscan-galileo.0g.ai/tx/${row.txHash}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--accent)" }}
                      className="underline"
                    >
                      {row.txHash.slice(0, 8)}… ↗
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://storagescan-galileo.0g.ai/file/${row.receiptHash}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: "var(--accent)" }}
                      className="underline"
                    >
                      StorageScan ↗
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="flex gap-4 text-xs" style={{ color: "var(--muted)" }}>
        <Link href="/dashboard" className="underline hover:text-white transition-colors">Dashboard</Link>
        <Link href="/strategy"  className="underline hover:text-white transition-colors">Set Strategy</Link>
      </nav>
    </div>
  );
}
