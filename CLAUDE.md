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
  - `program.aleo::function()` and `program.aleo::mapping.get()` —
    use `::`, **never `/`** as the separator in source. (The compiled AVM
    bytecode uses `/` internally, but Leo source uses `::`.)
  - `f.run()` (not `f.await()`)
  - Helper fns and structs go **outside** the `program {}` block
- **Cross-program mapping reads from inside `final {}` blocks ARE supported**
  in Leo v4.0.2 — verified April 2026. The pattern:
  ```leo
  final {
      let bal: u64 = other_program.aleo::balances.get_or_use(addr, 0u64);
  }
  ```
  is canonical for oracle/vault-style designs. Do not invent workarounds
  unless a verified bug is referenced.
- **If `leo build` errors mention `transition` or `async function`** as
  unrecognized keywords, the user's CLI is on v3.x. Tell them to run
  `cargo install leo-lang --locked` to upgrade. v3.x and v4.x are not
  source-compatible — there is no auto-migration.

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

## 7. Testing & local development

- **Two testing tiers are canonical.** See
  `skills/aleo-plan/references/testing-strategy.md` for the full strategy.
  - `@test fn` blocks inside `main.leo` for in-language unit tests of single
    programs. Run with `leo test`. Fast, no Rust required.
  - leo-bindings + `cargo test --release` for integration tests across
    multiple programs (e.g., your program calling `credits.aleo`). Required
    when you need to set up cross-program state in a test.
- **First leo-bindings run takes 15–25 minutes.** It downloads SnarkVM SRS
  files (`powers-of-beta-{16,17,18}.usrs`, `shifted-powers-of-beta-{17,18}.usrs`,
  ~40 MB total) to `~/.aleo/resources/`. Subsequent runs use the cache and
  are fast. **Tell the user this before they kill the process at minute 8
  thinking it hung.** (Verified April 2026.)
- **leo-bindings depends on a custom snarkVM fork** (`henrikkv/snarkVM`
  branch `leo-bindings`), not upstream `ProvableHQ/snarkVM`. Devs should
  know this before adopting leo-bindings — it's a real trust dependency.
- **`leo test` and leo-bindings are complementary, not competing.** Use
  `@test` for "is the per-program logic right" and leo-bindings for "does
  the multi-program flow actually work end-to-end."

## 8. Vendor neutrality (skills layer)

When working inside this repo or extending its skills:

- `skills/*/SKILL.md` and `skills/*/references/architecture-*.md` describe
  **patterns**, not products. No third-party vendor names (Supabase, Firebase,
  etc.) in these files.
- Vendor-specific recipes live in `examples/<vendor>/`.
- Aleo-native primitives (records, mappings, BHP256, view keys, DPS, external
  signing) are always allowed and encouraged.
- Aleo ecosystem tools (Leo CLI, `@provablehq/sdk`, wallet adaptors) are pinned
  with version + last-verified date.

## 9. When in doubt, ask

For ambiguous requests:
- "Is this for testnet or mainnet?" (assume testnet if unanswered)
- "Self-custody (user holds key) or dApp-custody (your app holds key)?"
  (recommend self-custody for production; dApp-custody only for prototypes)
- "Is privacy of identity, amount, or metadata the priority?" (informs
  record-vs-mapping-vs-hash choice)

Never silently pick a default that affects security or privacy posture.
