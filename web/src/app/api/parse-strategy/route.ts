import { normalizeConditions } from "@/lib/strategy-schema";

export const runtime = "nodejs";

// Server-only: holds the TEE creds (never NEXT_PUBLIC). Parses a NL strategy into draft
// conditions, then code-normalizes the (sloppy) 7B output. Used by the Simple-mode chat
// and the optional Advanced-mode chat assist.
const PARSE_SYS =
  'Convert the user trading strategy into STRICT JSON only. Schema: {"conditions":[{"indicator": one of rsi|ma|price|volatility|trend|change24h, "period": int optional, "op": one of lt|gt|below|above|crossesAbove|crossesBelow, "value": number optional, "ref": "ma" optional, "maPeriod": int optional}], "logic": "AND"|"OR"}. RSI default period 14. "1h moving average" maps to ma with maPeriod 60. Include ONLY conditions the user explicitly stated; never invent thresholds, prices, or indicators. If the user wants to trade immediately or states no indicator conditions (for example "now", "right now", "immediately", "asap", or "whatever the conditions"), return {"conditions": [], "logic": "AND"}. Output ONLY the JSON object.';

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: unknown };
    if (typeof text !== "string" || !text.trim() || text.length > 500) {
      return Response.json({ conditions: [], logic: "AND", error: "invalid input" }, { status: 400 });
    }
    /* deterministic guard: an immediate request with no indicator words is an unconditional
       swap; return empty conditions without trusting the 7B (which tends to invent thresholds) */
    const t = text.toLowerCase();
    const hasIndicator = /(rsi|moving average|\bma\b|price|volatility|trend|change|above|below|over|under|cross|greater|less|>|<)/.test(t);
    const isImmediate = /(\bnow\b|immediately|right now|asap|instantly|whatever)/.test(t);
    if (isImmediate && !hasIndicator) {
      return Response.json({ conditions: [], logic: "AND" });
    }
    const url = process.env.ZG_SERVICE_URL;
    const key = process.env.ZG_API_SECRET;
    const model = process.env.ZG_MODEL || "qwen/qwen2.5-omni-7b";
    if (!url || !key) return Response.json({ conditions: [], logic: "AND", error: "TEE not configured" }, { status: 500 });

    const res = await fetch(`${url}/v1/proxy/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_tokens: 400,
        messages: [
          { role: "system", content: PARSE_SYS },
          { role: "user", content: text },
        ],
      }),
    });
    if (!res.ok) return Response.json({ conditions: [], logic: "AND", error: "TEE error" }, { status: 502 });
    const body = (await res.json()) as { choices?: Array<{ message: { content: string } }> };
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    let parsed: { conditions?: unknown; logic?: unknown } = {};
    try {
      parsed = JSON.parse(raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    } catch {
      /* normalize handles empty */
    }
    return Response.json({ conditions: normalizeConditions(parsed.conditions), logic: parsed.logic === "OR" ? "OR" : "AND" });
  } catch {
    return Response.json({ conditions: [], logic: "AND", error: "parse failed" }, { status: 500 });
  }
}
