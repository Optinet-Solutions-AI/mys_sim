-- Misty-style mystery box backend · Postgres schema · kit v1.1 (14 October 2026)
-- Money in cents. Credit in whole units (integer). The hashed table JSON is stored as is. All timestamps UTC.

create extension if not exists pgcrypto;

-- ---------- catalogue ----------
create table boxes (
  slug              text primary key,
  name              text not null,
  tagline           text,
  price_cents       integer not null check (price_cents >= 0),
  currency          text not null default 'USD',
  trade_in_percent  smallint not null default 90 check (trade_in_percent between 0 and 100),
  active            boolean not null default true,
  current_table_id  uuid,            -- fk added below
  current_bonus_id  uuid,            -- fk added below
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- an outcome is a thing a box can pay; it belongs to a box and keeps its id across table versions
create table outcomes (
  id            uuid primary key default gen_random_uuid(),
  box_slug      text not null references boxes(slug),
  label         text not null,
  rarity        text not null,                     -- common | uncommon | rare | epic | legendary | grail | bonus
  kind          text not null check (kind in ('item','credit','bonus')),   -- bonus = credit plus free spins
  credits       integer not null default 0,        -- whole credits paid by this outcome (0 for items)
  free_spins    smallint not null default 0 check (free_spins between 0 and 3),
  value_cents   integer,                           -- listed value for items; null for credit
  brand         text,
  category      text,                              -- watch | bag | ... (the main site's taxonomy)
  image_url     text,
  sort_order    integer not null default 0,
  check ((kind = 'item' and value_cents is not null) or (kind <> 'item' and value_cents is null)),
  check (kind <> 'bonus' or free_spins >= 1)
);
create index on outcomes (box_slug);

-- a table version is an immutable snapshot of percents for every outcome of a box; its hash is pinned on every open.
-- entries is the exact JSON array that was hashed: canonicalJson({slug, price (dollars), table: entries}).
-- Never round it and never rebuild it from a numeric column; what is stored is what was hashed.
create table box_tables (
  id            uuid primary key default gen_random_uuid(),
  box_slug      text not null references boxes(slug),
  version       integer not null,
  table_hash    text not null unique,              -- sha256(canonicalJson({slug, price, table:[{id, percent}]}))
  price_cents   integer not null,                  -- price at the time; the hash uses price_cents / 100
  entries       jsonb not null,                    -- ordered [{ "id": outcomeId, "percent": 30.83042011764706 }, ...]
  percent_sum   double precision not null check (abs(percent_sum - 100) < 0.000001),
  note          text,
  created_by    text not null,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  retired_at    timestamptz,
  unique (box_slug, version)
);

-- the free-spin table, versioned the same way. bonus_hash = sha256(canonicalJson({slug, bonus: entries})).
create table bonus_tables (
  id            uuid primary key default gen_random_uuid(),
  box_slug      text not null references boxes(slug),
  version       integer not null,
  bonus_hash    text not null unique,
  entries       jsonb not null,                    -- ordered [{ "credits": 1, "percent": 70 }, ...] exactly as hashed
  created_by    text not null,
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  unique (box_slug, version)
);

alter table boxes add constraint boxes_current_table_fk foreign key (current_table_id) references box_tables(id);
alter table boxes add constraint boxes_current_bonus_fk foreign key (current_bonus_id) references bonus_tables(id);

-- every activation is published; the public log is this table, read-only
create table table_publication_log (
  id            bigserial primary key,
  box_slug      text not null references boxes(slug),
  table_hash    text not null,
  bonus_hash    text,
  segment_id    uuid,                              -- null = everyone
  published_at  timestamptz not null default now()
);

-- ---------- players and segments ----------
create table segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  note        text,
  created_at  timestamptz not null default now()
);

-- a segment may override the table of a box; the hash pinned on an open is always the table actually used
create table segment_tables (
  segment_id  uuid not null references segments(id),
  box_slug    text not null references boxes(slug),
  table_id    uuid not null references box_tables(id),
  primary key (segment_id, box_slug)
);

create table players (
  id            uuid primary key default gen_random_uuid(),
  external_id   text not null unique,              -- the `sub` of the main site's JWT
  segment_id    uuid references segments(id),
  created_at    timestamptz not null default now()
);

-- ---------- opens ----------
create type open_status as enum ('created', 'paid', 'resolved', 'expired', 'cancelled');

create table opens (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references players(id),
  box_slug           text not null references boxes(slug),
  table_id           uuid not null references box_tables(id),
  table_hash         text not null,
  bonus_id           uuid references bonus_tables(id),
  bonus_hash         text,
  price_cents        integer not null,
  status             open_status not null default 'created',
  -- commitment
  server_seed_enc    bytea not null,                -- 32 random bytes, encrypted at rest; decrypt only to resolve
  server_hash        text not null,                 -- sha256(hex(server_seed)), shown before payment
  client_seed        text,
  client_seed_source text check (client_seed_source in ('player','server-default')),
  nonce_start        integer not null default 1,
  -- payment
  paid_at            timestamptz,
  payment_ref        text,                          -- provider charge id or 'credits'
  idempotency_key    text unique,
  -- result
  digest             text,
  roll               double precision,              -- [0,1)
  outcome_id         uuid references outcomes(id),
  credits_awarded    integer not null default 0,    -- outcome credits + bonus credits
  resolved_at        timestamptz,
  revealed_at        timestamptz,
  expires_at         timestamptz not null,
  created_at         timestamptz not null default now()
);
create index on opens (player_id, created_at desc);
create index on opens (box_slug, created_at desc);
create index on opens (table_hash);

create table bonus_spins (
  open_id    uuid not null references opens(id),
  nonce      integer not null,
  digest     text not null,
  roll       double precision not null,
  credits    integer not null,
  primary key (open_id, nonce)
);

-- ---------- awards, shipping and credit ----------
create type award_status as enum ('awarded', 'shipping', 'shipped', 'traded', 'cancelled');

create table item_awards (
  id               uuid primary key default gen_random_uuid(),
  open_id          uuid not null unique references opens(id),
  player_id        uuid not null references players(id),
  outcome_id       uuid not null references outcomes(id),
  value_cents      integer not null,
  status           award_status not null default 'awarded',
  trade_in_percent smallint not null,              -- the box's rate at award time
  trade_in_credits integer not null,               -- round(value_cents * trade_in_percent / 100 / 100)
  traded_at        timestamptz,
  shipped_at       timestamptz,
  created_at       timestamptz not null default now()
);

-- one row per ship request; fulfilment (carrier, label, insurance) is the main site's
create table award_shipments (
  id           uuid primary key default gen_random_uuid(),
  award_id     uuid not null unique references item_awards(id),
  address      jsonb not null,                     -- { name, line1, line2, city, region, postalCode, country, phone }
  fee_cents    integer not null default 0,
  carrier      text,
  tracking     text,
  status       text not null default 'requested' check (status in ('requested','label','shipped','delivered','cancelled')),
  requested_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- append-only; balance is the sum; never negative
create table credit_ledger (
  id          bigserial primary key,
  player_id   uuid not null references players(id),
  delta       integer not null,
  reason      text not null check (reason in ('box-award','bonus-award','trade-in','box-payment','product-payment','welcome','adjustment')),
  ref_type    text,                                -- 'open' | 'award' | 'order' | 'admin'
  ref_id      uuid,
  created_at  timestamptz not null default now()
);
create index on credit_ledger (player_id, id);

create or replace function credit_balance(p uuid) returns bigint language sql stable as $$
  select coalesce(sum(delta), 0) from credit_ledger where player_id = p
$$;

-- ---------- audit ----------
create table admin_audit (
  id          bigserial primary key,
  actor       text not null,
  action      text not null,                       -- 'box.upsert' | 'table.create' | 'table.activate' | 'segment.assign' | ...
  subject     text not null,
  before      jsonb,
  after       jsonb,
  created_at  timestamptz not null default now()
);
