-- A strategy belongs to one authenticated user. Configuration is versioned data;
-- it is not executable code and must be validated by the future EA Engine.
create table public.strategies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  config jsonb not null check (jsonb_typeof(config) = 'object' and coalesce(config->>'schemaVersion' = '1', false)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index strategies_owner_updated_idx on public.strategies (owner_id, updated_at desc);

create function public.touch_strategy_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger strategies_touch_updated_at before update on public.strategies
for each row execute function public.touch_strategy_updated_at();

alter table public.strategies enable row level security;
create policy "Users can view their own strategies" on public.strategies for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Users can create their own strategies" on public.strategies for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Users can update their own strategies" on public.strategies for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Users can delete their own strategies" on public.strategies for delete to authenticated using ((select auth.uid()) = owner_id);
