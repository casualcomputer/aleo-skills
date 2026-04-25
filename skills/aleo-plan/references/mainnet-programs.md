# Aleo mainnet — verified-live programs

> **A snapshot of deployed on-chain programs your dApp may interact with.**
>
> These are not "vendor choices" — they're immutable on-chain facts. If you
> want to interact with USDCx on Aleo mainnet, there is exactly one program
> ID. You can't swap to a different USDCx provider.
>
> **Last verified:** 2026-04-25 against
> `https://api.explorer.provable.com/v1/mainnet/program/<name>` — all entries
> below returned HTTP 200 at verification time.

This is **not exhaustive**. Aleo's mainnet has many more deployed programs;
this doc lists the ones a builder of a privacy-preserving payments, identity,
or DeFi app is most likely to need. To find more, see the "How to discover"
section at the bottom.

---

## 1. Aleo-native infrastructure

These are part of the chain itself. They use the **same program ID on testnet
and mainnet** — no `test_` prefix.

| Program ID | Purpose |
|------------|---------|
| `credits.aleo` | Native ALEO token — fee payment, public/private credit transfers, `transfer_*` family of 7 transitions. The token your gas is paid in. |
| `token_registry.aleo` | Multi-token standard. Hosts arbitrary tokens identified by `token_id: field`. ARC-21-style. 22 functions: `register_token`, `mint_*`, `burn_*`, `transfer_*` (×7 variants), `join`, `split`, `approve_public`, etc. |
| `merkle_tree.aleo` | Merkle proof primitives used by compliance contracts (USDCx/USAD freezelists). |

---

## 2. Standalone fiat-backed stablecoins

Issuer-owned programs. Each issuer ships **3 cooperating programs** —
the stablecoin itself plus a freezelist (compliance) and a multisig core
(admin). They do NOT route through `token_registry.aleo`.

### USDCx — Circle-issued (mainnet stablecoin)

| Program ID | Purpose |
|------------|---------|
| `usdcx_stablecoin.aleo` | Main token contract. 8 transfer variants (public/private/public-to-private/etc.), `mint_*`, `burn_*`, `approve_public`. Amounts are `u128`. |
| `usdcx_freezelist.aleo` | Maintains the compliance freeze list. Private transfers require Merkle non-membership proofs. |
| `usdcx_multisig_core.aleo` | Admin / governance multisig. |

Testnet variants prefix all three with `test_` (e.g., `test_usdcx_stablecoin.aleo`).

### USAD — Paxos-issued (mainnet stablecoin)

| Program ID | Purpose |
|------------|---------|
| `usad_stablecoin.aleo` | Main token contract. Mirror of `usdcx_stablecoin.aleo` — same 8 transfer functions, same record types, same compliance hooks. |
| `usad_freezelist.aleo` | Compliance freeze list. |
| `usad_multisig_core.aleo` | Admin multisig. |

Testnet variants prefix all three with `test_`.

---

## 3. Bridges

| Program ID | Purpose |
|------------|---------|
| `vlink_token_service_v1.aleo` | Verulink ETH↔Aleo bridge controller. Mints `vUSDC`, `vUSDT`, `vETH` on the Aleo side (registered through `token_registry.aleo` — see section 5). |

---

## 4. Liquid staking — Pondo (5 programs)

| Program ID | Purpose |
|------------|---------|
| `pondo_protocol.aleo` | Top-level Pondo entry point. |
| `pondo_oracle.aleo` | Validator/delegation rate oracle. |
| `pondo_token.aleo` | The Pondo native PNDO token. |
| `pondo_core_protocol.aleo` | Core protocol logic. |
| `paleo_token.aleo` | The pALEO liquid-staked ALEO token. |

The pALEO token also has a **separate** registered entry in
`token_registry.aleo` (see section 5). Pondo's protocol surface spans both
its own programs and the registry.

---

## 5. Tokens registered through `token_registry.aleo`

These are not separate programs — they're entries in `token_registry.aleo`'s
`registered_tokens` mapping. To interact with them, call
`token_registry.aleo::transfer_*` and pass the `token_id` field-element.

All 4 entries below verified live (HTTP 200 at lookup time).

| Symbol (registry name / symbol u128) | token_id | Decimals | Issuer admin | Notes |
|---|---|---|---|---|
| **ALEO** (Pondo pALEO) | `3443843282313283355522573239085696902919850365217539366784739393210722344986field` | 6 | `aleo1tjkv7vquk6yldxz53ecwsy5csnun43rfaknpkjc97v5223dlnyxsglv7nm` | Liquid-staked ALEO. Registry stores name/symbol both as `1095517519u128` = ASCII `"ALEO"`. |
| **vUSDC** | `6088188135219746443092391282916151282477828391085949070550825603498725268775field` | 6 | `aleo199ts3h95xl7mvwzy3empcxdnhrw675wvehru0yy8jyaezrydruysl9ylel` (Verulink) | Bridged USDC. name=`"VUSDC"`, symbol=`"vUSDC"`. |
| **vUSDT** | `7311977476241952331367670434347097026669181172395481678807963832961201831695field` | 6 | Verulink (same admin) | Bridged USDT. |
| **vETH** | `1381601714105276218895759962490543360839827276760458984912661726715051428034field` | 18 | Verulink (same admin) | Bridged ETH. |

