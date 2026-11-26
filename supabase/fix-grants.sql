-- Newer Supabase projects don't expose new tables to the app until you grant access.
-- Run this once in Supabase > SQL Editor, then tap "Try again" in the app.
grant usage on schema public to authenticated;
grant select on public.households to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.items to authenticated;
