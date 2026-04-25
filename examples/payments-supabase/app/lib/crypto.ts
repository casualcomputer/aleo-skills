// ----------------------------------------------------------------------------
// crypto.ts — AES-256-GCM encryption of invoice blobs using WebCrypto.
//
// AES-GCM is an AEAD cipher: it provides both confidentiality and integrity.
// Do not substitute non-AEAD ciphers (e.g., AES-CBC alone) — see
// architecture-payments.md "Anti-patterns" for why.
// ----------------------------------------------------------------------------

export interface EncryptedBlob {
  ciphertext: Uint8Array; // includes the 16-byte GCM tag at the end
  iv: Uint8Array;         // 12 bytes, fresh for each encryption
}

/** Generate a fresh AES-256 symmetric key. */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/** Export a CryptoKey as raw bytes (32 bytes for AES-256). */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(raw);
}

/** Import raw bytes as an AES-256 CryptoKey. */
export async function importKey(raw: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

/**
 * Encrypt a JSON-serializable object with AES-256-GCM.
 * Generates a fresh 12-byte IV per call.
 */
export async function encryptBlob(
  key: CryptoKey,
  plaintextObj: unknown,
): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(plaintextObj));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return { ciphertext: new Uint8Array(ciphertext), iv };
}

/**
 * Decrypt an AES-256-GCM blob and parse it back to JSON.
 * Throws if the tag check fails (tampered ciphertext).
 */
export async function decryptBlob<T = unknown>(
  key: CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: blob.iv },
    key,
    blob.ciphertext,
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as T;
}
