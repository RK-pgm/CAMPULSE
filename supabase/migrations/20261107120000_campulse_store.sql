create table if not exists public.campulse_store (
  id text primary key check (id = 'main'),
  store jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.campulse_store_lock (
  id text primary key check (id = 'main'),
  token text not null,
  expires_at timestamptz not null
);

alter table public.campulse_store enable row level security;
alter table public.campulse_store_lock enable row level security;

revoke all on table public.campulse_store from anon, authenticated;
revoke all on table public.campulse_store_lock from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.campulse_store to service_role;
grant select, insert, update, delete on table public.campulse_store_lock to service_role;

create or replace function public.campulse_acquire_lock(p_token text, p_ttl_ms integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  insert into public.campulse_store_lock (id, token, expires_at)
  values ('main', p_token, pg_catalog.now() + pg_catalog.make_interval(secs => p_ttl_ms::double precision / 1000.0))
  on conflict (id) do update
    set token = excluded.token,
        expires_at = excluded.expires_at
    where public.campulse_store_lock.expires_at < pg_catalog.now();

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

create or replace function public.campulse_release_lock(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_rows integer;
begin
  delete from public.campulse_store_lock
  where id = 'main' and token = p_token;

  get diagnostics affected_rows = row_count;
  return affected_rows = 1;
end;
$$;

revoke all on function public.campulse_acquire_lock(text, integer) from public, anon, authenticated;
revoke all on function public.campulse_release_lock(text) from public, anon, authenticated;
grant execute on function public.campulse_acquire_lock(text, integer) to service_role;
grant execute on function public.campulse_release_lock(text) to service_role;
