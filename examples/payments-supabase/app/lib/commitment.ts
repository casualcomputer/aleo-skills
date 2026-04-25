// ----------------------------------------------------------------------------
// commitment.ts — compute the on-chain commitment for an invoice.
//
// Both this client AND the Leo program must produce the same hash from the
// same logical invoice, so we use canonical-JSON (sorted keys, no whitespace)
// as the deterministic byte representation, then BHP256 hash to a field
// element via the Provable SDK.
//
// Pattern reference: skills/aleo-plan/references/architecture-payments.md
// ----------------------------------------------------------------------------

import { Hasher } from "@provablehq/sdk/testnet.js";

export interface InvoiceBlob {
  // The canonical schema for an invoice. Add fields as needed; they will be
  // included in the commitment automatically.
  id: string;            // application-level ID (UUID); not the commitment
  merchant: string;      // aleo1... address
  amount: string;        // decimal string (avoid float precision issues)
  currency: string;      // "credits" | "<token-program>.aleo" | etc.
  description: string;
  items?: Array<{ name: string; qty: number; unitPrice: string }>;
  due?: string;          // ISO8601 timestamp
  metadata?: Record<string, string>;
}

/**
 * Canonical-JSON: sorted keys, no whitespace, deterministic for the same
 * logical object. Critical: the Leo program will recompute this hash on-chain
 * from the same canonical bytes, so any deviation breaks the binding.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => JSON.stringify(k) + ":" + canonicalize((value as Record<string, unknown>)[k]),
  );
  return "{" + entries.join(",") + "}";
}

/**
 * Compute the on-chain commitment for an invoice blob.
 * Returns a field-element string suitable for use in Leo (e.g., "1234field").
 */
export async function computeCommitment(invoice: InvoiceBlob): Promise<string> {
  const canonical = canonicalize(invoice);
  const bytes = new TextEncoder().encode(canonical);

  // BHP256 hash to field. The SDK exposes hash families that match Leo's
  // built-ins exactly.
  const field = await Hasher.bhp256.hashToField(bytes);
  return field.toString(); // already includes the "field" suffix
}
