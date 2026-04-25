# Reference architecture: anonymous payments

> **Vendor-neutral pattern** for any payment-class product on Aleo: invoicing,
> bills, subscriptions, donations, marketplace checkout, payroll.
>
> **Last verified:** 2026-04 · **Leo:** v4.0.2

This file describes **what to build**. It does not prescribe a specific
database, framework, or library. For one concrete implementation, see
`examples/payments-supabase/`. Other valid implementations exist with any
backend stack.

---

## Problem class

Two parties (payer, payee) need to settle a transaction with these properties:

- **Identity privacy:** observers cannot link payer to payee
- **Amount privacy:** observers cannot see the value transferred
- **Metadata privacy:** observers cannot see the invoice contents (line items,
  notes, references)
- **Provability:** payer and payee can both prove the transaction happened
- **Optional auditability:** a designated third party (tax authority,
  compliance officer) can decrypt on demand without observer access

This pattern fits invoices, bills, donations, subscription payments,
marketplace checkout, payroll, and any one-shot or recurring transfer where
both parties care about confidentiality.

---

## Aleo-native solution shape

The pattern has four pieces. All are required for a complete privacy story.

### Piece 1: invoice commitment on-chain

The chain stores a hash, not the data.

```
client                                  Aleo
  ├─ build invoice_blob (JSON):
  │    { id, amount, currency, items, notes, ... }
  │
  ├─ compute commitment = BHP256::hash_to_field(invoice_blob)
  │
  ├─ submit transition: create_invoice(merchant, commitment, amount_pub_or_priv)
  │      ↓
  │                                    mapping invoices: field => InvoiceData
  │                                    invoices.set(commitment, { merchant, status: Pending })
```

The `commitment` is a field-element hash. It binds the off-chain blob to the
on-chain state without revealing contents. Anyone who later sees the blob can
verify it matches by re-hashing.

**Why BHP256:** it's the Aleo-native hash that's both efficient inside ZK
circuits (when the program needs to verify a hash) and standard outside (when
the off-chain client computes it). Using the same family on both sides means
no impedance mismatch.

### Piece 2: payment as record consumption

Payment uses Aleo's UTXO model. Records are consumed (spent) and produced (created).

```leo
// inside the payments program
record Receipt {
    owner: address,    // the payer (private)
    commitment: field, // links back to the invoice
    amount: u64,       // what they paid
}

fn pay_invoice(
    public commitment: field,
    payer_credits: credits.aleo/credits,
    public amount: u64,
) -> (credits.aleo/credits, Receipt, Final) {
    let (change, payment): (credits.aleo/credits, credits.aleo/credits) =
        credits.aleo::transfer_private_to_public(
            payer_credits, self.address, amount
        );
    let receipt: Receipt = Receipt {
        owner: self.caller,
        commitment: commitment,
        amount: amount,
    };
    return (change, receipt, final {
        // mark invoice paid
        let info: InvoiceData = invoices.get(commitment);
        invoices.set(commitment, InvoiceData {
            merchant: info.merchant,
            status: Status::Paid,
        });
        // forward the public credits to the merchant
        credits.aleo::transfer_public(info.merchant, amount);
    });
}
```

**Privacy properties:**
- The `payer_credits` record is consumed; its `_nonce` becomes a nullifier.
  Observers see *a* nullifier was spent, not *which* record.
- The `Receipt` record is private — only the payer can decrypt it.
- The `commitment` is public on-chain (in the mapping update) but reveals
  nothing about contents.
- The `amount` is `public` here. **If amount privacy matters, make it private**
  by removing `public` and routing through `transfer_private` only.

### Piece 3: encrypted off-chain blob, keyed by commitment

The full invoice content lives off-chain, encrypted, with `commitment` as the
lookup key.

```
client                                off-chain store
  ├─ generate symmetric key K (random 32 bytes)
  ├─ ciphertext = AEAD-encrypt(K, invoice_blob)
  ├─ wrapped_keys = [
  │     wrap(K, payer_view_key),
  │     wrap(K, merchant_view_key),
  │     wrap(K, auditor_view_key),  // optional
  │   ]
  └─ store: { commitment, ciphertext, wrapped_keys, ... } ───────→
                                                                  ↓
                                              row: indexed by commitment
                                              access: read by anyone with
                                                a wrapped_key they can unwrap
```

**Decisions you make here:**
- Which AEAD cipher? Any standard (AES-GCM, ChaCha20-Poly1305, libsodium
  secretbox). The chain doesn't care.
- Where does the row live? Any storage with row-level access control:
  - Centralized DB (Postgres / Mongo / Firebase)
  - Decentralized storage (IPFS / Arweave) keyed by commitment
  - Encrypted on-chain in a separate Aleo mapping (max trust minimization,
    higher cost)
  - Client-only (browser localStorage, encrypted)

**Access control discipline:** the off-chain store should *not* enforce
"merchant can read all their invoices" via SQL row-level rules tied to
plaintext addresses. That re-leaks the merchant→invoice relationship. Instead,
gate access on possession of a valid wrapped_key, which only the intended
parties have.

### Piece 4: selective disclosure via view-key wrapping

