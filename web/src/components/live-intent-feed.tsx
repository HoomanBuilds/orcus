"use client";

import { useEffect, useState, useRef } from "react";

const AGENT_NAMES = [
  "encryptor-7f2a", "executor-3b1c", "auditor-9d4e", "strategist-2c8f",
  "router-5a3d", "builder-1e9b", "guardian-4f2c", "oracle-8d1a",
  "scheduler-6b3e", "indexer-0c7f",
];

const TASKS = [
  "Encrypting intent with ECIES-256",
  "Submitting sealed ciphertext to Strategy Vault",
  "Decrypting intent inside TDX enclave",
  "Calling 0G Compute for strategy reasoning",
  "Evaluating market conditions for OG/USDT",
  "Applying slippage guardrails before swap",
  "Routing swap through Jaine DEX",
  "Executing OG -> USDT swap on-chain",
  "Writing execution receipt to 0G Storage",
  "Committing proof root hash on-chain",
  "Verifying TEE attestation for intent",
  "Checking vault balance before execution",
  "Broadcasting transaction to 0G Galileo",
  "Polling TradeExecuted event from vault",
];

const REGIONS = ["0g-galileo", "tee-enclave", "jaine-dex", "0g-storage", "0g-compute"];
const STATUSES = [
  { label: "running",  color: "#4ade80" },
  { label: "running",  color: "#4ade80" },
  { label: "running",  color: "#4ade80" },
  { label: "queued",   color: "#facc15" },
  { label: "complete", color: "#60a5fa" },
];

type IntentRow = {
  id: string;
  name: string;
  task: string;
  region: string;
  status: typeof STATUSES[number];
  progress: number;
  elapsed: string;
  key: number;
};

function randomRow(key: number): IntentRow {
  return {
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
    name: AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)],
    task: TASKS[Math.floor(Math.random() * TASKS.length)],
    region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
    status: STATUSES[Math.floor(Math.random() * STATUSES.length)],
    progress: Math.floor(Math.random() * 85 + 10),
    elapsed: `${Math.floor(Math.random() * 14 + 1)}m ${Math.floor(Math.random() * 59)}s`,
    key,
  };
}

function ProgressBar({ initial }: { initial: number }) {
  const [pct, setPct] = useState(initial);
  const rafRef = useRef<number>(0);
  const pctRef = useRef(initial);

  useEffect(() => {
    const tick = () => {
      pctRef.current = Math.min(99, pctRef.current + 0.015);
      setPct(Math.round(pctRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ width: "100%", height: 2, background: "rgba(0,0,0,0.08)", borderRadius: 9 }}>
      <div style={{ height: "100%", borderRadius: 9, width: `${pct}%`, background: "rgba(0,0,0,0.35)", transition: "width 0.5s linear" }} />
    </div>
  );
}

const SEED_ROWS: IntentRow[] = [
  { id: "A1B2C3", name: "encryptor-7f2a",  task: "Encrypting intent with ECIES-256",            region: "tee-enclave",  status: STATUSES[0], progress: 42, elapsed: "3m 12s", key: 0 },
  { id: "D4E5F6", name: "executor-3b1c",   task: "Executing OG -> USDT swap on-chain",           region: "jaine-dex",    status: STATUSES[0], progress: 67, elapsed: "7m 48s", key: 1 },
  { id: "G7H8I9", name: "strategist-2c8f", task: "Calling 0G Compute for strategy reasoning",   region: "0g-compute",   status: STATUSES[3], progress: 18, elapsed: "1m 05s", key: 2 },
  { id: "J0K1L2", name: "router-5a3d",     task: "Routing swap through Jaine DEX",              region: "0g-galileo",   status: STATUSES[0], progress: 55, elapsed: "5m 30s", key: 3 },
  { id: "M3N4O5", name: "auditor-9d4e",    task: "Writing execution receipt to 0G Storage",     region: "0g-storage",   status: STATUSES[0], progress: 80, elapsed: "11m 22s", key: 4 },
  { id: "P6Q7R8", name: "guardian-4f2c",   task: "Verifying TEE attestation for intent",        region: "tee-enclave",  status: STATUSES[4], progress: 99, elapsed: "14m 01s", key: 5 },
];

export function LiveIntentFeed() {
  const [rows, setRows] = useState<IntentRow[]>(SEED_ROWS);
  const keyRef = useRef(100);

  useEffect(() => {
    setRows(Array.from({ length: 6 }, (_, i) => randomRow(i)));
    const t = setInterval(() => {
      keyRef.current++;
      setRows(prev => [...prev.slice(1), randomRow(keyRef.current)]);
    }, 2800);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 16, overflow: "hidden", background: "rgba(255,255,255,0.70)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 70px", padding: "8px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(0,0,0,0.03)" }}>
        {["AGENT", "TASK", "REGION", "STATUS"].map(h => (
          <span key={h} style={{ fontSize: 8, letterSpacing: "0.16em", color: "rgba(0,0,0,0.30)", fontFamily: "var(--font-data)" }}>{h}</span>
        ))}
      </div>

      <div style={{ overflow: "hidden" }}>
        {rows.map((row, i) => (
          <div
            key={row.key}
            style={{
              display: "grid", gridTemplateColumns: "80px 1fr 80px 70px",
              padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)",
              gap: 8, alignItems: "center",
              animation: i === rows.length - 1 ? "rowSlideIn 0.4s cubic-bezier(0.16,1,0.3,1) both" : "none",
            }}
          >
            <div>
              <div style={{ fontSize: 9, fontFamily: "var(--font-data)", color: "rgba(0,0,0,0.65)", marginBottom: 1 }}>{row.name}</div>
              <div style={{ fontSize: 7.5, fontFamily: "var(--font-data)", color: "rgba(0,0,0,0.25)" }}>#{row.id}</div>
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 9, color: "rgba(0,0,0,0.50)", lineHeight: 1.35, marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.task}</div>
              <ProgressBar initial={row.progress} />
            </div>

            <div style={{ fontSize: 8, fontFamily: "var(--font-data)", color: "rgba(0,0,0,0.30)" }}>{row.region}</div>

            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%",
                background: row.status.color,
                boxShadow: row.status.label === "running" ? `0 0 6px ${row.status.color}` : "none",
                animation: row.status.label === "running" ? "statusPulse 2s ease-in-out infinite" : "none",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 8, fontFamily: "var(--font-data)", color: "rgba(0,0,0,0.35)" }}>{row.status.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LiveIntentCounter() {
  const [count, setCount] = useState(1284);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = setInterval(() => {
      setCount(v => v + Math.floor(Math.random() * 3 - 1));
    }, 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <span className="font-display" style={{
      fontSize: "clamp(3rem, 6vw, 5rem)",
      fontWeight: 300,
      color: "#111",
      lineHeight: 1,
      letterSpacing: "-0.02em",
      transition: "color 0.3s ease",
    }}>
      {mounted ? count.toLocaleString("en-US") : "1,284"}
    </span>
  );
}
