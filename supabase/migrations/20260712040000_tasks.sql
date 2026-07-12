-- ============================================================
-- Tasks feature migration
-- Run this in Supabase → SQL Editor (or save as
-- supabase/migrations/20260712030000_tasks.sql and push).
-- ============================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  title text not null,
  description text not null default '',
  status text not null default 'Backlog',
  priority text not null default 'Medium',
  assigned_to uuid references auth.users(id) on delete set null,
  assigned_to_agent text,
  assigned_from uuid references auth.users(id) on delete set null,
  due_date date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_status_chk check (status in ('Backlog','In progress','Blocked','Done')),
  constraint tasks_priority_chk check (priority in ('Low','Medium','High'))
);

create index if not exists tasks_workspace_idx on public.tasks(workspace_id, created_at desc);
create index if not exists tasks_channel_idx on public.tasks(channel_id, created_at desc);

grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

alter table public.tasks enable row level security;

create policy "members view tasks" on public.tasks for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));

create policy "members create tasks" on public.tasks for insert to authenticated
  with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "members update tasks" on public.tasks for update to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()))
  with check (public.is_workspace_member(workspace_id, auth.uid()));

create policy "manage delete tasks" on public.tasks for delete to authenticated
  using (
    created_by = auth.uid()
    or public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

create or replace function public.tasks_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.tasks_set_updated_at();
