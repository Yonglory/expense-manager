-- Expense Manager: run this whole file once in Supabase > SQL Editor.

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  animal text not null default 'bunny' check (animal in ('bunny','bear','cat','lamb')),
  household_id uuid not null references public.households(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  kind text not null check (kind in ('in','out')),
  name text not null,
  amount numeric not null default 0 check (amount >= 0),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists items_household_month_idx on public.items (household_id, month);

-- Which household does the signed-in user belong to?
create or replace function public.my_household()
returns uuid language sql stable security definer set search_path = public as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- Called right after sign-up/sign-in to create the profile and the household (or join one by code).
create or replace function public.setup_profile(p_name text, p_animal text, p_join_code text default null)
returns void language plpgsql security definer set search_path = public as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from profiles where id = auth.uid()) then return; end if;
  if p_join_code is not null and length(trim(p_join_code)) > 0 then
    select id into hid from households where code = upper(trim(p_join_code));
    if hid is null then raise exception 'Family code not found'; end if;
  else
    insert into households (name, code)
    values (coalesce(nullif(trim(p_name), ''), 'Our') || '''s household',
            'HOME-' || upper(substr(md5(gen_random_uuid()::text), 1, 5)))
    returning id into hid;
  end if;
  insert into profiles (id, display_name, animal, household_id)
  values (auth.uid(), coalesce(nullif(trim(p_name), ''), 'Friend'),
          case when p_animal in ('bunny','bear','cat','lamb') then p_animal else 'bunny' end, hid);
end $$;
grant execute on function public.setup_profile(text, text, text) to authenticated;

alter table public.households enable row level security;
alter table public.profiles  enable row level security;
alter table public.items     enable row level security;

drop policy if exists "household: read own" on public.households;
create policy "household: read own" on public.households
  for select to authenticated using (id = public.my_household());

drop policy if exists "profiles: read household" on public.profiles;
create policy "profiles: read household" on public.profiles
  for select to authenticated using (household_id = public.my_household() or id = auth.uid());

drop policy if exists "profiles: update self" on public.profiles;
create policy "profiles: update self" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "items: household all" on public.items;
create policy "items: household all" on public.items
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

-- Live updates between family phones.
do $$ begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null; end $$;

-- Newer Supabase projects need explicit grants before the app can read these tables.
grant usage on schema public to authenticated;
grant select on public.households to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.items to authenticated;
