-- Expense Manager: recurring bills, shopping list, and actual-vs-planned amounts.
-- Run this once in Supabase > SQL Editor (after schema.sql). Safe to run again.

-- 1) Recurring bills
create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount numeric not null default 0 check (amount >= 0),
  due_day int not null check (due_day between 1 and 31),
  remind_days_before int not null default 3 check (remind_days_before between 0 and 14),
  active boolean not null default true,
  start_month text not null check (start_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  created_at timestamptz not null default now()
);
create index if not exists bills_household_idx on public.bills (household_id);

-- 2) Items: actual amount, due day, and the bill they came from
alter table public.items add column if not exists actual numeric check (actual is null or actual >= 0);
alter table public.items add column if not exists due_day int;
alter table public.items add column if not exists bill_id uuid references public.bills(id) on delete set null;
create unique index if not exists items_bill_month_uq on public.items (bill_id, month);

-- Creates this month's items for every active bill (runs when a month is opened).
create or replace function public.ensure_month_bills(p_month text)
returns void language sql security invoker set search_path = public as $$
  insert into public.items (household_id, month, kind, name, amount, bill_id, due_day)
  select b.household_id, p_month, 'out', b.name, b.amount, b.id, b.due_day
  from public.bills b
  where b.household_id = public.my_household() and b.active and b.start_month <= p_month
  on conflict (bill_id, month) do nothing;
$$;
grant execute on function public.ensure_month_bills(text) to authenticated;

-- 3) Shopping list
create table if not exists public.shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  category text not null default 'Groceries' check (category in ('Groceries','Household','Baby','Other')),
  est_price numeric not null default 0 check (est_price >= 0),
  done boolean not null default false,
  archived boolean not null default false,
  added_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists shopping_household_idx on public.shopping_items (household_id, archived);

-- Security: everyone in a household can see and change its bills and shopping list.
alter table public.bills enable row level security;
alter table public.shopping_items enable row level security;

drop policy if exists "bills: household all" on public.bills;
create policy "bills: household all" on public.bills
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

drop policy if exists "shopping: household all" on public.shopping_items;
create policy "shopping: household all" on public.shopping_items
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

grant select, insert, update, delete on public.bills to authenticated;
grant select, insert, update, delete on public.shopping_items to authenticated;

-- Live updates between family phones.
do $$ begin
  alter publication supabase_realtime add table public.bills;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.shopping_items;
exception when duplicate_object then null; end $$;
