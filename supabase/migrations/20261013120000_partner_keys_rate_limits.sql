-- Map place → workplace (lib/place-ensure.ts):
-- * Durable limits: hit_rate_limit() counts in the database per key and fixed window, so the
--   limits hold across server instances (the in-memory counter counted per instance).
-- * Partner keys: a trusted importer (e.g. a bot adding workplaces through /app/rate) sends its key
--   in the X-RTJ-Partner-Key header; with a valid key the per-IP and the all-visitors limits don't
--   apply, only the key's own hourly ceiling. Only the SHA-256 hash is stored; the key is shown once
--   in the admin "Partner keys" tab when it is created. Workplaces it creates get
--   created_via = 'partner' and partner_key_id. Admins list and revoke keys.

create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);
alter table public.rate_limits enable row level security;

-- One hit; true when the key is over p_limit in the current window of p_window_s seconds.
create or replace function public.hit_rate_limit(p_key text, p_limit int, p_window_s int)
returns boolean
language plpgsql security definer
set search_path = '' as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  n int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into n;
  -- Now and then, old windows go.
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '2 days';
  end if;
  return n > p_limit;
end $$;
revoke all on function public.hit_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function public.hit_rate_limit(text, int, int) to service_role;

create table if not exists public.partner_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  key_hash text not null unique,
  hourly_limit int not null default 1000 check (hourly_limit between 1 and 100000),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  uses int not null default 0
);
alter table public.partner_keys enable row level security;

alter table public.locations add column if not exists partner_key_id uuid references public.partner_keys (id) on delete set null;

-- The key behind a hash, when active (service role); counts the use.
create or replace function public.partner_key_use(p_hash text)
returns table (id uuid, name text, hourly_limit int)
language sql security definer
set search_path = '' as $$
  update public.partner_keys k set last_used_at = now(), uses = k.uses + 1
  where k.key_hash = p_hash and k.revoked_at is null
  returning k.id, k.name, k.hourly_limit
$$;
revoke all on function public.partner_key_use(text) from public, anon, authenticated;
grant execute on function public.partner_key_use(text) to service_role;

-- Admin: list, create (the app makes the key and sends only its hash), revoke.
create or replace function public.admin_partner_keys()
returns table (id uuid, name text, hourly_limit int, created_at timestamptz, revoked_at timestamptz,
               last_used_at timestamptz, uses int, workplaces bigint)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select k.id, k.name, k.hourly_limit, k.created_at, k.revoked_at, k.last_used_at, k.uses,
         (select count(*) from public.locations l where l.partner_key_id = k.id)
  from public.partner_keys k order by k.revoked_at nulls first, k.created_at desc;
end $$;
revoke all on function public.admin_partner_keys() from public, anon;
grant execute on function public.admin_partner_keys() to authenticated;

create or replace function public.admin_create_partner_key(p_name text, p_hash text, p_hourly_limit int default 1000)
returns uuid
language plpgsql security definer
set search_path = '' as $$
declare k uuid;
begin
  perform private.require_admin();
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid hash' using errcode = '22023'; end if;
  insert into public.partner_keys (name, key_hash, hourly_limit, created_by)
  values (btrim(p_name), p_hash, p_hourly_limit, (select auth.uid()))
  returning id into k;
  return k;
end $$;
revoke all on function public.admin_create_partner_key(text, text, int) from public, anon;
grant execute on function public.admin_create_partner_key(text, text, int) to authenticated;

create or replace function public.admin_revoke_partner_key(p_id uuid)
returns void
language plpgsql security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  update public.partner_keys set revoked_at = coalesce(revoked_at, now()) where id = p_id;
end $$;
revoke all on function public.admin_revoke_partner_key(uuid) from public, anon;
grant execute on function public.admin_revoke_partner_key(uuid) to authenticated;
