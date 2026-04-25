# Why we don't gate invoice access on merchant address

A natural-looking RLS policy would be:

```sql
create policy invoices_merchant_only
  on invoices for select
  using (merchant_address = auth.jwt() ->> 'aleo_address');
```

This re-leaks merchant identity. Specifically:

1. The DB now stores `merchant_address` in plaintext.
2. The DB operator (Supabase, your DBA, anyone with `service_role` access) can
   enumerate every merchant's invoices and amounts.
3. Anyone who breaches the DB sees the full merchant→invoice graph.

This contradicts the privacy property promised by the on-chain design, where
the merchant's identity is intentionally only stored in the on-chain mapping
(visible, but uncorrelatable to off-chain identity unless the merchant chose
to be in `merchant_profiles`).

## What we do instead

- The `invoices` table is publicly readable by `commitment`.
- A row contains: commitment, ciphertext, IV, and a list of wrapped symmetric
  keys (one per recipient — payer, merchant, optional auditor).
- Decryption requires holding a view key that can unwrap one of those entries.
- The DB and its operator never see plaintext, never see addresses, never see
  amounts.

## What is correlatable

- Anyone watching the DB sees: how many invoices exist, when they were created,
  rough size of each (ciphertext length).
- They do NOT see: who created them, who can decrypt them, how much, or what
  for.

If even those metadata attacks matter to your threat model:
- Pad ciphertexts to a fixed size before storing.
- Add decoy rows.
- Or move the off-chain blob to decentralized storage (IPFS), removing the
  single operator entirely.

## Trade-off

Server-side filtering by merchant becomes impossible. To list "my invoices,"
the merchant client must:
1. Listen to chain events for new commitments where `info.merchant ==
   self.address` (which IS visible on-chain — the chain reveals the merchant,
   not the DB).
2. Look up each commitment in the DB and decrypt locally.

This pushes work to the client, which is the correct design for a privacy
app: the database knows nothing it doesn't need to know.
