import { bcs } from "@mysten/sui/bcs";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

// Mirrors orcus::vault::exec_message on Sui: the attestor signs the BCS bytes
//   address(user) || u64(agentMinOut) || u64(deadlineMs) || vector<u8>(receiptHash) || u64(nonce)
// Move verifies it with sui::ed25519::ed25519_verify(signature, attestor_pubkey, message).
export interface SuiExecParams {
  user: string;        // 0x-prefixed 32-byte Sui address
  agentMinOut: bigint;
  deadlineMs: bigint;
  receiptHash: string; // 0x-prefixed 32-byte hash
  nonce: bigint;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function buildExecMessage(p: SuiExecParams): Uint8Array {
  const hashBytes = Uint8Array.from(Buffer.from(p.receiptHash.replace(/^0x/, ""), "hex"));
  return concatBytes([
    bcs.Address.serialize(p.user).toBytes(),
    bcs.u64().serialize(p.agentMinOut).toBytes(),
    bcs.u64().serialize(p.deadlineMs).toBytes(),
    bcs.vector(bcs.u8()).serialize(Array.from(hashBytes)).toBytes(),
    bcs.u64().serialize(p.nonce).toBytes(),
  ]);
}

/// Sign the exec message with the attestor key (raw ed25519, no intent prefix).
export async function signSuiExec(
  attestor: Ed25519Keypair,
  p: SuiExecParams,
): Promise<{ message: Uint8Array; signature: Uint8Array; publicKey: Uint8Array }> {
  const message = buildExecMessage(p);
  const signature = await attestor.sign(message);
  const publicKey = attestor.getPublicKey().toRawBytes();
  return { message, signature, publicKey };
}
