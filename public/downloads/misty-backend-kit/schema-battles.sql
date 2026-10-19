-- Battles · Postgres schema · kit v1.2 (19 October 2026). Extends schema.sql; money in cents; credit in whole units.

-- one row per site: what the admin panel configures
create table battle_settings (
  id                        smallint primary key default 1 check (id = 1),
  enabled                   boolean not null default false,
  modes_allowed             text[] not null default array['normal','crazy','terminal'],
  seats_allowed             smallint[] not null default array[2,3,4],
  rounds_max                smallint not null default 10 check (rounds_max between 1 and 50),
  eligible_box_slugs        text[] not null default array[]::text[],
  fee_percent               numeric(5,2) not null default 0 check (fee_percent between 0 and 20),
  coinflip_edge             numeric(5,4) not null default 0 check (coinflip_edge between 0 and 0.10),
  open_expiry_minutes       smallint not null default 30,
  countdown_seconds         smallint not null default 5,
  private_allowed           boolean not null default true,
  bots_enabled              boolean not null default false,
  bot_label                 text not null default 'House bot',
  max_concurrent_per_player smallint not null default 3,
  credit_face_cents         integer not null default 100,
  updated_by                text,
  updated_at                timestamptz not null default now()
);
insert into battle_settings (id) values (1) on conflict do nothing;

-- the admin's bot list: a name and a picture, nothing else (no odds, no behaviour)
create table battle_bots (
  id          smallserial primary key,
  name        text not null,
  avatar_url  text,
  enabled     boolean not null default true
);

create type battle_status as enum ('open','full','in_progress','settling','finished','cancelled','expired');
create type battle_mode as enum ('normal','crazy','terminal','jackpot','group','break','coinflip');

create table battles (
  id                 uuid primary key default gen_random_uuid(),
  status             battle_status not null default 'open',
  version            integer not null default 0,           -- bumped on every transition; the optimistic lock
  mode               battle_mode not null,
  seats              smallint not null check (seats between 2 and 16),
  -- the rounds, pinned at creation: [{ "slug": "...", "tableHash": "...", "bonusHash": "...", "priceCents": 1000 }]
  rounds             jsonb not null,
  rounds_count       smallint not null check (rounds_count between 0 and 50),
  entry_cents        integer not null check (entry_cents >= 0),   -- per seat: sum of round prices
  fee_percent        numeric(5,2) not null default 0,
  coinflip_edge      numeric(5,4) not null default 0,
  credit_face_cents  integer not null default 100,
  is_private         boolean not null default false,
  invite_code        text unique,
  sponsored          boolean not null default false,       -- entries paid by the house (ledger battle-sponsor)
  sponsor            text,                                 -- shown as "Sponsored by ..."
  created_by         uuid not null references players(id),
  -- commitment
  server_seed_enc    bytea not null,                        -- CSPRNG 32 bytes, encrypted; decrypt only to resolve
  server_hash        text not null,                         -- sha256(hex seed), shown before any seat is taken
  -- result (filled at settling)
  pot_cents          integer,
  winners            smallint[],
  shares_cents       integer[],
  tied_seats         smallint[],
  extra_nonce        integer,
  extra_digest       text,
  extra_roll         double precision,
  -- timeline
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null,                  -- open battles expire here
  full_at            timestamptz,
  starts_at          timestamptz,                           -- full_at + countdown
  started_at         timestamptz,
  settled_at         timestamptz,
  revealed_at        timestamptz,
  cancelled_at       timestamptz,
  cancel_reason      text
);
create index on battles (status, created_at desc);
create index on battles (created_by, created_at desc);
create index on battles (expires_at) where status = 'open';
create index on battles (starts_at) where status = 'full';

create table battle_seats (
  battle_id          uuid not null references battles(id),
  seat               smallint not null,
  player_id          uuid references players(id),           -- null for a bot
  is_bot             boolean not null default false,
  bot_id             smallint references battle_bots(id),
  client_seed        text not null,
  client_seed_source text not null check (client_seed_source in ('player','server-default','bot')),
  hold_ledger_id     bigint references credit_ledger(id),   -- the battle-entry hold
  idempotency_key    text unique,
  joined_at          timestamptz not null default now(),
  left_at            timestamptz,
  primary key (battle_id, seat),
  unique (battle_id, player_id)                             -- one seat per player per battle (nulls allowed for bots)
);

