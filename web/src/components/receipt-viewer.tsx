import type { DecisionReceipt } from "@/lib/receipt";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-black/[0.05] last:border-0">
      <span className="text-[10px] tracking-[0.14em] uppercase text-black/30 mt-0.5" style={{ fontFamily: "var(--font-data)" }}>
        {label}
      </span>
      <span className="text-sm text-[#111] text-right break-all" style={{ fontFamily: "var(--font-data)" }}>
        {children}
      </span>
    </div>
  );
}

function marketRows(market: unknown): { k: string; v: string }[] {
  if (!market || typeof market !== "object") return [];
  const m = market as Record<string, unknown>;
  const out: { k: string; v: string }[] = [];
  if (m.symbol !== undefined) out.push({ k: "symbol", v: String(m.symbol) });
  if (m.price !== undefined) out.push({ k: "price", v: `$${Number(m.price).toLocaleString()}` });
  if (m.trend !== undefined) out.push({ k: "trend", v: String(m.trend) });
  const ind = m.indicators as Record<string, unknown> | undefined;
  if (ind && typeof ind === "object") {
    if (ind.rsi14 !== undefined && ind.rsi14 !== null) out.push({ k: "rsi 14", v: String(ind.rsi14) });
    if (ind.sma20 !== undefined && ind.sma20 !== null) out.push({ k: "sma 20", v: String(ind.sma20) });
    if (ind.sma50 !== undefined && ind.sma50 !== null) out.push({ k: "sma 50", v: String(ind.sma50) });
    if (ind.realizedVolatility !== undefined && ind.realizedVolatility !== null)
      out.push({ k: "realized vol", v: String(ind.realizedVolatility) });
  }
  return out;
}

export function ReceiptViewer({ receipt }: { receipt: DecisionReceipt }) {
  const execute = receipt.verdict.action?.toUpperCase() === "EXECUTE";
  const when = receipt.ts ? new Date(receipt.ts).toUTCString() : "-";
  const mkt = marketRows(receipt.inputs?.market);

  return (
    <div className="flex flex-col gap-6">
      {/* Verdict */}
      <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
        <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>
          TEE verdict
        </p>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
            style={{
              fontFamily: "var(--font-data)",
              background: execute ? "rgba(22,163,74,0.10)" : "rgba(180,120,10,0.10)",
              color: execute ? "#15803d" : "#9a6700",
            }}
          >
            {receipt.verdict.action ?? "-"}
          </span>
          <span className="text-[11px] text-black/30" style={{ fontFamily: "var(--font-data)" }}>
            sealed inference
          </span>
        </div>
        <p className="mt-4 text-sm text-black/55 leading-relaxed">{receipt.verdict.reason}</p>
      </div>

      {/* Strategy conditions evaluated (code-decided, AI-narrated) */}
      {receipt.strategy && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
          <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-3" style={{ fontFamily: "var(--font-data)" }}>
            Strategy conditions ({receipt.strategy.logic})
          </p>
          <div className="flex flex-col gap-2">
            {receipt.strategy.evaluated.map((e, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-sm" style={{ fontFamily: "var(--font-data)" }}>
                <span className="text-[#111]">{e.desc}</span>
                <span className="flex items-center gap-2">
                  {e.computedValue !== null && <span className="text-black/40">{e.computedValue}</span>}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]"
                    style={{ background: e.pass ? "rgba(22,163,74,0.10)" : "rgba(180,120,10,0.10)", color: e.pass ? "#15803d" : "#9a6700" }}>
                    {e.pass ? "pass" : "fail"}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-black/30">
            Conditions evaluated in code (authoritative); the verdict above is narrated by the sealed AI{receipt.strategy.aiReason === null ? " (fell back to a code reason)" : ""}.
          </p>
        </div>
      )}

      {/* Decision metadata */}
      <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
        <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>
          Decision
        </p>
        <Row label="time">{when}</Row>
        <Row label="chain">{receipt.chain?.key} {receipt.chain?.chainId ? `(${receipt.chain.chainId})` : ""}</Row>
        <Row label="user">{receipt.user}</Row>
        <Row label="receipt v">{receipt.version}</Row>
      </div>

      {/* Market inputs */}
      {mkt.length > 0 && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
          <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>
            Market inputs (public)
          </p>
          {mkt.map((r) => (
            <Row key={r.k} label={r.k}>{r.v}</Row>
          ))}
        </div>
      )}

      {/* Settlement venue (real-DEX routing, e.g. DeepBook v3 on Sui) */}
      {receipt.settlement && (
        <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
          <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>
            Settlement venue
          </p>
          <Row label="venue">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]" style={{ background: "rgba(22,163,74,0.10)", color: "#15803d" }}>
              {receipt.settlement.venue}
            </span>
          </Row>
          {receipt.settlement.token && <Row label="settled in">{receipt.settlement.token.split("::").slice(-1)[0]}</Row>}
          {receipt.settlement.pool && <Row label="pool">{receipt.settlement.pool}</Row>}
        </div>
      )}

      {/* Oracle + TEE */}
      <div className="rounded-2xl border border-black/[0.07] bg-white p-6">
        <p className="text-[10px] tracking-[0.14em] uppercase text-black/30 mb-2" style={{ fontFamily: "var(--font-data)" }}>
          Oracle floor + enclave
        </p>
        <Row label="oracle mode">{receipt.inputs?.oracle?.mode ?? "-"}</Row>
        {receipt.inputs?.oracle?.priceScaled && <Row label="price (scaled)">{receipt.inputs.oracle.priceScaled}</Row>}
        {receipt.inputs?.oracle?.address && <Row label="oracle">{receipt.inputs.oracle.address}</Row>}
        <Row label="tee provider">{receipt.tee?.provider}</Row>
        <Row label="verifiability">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px]" style={{ background: "rgba(17,17,17,0.06)", color: "#111" }}>
            {receipt.tee?.verifiability} · sealed
          </span>
        </Row>
      </div>
    </div>
  );
}
