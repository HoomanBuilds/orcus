export async function getMarketSnapshot(): Promise<string> {
  return JSON.stringify({
    ts: Date.now(),
    note: "stub market feed; replace with 0G DA subscription post-MVP",
  });
}
