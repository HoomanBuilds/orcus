"use client";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
    </>
  );
}

// Full-page prompt shown when wallet is not connected
export function WalletConnectPrompt({ page }: { page: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: "#F5F4F0", paddingTop: 88 }}
    >
      {/* Background image — same footer asset, masks up */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/footer-H55fzz5AzA5Y6jAI5IKopqp3GCQCWF.png"
          alt=""
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-full object-cover object-bottom select-none"
          style={{ opacity: 0.5 }}
        />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to top, rgba(245,244,240,0.6) 0%, #F5F4F0 55%)",
        }} />
        <div className="absolute inset-0" style={{
          height: "50%",
          bottom: 0,
          top: "auto",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          maskImage: "linear-gradient(to top, black 0%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)",
        }} />
      </div>

      <div className="relative z-10 max-w-sm w-full text-center">
        {/* Brand mark */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl border border-black/[0.08] bg-white flex items-center justify-center"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-black/60">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.25em] text-black/30 uppercase mb-1" style={{ fontFamily: "var(--font-data)" }}>
              ORCUS / {page.toUpperCase()}
            </p>
            <h1 className="text-2xl font-light text-[#111] tracking-tight">Connect your wallet</h1>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-black/40 leading-relaxed mb-8">
          {page === "strategy"
            ? "Connect to encrypt and submit a sealed trade intent to the Orcus vault."
            : page === "dashboard"
            ? "Connect to view your vault balance, active intents, and trade history."
            : page === "vault"
            ? "Connect to manage your vault position, deposits, and withdrawals."
            : "Connect your wallet to continue."}
        </p>

        {/* ConnectButton — let RainbowKit handle all states */}
        <div className="flex justify-center">
          <ConnectButton
            label="Connect wallet"
            showBalance={false}
            chainStatus="none"
            accountStatus="address"
          />
        </div>

        {/* Protocol badges */}
        <div className="mt-10 flex items-center justify-center gap-4">
          {["ECIES-256", "Intel TDX", "0G Galileo"].map(b => (
            <span
              key={b}
              className="text-[9px] tracking-widest text-black/25 uppercase border border-black/[0.07] px-2 py-1 rounded-full"
            >
              {b}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
