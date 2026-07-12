
-- ============ ROLES ============
create type public.app_role as enum ('owner','admin','member','guest');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  handle text unique,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    new.raw_user_meta_data->>'avatar_url'
  ) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ WORKSPACES ============
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.workspaces to authenticated;
grant all on public.workspaces to service_role;
alter table public.workspaces enable row level security;

create table public.memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
grant select, insert, update, delete on public.memberships to authenticated;
grant all on public.memberships to service_role;
alter table public.memberships enable row level security;

-- Security-definer helpers (avoid RLS recursion)
create or replace function public.is_workspace_member(_workspace uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships where workspace_id = _workspace and user_id = _user)
$$;

create or replace function public.has_workspace_role(_workspace uuid, _user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.memberships where workspace_id = _workspace and user_id = _user and role = any(_roles))
$$;

-- Workspaces policies
create policy "members view workspace" on public.workspaces for select to authenticated
  using (public.is_workspace_member(id, auth.uid()));
create policy "any auth create workspace" on public.workspaces for insert to authenticated
  with check (auth.uid() = created_by);
create policy "owners update workspace" on public.workspaces for update to authenticated
  using (public.has_workspace_role(id, auth.uid(), array['owner']::public.app_role[]));

-- Membership policies
create policy "members view memberships" on public.memberships for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "admins manage memberships" on public.memberships for all to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));
create policy "self insert first membership" on public.memberships for insert to authenticated
  with check (user_id = auth.uid());

-- Auto-add creator as owner
create or replace function public.handle_new_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.memberships (workspace_id, user_id, role) values (new.id, new.created_by, 'owner');
  insert into public.channels (workspace_id, name, topic, created_by, is_default)
  values (new.id, 'general', 'Company-wide announcements and general chatter', new.created_by, true);
  return new;
end $$;

-- ============ CHANNELS / MESSAGES ============
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  topic text,
  is_private boolean not null default false,
  is_default boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);
grant select, insert, update, delete on public.channels to authenticated;
grant all on public.channels to service_role;
alter table public.channels enable row level security;

create table public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);
grant select, insert, delete on public.channel_members to authenticated;
grant all on public.channel_members to service_role;
alter table public.channel_members enable row level security;

create or replace function public.can_view_channel(_channel uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.channels c
    where c.id = _channel
      and public.is_workspace_member(c.workspace_id, _user)
      and (not c.is_private or exists(select 1 from public.channel_members cm where cm.channel_id = c.id and cm.user_id = _user))
  )
$$;

create policy "view channels in my workspaces" on public.channels for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()) and (not is_private or exists(
    select 1 from public.channel_members cm where cm.channel_id = id and cm.user_id = auth.uid()
  )));
create policy "members create channels" on public.channels for insert to authenticated
  with check (public.is_workspace_member(workspace_id, auth.uid()) and created_by = auth.uid());
create policy "admins manage channels" on public.channels for update to authenticated
  using (public.has_workspace_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[]));

create policy "view channel members" on public.channel_members for select to authenticated
  using (public.can_view_channel(channel_id, auth.uid()));
create policy "join channel self" on public.channel_members for insert to authenticated
  with check (user_id = auth.uid() and public.can_view_channel(channel_id, auth.uid()));
create policy "leave channel self" on public.channel_members for delete to authenticated
  using (user_id = auth.uid());

create trigger on_workspace_created after insert on public.workspaces
  for each row execute function public.handle_new_workspace();

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_id uuid references public.messages(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  edited_at timestamptz,
  idempotency_key text
);
create index messages_channel_created_idx on public.messages(channel_id, created_at desc);
create index messages_parent_idx on public.messages(parent_id);
create unique index messages_idem_idx on public.messages(author_id, idempotency_key) where idempotency_key is not null;
grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

create policy "view messages in visible channels" on public.messages for select to authenticated
  using (public.can_view_channel(channel_id, auth.uid()));
create policy "members post messages" on public.messages for insert to authenticated
  with check (author_id = auth.uid() and public.can_view_channel(channel_id, auth.uid()));
create policy "authors edit own" on public.messages for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete own" on public.messages for delete to authenticated
  using (author_id = auth.uid());

-- Reactions
create table public.reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.reactions to authenticated;
grant all on public.reactions to service_role;
alter table public.reactions enable row level security;
create policy "view reactions" on public.reactions for select to authenticated
  using (exists(select 1 from public.messages m where m.id = message_id and public.can_view_channel(m.channel_id, auth.uid())));
create policy "toggle own reactions" on public.reactions for insert to authenticated
  with check (user_id = auth.uid());
create policy "remove own reactions" on public.reactions for delete to authenticated
  using (user_id = auth.uid());

-- Mentions
create table public.mentions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  mentioned_user_id uuid references auth.users(id) on delete cascade,
  mentioned_pet_id uuid,
  created_at timestamptz not null default now()
);
grant select, insert on public.mentions to authenticated;
grant all on public.mentions to service_role;
alter table public.mentions enable row level security;
create policy "view mentions in visible channels" on public.mentions for select to authenticated
  using (exists(select 1 from public.messages m where m.id = message_id and public.can_view_channel(m.channel_id, auth.uid())));
create policy "insert mentions with own messages" on public.mentions for insert to authenticated
  with check (exists(select 1 from public.messages m where m.id = message_id and m.author_id = auth.uid()));

-- Files
create table public.files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploader_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  path text not null,
  name text not null,
  size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.files to authenticated;
grant all on public.files to service_role;
alter table public.files enable row level security;
create policy "view workspace files" on public.files for select to authenticated
  using (public.is_workspace_member(workspace_id, auth.uid()));
create policy "upload own files" on public.files for insert to authenticated
  with check (uploader_id = auth.uid() and public.is_workspace_member(workspace_id, auth.uid()));
create policy "delete own files" on public.files for delete to authenticated
  using (uploader_id = auth.uid());

-- updated_at trigger
create or replace function public.tg_touch_updated_at()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
create trigger touch_profiles before update on public.profiles for each row execute function public.tg_touch_updated_at();
create trigger touch_messages before update on public.messages for each row execute function public.tg_touch_updated_at();

-- Realtime
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.channels;