Aleo addresses have an associated **view key** — a symmetric secret that lets
its holder decrypt records owned by that address.

To grant decryption rights to N parties, wrap the symmetric key K under each
party's view key:

```
wrapped_K_for_payer    = encrypt(payer_view_key, K)
wrapped_K_for_merchant = encrypt(merchant_view_key, K)
wrapped_K_for_auditor  = encrypt(auditor_view_key, K)  // optional
```

Anyone who holds one of these view keys can unwrap K and decrypt the blob.
Anyone else sees only opaque ciphertext.

**Audit pattern:** to add an auditor *after* the invoice was created, the
payer or merchant re-wraps K under the auditor's view key and stores it
alongside. No on-chain action required.

**Revocation pattern:** view-key wrapping cannot be revoked once published.
For revocable access, use a different trust model (proxy re-encryption,
threshold encryption — out of scope for the basic pattern).

---

## What you still need to decide

These choices don't affect the on-chain design but affect UX and operations:

| Decision | Options | Notes |
|----------|---------|-------|
| **Off-chain storage** | client-only / centralized / decentralized | See `off-chain-storage-tradeoffs.md` *(coming)*. The user can change their mind without redeploying. |
| **AEAD library** | WebCrypto / libsodium / platform native | Any AEAD works. Pick what's available in your runtime. |
| **Commitment input format** | JSON / canonical CBOR / custom | Must be deterministic — both parties hash to the same field. JSON works if you canonicalize key order. |
| **Frontend framework** | any (React, Svelte, native) | Aleo has no opinion. |
| **Backend stack** | any (Node, Python, Go, serverless, none) | Aleo has no opinion. |
| **Multi-currency** | credits only / + stablecoins / own token | Imports add complexity in `/aleo-contract`. |
| **Indexer** | direct API polling / hosted indexer / self-hosted | Polling `api.explorer.provable.com/v1` works for low-volume. |
| **Wallet model** | dApp-custody / self-custody (external signing) | Recommend self-custody for production. See `/aleo-wallet`. |
| **Notification channel** | none / email / Telegram / push | Backend-only concern; doesn't affect Aleo design. |

---

## Common variations

### Public status, private contents

If the public should be able to see "invoice X is paid" without seeing
contents, store `status: Pending | Paid | Cancelled` in the public mapping
alongside `commitment`. The status is a 2-bit public field; contents stay
encrypted.

### Multi-currency

Add imports for each accepted token contract. Keep payment transitions
parametric on currency, or split into one transition per currency for clearer
gas estimation:

```leo
fn pay_invoice_credits(...) -> (...) { /* uses credits.aleo */ }
fn pay_invoice_stablecoin(...) -> (...) { /* uses stablecoin.aleo */ }
```

### Donations (no expected payer)

Skip the merchant→commitment binding step; let any address pay against a
public commitment. The receipt record is still private to the donor.

### Subscriptions (recurring)

The on-chain commitment maps to a recurring schedule (next-due timestamp).
Each payment consumes a record, updates the schedule mapping. Off-chain blob
optionally stores the schedule rules.

### Refunds

Store a `refund_authorized_by` field in the on-chain mapping. The merchant
calls a `refund` transition that consumes their public credits balance and
produces a refund receipt record for the payer. Update the off-chain blob
with `status: Refunded` (the chain doesn't need to mirror this if the
mapping already shows status).

---

## Anti-patterns

These look reasonable but break the privacy model. Avoid.

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Use payer address as the off-chain DB key | Re-leaks payer identity to the DB operator |
| Use merchant address as a public mapping key | Anyone can enumerate the merchant's invoices |
| Store amount in public mapping next to commitment | Defeats amount privacy |
| Skip BHP256 commitment, just use a UUID | Loses the on-chain binding — you can't prove the off-chain blob hasn't been swapped |
| Put plaintext invoice in the record | Records are encrypted to the *owner only*. Both parties need to read — use the off-chain pattern |
| Wrap K under the address (not the view key) | Addresses don't have a decryption capability; only view keys do |
| Use a non-AEAD cipher (e.g., AES-CBC alone) | Allows ciphertext malleability — observer can corrupt the blob undetectably |

---

## Reference implementations

These directories implement this pattern with a specific stack. Pattern is
identical across all of them; pick the one closest to your existing tools.

- `examples/payments-supabase/` — Next.js + Supabase (Postgres) + WebCrypto AES-GCM
- *(more coming: payments-firebase, payments-selfhosted, payments-ipfs)*

When you implement, the only files that change between vendors are:
- The off-chain storage adapter
- The encryption library binding
- The realtime/notification glue

The Leo program, the commitment scheme, and the view-key wrapping logic are
the same in every implementation.

---

## Next skills to invoke

After confirming this architecture fits your product:

1. **`/aleo-contract`** — write the Leo program(s)
2. **`/aleo-app`** — implement the off-chain pattern (commitment computation,
   encryption, storage)
3. **`/aleo-wallet`** — wire up the wallet adapter
4. **`/aleo-audit`** — privacy-leakage checklist before mainnet
5. **`/aleo-production`** — DPS, external signing, deployment
