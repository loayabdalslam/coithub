-- Unified agent memory + Composio integrations
create table if not exists public.workspace_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null default 'fact',
  subject text not null default '',
  content text not null,
  importance int not null default 3,
  source_channel_id uuid references public.channels(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  created_by_agent text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_memories_kind_chk
    check (kind in ('user','workspace','business','preference','process','fact','insight')),
  constraint workspace_memories_importance_chk check (importance between 1 and 5)
);
create index if not exists workspace_memories_ws_idx
  on public.workspace_memories(workspace_id, importance desc, created_at desc);
create unique index if not exists workspace_memories_dedupe_idx
  on public.workspace_memories(workspace_id, kind, subject, md5(content));
grant select, insert, update, delete on public.workspace_memories to authenticated;
grant all on public.workspace_memories to service_role;
alter table public.workspace_memories enable row level security;
drop policy if exists "members view memories" on public.workspace_memories;
create policy "members view memories" on public.workspace_memories for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
drop policy if exists "members create memories" on public.workspace_memories;
create policy "members create memories" on public.workspace_memories for insert to authenticated
  with check (public.is_workspace_member(workspace_id, auth.uid()));
drop policy if exists "members update memories" on public.workspace_memories;
create policy "members update memories" on public.workspace_memories for update to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()))
  with check (public.is_workspace_member(workspace_id, auth.uid()));
drop policy if exists "members delete memories" on public.workspace_memories;
create policy "members delete memories" on public.workspace_memories for delete to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

create or replace function public.workspace_memories_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
drop trigger if exists workspace_memories_updated_at on public.workspace_memories;
create trigger workspace_memories_updated_at before update on public.workspace_memories
  for each row execute function public.workspace_memories_set_updated_at();

create table if not exists public.workspace_integrations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  toolkit text not null,
  connected_account_id text,
  auth_config_id text,
  status text not null default 'INITIATED',
  enabled boolean not null default true,
  connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, toolkit)
);
create index if not exists workspace_integrations_ws_idx on public.workspace_integrations(workspace_id);
grant select, insert, update, delete on public.workspace_integrations to authenticated;
grant all on public.workspace_integrations to service_role;
alter table public.workspace_integrations enable row level security;
drop policy if exists "members view integrations" on public.workspace_integrations;
create policy "members view integrations" on public.workspace_integrations for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
drop policy if exists "admins manage integrations" on public.workspace_integrations;
create policy "admins manage integrations" on public.workspace_integrations for all to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));
drop trigger if exists workspace_integrations_updated_at on public.workspace_integrations;
create trigger workspace_integrations_updated_at before update on public.workspace_integrations
  for each row execute function public.workspace_memories_set_updated_at();
