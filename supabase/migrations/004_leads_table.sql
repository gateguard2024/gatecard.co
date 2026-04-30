-- ── leads table — property manager demo requests from gatecard.co/get-started
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null,
  phone         text,
  property_name text not null,
  units         integer,
  city          text,
  source        text,
  status        text not null default 'new'  -- new | contacted | demo_scheduled | closed
                check (status in ('new','contacted','demo_scheduled','closed','lost')),
  notes         text,
  created_at    timestamptz not null default now()
);

-- Service role only — no public access to leads
alter table leads enable row level security;
