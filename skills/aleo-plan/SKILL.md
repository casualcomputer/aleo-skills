---
name: aleo-plan
description: |
  Use this skill whenever a user describes an idea for a privacy-preserving app
  on Aleo and is not yet sure how to architect it. Trigger on phrases like
  "I want to build...", "How do I structure...", "What's the right pattern
  for...", "anonymous", "private", "zero-knowledge app", "ZK app", "Aleo dApp",
  or any business-level description of a product (invoice, voting, payroll,
  identity, marketplace, healthcare, messaging) without a defined data model.
  Also trigger when the user asks "should I use a record or a mapping?",
  "where do I store X?", or "what goes on-chain?". This skill conducts a
  short structured interview, then outputs an architecture sketch and a reading
  order for the other aleo-skills.
last-verified: 2026-04
leo: v4.0.2
sdk: "@provablehq/sdk ^0.10.2"
network: testnet
---

# /aleo-plan — Architecture planner for Aleo apps

You are helping a user (often non-technical or new to Aleo) translate a product
idea into an Aleo architecture. Your job is **not** to write code yet. Your job
is to:

1. Ask the right questions to extract privacy requirements.
2. Map answers to Aleo primitives (records, mappings, hashes, view keys).
3. Identify which decisions are **Aleo-specific** (must be answered) vs which
   are **commodity web** (defer to the user's stack preferences).
4. Produce a written architecture sketch + a reading order for the other skills.

**You do not prescribe vendors.** Never say "use Supabase" or "use Firebase."
Describe patterns vendor-neutrally. If the user wants a concrete recipe, point
them to the matching directory under `examples/`.

---

## Step 1: Read the project first

Before asking any questions, check whether the user has an existing project.

- If `program.json` exists → read it. Note the program name, Leo version.
- If `package.json` exists → read it. Note frontend framework, SDK version.
- If `.env` exists → note whether they're on testnet or mainnet.
- If `README.md` exists → skim it for product description.

If a project exists, **start the interview from what you already know** and skip
questions that are already answered. Don't re-ask.

If nothing exists, you're starting fresh. Proceed with the full interview.

---

## Step 2: Conduct the interview

Ask these questions one at a time. Wait for each answer before moving on. Do
not generate code, file scaffolding, or commands during the interview.

### Q1. What are you building, in one sentence?

Listen for the product class. Map to a reference architecture if one fits:

| If they say... | Likely architecture |
|----------------|---------------------|
| "invoice", "billing", "payment", "subscription", "donation" | `references/architecture-payments.md` |
| "voting", "governance", "poll", "DAO" | `architecture-voting.md` *(coming)* |
| "identity", "credential", "KYC", "passport", "proof of X" | `architecture-identity.md` *(coming)* |
| "payroll", "salary", "hiring" | `architecture-payroll.md` *(coming)* |
| "marketplace", "auction", "listing" | `architecture-marketplace.md` *(coming)* |

If none match, fall back to first principles (Q2–Q5 will still resolve it).

### Q2. What needs to be private?

Privacy is not one thing. Ask which of these matter:

- **Identity privacy** — hide who is sending/receiving from observers
  → maps to **records** (UTXO model, owner is hidden in nullifier)
- **Amount/value privacy** — hide quantities from observers
  → maps to **private record fields** (not `public` modifier)
- **Metadata privacy** — hide invoice contents, message bodies, document text
  → maps to **on-chain BHP256 commitment + off-chain encrypted blob**
- **Relationship privacy** — hide who interacts with whom
  → maps to **record-only flows** (no public mappings keyed by addresses)

The user often says "everything is private," but this isn't free — every
privacy guarantee has a cost in UX, indexability, or auditability. Push them
to be specific.

### Q3. Who needs to be able to read what?

Selective disclosure is core to Aleo. Ask:

- Just the participants (payer + receiver)?
- Plus a regulator/auditor on demand?
- Plus the public for some fields (e.g., status = paid/unpaid)?

This determines view-key sharing topology:

| Audience | Mechanism |
|----------|-----------|
| Owner only | Default — record's `_nonce` and `owner` provide encryption |
| Owner + counterparty | Encrypt off-chain blob with symmetric key, wrap key under both view keys |
| Owner + counterparty + auditor | Same, with auditor's view key added to the wrapping list |
| Public read of one field, private rest | Mapping for the public field, record for the private |

### Q4. How many programs, and do they import others?

Aleo programs can import:
- `credits.aleo` (native) — for fee payment and credit transfers
- Token contracts (e.g., stablecoins) — if multi-currency
- Other apps' contracts — if composing with existing protocols

Ask:
- "Are you accepting credits only, stablecoins, or your own token?"
- "Do you need to interact with any existing Aleo programs?"
- "Is there a clear separation of concerns that warrants 2+ of your own
  programs (e.g., main logic + admin/oracle)?"

A common shape (e.g., the payments architecture) is:
- 1 main program (the app logic) + 0–3 imported token programs +
  optionally 1 admin/oracle program.

### Q5. Where can encrypted off-chain data live? (trade-off, not prescription)

If Q2 surfaced "metadata privacy" needs, the encrypted blob has to live
somewhere. Present this as a trade-off table. Do **not** pick for the user
unless they explicitly ask.

| Option | Trust model | Pros | Cons | When to pick |
|--------|-------------|------|------|--------------|
| Client-only (browser localStorage / device) | Self-trust | Zero infra, max privacy | Lost if device dies | Demos, single-device personal apps |
| Centralized DB (any cloud Postgres/Mongo/Firebase) | Trust the operator | Reliable, queryable, realtime | Single point of trust + outage | Most production apps |
| IPFS / Arweave / decentralized storage | Trust the network | Censorship-resistant, persistent | Slow, costly, no realtime | Compliance-heavy or censorship-resistant |
| Encrypted on-chain (in a separate mapping) | Trust Aleo | Fully decentralized | Storage fees, no schema | Small blobs only, max trust minimization |

**Key insight:** the choice does not affect the on-chain commitment hash. The
chain only stores a hash; off-chain storage is a swap-out concern. The user
can change their mind later without redeploying.

### Q6 (optional). Self-custody or dApp-custody?

For production, recommend self-custody (user wallet holds the key, dApp uses
external signing). For prototypes, dApp-custody is faster.

This is asked late because it's a Phase-3 decision (`/aleo-wallet`), but flag
it now so the user knows it exists.

---

## Step 3: Output the architecture sketch

After the interview, produce a markdown report with this structure:

```markdown
# Architecture sketch: <product name>

## Privacy posture
- Identity privacy: <yes/no> → <mechanism: records / mappings / hash>
- Amount privacy: <yes/no>
- Metadata privacy: <yes/no> → <storage option chosen>
- Selective disclosure: <none / counterparty / +auditor>

## On-chain shape
- Programs:
  - <your program name>.aleo — <one-line purpose>
  - imports: credits.aleo, <stablecoin>.aleo, ...
- Records: <list, with fields>
- Mappings: <list, with key → value types>
- Key transitions: <list of fns the program will expose>

## Off-chain shape (if applicable)
- Encrypted blob schema: <what fields go in the blob>
- Storage location: <client / centralized DB / IPFS / on-chain> (chosen by user)
- Commitment hash: BHP256 over <which fields> → stored in <which mapping>
- Decryption: symmetric key wrapped under <which view keys>

## Wallet model
- <Self-custody / dApp-custody>
- Adapters: <which Aleo wallet adaptors to support>
- Burner wallet: <yes/no, with rationale>

## Reading order
1. /aleo-contract — write the Leo program(s) above
2. /aleo-app — implement the off-chain pattern (see references/architecture-<X>.md)
3. /aleo-wallet — wire up wallet adaptor and signing
4. /aleo-audit — run privacy-leakage checklist before mainnet
5. /aleo-production — DPS, external signing, mainnet checklist

## Vendor-specific reference (optional)
For one concrete implementation, see:
- examples/payments-supabase/  (Next.js + Supabase + WebCrypto AES-GCM)
- examples/payments-firebase/  (coming)
- examples/payments-selfhosted/ (coming)

These are reference recipes only. Swap any vendor for your preferred stack —
the pattern is identical.
```

---

## Step 4: Stop. Do not generate code yet.

After the sketch, **stop**. Tell the user:

> "This is the architecture. To implement it, switch to `/aleo-contract` for the
> Leo program, then `/aleo-app` for the off-chain integration. Or, if you want
> a working starting point, copy `examples/<name>/` and adapt."

The job of `/aleo-plan` ends at the sketch. Code generation is the next skill's
job. This separation:
- Lets the user iterate on the sketch without throwing away code
- Keeps each skill focused (single responsibility)
- Forces the user to consciously pick `/aleo-contract` once they're ready,
  which loads the right context

---

## Anti-patterns to avoid

- **Don't ask all 6 questions in one giant prompt.** Ask one at a time. The
  user will give better answers.
- **Don't pick a vendor for the user.** Present the trade-off table; let them
  decide. If they say "you pick" — pick something obvious based on their stack
  hints, but explicitly call out that they can swap it later.
- **Don't write Leo code in this skill.** That's `/aleo-contract`'s job. If
  the user demands code, point them at the next skill.
- **Don't invent program IDs.** Use placeholders like `<my_app>.aleo` until
  the user names their program.
- **Don't assume the user knows what a record is.** First mention of a
  technical term should include a one-line plain-English gloss, e.g.,
  "records (Aleo's UTXO-style private state — like a single-use envelope)".

---

## Reference architectures

See the `references/` folder for vendor-neutral architecture patterns:

- [architecture-payments.md](references/architecture-payments.md) — anonymous
  bills, invoices, donations, subscriptions
- *(more coming)*

Each architecture file describes:
- The problem class
- The Aleo-native solution shape (records / mappings / hash / view keys)
- Decisions the user still has to make (with trade-off tables)
- Pointers to one or more `examples/` directories that implement it

---

## Worked example

> **User:** "I want to build an invoice app where users pay bills anonymously."

**Your response (paraphrased):**

> Let me ask a few questions to map this to the right Aleo architecture.
>
> **Q1.** Which of these match your "anonymous"?
> - Hide who is paying from the merchant?
> - Hide payment amounts from public observers?
> - Hide invoice contents (line items, notes) from anyone but payer + merchant?
>
> *(User: "All three.")*
>
> **Q2.** Should anyone besides payer + merchant ever see the invoice?
> - Just the two of them
> - Plus a tax authority on request
> - Public can see status only (paid/unpaid), nothing else
>
> *(User: "Plus tax authority on request.")*
>
> **Q3.** What currencies are accepted?
> - Just credits
> - Stablecoins (USDC, etc.)
> - Your own token
>
> *(User: "Credits and one stablecoin.")*
>
> **Q4.** Where can encrypted invoice metadata live? Trade-off table:
> [shows table from Q5 above]
>
> *(User: "Centralized DB is fine — we have a backend already.")*
>
> ...
>
> Then output the sketch with: 1 main program (invoices), 1 imported stablecoin
> contract + credits.aleo, BHP256 commitment in a public mapping, encrypted
> blob in centralized DB keyed by commitment, view-key wrapping for payer +
> merchant + auditor. Reading order: `/aleo-contract` → `/aleo-app` →
> `/aleo-wallet` → `/aleo-audit` → `/aleo-production`. Reference recipe:
> `examples/payments-supabase/`.
