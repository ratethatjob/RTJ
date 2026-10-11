-- Map search calls per day (Google Places and OpenStreetMap), to keep an eye on the monthly
-- Google budget. Written by the server (service role), shown on the admin Metrics tab.

create table public.places_usage (
  day date not null default current_date,
  provider text not null check (provider in ('google', 'osm')),
  kind text not null check (kind in ('autocomplete', 'details')),
  calls int not null default 0,
  primary key (day, provider, kind)
);
alter table public.places_usage enable row level security;

create function public.record_places_call(p_provider text, p_kind text) returns void
language sql security definer
set search_path = '' as $$
  insert into public.places_usage (day, provider, kind, calls)
  values (current_date, p_provider, p_kind, 1)
  on conflict (day, provider, kind) do update set calls = public.places_usage.calls + 1
$$;
revoke execute on function public.record_places_call(text, text) from public, anon, authenticated;
grant execute on function public.record_places_call(text, text) to service_role;

-- Admin: calls per month (this and the two before), provider and kind.
create function public.admin_places_usage()
returns table (month date, provider text, kind text, calls bigint)
language plpgsql stable security definer
set search_path = '' as $$
begin
  perform private.require_admin();
  return query
  select date_trunc('month', u.day)::date, u.provider, u.kind, sum(u.calls)::bigint
  from public.places_usage u
  where u.day >= (date_trunc('month', now()) - interval '2 months')::date
  group by 1, 2, 3
  order by 1 desc, 2, 3;
end $$;
revoke execute on function public.admin_places_usage() from public, anon;
grant execute on function public.admin_places_usage() to authenticated;
