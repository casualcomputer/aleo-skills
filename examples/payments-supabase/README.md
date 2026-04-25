# Example: payments with Supabase

> **Status:** scaffold (v0.1) — Leo program is complete, db schema is complete,
> app helpers are complete, full Next.js UI is sketched but not runnable yet.
>
> This is **one** implementation of the
> [`architecture-payments.md`](../../skills/aleo-plan/references/architecture-payments.md)
> pattern. Other valid implementations: Firebase, self-hosted Postgres, IPFS.
> The Leo program and the commitment scheme are identical across all of them.
> Only the off-chain storage adapter and encryption library binding change.

---

## What this implements

- **Anonymous invoice payments** on Aleo testnet
- **Privacy:** identity, amount, and metadata
- **Selective disclosure:** payer + merchant, optional auditor
- **On-chain:** BHP256 commitment in a public mapping, status flag
- **Off-chain:** invoice JSON encrypted with AES-256-GCM (WebCrypto), keyed by
  commitment, in Supabase Postgres
- **Access control:** view-key wrapping (Supabase RLS is *not* used to gate
  invoice contents — RLS would re-leak merchant identity. RLS only gates the
  public commitment lookup.)
- **Wallet:** dApp-custody for prototype simplicity. For production, switch to
  external signing per `/aleo-wallet` skill.

## Stack

| Layer | Choice | Why this one |
|-------|--------|--------------|
| Frontend | Next.js 14 (App Router) | Common, well-supported by `@provablehq/sdk` |
| Backend | Supabase Edge Functions + Postgres | Reasonable free tier, realtime built-in |
| Encryption | WebCrypto AES-256-GCM | Standard browser-native AEAD, no deps |
| Aleo SDK | `@provablehq/sdk/testnet.js ^0.10.2` | Pinned in CLAUDE.md |
| Network | Aleo testnet | Default per always-on rules |

**To swap any of these,** see `architecture-payments.md` and follow the same
piece-by-piece structure with your preferred tools.

---

## Directory layout

```
payments-supabase/
  README.md                     ← this file
  contracts/
    invoice/
      program.json              ← Leo manifest
      src/main.leo              ← the Leo program
      .env.example              ← network + key template
  app/
    package.json                ← Next.js + SDK + supabase-js
    .env.example                ← endpoints + Supabase URL/anon key
    lib/
      commitment.ts             ← BHP256 hashing client-side
      crypto.ts                 ← WebCrypto AES-GCM helpers
      view-key-wrap.ts          ← wrap/unwrap symmetric K under view keys
      supabase.ts               ← supabase client
      aleo.ts                   ← SDK wrapper for transitions
    app/
      page.tsx                  ← merchant: create invoice
      pay/[commitment]/page.tsx ← payer: pay invoice
      audit/page.tsx            ← optional auditor view
  db/
    schema.sql                  ← invoices table, RLS policies
    encryption-rationale.md     ← why we don't gate on merchant address
```

---

## Quickstart (when fully built)

```bash
# 1. Deploy the Leo program
cd contracts/invoice
cp .env.example .env  # fill in PRIVATE_KEY (testnet)
leo deploy --broadcast --priority-fees 100000

# 2. Create the Supabase tables
psql "$SUPABASE_DB_URL" -f ../../db/schema.sql

# 3. Configure and run the app
cd ../../app
cp .env.example .env.local  # fill in NEXT_PUBLIC_PROGRAM_ID, SUPABASE_URL, SUPABASE_ANON_KEY
npm install
npm run dev
```

> **Currently incomplete.** `app/` ships helpers but not yet a full UI.
> Contributions welcome.

---

## How this maps to the pattern

| Pattern piece | This implementation |
|---------------|---------------------|
| **On-chain commitment** | `lib/commitment.ts` computes BHP256 hash of canonical-JSON invoice; `contracts/invoice/src/main.leo` stores `commitment → InvoiceData` in public mapping |
| **Payment as record consumption** | `pay_invoice` transition in main.leo consumes credits, produces `Receipt` record |
| **Encrypted off-chain blob** | `lib/crypto.ts` AES-256-GCM encrypts invoice JSON; `db/schema.sql` stores it keyed by commitment |
| **View-key wrapping** | `lib/view-key-wrap.ts` wraps the symmetric K under each party's view key |

---

## Key non-obvious decisions

1. **No RLS on invoice contents.** Supabase RLS is great for "users see only
   their rows," but in this app the *merchant address* is what would key the
   policy — and merchant addresses are supposed to be private from the public.
   We instead make the `invoices` table publicly readable by commitment, and
   gate decryption on possession of a wrapped key. RLS *is* used on a separate
   `merchant_profiles` table where addresses are deliberately public (for
   merchant directories).

2. **Canonical JSON for commitment.** Both client and contract must produce
   the same hash from the same logical invoice. We use sorted-key JSON with
   no whitespace as the canonical form. See `lib/commitment.ts`.

3. **dApp-custody only for the prototype.** The app holds private keys for
   simplicity. Production should switch to external signing — see the
   `/aleo-wallet` skill. The pattern is the same; only the signing layer
   changes.

4. **DPS is optional.** Local proving works on testnet for low volume. For
   production, route through DPS — see `/aleo-production`.

---

## Testing this example

Two complementary tiers — see
[`skills/aleo-plan/references/testing-strategy.md`](../../skills/aleo-plan/references/testing-strategy.md)
for the full guidance.

**Tier 1 — `@test` blocks (what ships in `main.leo`):**

```bash
cd contracts/invoice
leo test
```

Covers `create_invoice` and `cancel_invoice` logic in isolation. Fast,
sub-second.

**Tier 2 — leo-bindings (recommended for `pay_invoice`):**

`pay_invoice` calls `credits.aleo::transfer_private_to_public`, so any
realistic test needs to mint credits to the payer first. That's leo-bindings
territory. The upstream
[`leo-bindings/examples/token/`](https://github.com/henrikkv/leo-bindings/tree/master/examples/token)
workspace is the closest template — copy its `Cargo.toml` and `tests/` layout
into `contracts/invoice/`, then write tests that:

1. `Account::dev_account(0)` for alice (payer), `(1)` for bob (merchant)
2. Mint credits to alice via `credits.aleo`
3. Call `aleo_invoice_example.aleo::create_invoice(commitment, amount)` from bob
4. Call `aleo_invoice_example.aleo::pay_invoice(commitment, alice_credits, amount)` from alice
5. Assert the invoice's status flipped from `Pending` to `Paid`
6. Assert bob's public credits balance increased by `amount`

**Heads-up: first `cargo test --release` takes 15–25 minutes** while it
downloads ~40 MB of SnarkVM SRS files to `~/.aleo/resources/`. Subsequent
runs are fast. **Don't kill it at minute 8.**

A pre-wired `tests/` directory will land in a future commit once the
`/aleo-contract` skill ships and can scaffold the leo-bindings boilerplate
automatically.

---

## What this example does NOT cover

- Payroll or subscription scheduling (see future `architecture-payroll.md`)
- Multi-program coordination across more than one own program
- Mainnet deployment (testnet only)
- Wallet adapter integration (uses dApp-custody)
- DPS (uses local proving)
- External signing (see `/aleo-production`)

For these, follow the matching skill.
