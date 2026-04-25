# aleo-skills

> **Bring your existing AI dev workflow to Aleo.** Install one plugin, keep
> using the AI tools you already know (Claude Code, Cursor, etc.), and ship
> privacy apps on [Aleo](https://aleo.org) without learning zero-knowledge
> cryptography first.

**Status:** v0.1 — ships `/aleo-plan` (architecture planner) + one worked
example. More skills coming.
**Last verified:** April 2026 · **Leo:** v4.0.2 · **SDK:** `@provablehq/sdk ^0.10.2`

---

## Install

```bash
# Inside Claude Code:
/plugin install casualcomputer/aleo-skills
```

Done. Slash commands and always-on rules are now active.

**Other AI tools:**

```bash
git clone https://github.com/casualcomputer/aleo-skills
```

Point Cursor / Windsurf / Continue / Copilot / ChatGPT at the cloned `skills/`
folder. Each `SKILL.md` is plain markdown — works anywhere.

---

## Pick your starting point

### "I'm a full-stack / web2 dev. Never touched blockchain."

You already know: REST APIs, databases, JWTs, AES encryption, React, Next.js.

**Mental model translation:**
- An **Aleo program** is like a stored procedure that returns a math proof
  alongside its result. You don't write the proof — the tools generate it.
- **Records** are rows in an encrypted database that only the row owner can
  decrypt.
- **Mappings** are a public key-value store (think Redis on a blockchain).
- **The off-chain encrypted blob pattern** is exactly what you'd build with
  Postgres + AES — the chain just stores the hash.

You do **not** need to learn the underlying ZK cryptography. The SDK handles it.

**First prompt (paste into Claude Code):**

```
/aleo-plan

I'm a full-stack dev, no blockchain experience. I want to build an anonymous
invoice app where users pay bills and identities stay private. Walk me through
the architecture decisions in plain language.
```

The interview adapts to your background — it'll skip ZK jargon and translate
Aleo primitives into web2 analogies you already know.

---

### "I'm a Web3 dev. Know Solidity / EVM. New to Aleo."

You already know: contracts, mappings, events, ERC-20, gas, wallets, wagmi /
ethers.

**Mental model translation:**
- Aleo is **closer to Bitcoin's UTXO model than Ethereum's accounts model**
  (for the private parts). Records are spent and created, not mutated.
- A `transition` ≈ external Solidity function. A `final {}` block ≈ the
  state-changing part of a tx (executed in a finalization phase).
- `credits.aleo` ≈ ETH (the native token, used for fees).
- ARC-20 tokens ≈ ERC-20 tokens.
- Wallet adapters ≈ wagmi / RainbowKit, just for Aleo.
- **DPS (Delegated Proving Service)** ≈ meta-transactions, but for proof
  generation: a service computes the ZK proof for you so the user's device
  doesn't.
- **View keys** ≈ no EVM equivalent. They're decryption keys for selective
  disclosure (e.g., "let my auditor read these specific encrypted records").
- **BHP256** ≈ keccak256 but ZK-friendly (cheap inside circuits).

**The mental shift:** privacy isn't free. Every public mapping leaks something.
You'll spend more time deciding *what goes on-chain* than writing the contract.

**First prompt:**

```
/aleo-plan

I have 3 years of Solidity experience. Want to build an anonymous invoice app
on Aleo. Show me the architecture decisions, with EVM analogies where they
help.
```

---

### "I'm a data person / ML engineer. Built backends, never blockchain."

You already know: Python, SQL, encryption-at-rest, hashing, schema design,
AWS/GCP, S3, RDS.

**Mental model translation:**
- Aleo is a **distributed append-only log of typed records and a key-value
  store** with strong privacy guarantees.
- Writes go through a "program" (like a stored procedure) that the network
  verifies cryptographically. You don't trust the server — you verify the
  proof.
- **You can keep your existing data infra.** The pattern is: hash sensitive
  rows, store the hash on-chain, keep the encrypted row in your existing DB.
  Your AES keys, your storage, your queries — unchanged. The chain is a
  tamper-proof index.

**The mental shift:** unlike a normal DB, *nothing* is private by default
unless you mark it private. Records hide owners, mappings don't.

**First prompt:**

```
/aleo-plan

I'm a backend / data engineer. We have Postgres + S3 already. I want to add
privacy guarantees to our invoicing flow without rewriting the whole stack.
Walk me through which parts move on-chain and which stay where they are.
```

---

### "I already know Aleo. Just want the skill files."

```bash
git clone https://github.com/casualcomputer/aleo-skills
ls skills/
```

`skills/aleo-plan/SKILL.md` is the interview script. Skip the interview if you
know what you want — go straight to `references/architecture-payments.md` for
the vendor-neutral pattern, or `examples/payments-supabase/` for a concrete
recipe.

---

## What you'll actually do with this

Three realistic dev moments. Same prompts work in Claude Code, Cursor,
Windsurf, ChatGPT — anywhere you already use AI.

### 1. Scope a vague idea fast

> *PM slacks you: "Can you tell me by Friday if Aleo is a fit for our
> anonymous invoicing product?"*

```
/aleo-plan

PM wants an anonymous invoice product. Founders are deciding if Aleo fits.
Need a 1-pager: architecture sketch + flagged unknowns to take back to the
founders before the investor call.
```

Output in 20 minutes: an architecture sketch with on-chain shape, off-chain
shape, deployment order, and a list of decisions the founders need to make.
Hand it to the PM.

Compare to: 4 hours reading Aleo docs, then guessing.

### 2. Translate the architecture into a working Leo program

> *Architecture is approved. Time to write code.*

```
Read skills/aleo-plan/references/architecture-payments.md and our scope doc
at docs/scope.md. Generate the Leo v4.0 program implementing create_invoice,
pay_invoice, and cancel_invoice as described in the sketch.
```

The AI reads the pattern, follows your spec, generates a `main.leo` that
already respects privacy invariants (record consumption, no merchant-address
leakage in mappings, BHP256 commitment binding).

You skip the "Leo v3 vs v4 syntax" landmine. The skill encodes that knowledge.

### 3. Privacy review before shipping

> *PR is up. Before merging:*

```
Review src/main.leo for privacy leaks. Use the "Anti-patterns" section of
skills/aleo-plan/references/architecture-payments.md as the checklist.
```

The AI walks each anti-pattern against your code:
- Public mapping keyed on merchant address? ❌ leaks merchant→invoice graph
- Amount stored alongside commitment in public mapping? ❌ defeats amount privacy
- AES-CBC instead of AES-GCM for the off-chain blob? ❌ no integrity, malleable

You get a checklist with line numbers. Fix or justify each finding.

---

## What ships in v0.1

| Skill | Status | What it does |
|-------|--------|--------------|
| **`/aleo-plan`** | ✅ shipped | Idea → architecture sketch via 6-question interview. Vendor-neutral patterns. |
| `/aleo-contract` | 🟡 coming | Write/test/deploy Leo v4.0 programs, multi-program imports, `--broadcast`/`--priority-fees` flag checks. |
| `/aleo-app` | 🟡 coming | Off-chain encryption, BHP256 commitment computation, view-key wrapping, storage-adapter patterns. |
| `/aleo-wallet` | 🟡 coming | Adapter matrix (Leo/Puzzle/Fox/Shield/Soter), burner UX, view-key delegation, sign+submit. |
| `/aleo-audit` | 🟡 coming | Privacy-leakage checklist, mapping-correlation attacks, fee-reveal patterns. |
| `/aleo-production` | 🟡 coming | DPS, external signing, mainnet checklist, MCP server packaging. |

**Bundled examples (one vendor-specific recipe per architecture):**

- `examples/payments-supabase/` — Next.js + Supabase + WebCrypto AES-GCM. Pairs
  with `architecture-payments.md`. Includes the Leo program, schema with RLS,
  client-side commitment + encryption helpers.

---

## The 4-phase journey

```
                  ┌───────────────────────────────────────┐
                  │  /aleo-plan  ←  start here            │
                  │  Interview → architecture sketch +    │
                  │  reading order for the other skills   │
                  └───────────────────┬───────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              ↓                       ↓                       ↓
       /aleo-contract           /aleo-app                /aleo-wallet
       (Leo programs)           (Off-chain encryption)   (Wallet integration)
              └───────────────────────┼───────────────────────┘
                                      ↓
                              /aleo-audit
                              (privacy review)
                                      ↓
                              /aleo-production
                              (DPS, mainnet, MCP)
```

You only need to remember **`/aleo-plan`**. It tells you which skill to
invoke next.

---

## Best-practice tips

A few things devs trip on the first time:

1. **Start with `/aleo-plan` even if you think you know what to build.** The
   interview surfaces decisions you didn't know you had to make (e.g., "is the
   *amount* private or just the parties?"). 10 minutes upfront saves a
   refactor later.

2. **Don't paste your private key into chats with AI.** The skills assume
   `.env` files and CLI flags. If your AI ever asks for a private key inline,
   stop and use environment variables instead. (`CLAUDE.md` enforces this.)

3. **Default to testnet.** Every example, every prompt, every command. Mainnet
   is for after you've shipped on testnet and audited. The plugin defaults to
   testnet automatically.

4. **Use `examples/` as a starting point, not a tutorial.** Copy the
   directory, swap the parts that don't fit your stack. The Leo program and
   commitment scheme stay the same; the storage adapter changes.

5. **When the AI suggests a vendor (Supabase, Firebase, etc.), it should
   only happen inside `examples/`.** If a vendor name shows up in a `SKILL.md`
   file, that's a bug — please file an issue.

6. **Pin your Leo and SDK versions.** Aleo evolves fast; v3.5 → v4.0 was a
   breaking change in 2026. Every `SKILL.md` pins the verified version. If
   you see odd compile errors, check version drift first.

---

## Repo layout

```
aleo-skills/
  README.md                      ← you are here
  CLAUDE.md                      ← always-on Aleo rules:
                                   --broadcast required, --priority-fees plural,
                                   default testnet, never expose keys, etc.
  .claude-plugin/plugin.json     ← Claude Code plugin manifest

  skills/
    aleo-plan/
      SKILL.md                   ← interview script (293 lines)
      references/
        architecture-payments.md ← vendor-neutral payment pattern (277 lines)

  examples/
    payments-supabase/           ← one concrete implementation
      contracts/invoice/         ← Leo v4.0 program: create / pay / cancel
      app/lib/                   ← TypeScript helpers:
                                   - commitment.ts (canonical-JSON + BHP256)
                                   - crypto.ts (WebCrypto AES-256-GCM)
                                   - view-key-wrap.ts (wrap/unwrap K under view keys)
      db/schema.sql              ← invoices + merchant_profiles tables
      db/encryption-rationale.md ← why we don't gate on merchant address
```

---

## Vendor-neutrality discipline

Hard split between **patterns** (in `skills/`) and **implementations** (in
`examples/`).

| Layer | Allowed to mention |
|-------|--------------------|
| `skills/*/SKILL.md` and `references/architecture-*.md` | Aleo primitives + Aleo ecosystem tools (Leo, `@provablehq/sdk`, wallet adaptors). **No third-party vendors.** |
| `examples/*/` | Anything goes — Supabase, Firebase, IPFS, whatever fits |

**The test:** if the vendor disappeared tomorrow, would the file still be correct?

- "Use Supabase" → vendor-specific (file breaks)
- "Use an off-chain encrypted store with row-level access" → vendor-neutral (still correct)
- "Use BHP256" → Aleo-native (this is the whole point)

**Why it matters for devs:** patterns age slowly; implementations age fast.
When Supabase changes their SDK, only `examples/payments-supabase/` updates.
The skill stays correct. Devs who hate Vendor X swap it out without
re-architecting.

---

## Always-on rules (`CLAUDE.md`)

The plugin loads these rules into every Aleo task:

- `leo deploy` requires `--broadcast` (the #1 silent-failure mode)
- The flag is `--priority-fees` (plural)
- Default to testnet — never auto-broadcast to mainnet
- Read `program.json` / `package.json` / `.env` before generating code
- Pin `@provablehq/sdk/testnet.js` exactly; don't guess SDK paths
- Don't invent program IDs; don't fabricate Leo built-ins
- Records are consumed when passed as inputs (UTXO model — easy to forget)

Full list: [`CLAUDE.md`](CLAUDE.md).

---

## Contributing

PRs welcome for:

- **New vendor-specific implementations** under `examples/` — Firebase variant
  of payments, IPFS variant, self-hosted Postgres, etc.
- **Bug reports** on outdated version pins or broken example commands
- **New reference architectures** — `architecture-voting.md`,
  `architecture-identity.md`, `architecture-payroll.md`,
  `architecture-marketplace.md`

**Don't** open PRs that put third-party vendor names in `skills/*/`. That's
the one hard rule. (Aleo-native names are fine — Leo, `@provablehq/sdk`,
wallet adaptors.)

---

## License

MIT
