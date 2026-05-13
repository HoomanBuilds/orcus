import { encrypt } from "eciesjs";

export function encryptIntentBrowser(pubKeyHex: string, intent: unknown): `0x${string}` {
  const plaintext = new TextEncoder().encode(JSON.stringify(intent));
  const buf = encrypt(pubKeyHex.replace(/^0x/, ""), plaintext);
  const hex = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}
