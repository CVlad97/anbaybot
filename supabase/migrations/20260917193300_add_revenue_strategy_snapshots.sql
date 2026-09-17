create table if not exists public.revenue_strategy_snapshots (
  id uuid primary key default gen_random_uuid(),
  recorded_at timestamptz not null default now(),
  environment text not null check (environment in ('PAPER','TEST','LIVE')),
  strategy text not null check (strategy in (
    'EARN','FUNDING_CAPTURE','FUTURES_DIRECTIONAL','FARMING',
    'PREDICTION','ARBITRAGE','SAAS','REFERRAL'
  )),
  source text not null,
  venue text,
  asset text,
  horizon_days numeric,
  gross_return_pct numeric,
  total_cost_pct numeric,
  net_return_pct numeric,
  annualized_simple_pct numeric,
  evidence_quality text not null check (evidence_quality in (
    'HISTORICAL_VERIFIED','PAPER','LIVE_VERIFIED','HYPOTHETICAL','UNVERIFIED'
  )),
  capital_eur numeric,
  scenario_pnl_eur numeric,
  inputs jsonb not null default '{}'::jsonb,
  notes text
);
alter table public.revenue_strategy_snapshots enable row level security;
revoke all on public.revenue_strategy_snapshots from anon, authenticated;
create index if not exists idx_revenue_strategy_snapshots_strategy_time
  on public.revenue_strategy_snapshots(strategy, recorded_at desc);

create or replace function public.block_revenue_snapshot_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'revenue_strategy_snapshots is append-only';
end;
$$;

drop trigger if exists revenue_strategy_snapshots_append_only
  on public.revenue_strategy_snapshots;
create trigger revenue_strategy_snapshots_append_only
before update or delete on public.revenue_strategy_snapshots
for each row execute function public.block_revenue_snapshot_mutation();
