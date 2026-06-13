import type { Strategy } from "./schema.js";
import type { EvalResult } from "./evaluate.js";

// Deterministic, always-correct reason from the code verdict — used as the fallback.
function codeReason(ev: EvalResult): string {
  const parts = ev.evaluated.map((e) => `${e.desc} ${e.pass ? "✓" : "✗"}`);
  return `${ev.action}: ${parts.join(", ")}`;
}

// The sealed AI writes a human sentence for the (code-decided) verdict. It is GIVEN the
// pass/fail and must not recompute. Any failure -> code fallback; the action is never affected.
export async function narrate(
  serviceUrl: string,
  apiSecret: string,
  model: string,
  strategy: Strategy,
  ev: EvalResult,
): Promise<{ reason: string; aiReason: string | null }> {
  const fallback = codeReason(ev);
  if (!serviceUrl || !apiSecret) return { reason: fallback, aiReason: null };
  try {
    const res = await fetch(`${serviceUrl}/v1/proxy/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiSecret}` },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        max_tokens: 200,
        messages: [
          {
            role: "system",
            content:
              "You write ONE short sentence explaining a sealed trading decision. You are GIVEN the final verdict and each condition's pass/fail — do NOT recompute, do NOT change the verdict. Output STRICT JSON only: {\"reason\": string}.",
          },
          {
            role: "user",
            content: JSON.stringify({ action: ev.action, logic: strategy.logic, conditions: ev.evaluated, notes: strategy.notes ?? null }),
          },
        ],
      }),
    });
    if (!res.ok) return { reason: fallback, aiReason: null };
    const body = (await res.json()) as { choices?: Array<{ message: { content: string } }> };
    const raw = body.choices?.[0]?.message?.content ?? "";
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as { reason?: unknown };
    const aiReason = typeof parsed.reason === "string" && parsed.reason.trim() ? parsed.reason.trim() : null;
    return { reason: aiReason ?? fallback, aiReason };
  } catch {
    return { reason: fallback, aiReason: null };
  }
}
