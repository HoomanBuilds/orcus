export type Decision =
  | { action: "WAIT"; reason: string }
  | { action: "EXECUTE"; reason: string; tradeParams: Record<string, unknown> };

interface Broker {
  inference: {
    listService(): Promise<Array<{ provider: string; verifiability: string }>>;
    getServiceMetadata(provider: string): Promise<{ endpoint: string; model: string }>;
    requestHeaders(provider: string, content: string): Promise<Record<string, string>>;
    processResponse(provider: string, chatId: string, usage: unknown): Promise<void>;
  };
}

export async function sealedDecide(
  broker: Broker,
  provider: string,
  encryptedIntent: string,
  marketSnapshot: string,
): Promise<Decision> {
  const services = await broker.inference.listService();
  const svc = services.find((s) => s.provider === provider && s.verifiability === "TeeML");
  if (!svc) throw new Error("TEE provider not available");

  const { endpoint, model } = await broker.inference.getServiceMetadata(provider);
  const userContent =
    `Encrypted intent: ${encryptedIntent}\n` +
    `Current market: ${marketSnapshot}\n` +
    `Respond ONLY with JSON: {"action":"EXECUTE"|"WAIT","reason":"...","tradeParams":{...}}`;
  const headers = await broker.inference.requestHeaders(provider, userContent);

  const res = await fetch(`${endpoint}/chat/completions`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a sealed trading agent. Return ONLY valid JSON." },
        { role: "user", content: userContent },
      ],
    }),
  });

  // Extract ChatID from header first (CLAUDE.md rule 4), body.id as fallback
  const headerChatId = res.headers.get("ZG-Res-Key") ?? "";

  // Parse body inside try so processResponse fires even on JSON parse failure
  let body: { id?: string; choices?: Array<{ message: { content: string } }>; usage?: unknown } | undefined;
  try {
    body = (await res.json()) as typeof body;
    const resolvedChatId = headerChatId || body?.id || "";
    const content = body?.choices?.[0]?.message?.content ?? "";
    void resolvedChatId; // used in finally
    return JSON.parse(content) as Decision;
  } finally {
    const resolvedChatId = headerChatId || body?.id || "";
    await broker.inference.processResponse(provider, resolvedChatId, body?.usage);
  }
}
