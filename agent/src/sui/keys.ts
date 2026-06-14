import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// Accepts a Sui key in any of the common forms: bech32 (`suiprivkey1...`, what
// `sui keytool export` prints), 0x/raw hex (32 bytes), or base64 (32 or 33 bytes,
// the keystore form where byte 0 is the signature-scheme flag).
function keypairFromSecret(secret: string): Ed25519Keypair {
  const s = secret.trim();
  if (s.startsWith("suiprivkey")) return Ed25519Keypair.fromSecretKey(s);
  const hex = s.replace(/^0x/, "");
  if (/^[0-9a-fA-F]{64}$/.test(hex)) {
    return Ed25519Keypair.fromSecretKey(Uint8Array.from(Buffer.from(hex, "hex")));
  }
  const b = Buffer.from(s, "base64");
  const raw = b.length === 33 ? b.subarray(1) : b;
  return Ed25519Keypair.fromSecretKey(Uint8Array.from(raw));
}

export interface SuiKeys {
  agentKeypair: Ed25519Keypair;     // holds the AgentCap, pays gas
  attestorKeypair: Ed25519Keypair;  // signs exec params; pubkey must equal vault.attestor
}

export function resolveSuiKeys(): SuiKeys {
  const agentSecret = process.env.SUI_AGENT_PRIVATE_KEY ?? process.env.SUI_PRIVATE_KEY;
  if (!agentSecret) throw new Error("Missing SUI_PRIVATE_KEY (or SUI_AGENT_PRIVATE_KEY)");
  const attestorSecret = process.env.SUI_ATTESTOR_PRIVATE_KEY ?? agentSecret;
  return {
    agentKeypair: keypairFromSecret(agentSecret),
    attestorKeypair: keypairFromSecret(attestorSecret),
  };
}