create table battle_pulls (
  battle_id    uuid not null references battles(id),
  round        smallint not null,
  seat         smallint not null,
  nonce        integer not null,
  digest       text not null,
  roll         double precision not null,
  outcome_id   uuid not null references outcomes(id),
  kind         text not null check (kind in ('item','credit','bonus')),
  value_cents  integer not null,
  credits      integer not null default 0,
  award_id     uuid references item_awards(id),              -- set at settling for item pulls
  primary key (battle_id, round, seat)
);

create table battle_events (
  id          bigserial primary key,
  battle_id   uuid not null references battles(id),
  at          timestamptz not null default now(),
  actor       text not null,                                 -- player id, 'server', 'admin:<id>'
  event       text not null,                                 -- created | joined | left | full | countdown | started | round | settled | finished | cancelled | expired
  from_status battle_status,
  to_status   battle_status,
  data        jsonb
);
create index on battle_events (battle_id, id);

-- ledger reasons used by battles (extend the check in schema.sql); ref_type = 'battle', ref_id = the battle id:
--   'battle-entry' (hold, negative), 'battle-refund' (positive), 'battle-win' (positive),
--   'battle-fee' (negative, house), 'battle-sponsor' (negative, house account, the whole cost of a sponsored battle)
-- item_awards: an item won in a battle has no open; it points at the battle instead
alter table item_awards alter column open_id drop not null;
alter table item_awards add column if not exists battle_id uuid references battles(id);
alter table item_awards add constraint item_awards_source check ((open_id is null) <> (battle_id is null));

-- reports: battles played and gross gaming revenue per day and mode, player money only (bots and sponsors excluded)
create view battle_daily_report as
with money as (
  select l.ref_id as battle_id,
         sum(case when l.reason = 'battle-entry'  then -l.delta else 0 end) as entries_credits,
         sum(case when l.reason = 'battle-refund' then  l.delta else 0 end) as refunds_credits,
         sum(case when l.reason = 'battle-win'    then  l.delta else 0 end) as wins_credits
  from credit_ledger l where l.ref_type = 'battle' group by l.ref_id
), items as (
  select a.battle_id, sum(a.value_cents) as items_cents from item_awards a where a.battle_id is not null group by a.battle_id
)
select date_trunc('day', b.settled_at)                                                  as day,
       b.mode,
       count(*)                                                                         as battles,
       count(*) filter (where b.sponsored)                                              as sponsored_battles,
       count(*) filter (where exists (select 1 from battle_seats x where x.battle_id = b.id and x.is_bot)) as battles_with_bots,
       coalesce(sum((m.entries_credits - m.refunds_credits) * b.credit_face_cents), 0)   as player_entries_cents,
       coalesce(sum(m.wins_credits * b.credit_face_cents), 0)                            as credit_paid_cents,
       coalesce(sum(i.items_cents), 0)                                                  as items_paid_cents,
       coalesce(sum((m.entries_credits - m.refunds_credits - m.wins_credits) * b.credit_face_cents), 0)
         - coalesce(sum(i.items_cents), 0)                                              as ggr_cents
from battles b
left join money m on m.battle_id = b.id
left join items i on i.battle_id = b.id
where b.status = 'finished'
group by 1, 2;

-- a player's battle history (joins single opens in the game-history screen)
create view battle_history as
select s.player_id, b.id as battle_id, b.mode, b.status, b.settled_at, s.seat,
       (s.seat = any (b.winners)) as won,
       coalesce(b.shares_cents[s.seat + 1], 0) as share_cents,
       (select sum(p.value_cents) from battle_pulls p where p.battle_id = b.id and p.seat = s.seat) as pulled_cents
from battle_seats s join battles b on b.id = s.battle_id
where s.player_id is not null;
