
create table if not exists public.workspace_api_keys (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  api_key text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid,
  primary key (workspace_id, provider)
);

grant select, insert, update, delete on public.workspace_api_keys to authenticated;
grant all on public.workspace_api_keys to service_role;

alter table public.workspace_api_keys enable row level security;

create policy "wak_admin_select" on public.workspace_api_keys
  for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_api_keys.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create policy "wak_admin_write" on public.workspace_api_keys
  for all to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_api_keys.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.workspace_id = workspace_api_keys.workspace_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  );

create or replace function public.get_workspace_api_key(_workspace_id uuid, _provider text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select api_key from public.workspace_api_keys
  where workspace_id = _workspace_id and provider = _provider
  limit 1
$$;

grant execute on function public.get_workspace_api_key(uuid, text) to authenticated, service_role;

alter table public.workspaces
  add column if not exists auto_respond boolean not null default true;
