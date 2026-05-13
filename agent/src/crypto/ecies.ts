import { PrivateKey, encrypt, decrypt } from "eciesjs";

export interface KeyPair {
  privateKey: `0x${string}`;
  publicKey: `0x${string}`;
}

export function generateKeyPair(): KeyPair {
  const sk = new PrivateKey();
  return {
    privateKey: `0x${Buffer.from(sk.secret).toString("hex")}` as `0x${string}`,
    publicKey: `0x${sk.publicKey.toHex()}` as `0x${string}`,
  };
}

export function encryptIntent(publicKey: string, intent: unknown): `0x${string}` {
  const buf = encrypt(publicKey.replace(/^0x/, ""), Buffer.from(JSON.stringify(intent)));
  return `0x${Buffer.from(buf).toString("hex")}`;
}

export function decryptIntent<T = unknown>(privateKey: string, cipherHex: string): T {
  const cipher = Buffer.from(cipherHex.replace(/^0x/, ""), "hex");
  const buf = decrypt(privateKey.replace(/^0x/, ""), cipher);
  return JSON.parse(Buffer.from(buf).toString("utf8")) as T;
}
