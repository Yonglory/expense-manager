-- Expense Manager: custom shopping categories. Run once in Supabase > SQL Editor (after migration-002). Safe to run again.

-- Categories are now stored by name, so the fixed list of allowed values goes away.
alter table public.shopping_items drop constraint if exists shopping_items_category_check;
update public.shopping_items set category = 'Others' where category = 'Other';

create table if not exists public.shopping_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  color text not null default '#AFA9EC',
  created_at timestamptz not null default now(),
  unique (household_id, name)
);
create index if not exists shopping_categories_household_idx on public.shopping_categories (household_id);

alter table public.shopping_categories enable row level security;
drop policy if exists "shopping categories: household all" on public.shopping_categories;
create policy "shopping categories: household all" on public.shopping_categories
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());
grant select, insert, update, delete on public.shopping_categories to authenticated;

do $$ begin
  alter publication supabase_realtime add table public.shopping_categories;
exception when duplicate_object then null; end $$;
