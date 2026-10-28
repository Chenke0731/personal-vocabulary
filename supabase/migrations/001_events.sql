-- Apply to your own Supabase project. No real project has been configured or tested yet.
create table if not exists public.review_events (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 sequence bigint generated always as identity unique,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 primary key(user_id,id),
 constraint payload_id_matches check(payload->>'id'=id),
 constraint payload_required_fields check (
  jsonb_typeof(payload)='object' and
  payload ?& array['id','pointId','base','at','day','rating'] and
  jsonb_typeof(payload->'pointId')='string' and
  jsonb_typeof(payload->'base')='string' and
  jsonb_typeof(payload->'at')='string' and
  jsonb_typeof(payload->'day')='string' and
  jsonb_typeof(payload->'rating')='number' and
  (payload->>'rating')::int between 1 and 4
 )
);
alter table public.review_events enable row level security;
revoke all on public.review_events from anon;
grant select,insert on public.review_events to authenticated;
grant usage,select on sequence public.review_events_sequence_seq to authenticated;
create policy "read own reviews" on public.review_events for select to authenticated using((select auth.uid())=user_id);
create policy "insert own reviews" on public.review_events for insert to authenticated with check((select auth.uid())=user_id);
-- Immutable events: clients receive no UPDATE or DELETE policies.

