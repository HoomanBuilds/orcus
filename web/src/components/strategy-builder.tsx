"use client";
import { useState, useEffect } from "react";
import { INDICATORS, OPS, OP_LABEL, type Condition, type Indicator, type Op } from "@/lib/strategy-schema";

const FIELD = "rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] outline-none transition-colors focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]";
const LABEL = "text-[10px] tracking-[0.14em] uppercase text-black/30";
const DATA = { fontFamily: "var(--font-data)" } as const;

export interface BuilderState { conditions: Condition[]; logic: "AND" | "OR"; notes?: string; immediate: boolean; valid: boolean }

function condText(c: Condition): string {
  const left = c.indicator === "rsi" || c.indicator === "ma" ? `${c.indicator.toUpperCase()}(${c.period ?? (c.indicator === "rsi" ? 14 : 60)})` : c.indicator;
  const right = c.ref === "ma" ? `MA(${c.maPeriod ?? 60})` : String(c.value);
  return `${left} ${OP_LABEL[c.op]} ${right}`;
}
function condsValid(cs: Condition[]): boolean {
  return cs.length > 0 && cs.every((c) => INDICATORS.includes(c.indicator) && OPS.includes(c.op) && (c.ref === "ma" || (c.value !== undefined && !isNaN(Number(c.value)))));
}

