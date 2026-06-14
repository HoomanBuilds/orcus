"use client";
import { useState, useEffect, useCallback, useRef } from "react";

// Module-level flag: true on first render per JS runtime (hard refresh resets it, SPA nav doesn't)
let _introPlayed = false;
import Link from "next/link";
import { IntroAnimation, HERO_REVEAL_MS } from "@/components/intro-animation";
import { RevealText } from "@/components/reveal-text";
import { PixelIcon } from "@/components/pixel-icon";
import { StackingTradeCards } from "@/components/stacking-trade-cards";
import { LiveIntentFeed, LiveIntentCounter } from "@/components/live-intent-feed";

// ── Intersection Observer hook ──────────────────────────────────────────────
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ── Scroll-triggered counter ────────────────────────────────────────────────
function Counter({ end, suffix = "" }: { end: number; suffix?: string }) {
  const { ref, inView } = useInView(0.2);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let cur = 0;
    const step = end / (1800 / 16);
    const t = setInterval(() => {
      cur += step;
      if (cur >= end) { setCount(end); clearInterval(t); }
      else setCount(Math.floor(cur));
    }, 16);
    return () => clearInterval(t);
  }, [inView, end]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ── Bento card ───────────────────────────────────────────────────────────────
function BentoCard({ children, className = "", delay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      className={`group relative rounded-2xl border border-black/[0.07] bg-white overflow-hidden transition-all duration-700 hover:border-black/[0.15] hover:bg-[#fafaf8] ${className}`}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(28px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms, border-color 0.3s ease, background-color 0.3s ease`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: "radial-gradient(400px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(0,0,0,0.03), transparent 60%)" }}
      />
      {children}
    </div>
  );
}

// ── Scroll-reveal wrapper (fixes hooks-in-map) ────────────────────────────────
function FadeIn({ children, delay = 0, direction = "up", className = "" }: {
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "left" | "right";
  className?: string;
}) {
  const { ref, inView } = useInView(0.08);
  const fromMap = { up: "translateY(20px)", left: "translateX(-16px)", right: "translateX(12px)" };
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translate(0)" : fromMap[direction],
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ── Tag pill ─────────────────────────────────────────────────────────────────
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] tracking-widest font-sans text-black/40 bg-black/[0.04]">
      {children}
    </span>
  );
}

// ── DevEx: typed code line data ───────────────────────────────────────────────
type CodeLineData =
  | { type: "gap" }
  | { type: "comment" | "output" | "success" | "command" | "plain"; text: string }
  | { type: "prop"; key: string; val: string }
  | { type: "fn"; text: string; args: string }
  | { type: "keyword"; text: string; after: string; keyword2?: string; keyword3?: string; fn?: string; args?: string; string?: string };

// ── DevEx: Orcus-adapted steps ────────────────────────────────────────────────
const DEVEX_STEPS: { num: string; title: string; desc: string; file: string; code: CodeLineData[] }[] = [
  {
    num: "01",
    title: "Encrypt Intent",
    desc: "Browser-side ECIES-256 encryption",
    file: "encrypt.ts",
    code: [
      { type: "comment", text: "// Encrypt your trade intent in-browser" },
      { type: "keyword", text: "import", after: " { encrypt } ", keyword2: "from", string: " 'ecies-js'" },
      { type: "gap" },
      { type: "keyword", text: "const", after: " ciphertext ", keyword2: "=", keyword3: " await ", fn: "encrypt", args: "({" },
      { type: "prop", key: "  publicKey", val: "vaultPublicKey" },
      { type: "prop", key: "  data", val: "Buffer.from(intentJson)" },
      { type: "plain", text: "})" },
      { type: "gap" },
      { type: "comment", text: "// Ciphertext is all the vault ever sees" },
      { type: "output", text: "// Plaintext never leaves your device" },
    ],
  },
  {
    num: "02",
    title: "Submit to Vault",
    desc: "Deposit OG + sealed ciphertext",
    file: "submit.ts",
    code: [
      { type: "comment", text: "// Submit sealed intent to Strategy Vault" },
      { type: "keyword", text: "import", after: " { writeContract } ", keyword2: "from", string: " 'viem/actions'" },
      { type: "gap" },
      { type: "keyword", text: "await", after: " ", fn: "writeContract", args: "(walletClient, {" },
      { type: "prop", key: "  address", val: "VAULT_ADDRESS" },
      { type: "prop", key: "  abi", val: "vaultAbi" },
      { type: "prop", key: "  functionName", val: "'submitIntent'" },
      { type: "prop", key: "  args", val: "[ciphertext]" },
      { type: "prop", key: "  value", val: "parseEther('0.01')" },
      { type: "plain", text: "})" },
    ],
  },
  {
    num: "03",
    title: "Listen for Events",
    desc: "Watch TradeExecuted on-chain",
    file: "events.ts",
    code: [
      { type: "comment", text: "// Subscribe to on-chain execution events" },
      { type: "keyword", text: "import", after: " { watchContractEvent } ", keyword2: "from", string: " 'viem/actions'" },
      { type: "gap" },
      { type: "fn", text: "watchContractEvent", args: "(publicClient, {" },
      { type: "prop", key: "  address", val: "VAULT_ADDRESS" },
      { type: "prop", key: "  eventName", val: "'TradeExecuted'" },
      { type: "prop", key: "  onLogs", val: "async (logs) => {" },
      { type: "plain", text: "    const { receiptHash } = logs[0].args" },
      { type: "plain", text: "    await verifyProof(receiptHash)" },
      { type: "plain", text: "  }" },
      { type: "plain", text: "})" },
    ],
  },
  {
    num: "04",
    title: "Verify Proof",
    desc: "Audit receipt on 0G Storage",
    file: "verify.ts",
    code: [
      { type: "comment", text: "// Verify execution receipt on 0G Storage" },
      { type: "keyword", text: "import", after: " { Indexer } ", keyword2: "from", string: " '@0glabs/0g-ts-sdk'" },
      { type: "gap" },
      { type: "keyword", text: "const", after: " indexer ", keyword2: "=", keyword3: " new ", fn: "Indexer", args: "(INDEXER_RPC)" },
      { type: "gap" },
      { type: "keyword", text: "const", after: " receipt ", keyword2: "=", keyword3: " await ", fn: "indexer.getFileInfo", args: "(receiptHash)" },
      { type: "gap" },
      { type: "success", text: "✓ Receipt verified on 0G Storage" },
      { type: "output", text: "  root hash committed on-chain forever" },
    ],
  },
];

function CodeLine({ line }: { line: CodeLineData }) {
  if (line.type === "gap") return <div className="h-3" />;
  if (line.type === "comment") return <div style={{ color: "#9ca3af" }}>{line.text}</div>;
  if (line.type === "output") return <div style={{ color: "#6b7280" }}>{line.text}</div>;
  if (line.type === "success") return <div style={{ color: "#16a34a" }}>{line.text}</div>;
  if (line.type === "command") return (
    <div><span style={{ color: "#16a34a" }}>$ </span><span style={{ color: "#111" }}>{line.text}</span></div>
  );
  if (line.type === "plain") return <div style={{ color: "#111" }}>{line.text}</div>;
  if (line.type === "prop") return (
    <div>
      <span style={{ color: "#2563eb" }}>{line.key}</span>
      <span style={{ color: "#111" }}>: </span>
      <span style={{ color: "#16a34a" }}>{line.val}</span>
      <span style={{ color: "#111" }}>,</span>
    </div>
  );
  if (line.type === "fn") return (
    <div>
      <span style={{ color: "#b45309" }}>{line.text}</span>
      <span style={{ color: "#111" }}>{line.args}</span>
    </div>
  );
  if (line.type === "keyword") return (
    <div>
      <span style={{ color: "#7c3aed" }}>{line.text}</span>
      <span style={{ color: "#111" }}>{line.after}</span>
      {line.keyword2 && <span style={{ color: "#7c3aed" }}>{line.keyword2}</span>}
      {line.keyword3 && <span style={{ color: "#7c3aed" }}>{line.keyword3}</span>}
      {line.fn && <span style={{ color: "#b45309" }}>{line.fn}</span>}
      {line.args && <span style={{ color: "#111" }}>{line.args}</span>}
      {line.string && <span style={{ color: "#16a34a" }}>{line.string}</span>}
    </div>
  );
  return null;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [heroReady, setHeroReady] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [devexActive, setDevexActive] = useState(0);
  const [devexVisible, setDevexVisible] = useState(true);
  const [ctaEmail, setCtaEmail] = useState("");
  const [ctaSubmitted, setCtaSubmitted] = useState(false);

  // Captured at render time - before any effects mutate _introPlayed
  const willPlayIntro = useRef(!_introPlayed);

  const handleIntroDone = useCallback(() => setHeroReady(true), []);

  useEffect(() => {
    if (willPlayIntro.current) {
      _introPlayed = true;
      setShowIntro(true);
    } else {
      setHeroReady(true);
    }
  }, []);

  useEffect(() => {
    const delay = willPlayIntro.current ? HERO_REVEAL_MS : 0;
    const t = setTimeout(() => setVideoReady(true), delay);
    return () => clearTimeout(t);
  }, []);

  // DevEx step selector
  function selectDevexStep(i: number) {
    if (i === devexActive) return;
    setDevexVisible(false);
    setTimeout(() => { setDevexActive(i); setDevexVisible(true); }, 180);
  }

  // DevEx auto-advance
  useEffect(() => {
    const t = setInterval(() => {
      setDevexVisible(false);
      setTimeout(() => {
        setDevexActive(prev => (prev + 1) % DEVEX_STEPS.length);
        setDevexVisible(true);
      }, 180);
    }, 3200);
    return () => clearInterval(t);
  }, []);

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mouse-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--mouse-y", `${e.clientY - rect.top}px`);
  };

  const devexStep = DEVEX_STEPS[devexActive];

  return (
    <div className="bg-[#F5F4F0] text-[#111] min-h-screen font-sans antialiased">

      {showIntro && <IntroAnimation onDone={handleIntroDone} />}

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="relative h-screen overflow-hidden">

        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          style={{
            transform: videoReady ? "scale(1.05)" : "scale(0.85)",
            transition: "transform 2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <source src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/agentic-hero-9yW3wnTNMfn2U6lsVhTTZSJFEvAoSj.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "65%", background: "linear-gradient(to top, #F5F4F0 0%, #F5F4F0 18%, rgba(245,244,240,0.85) 35%, rgba(245,244,240,0.5) 55%, rgba(245,244,240,0.15) 75%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "20%", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", maskImage: "linear-gradient(to top, black 0%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "38%", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", maskImage: "linear-gradient(to top, black 0%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)" }} />
        <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none" style={{ height: "55%", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", maskImage: "linear-gradient(to top, black 0%, transparent 100%)", WebkitMaskImage: "linear-gradient(to top, black 0%, transparent 100%)" }} />

        <div className="h-20" />

        <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col px-6 md:px-12 pb-12 max-w-3xl">
          <h1
            className="text-6xl sm:text-7xl md:text-8xl font-light text-[#111] leading-[1.0] tracking-tight mb-10"
            style={{
              fontFamily: '"IBM Plex Sans", sans-serif',
              opacity: heroReady ? 1 : 0,
              filter: heroReady ? "blur(0px)" : "blur(24px)",
              transform: heroReady ? "translateY(0px)" : "translateY(32px)",
              transition: "opacity 1s cubic-bezier(0.16,1,0.3,1) 0ms, filter 1s cubic-bezier(0.16,1,0.3,1) 0ms, transform 1s cubic-bezier(0.16,1,0.3,1) 0ms",
            }}
          >
            Dark pool trading,<br />sealed in a TEE.
          </h1>

          <div className="flex gap-8 sm:gap-12">
            {[
              { value: "ECIES-256", label: "Encrypted intents" },
              { value: "Intel TDX", label: "TEE-sealed execution" },
              { value: "0G Storage", label: "On-chain proof forever" },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  opacity: heroReady ? 1 : 0,
                  filter: heroReady ? "blur(0px)" : "blur(16px)",
                  transform: heroReady ? "translateY(0px)" : "translateY(20px)",
                  transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms, filter 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${120 + i * 80}ms`,
                }}
              >
                <div className="text-3xl sm:text-4xl text-[#111] font-light tracking-tight" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{stat.value}</div>
                <div className="text-xs text-black/40 tracking-widest uppercase mt-1" style={{ fontFamily: '"IBM Plex Sans", sans-serif' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLATFORM BENTO ────────────────────────────────────────────────── */}
      <section id="platform" className="py-32 px-6 md:px-12 lg:px-20">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="platform" size={40} />
            <div className="mt-4"><Tag>PROTOCOL</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
              {"Cryptographic privacy\nbuilt into every layer."}
            </RevealText>
          </div>

          <div className="grid grid-cols-12 grid-rows-auto gap-3" onMouseMove={handleMouse}>

            <BentoCard className="col-span-12 p-8 min-h-[200px] flex flex-col justify-between relative overflow-hidden" delay={0}>
              <img
                src="/images/arc.png"
                alt=""
                aria-hidden="true"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ objectPosition: "center 70%" }}
              />
              <div className="absolute inset-0" style={{
                maskImage: "linear-gradient(to bottom, transparent 45%, black 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 45%, black 100%)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
              }} />
              <div className="absolute inset-0" style={{
                background: "linear-gradient(to bottom, transparent 35%, rgba(245,244,240,0.3) 50%, rgba(245,244,240,0.75) 65%, rgba(245,244,240,0.95) 80%, rgb(245,244,240) 100%)",
              }} />
              <div className="relative z-10">
                <div className="w-10 h-10 rounded-xl border border-black/10 bg-white/60 flex items-center justify-center mb-6" style={{ backdropFilter: "blur(8px)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <h3 className="text-xl font-light mb-3">ECIES-256 Intent Encryption</h3>
                <p className="text-sm text-black/45 leading-relaxed max-w-sm">
                  Your trade intent is encrypted in your browser using ECIES-256 before it leaves your device. The vault stores only ciphertext on-chain. No one can read your strategy.
                </p>
              </div>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={120}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">Intel TDX Enclave</h3>
              <p className="text-sm text-black/45 leading-relaxed">Hardware-sealed execution. The decryption key never leaves the trusted environment - not the host, not the hypervisor, not us.</p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={160}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">0G Storage Proofs</h3>
              <p className="text-sm text-black/45 leading-relaxed">Every execution writes a cryptographic receipt to 0G decentralized storage. The root hash is committed on-chain. Permanently verifiable.</p>
            </BentoCard>

            <BentoCard className="col-span-12 md:col-span-4 p-8 min-h-[200px]" delay={200}>
              <div className="w-10 h-10 rounded-xl border border-black/10 flex items-center justify-center mb-5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/>
                </svg>
              </div>
              <h3 className="text-lg font-light mb-2">MEV Resistance</h3>
              <p className="text-sm text-black/45 leading-relaxed">Encrypted intents are invisible to block builders until execution. Front-running and sandwich attacks are structurally impossible at the protocol level.</p>
            </BentoCard>

          </div>
        </div>
      </section>

      {/* ── ARCHITECTURE stacking cards ───────────────────────────────────── */}
      <section id="agents" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
            <div>
              <PixelIcon type="agents" size={40} />
              <div className="mt-4"><Tag>ARCHITECTURE</Tag></div>
              <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
                {"Four sealed layers,\none dark pool."}
              </RevealText>
            </div>
            <p className="text-sm text-black/45 leading-relaxed max-w-xs">
              Every layer of the Orcus stack is sealed and verifiable. From your browser to the blockchain, no plaintext intent is ever exposed.
            </p>
          </div>
          <StackingTradeCards />
        </div>
      </section>

      {/* ── PROTOCOL FLOW (4 cards) ───────────────────────────────────────── */}
      <section id="workflow" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="workflow" size={40} />
            <div className="mt-4"><Tag>PROTOCOL FLOW</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"From intent to verified trade\nin four sealed steps."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3" onMouseMove={handleMouse}>
            {[
              { n: "01", title: "Encrypt",  desc: "Describe your trade intent in plain language. ECIES-256 encrypts it in-browser before anything leaves your device.", delay: 0,   img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/define-5aafAmGBrxZpOqJ3XLHY3n3qzC2I5K.png" },
              { n: "02", title: "Submit",   desc: "Deposit OG and submit your sealed ciphertext to the Strategy Vault on 0G Galileo. The chain holds only encrypted data.", delay: 80,  img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/compose-5RT5VR4f1Y3GoFmovqTKLTG4UXp3g2.png" },
              { n: "03", title: "Execute",  desc: "A sealed Intel TDX enclave decrypts your intent, reasons via 0G Compute, and executes on Jaine DEX with slippage guardrails.", delay: 140, img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/test-zm8guZwxJHtwWsJ7XO4B0CF7GzlNK8.png" },
              { n: "04", title: "Verify",   desc: "A cryptographic execution receipt is written to 0G Storage. Anyone can verify the trade was unmanipulated - permanently.", delay: 200, img: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/deploy-an8fgHSLzniojkcmRyGGIFQUJF9T5J.png" },
            ].map((step) => (
              <BentoCard key={step.n} className="relative overflow-hidden flex flex-col min-h-[320px]" delay={step.delay}>
                <div className="absolute inset-x-0 top-0 h-56 pointer-events-none">
                  <img
                    src={step.img}
                    alt={step.title}
                    className="w-full h-full object-cover object-top"
                    style={{
                      maskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 80%)",
                      WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 30%, transparent 80%)",
                    }}
                  />
                </div>
                <div className="relative z-10 p-7">
                  <span className="text-[11px] text-black/20 tracking-widest block" style={{ fontFamily: "var(--font-data)" }}>{step.n}</span>
                </div>
                <div className="relative z-10 px-7 pb-7 mt-auto pt-16">
                  <h3 className="text-2xl font-light mb-3">{step.title}</h3>
                  <p className="text-sm text-black/45 leading-relaxed">{step.desc}</p>
                </div>
              </BentoCard>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS (Verification Layer) ────────────────────────────── */}
      <section id="integrations" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="integrations" size={40} />
            <div className="mt-4"><Tag>VERIFICATION LAYER</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"Every component verifiable.\nEvery proof permanent."}
            </RevealText>
            <p className="mt-5 text-base text-black/40 leading-relaxed max-w-xl">
              Orcus doesn&apos;t ask you to trust us. ECIES encrypts in your browser, TDX seals in hardware, 0G stores forever. Each layer is independently auditable.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 items-stretch">
            {/* Left: integration rows */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {[
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  ),
                  name: "ecies-js",
                  desc: "Browser encryption library",
                  tag: "ECIES-256",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  ),
                  name: "0G Compute",
                  desc: "TEE-sealed AI inference",
                  tag: "Intel TDX",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                    </svg>
                  ),
                  name: "0G Storage",
                  desc: "Decentralized proof archive",
                  tag: "Permanent",
                },
                {
                  icon: (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/>
                    </svg>
                  ),
                  name: "Jaine DEX",
                  desc: "On-chain swap execution",
                  tag: "Galileo",
                },
              ].map((item, i) => (
                <FadeIn key={item.name} delay={i * 80} direction="left">
                  <div className="flex items-center gap-4 p-5 rounded-2xl border border-black/[0.07] bg-white hover:border-black/[0.15] hover:bg-[#fafaf8] transition-all duration-300">
                    <div className="w-9 h-9 rounded-xl border border-black/[0.08] bg-black/[0.03] flex items-center justify-center shrink-0 text-black/50">
                      {item.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-light text-[#111]">{item.name}</div>
                      <div className="text-xs text-black/35 mt-0.5">{item.desc}</div>
                    </div>
                    <span className="text-[9px] tracking-widest text-black/30 uppercase border border-black/[0.08] px-2 py-0.5 rounded-full shrink-0">{item.tag}</span>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Right: Org Arc orchestration image */}
            <BentoCard className="lg:col-span-3 relative overflow-hidden min-h-[400px]" delay={100}>
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Org%20Arc%20-%20Upscaled-Sk90jShfu7nltLnhoQbaMJC1YaQKuU.png"
                alt="Orcus protocol orchestration"
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0" style={{
                background: "linear-gradient(135deg, rgba(245,244,240,0.85) 0%, rgba(245,244,240,0.2) 60%, transparent 100%)",
              }} />
              <div className="absolute bottom-0 inset-x-0" style={{
                height: "40%",
                background: "linear-gradient(to top, rgba(255,255,255,0.9), transparent)",
              }} />
              <div className="relative z-10 p-8 h-full flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] tracking-widest uppercase"
                    style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(0,0,0,0.08)", backdropFilter: "blur(8px)" }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Orchestration live
                  </div>
                </div>
                <div>
                  <p className="text-xs text-black/40 tracking-widest uppercase mb-1">Protocol</p>
                  <h3 className="text-2xl font-light">End-to-end sealed pipeline</h3>
                  <p className="text-sm text-black/45 mt-2 leading-relaxed max-w-xs">From browser encryption to on-chain proof - no plaintext is ever exposed across any hop.</p>
                </div>
              </div>
            </BentoCard>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ───────────────────────────────────────────────────────── */}
      <section className="py-0 border-t border-black/[0.06] overflow-hidden select-none">
        <div className="flex border-b border-black/[0.06]" style={{ animation: "marqueeLeft 28s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {["OG -> USDT", "OG -> BTC", "OG -> ETH", "OG -> DOGE", "OG -> SAT", "OG -> L2SCAN", "TEE-verified", "ECIES encrypted", "On-chain receipts", "MEV resistant"].map((cap) => (
                <div key={cap} className="flex items-center gap-6 px-10 py-5 border-r border-black/[0.06] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-black/20 shrink-0" />
                  <span className="text-sm text-black/45 whitespace-nowrap tracking-wide">{cap}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex" style={{ animation: "marqueeRight 22s linear infinite" }}>
          {[...Array(3)].map((_, rep) => (
            <div key={rep} className="flex shrink-0">
              {["0G Storage proofs", "Intel TDX", "Dark pool", "OG -> WAWA", "OG -> CUA", "Slippage guardrails", "Jaine DEX", "0G Compute", "Sealed inference", "Proof root hash"].map((cap) => (
                <div key={cap} className="flex items-center gap-6 px-10 py-5 border-r border-black/[0.06] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-black/[0.12] shrink-0" />
                  <span className="text-sm text-black/30 whitespace-nowrap tracking-wide">{cap}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── SECURITY ─────────────────────────────────────────────────────── */}
      <section id="security" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="security" size={40} />
            <div className="mt-4"><Tag>CRYPTOGRAPHIC GUARANTEES</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"Zero-knowledge by architecture,\nnot by promise."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Left: security pillars */}
            <div className="flex flex-col gap-8">
              {[
                {
                  label: "ECIES-256",
                  title: "Asymmetric encryption",
                  desc: "Your intent is encrypted with the vault's public key in-browser. Only the TEE enclave - never the vault contract, never us - holds the private key to decrypt it.",
                  delay: 0,
                },
                {
                  label: "Intel TDX",
                  title: "Hardware isolation",
                  desc: "The decryption and reasoning happens inside a hardware-enforced trusted execution environment. The host OS, hypervisor, and cloud provider are all excluded.",
                  delay: 80,
                },
                {
                  label: "0G Storage",
                  title: "Immutable proof chain",
                  desc: "Every execution receipt is written to 0G decentralized storage. The Merkle root is committed on-chain. The record is permanent and independently verifiable.",
                  delay: 160,
                },
                {
                  label: "MEV Shield",
                  title: "Structural front-run immunity",
                  desc: "Encrypted intents are unreadable to block builders, searchers, and validators. The sealed pool means your trade strategy is structurally protected - not just hoped-for.",
                  delay: 240,
                },
              ].map((item) => (
                <FadeIn key={item.label} delay={item.delay}>
                  <div className="flex gap-6">
                    <div className="flex flex-col items-center gap-2 shrink-0">
                      <div className="w-px flex-1 bg-black/[0.08]" />
                      <span className="text-[9px] tracking-widest text-black/25 uppercase rotate-180" style={{ writingMode: "vertical-rl" }}>{item.label}</span>
                    </div>
                    <div className="pb-2">
                      <h3 className="text-base font-light text-[#111] mb-2">{item.title}</h3>
                      <p className="text-sm text-black/45 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>

            {/* Right: audit trail BentoCard */}
            <BentoCard className="p-8" delay={120}>
              <div className="mb-6">
                <p className="text-[10px] tracking-widest text-black/30 uppercase mb-1">Live audit trail</p>
                <h3 className="text-lg font-light">Intent lifecycle</h3>
              </div>
              <div className="space-y-0">
                {[
                  {
                    step: "01",
                    label: "Intent encrypted",
                    detail: "ECIES-256 in browser",
                    status: "sealed",
                    color: "bg-violet-500",
                    delay: 0,
                  },
                  {
                    step: "02",
                    label: "Submitted to vault",
                    detail: "Ciphertext on-chain only",
                    status: "stored",
                    color: "bg-blue-500",
                    delay: 150,
                  },
                  {
                    step: "03",
                    label: "TEE decryption",
                    detail: "Intel TDX enclave only",
                    status: "executed",
                    color: "bg-amber-500",
                    delay: 300,
                  },
                  {
                    step: "04",
                    label: "Swap executed",
                    detail: "Jaine DEX, slippage guarded",
                    status: "complete",
                    color: "bg-emerald-500",
                    delay: 450,
                  },
                  {
                    step: "05",
                    label: "Proof written",
                    detail: "0G Storage, root hash on-chain",
                    status: "verified",
                    color: "bg-emerald-600",
                    delay: 600,
                  },
                ].map((item, idx, arr) => (
                  <FadeIn key={item.step} delay={item.delay} direction="right">
                    <div className="flex gap-4 items-stretch">
                      <div className="flex flex-col items-center shrink-0 w-6">
                        <div className={`w-2 h-2 rounded-full mt-4 shrink-0 ${item.color}`} />
                        {idx < arr.length - 1 && <div className="w-px flex-1 bg-black/[0.07] mt-1" />}
                      </div>
                      <div className={`pb-5 ${idx === arr.length - 1 ? "pb-0" : ""}`}>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-sm font-light text-[#111]">{item.label}</span>
                          <span className="text-[9px] tracking-widest text-black/25 uppercase border border-black/[0.08] px-1.5 py-0.5 rounded-full">{item.status}</span>
                        </div>
                        <p className="text-xs text-black/35 mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  </FadeIn>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-black/[0.06] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-black/35 tracking-wide">Fully verifiable on-chain</span>
              </div>
            </BentoCard>
          </div>

          {/* Stats row */}
          <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-px bg-black/[0.06] rounded-2xl overflow-hidden border border-black/[0.06]">
            {[
              { value: 256, suffix: "-bit", label: "Encryption key size" },
              { value: 0, suffix: " ms", label: "Plaintext exposure time" },
              { value: 100, suffix: "%", label: "Executions with on-chain proof" },
              { value: 0, suffix: "", label: "Trust assumptions required" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white px-8 py-8">
                <div className="text-3xl font-light text-[#111] tracking-tight">
                  <Counter end={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-xs text-black/35 mt-2 tracking-wide">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE INTENTS ──────────────────────────────────────────────────── */}
      <section id="live" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <PixelIcon type="integrations" size={40} />
              <div className="mt-4"><Tag>LIVE RIGHT NOW</Tag></div>
              <RevealText className="mt-5 text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05]">
                {"Intents executing\n24 / 7."}
              </RevealText>
              <p className="mt-6 text-base text-black/40 leading-relaxed max-w-sm">
                At any moment, Orcus TEE agents are decrypting intents, reasoning via 0G Compute, and executing swaps through Jaine DEX - all without a human in the loop.
              </p>
              <div className="mt-10 flex items-end gap-2">
                <LiveIntentCounter />
                <span className="text-black/30 text-sm mb-1 tracking-wide">intents processed</span>
              </div>
            </div>
            <div className="relative">
              <LiveIntentFeed />
            </div>
          </div>
        </div>
      </section>

      {/* ── DEVELOPER EXPERIENCE ─────────────────────────────────────────── */}
      <section id="devex" className="py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <PixelIcon type="devex" size={40} />
            <div className="mt-4"><Tag>DEVELOPER EXPERIENCE</Tag></div>
            <RevealText className="mt-5 text-4xl md:text-5xl font-light tracking-tight leading-[1.05]">
              {"Integrate Orcus in minutes,\nnot weeks."}
            </RevealText>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
            {/* Left: 4 clickable step cards */}
            <div className="flex flex-col gap-3">
              {DEVEX_STEPS.map((s, i) => (
                <button
                  key={s.num}
                  onClick={() => selectDevexStep(i)}
                  className="flex-1 text-left rounded-2xl border transition-all duration-200 p-6 group"
                  style={{
                    background: devexActive === i ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.7)",
                    borderColor: devexActive === i ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.07)",
                    boxShadow: devexActive === i ? "0 1px 3px rgba(0,0,0,0.06)" : "0 1px 2px rgba(0,0,0,0.03)",
                  }}
                >
                  <div className="flex gap-4 items-start">
                    <div
                      className="flex items-center justify-center w-8 h-8 rounded-lg text-xs font-light shrink-0 transition-colors duration-200"
                      style={{
                        background: devexActive === i ? "rgba(0,0,0,0.08)" : "rgba(0,0,0,0.04)",
                        color: devexActive === i ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.35)",
                      }}
                    >
                      {s.num}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-light transition-colors duration-200" style={{ color: devexActive === i ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)" }}>
                        {s.title}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(0,0,0,0.28)" }}>{s.desc}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Right: code panel */}
            <div
              className="lg:col-span-2 rounded-2xl border border-black/[0.06] p-8 flex flex-col"
              style={{ background: "rgba(255,255,255,0.7)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", minHeight: "360px" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-5 shrink-0">
                <div
                  className="text-[10px] tracking-widest uppercase"
                  style={{
                    opacity: devexVisible ? 1 : 0,
                    filter: devexVisible ? "blur(0px)" : "blur(4px)",
                    transition: "opacity 200ms ease, filter 200ms ease",
                    color: "rgba(0,0,0,0.3)",
                  }}
                >
                  {devexStep.file}
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map(d => (
                    <div
                      key={d}
                      className="w-2 h-2 rounded-full transition-all duration-300"
                      style={{ background: d === devexActive % 3 ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.08)" }}
                    />
                  ))}
                </div>
              </div>

              {/* Code block */}
              <div className="flex-1 rounded-xl p-6 overflow-hidden" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.06)" }}>
                <div
                  className="font-mono text-[12px] leading-6"
                  style={{
                    opacity: devexVisible ? 1 : 0,
                    filter: devexVisible ? "blur(0px)" : "blur(6px)",
                    transform: devexVisible ? "translateY(0)" : "translateY(6px)",
                    transition: "opacity 220ms cubic-bezier(0.16,1,0.3,1), filter 220ms cubic-bezier(0.16,1,0.3,1), transform 220ms cubic-bezier(0.16,1,0.3,1)",
                  }}
                >
                  {devexStep.code.map((line, i) => (
                    <CodeLine key={i} line={line} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────────── */}
      <section className="relative py-32 px-6 md:px-12 lg:px-20 border-t border-black/[0.06] overflow-hidden">
        <img
          src="/images/footer.png"
          alt=""
          aria-hidden="true"
          className="absolute bottom-0 left-0 w-full object-cover object-bottom pointer-events-none select-none"
          style={{ opacity: 0.85 }}
        />
        <div className="absolute inset-0 pointer-events-none" style={{
          maskImage: "linear-gradient(to top, transparent 0%, black 55%)",
          WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 55%)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "linear-gradient(to top, rgb(245,244,240) 0%, rgba(245,244,240,0.92) 18%, rgba(245,244,240,0.55) 35%, transparent 55%)",
        }} />
        <div className="relative z-10 max-w-2xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight leading-[1.05] mb-6">
            Start trading<br />in the dark.
          </h2>
          <p className="text-sm text-black/45 leading-relaxed mb-10">
            Connect your wallet, describe your intent, and let the sealed TEE execute it. Your strategy stays sealed from everyone - including us.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto mb-10">
            <Link
              href="/strategy"
              className="inline-flex items-center justify-center px-8 py-3 bg-[#111] text-white text-sm rounded-xl hover:bg-[#333] transition-colors tracking-widest font-medium shrink-0 w-full sm:w-auto"
            >
              LAUNCH APP
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center flex-1 bg-white border border-black/10 rounded-xl px-4 py-3 text-sm text-[#111] hover:border-black/25 transition-colors"
            >
              View Dashboard
            </Link>
          </div>

          {/* Mainnet notification opt-in */}
          <div className="max-w-sm mx-auto">
            {ctaSubmitted ? (
              <div
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-black/[0.07] bg-white"
                style={{ opacity: 1, transition: "opacity 0.3s ease" }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-sm text-black/50">You&apos;ll be notified at mainnet launch.</span>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); if (ctaEmail) setCtaSubmitted(true); }}
                className="flex gap-2"
              >
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={ctaEmail}
                  onChange={(e) => setCtaEmail(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-black/10 bg-white text-sm text-[#111] placeholder:text-black/25 focus:outline-none focus:border-black/25 transition-colors"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-black/[0.06] border border-black/[0.08] text-sm text-black/60 hover:bg-black/[0.1] hover:text-black/80 transition-all duration-200 shrink-0"
                >
                  Notify me
                </button>
              </form>
            )}
            <p className="text-xs text-black/25 mt-2 tracking-wide">Mainnet launch updates. No spam.</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer className="py-10 px-6 md:px-12 lg:px-20 border-t border-black/[0.06]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <span className="text-xs tracking-[0.25em] text-black/50" style={{ fontFamily: "var(--font-data)", fontWeight: 600 }}>ORCUS</span>

          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {[
              { label: "App",          href: "/strategy" },
              { label: "Dashboard",    href: "/dashboard" },
              { label: "History",      href: "/history" },
              { label: "Vault",        href: "/vault" },
              { label: "Activity",     href: "/activity" },
              { label: "Protocol",     href: "#platform" },
              { label: "Security",     href: "#security" },
              { label: "Build",        href: "#devex" },
            ].map(l => (
              <a key={l.label} href={l.href} className="text-xs text-black/35 hover:text-black/70 transition-colors tracking-widest">{l.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-6">
            {[
              { label: "0G Galileo", href: "https://chainscan-galileo.0g.ai" },
              { label: "Chain 16602", href: "#" },
            ].map(l => (
              <a key={l.label} href={l.href} className="text-xs text-black/25 hover:text-black/55 transition-colors tracking-widest">{l.label}</a>
            ))}
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-black/[0.04]">
          <span className="text-xs text-black/20">2026 ORCUS. Testnet only. No production claims.</span>
        </div>
      </footer>
    </div>
  );
}
