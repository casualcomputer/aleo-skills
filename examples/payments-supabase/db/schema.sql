-- ----------------------------------------------------------------------------
-- Schema for the off-chain side of architecture-payments.md
-- (one specific implementation in Supabase Postgres)
--
-- Design notes:
--   - The `commitment` (BHP256 field-element hash) is the primary key. It is
--     the only thing the chain knows about a given invoice.
--   - The encrypted invoice blob is bytea. Encryption is AES-256-GCM done
--     client-side via WebCrypto. The DB never sees plaintext.
--   - `wrapped_keys` is a JSONB array of { recipient_view_key_hint, ciphertext }
--     entries. The "hint" is a non-sensitive identifier (e.g., a hash) that
--     lets a client find their wrapped key without scanning all entries.
--   - We do NOT use RLS keyed on merchant address — that would re-leak the
--     merchant↔invoice relationship to anyone watching the DB. Anyone can
--     read a row by commitment; only those holding a matching view key can
--     decrypt the blob.
--   - The chain is the source of truth for `status`. The `status_cache`
--     column is just a denormalized convenience for UI, refreshed by an
--     indexer or webhook listening to chain events.
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists invoices (
  commitment            text         primary key,         -- BHP256 hash, hex-encoded
  ciphertext            bytea        not null,            -- AES-256-GCM(plaintext_blob)
  iv                    bytea        not null,            -- 12-byte nonce for AES-GCM
  aead_tag_included     boolean      not null default true,
  wrapped_keys          jsonb        not null,            -- [{ hint, ciphertext }, ...]
  status_cache          smallint     not null default 0,  -- 0=Pending 1=Paid 2=Cancelled (mirrors chain)
  status_cache_updated  timestamptz  not null default now(),
  created_at            timestamptz  not null default now()
);

-- Public read by commitment is fine — the row reveals nothing without view keys.
alter table invoices enable row level security;

create policy invoices_public_read
  on invoices for select
  using (true);

-- Writes are restricted to authenticated server roles. Production deployments
-- should use a service role key from a backend, not the public anon key.
create policy invoices_authenticated_insert
  on invoices for insert
  to authenticated, service_role
  with check (true);

create policy invoices_service_status_update
  on invoices for update
  to service_role
  using (true)
  with check (true);

-- ----------------------------------------------------------------------------
-- Optional: merchant directory.
-- This table IS keyed on merchant address because the merchant has chosen
-- to be discoverable. RLS here is fine because the address is deliberately
-- public.
-- ----------------------------------------------------------------------------

create table if not exists merchant_profiles (
  address       text         primary key,    -- aleo1... bech32
  display_name  text         not null,
  description   text,
  created_at    timestamptz  not null default now()
);

alter table merchant_profiles enable row level security;

create policy merchant_profiles_public_read
  on merchant_profiles for select
  using (true);

create policy merchant_profiles_self_write
  on merchant_profiles for all
  using (address = current_setting('request.jwt.claims', true)::jsonb->>'aleo_address')
  with check (address = current_setting('request.jwt.claims', true)::jsonb->>'aleo_address');