// A two-mode strategy-conditions editor. Reports {conditions, logic, notes, valid} up via onChange.
// The page owns the trade fields (amount/slippage/asset), deposit and encryption.
export function StrategyBuilder({ onChange }: { onChange: (s: BuilderState) => void }) {
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [chat, setChat] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [interpreted, setInterpreted] = useState(false);

  useEffect(() => {
    /* simple is valid once interpreted (conditions OR an immediate swap); advanced needs >=1 condition */
    const valid = mode === "advanced" ? condsValid(conditions) : interpreted;
    const immediate = valid && conditions.length === 0;
    onChange({ conditions, logic, notes: chat.trim() || undefined, immediate, valid });
  }, [conditions, logic, chat, mode, interpreted, onChange]);

  function editChat(v: string) { setChat(v); setInterpreted(false); setParseMsg(null); }
  function switchMode(m: "simple" | "advanced") { setMode(m); if (m === "simple") setInterpreted(false); }

  async function interpret() {
    if (!chat.trim()) return;
    setParsing(true); setParseMsg(null);
    try {
      const res = await fetch("/api/parse-strategy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: chat }) });
      const data = (await res.json()) as { conditions?: Condition[]; logic?: "AND" | "OR"; error?: string };
      if (!res.ok || data.error) { setParseMsg(`Couldn't interpret${data.error ? ` (${data.error})` : ""}, rephrase or use Advanced.`); return; }
      setConditions(data.conditions ?? []);
      setLogic(data.logic === "OR" ? "OR" : "AND");
      setInterpreted(true);
    } catch { setParseMsg("Interpret failed, try again or use Advanced."); }
    finally { setParsing(false); }
  }

  const updateCond = (i: number, patch: Partial<Condition>) => setConditions((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addCond = () => setConditions((cs) => [...cs, { indicator: "rsi", period: 14, op: "lt", value: 30 }]);
  const removeCond = (i: number) => setConditions((cs) => cs.filter((_, j) => j !== i));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {(["simple", "advanced"] as const).map((m) => (
          <button key={m} type="button" onClick={() => switchMode(m)} className="rounded-xl border p-3 text-left transition-all"
            style={{ border: mode === m ? "1px solid rgba(0,0,0,0.25)" : "1px solid rgba(0,0,0,0.07)", background: mode === m ? "rgba(0,0,0,0.04)" : "white", cursor: "pointer" }}>
            <p className="text-[13px] font-medium text-[#111]">{m === "simple" ? "Simple - describe it" : "Advanced - indicators"}</p>
            <p className="text-[11px] text-black/35 mt-0.5">{m === "simple" ? "Chat in plain English" : "Specify conditions exactly"}</p>
          </button>
        ))}
      </div>

      {mode === "simple" && (
        <div className="flex flex-col gap-2">
          <textarea rows={3} value={chat} onChange={(e) => editChat(e.target.value)}
            placeholder="e.g. buy when RSI dips under 30 and price is below the 1h moving average, or just 'swap now'"
            className="w-full rounded-xl border border-black/10 bg-white p-4 text-[13px] leading-relaxed resize-none outline-none focus:border-black/25 focus:ring-2 focus:ring-black/[0.04]" style={{ color: "#111" }} />
          <button type="button" onClick={interpret} disabled={!chat.trim() || parsing} className="self-start rounded-xl border border-black/15 px-4 py-2 text-[12px] text-[#111] hover:bg-black/[0.03] transition-colors" style={{ opacity: !chat.trim() || parsing ? 0.5 : 1 }}>
            {parsing ? "Interpreting…" : "Interpret"}
          </button>
          {parseMsg && <p className="text-[11px] text-red-500">{parseMsg}</p>}
          {interpreted && (
            <div className="rounded-xl border border-black/[0.07] bg-black/[0.015] p-4">
              <p className={`${LABEL} mb-2`} style={DATA}>Here&apos;s what I understood</p>
              <p className="text-[13px] text-[#111]" style={DATA}>
                {conditions.length > 0 ? `Execute when ${conditions.map(condText).join(` ${logic} `)}` : "Execute immediately (no indicator conditions)"}
              </p>
            </div>
          )}
        </div>
      )}

      {mode === "advanced" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className={LABEL} style={DATA}>Conditions (required)</span>
            <div className="flex items-center rounded-lg border border-black/10 overflow-hidden">
              {(["AND", "OR"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setLogic(l)} className="px-3 py-1 text-[11px]" style={{ background: logic === l ? "#111" : "white", color: logic === l ? "#fff" : "rgba(0,0,0,0.5)" }}>{l}</button>
              ))}
            </div>
          </div>
          {conditions.length === 0 && <p className="text-[12px] text-black/35">Add at least one condition.</p>}
          {conditions.map((c, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <select value={c.indicator} onChange={(e) => updateCond(i, { indicator: e.target.value as Indicator })} className={FIELD} style={DATA}>
                {INDICATORS.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
              {(c.indicator === "rsi" || c.indicator === "ma") && (
                <input type="number" value={c.period ?? 14} onChange={(e) => updateCond(i, { period: Number(e.target.value) })} className={`${FIELD} w-20`} style={DATA} title="period" />
              )}
              <select value={c.op} onChange={(e) => updateCond(i, { op: e.target.value as Op })} className={FIELD} style={DATA}>
                {OPS.map((op) => <option key={op} value={op}>{OP_LABEL[op]}</option>)}
              </select>
              {c.ref === "ma" ? (
                <span className="flex items-center gap-1"><span className="text-[12px] text-black/40">MA(</span>
                  <input type="number" value={c.maPeriod ?? 60} onChange={(e) => updateCond(i, { maPeriod: Number(e.target.value) })} className={`${FIELD} w-20`} style={DATA} />
                  <span className="text-[12px] text-black/40">)</span></span>
              ) : (
                <input type="number" value={c.value ?? 0} onChange={(e) => updateCond(i, { value: Number(e.target.value) })} className={`${FIELD} w-24`} style={DATA} placeholder="value" />
              )}
              <button type="button" onClick={() => updateCond(i, c.ref === "ma" ? { ref: undefined, maPeriod: undefined, value: 0 } : { ref: "ma", maPeriod: 60, value: undefined })} className="text-[11px] text-black/40 underline hover:text-black/70">{c.ref === "ma" ? "use value" : "vs MA"}</button>
              <button type="button" onClick={() => removeCond(i)} className="text-[11px] text-red-400 hover:text-red-600 ml-auto">remove</button>
            </div>
          ))}
          <button type="button" onClick={addCond} className="self-start rounded-xl border border-black/15 px-4 py-2 text-[12px] text-[#111] hover:bg-black/[0.03] transition-colors">+ Add condition</button>
          <details className="mt-1">
            <summary className="text-[11px] text-black/40 cursor-pointer hover:text-black/70">Optional: pre-fill from a sentence</summary>
            <div className="flex items-center gap-2 mt-2">
              <input value={chat} onChange={(e) => editChat(e.target.value)} placeholder="describe, then Pre-fill" className={`${FIELD} flex-1`} style={{ color: "#111" }} />
              <button type="button" onClick={interpret} disabled={!chat.trim() || parsing} className="rounded-xl border border-black/15 px-3 py-2 text-[12px]" style={{ opacity: !chat.trim() || parsing ? 0.5 : 1 }}>{parsing ? "…" : "Pre-fill"}</button>
            </div>
            {parseMsg && <p className="text-[11px] text-red-500 mt-1">{parseMsg}</p>}
          </details>
        </div>
      )}
    </div>
  );
}
