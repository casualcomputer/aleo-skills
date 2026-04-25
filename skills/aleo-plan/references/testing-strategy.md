# Testing strategy for Aleo programs

> Vendor-neutral guidance on **what to test, where, and with which tool**.
> The recommendation is *both* tiers below — they cover different things.
>
> **Last verified:** 2026-04 · **Leo:** v4.0.2 · **leo-bindings:** v0.2.0
> ([upstream](https://github.com/henrikkv/leo-bindings))

---

## Two tiers, complementary

| Tier | Tool | Tests what | Speed | When required |
|------|------|------------|-------|----------------|
| **1. In-language unit tests** | `@test fn` blocks + `leo test` | Single-program logic, edge cases inside one transition | Fast (interpreter) | Always — write these first |
| **2. Cross-program integration tests** | leo-bindings + `cargo test --release` | Multi-program flows (your program calling `credits.aleo`, multiple of your own programs interacting) | Slow on first run, fast after | Whenever a transition calls another program |

A typical Aleo project uses **both**. `@test` for "is the math right." leo-bindings for "does the actual end-to-end flow work."

---

## Tier 1: `@test` blocks (start here)

Inside `main.leo`:

```leo
program my_program.aleo {
    fn add(a: u32, b: u32) -> u32 {
        return a + b;
    }

    @test
    fn test_add() {
        let result: u32 = my_program.aleo::add(2u32, 3u32);
        assert_eq(result, 5u32);
    }

    @test
    @should_fail
    fn test_overflow() {
        let _: u8 = 255u8 + 1u8;
    }

    @noupgrade
    constructor() {}
}
```

Run:

```bash
leo test                  # all @test blocks; fast
leo test --prove          # full proof generation (slower)
```

**Strengths:**
- Built into the Leo CLI, no extra setup
- Sub-second feedback loop
- No Rust required

**Limits:**
- Hard to set up cross-program state (e.g., "alice has 1000 credits before this test")
- Cannot easily orchestrate "program A calls program B which calls program C"
- Tests live alongside production code in `main.leo`

Use for: arithmetic correctness, branch coverage, assertion paths inside one program.

---

## Tier 2: leo-bindings + `cargo test`

Adds a Rust testing layer that:
- Generates strongly-typed Rust bindings from the Leo program's ABI (`build/abi.json`)
- Runs the bindings against `LocalVM` (in-process simulation, no network) or `NetworkVm` (against a devnet/testnet)
- Lets a single test exercise multiple Leo programs at once

Example test pattern (from upstream `leo-bindings/examples/token/tests/`):

```rust
let alice: Account<TestnetV0> = Account::dev_account(0).unwrap();
let bob: Account<TestnetV0>   = Account::dev_account(1).unwrap();
let vm = LocalVM::new().unwrap();
let token = TokenAleo::new(alice, vm).unwrap();
token.mint_public(alice, bob.address(), 1_000_000_000_000).unwrap();
let bal = token.get_balance(bob.address()).unwrap();
assert_eq!(bal, 1_000_000_000_000);
```

Run:

```bash
cargo test --release -- --nocapture
```

**Strengths:**
- Type-checked test code (catches signature mismatches at compile time)
- Mints credits to test addresses, sets up complex initial state
- Same tests run on `LocalVM` (fast, no proving) or `NetworkVm` (against real network)
- Required for testing transitions that call `credits.aleo` or other imports

**Limits & gotchas:**
- **First-run cost is real.** `cargo test --release` downloads ~40 MB of SnarkVM
  SRS files (`powers-of-beta-{16,17,18}.usrs`,
  `shifted-powers-of-beta-{17,18}.usrs`) to `~/.aleo/resources/` on the first
  test run. **15–25 minutes is normal.** Subsequent runs use the cache and
  are fast. Tell users this before they kill the process.
- **Custom snarkVM fork.** leo-bindings depends on `henrikkv/snarkVM` branch
  `leo-bindings`, not upstream `ProvableHQ/snarkVM`. Adopting leo-bindings
  means accepting that fork as a dependency.
- **Requires `build/abi.json`** — run `leo build` once before `cargo test` so
  the bindings macro can read the ABI.
- **Workspace setup is a chore the first time.** Each Leo program needs a
  Rust crate that invokes the bindings macro; tests live in a separate test
  crate. See the upstream `examples/` directory for the boilerplate.

Use for: `pay_invoice` calling `credits.aleo::transfer_private_to_public`,
oracle programs reading another program's mappings, anything where a
single-program `@test` block can't set up the prerequisite state.

---

## Decision tree

```
Need to test a transition?
  ├─ Does it call another program (e.g., credits.aleo, an imported token)?
  │   ├─ Yes → leo-bindings (Tier 2). Tier 1 cannot easily set up the
  │   │        prerequisite state in the imported program.
  │   └─ No  → @test block (Tier 1) is sufficient.
  │
  └─ Does the test depend on multi-step state changes across mappings?
      ├─ Yes → leo-bindings is more ergonomic.
      └─ No  → @test block.
```

---

## What to do BEFORE either tier

Before writing any test:

1. **Confirm `leo --version` matches the version pinned in your project's
   frontmatter.** If your CLI is v3.x and the program is v4.0, nothing will
   compile. Run `cargo install leo-lang --locked` to update.
2. **Run `leo build` first.** Both tiers need the program to compile cleanly.
3. **Run `leo test` (Tier 1) first.** It's faster and catches most bugs. Only
   reach for Tier 2 when a single-program test can't express what you need.

---

## Anti-patterns

| Anti-pattern | Why it breaks |
|--------------|---------------|
| Skipping Tier 1, going straight to leo-bindings | Slow feedback loop, more setup, fewer iterations |
| Using leo-bindings for single-program logic | Overkill — `@test` is faster |
| Assuming first `cargo test --release` is hung | It's downloading SRS files. Wait. |
| Running `cargo test` without `leo build` first | Bindings macro can't find `build/abi.json` |
| Mixing v3.x and v4.x syntax in tests | v3.x test syntax (`@test script foo()`) won't compile under v4.0 |

---

## Reference implementations

For a working leo-bindings setup, see the upstream examples at
[`henrikkv/leo-bindings/examples/`](https://github.com/henrikkv/leo-bindings/tree/master/examples):
- `examples/token/` — single-program ERC-20-style token
- `examples/delegated/` — multi-program interaction
- `examples/dev/` — structs, private/public functions

For a multi-program flow that's been verified to compile and run end-to-end:
[`henrikkv/leo-test/call-limit/`](https://github.com/henrikkv/leo-test) — token1 + token2 + vault tested as a Rust integration suite.

---

## Future work

When `/aleo-contract` ships, it will automate the leo-bindings workspace
scaffolding: `leo build` → generate Cargo workspace → write a test template
that mints credits and exercises the program's transitions. Until then, copy
the upstream `examples/token/` workspace as a starting point and adapt to
your program's ABI.
