import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { signSuiExec, type SuiExecParams } from "../src/sign/suiExec.js";

// Deterministic test vector for the Move vault's ed25519 attestation test.
// Fixed seed -> stable pubkey/signature so the Move test can hardcode them.
const seed = new Uint8Array(32).fill(7);
const kp = Ed25519Keypair.fromSecretKey(seed);

const p: SuiExecParams = {
  user: "0x" + "0".repeat(59) + "a11ce", // @0xa11ce padded to 32 bytes
  agentMinOut: 0n,
  deadlineMs: 9_000_000_000_000n,
  receiptHash: "0x" + "11".repeat(32),
  nonce: 0n,
};

const hex = (u: Uint8Array) => "0x" + Buffer.from(u).toString("hex");

const { message, signature, publicKey } = await signSuiExec(kp, p);
console.log("user        =", p.user);
console.log("agentMinOut =", p.agentMinOut.toString());
console.log("deadlineMs  =", p.deadlineMs.toString());
console.log("receiptHash =", p.receiptHash);
console.log("nonce       =", p.nonce.toString());
console.log("MESSAGE  =", hex(message));
console.log("PUBKEY   =", hex(publicKey));
console.log("SIGNATURE=", hex(signature));
