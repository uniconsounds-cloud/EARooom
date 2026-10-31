-- Public strategies are discoverable, while private strategies remain owner-only.
alter table public.strategies add column is_public boolean not null default false;
create index strategies_public_updated_idx on public.strategies (updated_at desc) where is_public = true;
drop policy "Users can view their own strategies" on public.strategies;
create policy "Users can view own or published strategies"
  on public.strategies for select to anon, authenticated
  using ((select auth.uid()) = owner_id or is_public = true);
