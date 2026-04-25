// ----------------------------------------------------------------------------
// view-key-wrap.ts — wrap/unwrap a symmetric AES key under Aleo view keys.
//
// Pattern: a single AES-256 key K encrypts the invoice blob. K is then wrapped
// (encrypted) once per intended recipient using their Aleo view key. Each
// recipient can unwrap K with their view key and then decrypt the blob.
//
// This file uses the Provable SDK's built-in record-encryption primitives,
// which derive a symmetric key from the view key. We piggyback on that
// scheme rather than rolling our own.
//
// CAVEATS:
//   - View keys cannot be revoked. Once you wrap K under someone's view key,
//     they can decrypt forever (assuming they keep a copy of the wrapped K).
//   - For revocable disclosure, use a different trust model (proxy
//     re-encryption, threshold encryption — out of scope here).
//
// Pattern reference: skills/aleo-plan/references/architecture-payments.md
// ----------------------------------------------------------------------------

import { ViewKey } from "@provablehq/sdk/testnet.js";

export interface WrappedKey {
  /**
   * A non-sensitive identifier for the recipient. Use a hash of the address
   * or a deterministic index. Do NOT use the recipient's address directly —
   * that would re-leak identity in the off-chain DB.
   */
  hint: string;
  /** The wrapped K, hex-encoded. */
  ciphertext: string;
}

/**
 * Wrap a raw AES-256 key (32 bytes) so it can be unwrapped later by the
 * holder of `viewKey`.
 */
export async function wrapForViewKey(
  rawKey: Uint8Array,
  viewKey: ViewKey,
  hint: string,
): Promise<WrappedKey> {
  // The SDK's view key has an `encrypt` method that produces ciphertext only
  // its corresponding ViewKey can decrypt. We use it as a key wrap primitive.
  const ciphertext = await viewKey.encrypt(rawKey);
  return { hint, ciphertext: bytesToHex(ciphertext) };
}

/**
 * Try to unwrap each entry in `wrappedKeys` with `viewKey`. Returns the raw
 * AES key on first success, or null if none match.
 */
export async function unwrapWithViewKey(
  wrappedKeys: WrappedKey[],
  viewKey: ViewKey,
): Promise<Uint8Array | null> {
  for (const wrapped of wrappedKeys) {
    try {
      const ciphertext = hexToBytes(wrapped.ciphertext);
      const raw = await viewKey.decrypt(ciphertext);
      return raw;
    } catch {
      // wrong key for this entry — try the next
      continue;
    }
  }
  return null;
}

// --- helpers ---------------------------------------------------------------

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex must have even length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
