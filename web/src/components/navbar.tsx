"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { OrcusLogo } from "./icons";

export function Navbar() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6"
      style={{
        height: 52,
        background: "var(--bg)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <Link href="/" className="flex items-center gap-2.5" style={{ color: "var(--text)" }}>
        <OrcusLogo size={22} />
        <span className="font-semibold tracking-tight text-sm">Orcus</span>
      </Link>
      <ConnectButton
        showBalance={false}
        chainStatus="none"
        accountStatus="address"
      />
    </header>
  );
}
