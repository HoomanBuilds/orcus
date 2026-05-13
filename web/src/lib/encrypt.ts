import { encrypt } from "eciesjs";

export function encryptIntentBrowser(pubKeyHex: string, intent: unknown): `0x${string}` {
  const buf = encrypt(pubKeyHex.replace(/^0x/, ""), Buffer.from(JSON.stringify(intent)));
  return `0x${Buffer.from(buf).toString("hex")}`;
}
