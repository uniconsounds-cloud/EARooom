-- Authenticated users can consume at most 20 AI requests per UTC day.
create table if not exists public.strategy_ai_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  request_count integer not null default 0,
  primary key(owner_id,usage_day)
);
alter table public.strategy_ai_usage enable row level security;
revoke all on public.strategy_ai_usage from anon,authenticated;
create or replace function public.consume_strategy_ai_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  used integer;
  actor uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
begin
  if actor is null then return false; end if;
  insert into public.strategy_ai_usage(owner_id,usage_day,request_count)
    values(actor,today,1)
    on conflict(owner_id,usage_day) do update set request_count=public.strategy_ai_usage.request_count+1
      where public.strategy_ai_usage.request_count<20
    returning request_count into used;
  return used is not null;
end;
$$;
revoke all on function public.consume_strategy_ai_quota() from public,anon;
grant execute on function public.consume_strategy_ai_quota() to authenticated;
