export type Decision =
  | { action: "WAIT"; reason: string }
  | { action: "EXECUTE"; reason: string; tradeParams: Record<string, unknown> };

export async function sealedDecide(
  serviceUrl: string,
  apiSecret: string,
  intentJson: string,
  market: string,
): Promise<Decision> {
  if (!serviceUrl || !apiSecret) throw new Error("ZG_SERVICE_URL and ZG_API_SECRET must be set");

  const userContent =
    `Intent: ${intentJson}\n` +
    `Market: ${market}\n` +
    `Respond ONLY with JSON: {"action":"EXECUTE","reason":"...","tradeParams":{}} or {"action":"WAIT","reason":"..."}`;

  const res = await fetch(`${serviceUrl}/v1/proxy/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiSecret}`,
    },
    body: JSON.stringify({
      model: "qwen/qwen-2.5-7b-instruct",
      messages: [
        {
          role: "system",
          content:
            "You are a sealed MEV-resistant trading agent. " +
            "If the user intent contains words like 'now', 'immediately', 'execute', or 'force', you MUST return action=EXECUTE regardless of market conditions. " +
            "Only return action=WAIT when the intent is clearly conditional (e.g. 'swap only if price rises above X'). " +
            "Return ONLY valid JSON with no markdown.",
        },
        { role: "user", content: userContent },
      ],
      max_tokens: 256,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`0G inference error ${res.status}: ${text}`);
  }

  const body = await res.json() as { choices?: Array<{ message: { content: string } }> };
  const raw = body.choices?.[0]?.message?.content ?? "";
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(clean) as Decision;
}
