# Aleo development — always-on rules

These rules apply to every Aleo development task in this repo or any project
that imports these skills. They override generic defaults.

**Last verified:** 2026-04 · **Leo:** v4.0.2 · **SDK:** `@provablehq/sdk ^0.10.2`

---

## 1. Network defaults

- **Default to testnet** for all examples, code generation, and CLI commands.
- Endpoints:
  - testnet → `https://api.explorer.provable.com/v1`
  - DPS API host → `https://api.provable.com/v2`
  - local devnet → `http://localhost:3030`
- **Never auto-broadcast to mainnet without explicit confirmation from the user.**
- Faucets (testnet only): https://faucet.provable.com/ and https://faucet.aleo.org/

## 2. Leo CLI gotchas (most common silent failures)

- **`leo deploy` requires `--broadcast`** to actually send the transaction. Without
  it, the tx is built and signed but never reaches the network. This is the #1
  source of "deployed but not on explorer" confusion.
- **The flag is `--priority-fees` (PLURAL)**, not `--priority-fee`. Default `0`
  deprioritizes the tx; use `100000` microcredits (≈0.1 credits) for normal flow.
- **Use Leo v4.0 syntax.** Do not mix v3.x:
  - `fn` (not `transition`, not `function`, not `inline`)
  - `final { ... }` blocks (not `async function finalize_*`)
  - `program.aleo::function()` (not `program.aleo/function()`)
  - `f.run()` (not `f.await()`)
  - Helper fns and structs go **outside** the `program {}` block

## 3. Privacy hygiene (non-negotiable)

- **Never embed private keys in committed code.** Read from `.env` or shell env.
- **Never log private keys, view keys, or record plaintexts.** Use redacted
  placeholders in error messages.
- **View keys are sensitive.** Treat them like read-only credentials. Anyone with
  a view key can decrypt all records owned by the corresponding address.
- **Records are consumed when passed as inputs.** This is the UTXO model. To
  "update" a record, consume it and produce a new one. Don't reuse a record
  variable after passing it in.
- **Public mapping keys are visible.** If correlatable (e.g., user ID), they
  leak privacy. Hash sensitive keys with BHP256 before using as map keys.

## 4. Hallucination guards (Aleo-specific)

- **Don't invent program IDs.** If the user hasn't provided a program name, ask
  or use a clearly fake placeholder like `<your-program>.aleo`.
- **Don't invent contract addresses.** Aleo addresses start with `aleo1` and are
  63 chars bech32. Don't fabricate them.
- **Pin SDK paths exactly:** `@provablehq/sdk/testnet.js` or `/mainnet.js` —
  never guess, never abbreviate.
- **Cite sources for canonical patterns.** Use GitHub permalinks with commit
  SHAs (`github.com/.../blob/<sha>/...`), not paraphrased rules. Permalinks
  survive doc rewrites.
- **Don't fabricate Leo built-ins.** The hash families are exactly: `BHP256`,
  `BHP512`, `BHP768`, `BHP1024`, `Pedersen64`, `Pedersen128`, `Poseidon2`,
  `Poseidon4`, `Poseidon8`, `Keccak256/384/512`, `SHA3_256/384/512`. Don't add
  anything else.

## 5. Read the project before generating

Before writing any code, **read what's already there**. Match the existing style.

- Before writing Leo: read `program.json`, `.env`, `src/main.leo`, any imports.
- Before writing app code: read `package.json`, existing SDK imports, env config.
- Before suggesting a deploy command: check whether the user has a `.env` with
  `NETWORK` and `PRIVATE_KEY` already configured.
- If the project doesn't exist yet, scaffold with `leo new` rather than
  hand-rolling files.

## 6. Default to safe operations

- **Simulate before broadcasting** when the user is iterating. Use `leo run`
  locally before `leo deploy --broadcast`.
- **Confirm before destructive actions:** mainnet deploys, key generation that
  overwrites existing keys, dropping mappings (mappings cannot be recovered after
  drop in upgrade).
- **Prefer `--dry-run` / `--save` / `--print` flows** when the user is
  exploring; reserve `--broadcast` for confirmed actions.
- **Default proving offload:** for production transactions, prefer DPS
  (Delegated Proving Service) over local proving. Local proving is slow and
  battery/CPU-heavy on mobile.

## 7. Vendor neutrality (skills layer)

When working inside this repo or extending its skills:

- `skills/*/SKILL.md` and `skills/*/references/architecture-*.md` describe
  **patterns**, not products. No third-party vendor names (Supabase, Firebase,
  etc.) in these files.
- Vendor-specific recipes live in `examples/<vendor>/`.
- Aleo-native primitives (records, mappings, BHP256, view keys, DPS, external
  signing) are always allowed and encouraged.
- Aleo ecosystem tools (Leo CLI, `@provablehq/sdk`, wallet adaptors) are pinned
  with version + last-verified date.

## 8. When in doubt, ask

For ambiguous requests:
- "Is this for testnet or mainnet?" (assume testnet if unanswered)
- "Self-custody (user holds key) or dApp-custody (your app holds key)?"
  (recommend self-custody for production; dApp-custody only for prototypes)
- "Is privacy of identity, amount, or metadata the priority?" (informs
  record-vs-mapping-vs-hash choice)

Never silently pick a default that affects security or privacy posture.
