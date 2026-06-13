"use client";
import Link from "next/link";
import { useState } from "react";
import { ChainSelector } from "./chain-selector";
import { OrcusConnectButton } from "./connect-button";

const NAV_LINKS = [
  { label: "Protocol", href: "#platform" },
  { label: "Security", href: "#security" },
  { label: "Build",    href: "#devex" },
  { label: "Live",     href: "#live" },
];

const NAV_STYLE: React.CSSProperties = {
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  background: "rgba(245,244,240,0.30)",
  boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.06)",
};

export function Navbar() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="fixed top-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-4xl">

        <nav
          className="flex items-center justify-between px-5 py-3 rounded-2xl border border-black/[0.06]"
          style={NAV_STYLE}
        >
          {/* Logo */}
          <Link
            href="/"
            className="text-xs tracking-[0.25em] text-black/70 hover:text-black transition-colors shrink-0"
            style={{ fontFamily: "var(--font-data)", fontWeight: 600 }}
          >
            ORCUS
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-[11px] text-black/55 hover:text-black transition-colors duration-200 tracking-wide"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Right group */}
          <div className="hidden md:flex items-center gap-2">
            {/* Split pill: LAUNCH APP | DASHBOARD */}
            <div className="flex items-center rounded-xl border border-black/10 overflow-hidden">
              <Link
                href="/strategy"
                className="inline-flex items-center justify-center text-[11px] px-4 py-2 text-black/60 hover:text-black hover:bg-black/[0.03] transition-all duration-200 tracking-wide"
              >
                APP
              </Link>
              <span className="w-px h-4 bg-black/10 shrink-0" />
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center text-[11px] px-4 py-2 text-black/60 hover:text-black hover:bg-black/[0.03] transition-all duration-200 tracking-wide"
              >
                DASHBOARD
              </Link>
            </div>

            {/* Chain selector + VM-aware wallet button */}
            <ChainSelector />
            <OrcusConnectButton />
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen(v => !v)}
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-[5px] rounded-lg hover:bg-black/[0.04] transition-colors"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            <span className="block h-px bg-black/60 transition-all duration-300 origin-center" style={{ width: 18, transform: open ? "translateY(6px) rotate(45deg)" : "none" }} />
            <span className="block h-px bg-black/60 transition-all duration-300" style={{ width: 18, opacity: open ? 0 : 1 }} />
            <span className="block h-px bg-black/60 transition-all duration-300 origin-center" style={{ width: 18, transform: open ? "translateY(-6px) rotate(-45deg)" : "none" }} />
          </button>
        </nav>

        {/* Mobile menu */}
        <div
          className="md:hidden mt-2 overflow-hidden transition-all duration-300 ease-in-out"
          style={{ maxHeight: open ? "380px" : "0px", opacity: open ? 1 : 0 }}
        >
          <div className="rounded-2xl border border-black/[0.06] px-2 py-2 flex flex-col" style={NAV_STYLE}>
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                onClick={close}
                className="px-4 py-3 text-sm text-black/60 hover:text-black hover:bg-black/[0.03] rounded-xl transition-colors tracking-wide"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-1 px-2 pb-1 flex gap-2">
              <Link
                href="/strategy"
                onClick={close}
                className="flex flex-1 justify-center text-[11px] px-4 py-2.5 rounded-xl border border-black/10 text-black/60 hover:text-black hover:border-black/20 hover:bg-black/[0.03] transition-all duration-200 tracking-wide"
              >
                LAUNCH APP
              </Link>
              <Link
                href="/dashboard"
                onClick={close}
                className="flex flex-1 justify-center text-[11px] px-4 py-2.5 rounded-xl border border-black/10 text-black/60 hover:text-black hover:border-black/20 hover:bg-black/[0.03] transition-all duration-200 tracking-wide"
              >
                DASHBOARD
              </Link>
            </div>
            {/* Mobile chain selector + connect */}
            <div className="mt-1 px-2 pb-1 flex items-center gap-2">
              <ChainSelector />
              <OrcusConnectButton />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
