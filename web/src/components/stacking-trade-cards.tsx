"use client";

import { useEffect, useRef, useState } from "react";

const LAYERS = [
  {
    label: "ENCRYPTOR",
    title: "Intent encryption layer",
    desc: "Your trade intent is written in plain language, then ECIES-256 encrypted in-browser before anything leaves your device. The vault stores only ciphertext - even the protocol cannot read your strategy.",
    stats: [{ v: "ECIES-256", l: "cipher suite" }, { v: "0", l: "plaintext leaks" }],
    img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/researcher-CvhqOuV6irGwBOnJoTGFlXdbyYBRjb.png",
  },
  {
    label: "STRATEGIST",
    title: "Sealed TEE reasoning",
    desc: "Inside a sealed Intel TDX hardware enclave, the decrypted intent is evaluated via 0G Compute - sealed LLM inference where no model provider can observe your strategy or positions.",
    stats: [{ v: "Intel TDX", l: "hardware enclave" }, { v: "0G Compute", l: "sealed inference" }],
    img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/coder-9bItvCegU6TXUqbX3tUXGBAtvkBkXp.png",
  },
  {
    label: "EXECUTOR",
    title: "Dark pool execution",
    desc: "The TEE agent routes and executes your swap on Jaine DEX with on-chain slippage guardrails. Intent is invisible to validators until settlement - sandwich attacks are structurally impossible.",
    stats: [{ v: "100%", l: "MEV resistant" }, { v: "on-chain", l: "slippage guardrails" }],
    img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/analyst-Ysxnqg7Fpy2cfA56PiIttv1KximMhT.png",
  },
  {
    label: "AUDITOR",
    title: "On-chain proof storage",
    desc: "Every execution writes a cryptographic receipt to 0G decentralized storage. The root hash is committed on-chain. Anyone can verify the execution was unmanipulated - permanently, forever.",
    stats: [{ v: "0G Storage", l: "permanent receipts" }, { v: "open", l: "public verification" }],
    img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/executor-o1q6509qMLXMtpBIGo49vcgOu34sI1.png",
  },
];

const STICKY_TOP  = 80;
const STICKY_STEP = 16;
const SCALE_STEP  = 0.04;
const OFFSET_STEP = 8;

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      padding: "3px 12px",
      borderRadius: 100,
      fontSize: 11,
      letterSpacing: "0.12em",
      fontFamily: "var(--font-data)",
      color: "rgba(0,0,0,0.30)",
      background: "rgba(0,0,0,0.03)",
      border: "1px solid rgba(0,0,0,0.06)",
    }}>
      {children}
    </span>
  );
}

export function StackingTradeCards() {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [depth, setDepth] = useState<number[]>(LAYERS.map(() => 0));

  useEffect(() => {
    function onScroll() {
      const nextDepth = LAYERS.map((_, i) => {
        let count = 0;
        for (let j = i + 1; j < LAYERS.length; j++) {
          const el = cardRefs.current[j];
          if (!el) continue;
          const rect = el.getBoundingClientRect();
          const stickyTopJ = STICKY_TOP + j * STICKY_STEP;
          if (rect.top <= stickyTopJ + 2) count++;
        }
        return count;
      });
      setDepth(nextDepth);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", perspective: "1400px", perspectiveOrigin: "50% 0%" }}>
      {LAYERS.map((layer, i) => {
        const d          = depth[i];
        const scale      = 1 - d * SCALE_STEP;
        const translateY = d * OFFSET_STEP;

        return (
          <div
            key={layer.label}
            ref={el => { cardRefs.current[i] = el; }}
            style={{ position: "sticky", top: `${STICKY_TOP + i * STICKY_STEP}px`, zIndex: 10 + i, marginBottom: 16 }}
          >
            <div style={{
              transform: `scale(${scale}) translateY(${translateY}px)`,
              transformOrigin: "top center",
              transition: "transform 0.3s cubic-bezier(0.16,1,0.3,1)",
              willChange: "transform",
            }}>
              <div
                className="group"
                style={{
                  position: "relative",
                  background: "#faf9f7",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.07)",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                {/* Mobile: image top */}
                {layer.img && (
                  <div className="relative w-full md:hidden" style={{ height: 208, pointerEvents: "none" }}>
                    <img
                      src={layer.img}
                      alt={layer.label}
                      className="absolute inset-0 w-full h-full object-cover object-center"
                      style={{
                        maskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)",
                        WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 35%, transparent 85%)",
                      }}
                    />
                  </div>
                )}

                {/* Desktop: image right */}
                {layer.img && (
                  <div className="hidden md:block absolute inset-y-0 right-0 pointer-events-none" style={{ width: "50%" }}>
                    <img
                      src={layer.img}
                      alt={layer.label}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to right, #faf9f7 0%, transparent 55%)" }} />
                  </div>
                )}

                {/* Text content */}
                <div className="relative p-8" style={{ zIndex: 10 }}>
                  <div className="md:max-w-[60%]">
                    <div style={{ marginBottom: 24 }}>
                      <Tag>{layer.label}</Tag>
                    </div>
                    <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: 300, color: "rgba(0,0,0,0.85)", marginBottom: 12 }}>{layer.title}</h3>
                    <p style={{ fontSize: 14, color: "rgba(0,0,0,0.45)", lineHeight: 1.7, marginBottom: 32 }}>{layer.desc}</p>
                  </div>
                  <div style={{ display: "flex", gap: 32, paddingTop: 24, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    {layer.stats.map(s => (
                      <div key={s.l}>
                        <div className="font-display" style={{ fontSize: "1.5rem", fontWeight: 300, color: "rgba(0,0,0,0.85)", letterSpacing: "-0.02em" }}>{s.v}</div>
                        <div style={{ marginTop: 4, fontSize: 11, color: "rgba(0,0,0,0.35)", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-data)" }}>{s.l}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