### Encoding gotcha

The `name` and `symbol` fields in `TokenMetadata` are stored as `u128`
integers but represent ASCII strings interpreted as **big-endian** bytes:

```python
# Decode: name=1095517519
hex(1095517519) == '0x414c454f'
# bytes: 0x41 0x4c 0x45 0x4f → "ALEO"
```

When integrating in TypeScript, decode by writing the integer as 16-byte
big-endian and stripping leading zeros, then interpreting as ASCII.

---

## 6. DeFi & utility

| Program ID | Purpose |
|------------|---------|
| `arcn_pool_v2_2_2.aleo` | Arcane Finance DEX pool (v2.2.2). The main on-chain swap venue on Aleo mainnet. |
| `ans_registrar.aleo` | Aleo Name Service registrar. Maps human-readable names to addresses. |

(Arcane has additional programs — routers, factories — that I have not yet
verified on mainnet by the curl recipe below. Add them here as you confirm.)

---

## How to discover more programs

The Provable explorer **does not expose a "list all programs" endpoint**.
There's no public global directory. To find programs:

### Verify a candidate program exists

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://api.explorer.provable.com/v1/mainnet/program/<name>"
# 200 = deployed, 404 = not deployed
```

### Read a program's bytecode

```bash
curl -s "https://api.explorer.provable.com/v1/mainnet/program/<name>" \
  | python3 -c "import json,sys; print(json.load(sys.stdin))"
```

The response is the AVM bytecode source as a single string. Look for `import`,
`record`, `mapping`, `function` lines.

### Enumerate token_registry entries

There is no "list keys" endpoint for mappings. To discover more registered
tokens:

1. Scan `register_token` transitions:
   ```
   https://api.explorer.provable.com/v1/mainnet/program/token_registry.aleo/transitions?function=register_token&edition=<n>
   ```
   (Requires `edition` query param; bare call returns 400.)
2. Pull token_ids from each transition's inputs.
3. Verify with `curl .../mapping/registered_tokens/<id>field`.

### Browse the explorer UI

- https://explorer.provable.com/program/<name>
- https://aleoscan.io/program?id=<name> (returns 403 to curl, loads in browser)

---

## How to use this for app design

When `/aleo-plan` Q4 surfaces "do you import other programs," cross-reference
this list:

| If the app needs... | Likely import |
|---------------------|---------------|
| Pay/receive ALEO | `credits.aleo` |
| Generic multi-token support | `token_registry.aleo` (one import covers pALEO, vUSDC, vUSDT, vETH, plus any future registered token) |
| Specifically Circle USDCx on mainnet | `usdcx_stablecoin.aleo` (standalone — separate import) |
| Specifically Paxos USAD on mainnet | `usad_stablecoin.aleo` (standalone) |
| ETH/USDC/USDT bridged from Ethereum | `token_registry.aleo` with the matching `vETH`/`vUSDC`/`vUSDT` token_id |
| Stake / yield on ALEO | Pondo programs + the registered ALEO token_id |
| Trade between tokens | `arcn_pool_v2_2_2.aleo` |
| Resolve human-readable names | `ans_registrar.aleo` |

Two parallel token universes (registry + standalone) means a comprehensive
payments app may need **both** — the registry for one set of tokens, and
direct standalone-program imports for USDCx/USAD.

---

## Maintenance

This file is a **time-stamped snapshot**, not a live registry. Treat it as
a starting point and re-verify before relying on any specific entry:

```bash
# One-liner to re-verify everything in this file
for prog in credits.aleo token_registry.aleo merkle_tree.aleo \
  usdcx_stablecoin.aleo usdcx_freezelist.aleo usdcx_multisig_core.aleo \
  usad_stablecoin.aleo usad_freezelist.aleo usad_multisig_core.aleo \
  vlink_token_service_v1.aleo \
  pondo_protocol.aleo pondo_oracle.aleo pondo_token.aleo paleo_token.aleo pondo_core_protocol.aleo \
  ans_registrar.aleo arcn_pool_v2_2_2.aleo; do
  code=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://api.explorer.provable.com/v1/mainnet/program/$prog")
  echo "  $code  $prog"
done
```

PRs welcome to add newly-discovered programs, with verification timestamps.
