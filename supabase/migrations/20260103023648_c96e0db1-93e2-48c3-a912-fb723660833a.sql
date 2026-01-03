-- Savings allocations: source-of-truth for goal progress (no mock current_amount)
create table if not exists public.savings_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  savings_goal_id uuid not null references public.savings_goals(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  amount numeric not null,
  currency public.currency_code not null default 'KES'::public.currency_code,
  allocated_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.savings_allocations enable row level security;

create policy "Users can view their own savings allocations"
on public.savings_allocations
for select
using (auth.uid() = user_id);

create policy "Users can insert their own savings allocations"
on public.savings_allocations
for insert
with check (auth.uid() = user_id);

create policy "Users can delete their own savings allocations"
on public.savings_allocations
for delete
using (auth.uid() = user_id);

-- Keep savings_goals.current_amount in sync with allocations
create or replace function public.recalculate_savings_goal_amount(_goal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  _sum numeric;
begin
  select coalesce(sum(amount), 0) into _sum
  from public.savings_allocations
  where savings_goal_id = _goal_id;

  update public.savings_goals
  set current_amount = _sum,
      updated_at = now()
  where id = _goal_id;
end;
$$;

create or replace function public.tg_recalculate_savings_goal_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.recalculate_savings_goal_amount(new.savings_goal_id);
  elsif (tg_op = 'DELETE') then
    perform public.recalculate_savings_goal_amount(old.savings_goal_id);
  elsif (tg_op = 'UPDATE') then
    perform public.recalculate_savings_goal_amount(old.savings_goal_id);
    perform public.recalculate_savings_goal_amount(new.savings_goal_id);
  end if;
  return null;
end;
$$;

drop trigger if exists recalc_savings_goal_amount on public.savings_allocations;
create trigger recalc_savings_goal_amount
after insert or update or delete on public.savings_allocations
for each row
execute function public.tg_recalculate_savings_goal_amount();

-- Ensure savings_goals updated_at stays correct (if trigger wasn't created previously)
drop trigger if exists update_savings_goals_updated_at on public.savings_goals;
create trigger update_savings_goals_updated_at
before update on public.savings_goals
for each row
execute function public.update_updated_at_column();
