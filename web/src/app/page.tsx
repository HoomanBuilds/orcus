"use client";
import Link from "next/link";
import { OrcusLogo, VaultIcon, ShieldIcon, ReceiptIcon, ChevronRight } from "@/components/icons";

const features = [
  {
    icon: ShieldIcon,
    title: "Sealed TEE",
    desc: "Intel TDX + NVIDIA H100 enclave. Intent never leaves the enclave in plaintext.",
  },
  {
    icon: VaultIcon,
    title: "Strategy Vault",
    desc: "Deposit OG. Set an encrypted goal. The vault executes only on verified attestation.",
  },
  {
    icon: ReceiptIcon,
    title: "Audit Trail",
    desc: "Every execution writes an immutable receipt to 0G Storage. Verify on-chain, always.",
  },
];

const navLinks = [
  { href: "/strategy", label: "Set Strategy" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history",   label: "Trade History" },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20 flex flex-col gap-16">
      {/* Hero */}
      <div className="flex flex-col items-center gap-6 text-center">
        <OrcusLogo size={64} style={{ color: "var(--text)" } as React.CSSProperties} />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: "var(--text)" }}>
            Orcus
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--muted)", maxWidth: 400, margin: "12px auto 0" }}>
            MEV-resistant dark pool. Intents encrypted. Execution proven.
          </p>
        </div>
        <div className="flex gap-3 mt-2">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1 px-4 py-2 text-sm rounded-full transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--text)",
                background: "var(--surface)",
              }}
            >
              {l.label}
              <ChevronRight size={14} />
            </Link>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {features.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col gap-3 p-5 rounded"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <Icon size={20} style={{ color: "var(--accent)" } as React.CSSProperties} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>{title}</p>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chain info */}
      <p className="text-xs text-center" style={{ color: "var(--muted)" }}>
        Live on 0G Galileo Testnet · Chain ID 16602 · Zer0 DEX
      </p>
    </div>
  );
}
