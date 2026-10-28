-- Apply after 001_events.sql. Private words, favorites, budget and daily allocation history.
create table if not exists public.private_metadata (
 user_id uuid not null references auth.users(id) on delete cascade,
 id text not null,
 sequence bigint generated always as identity unique,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 primary key(user_id,id),
 constraint metadata_identity check(coalesce(jsonb_typeof(payload)='object' and payload ?& array['id','kind','key','value','at'] and payload->>'id'=id,false)),
 constraint metadata_kind check (coalesce(
  jsonb_typeof(payload->'key')='string' and length(payload->>'key')>0 and
  jsonb_typeof(payload->'at')='string' and
  (
   (payload->>'kind'='point' and jsonb_typeof(payload->'value')='object' and payload->'value'->>'id'=payload->>'key') or
   (payload->>'kind'='favorite' and jsonb_typeof(payload->'value')='boolean') or
   (payload->>'kind'='budget' and payload->>'key'='budget' and payload->'value' in ('15'::jsonb,'30'::jsonb)) or
   (payload->>'kind'='allocation' and payload->>'key' ~ '^allocated:[0-9]{4}-[0-9]{2}-[0-9]{2}$' and jsonb_typeof(payload->'value')='array')
  )
 ,false))
);
alter table public.private_metadata enable row level security;
revoke all on public.private_metadata from anon;
grant select,insert on public.private_metadata to authenticated;
grant usage,select on sequence public.private_metadata_sequence_seq to authenticated;
create policy "read own private metadata" on public.private_metadata for select to authenticated using ((select auth.uid())=user_id);
create policy "insert own private metadata" on public.private_metadata for insert to authenticated with check ((select auth.uid())=user_id);
-- No UPDATE/DELETE policies: immutable operation IDs are safe to retry.
