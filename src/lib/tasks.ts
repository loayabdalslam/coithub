// Workspace-scoped tasks. Backed by the public.tasks table (see
// tasks_migration.sql). Reads/writes go through the browser Supabase client;
// RLS scopes everything to the current workspace's members.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "Backlog" | "In progress" | "Blocked" | "Done";
export type TaskPriority = "Low" | "Medium" | "High";

export const TASK_STATUSES: TaskStatus[] = ["Backlog", "In progress", "Blocked", "Done"];
export const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

export type Task = {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  source_message_id: string | null;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  assigned_to_agent: string | null;
  assigned_from: string | null;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

const TASK_COLUMNS =
  "id, workspace_id, channel_id, source_message_id, title, description, status, priority, assigned_to, assigned_to_agent, assigned_from, due_date, created_by, created_at, updated_at";

// `tasks` isn't in the generated Database types yet, so cast the table name.
const tasksTable = () => supabase.from("tasks" as never);

export async function fetchWorkspaceTasks(workspaceId: string): Promise<Task[]> {
  const { data, error } = await tasksTable()
    .select(TASK_COLUMNS)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

export async function fetchChannelTasks(channelId: string): Promise<Task[]> {
  const { data, error } = await tasksTable()
    .select(TASK_COLUMNS)
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as Task[];
}

export type TaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  assigned_to_agent?: string | null;
  assigned_from?: string | null;
  due_date?: string | null;
  channel_id?: string | null;
};

export async function createTask(workspaceId: string, input: TaskInput): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await tasksTable().insert({
    workspace_id: workspaceId,
    title: input.title,
    description: input.description ?? "",
    status: input.status ?? "Backlog",
    priority: input.priority ?? "Medium",
    assigned_to: input.assigned_to ?? null,
    assigned_to_agent: input.assigned_to_agent ?? null,
    assigned_from: input.assigned_from ?? userData.user?.id ?? null,
    due_date: input.due_date ?? null,
    channel_id: input.channel_id ?? null,
    created_by: userData.user?.id ?? null,
  } as never);
  if (error) throw error;
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<void> {
  const { error } = await tasksTable()
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await tasksTable().delete().eq("id", id);
  if (error) throw error;
}

export function useWorkspaceTasks(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceTasks(workspaceId as string),
  });
}

export function useChannelTasks(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-tasks", channelId],
    enabled: !!channelId,
    queryFn: () => fetchChannelTasks(channelId as string),
  });
}

export type WorkspaceMember = { id: string; display_name: string | null; avatar_url: string | null };

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data: mems, error } = await supabase
    .from("memberships")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (error) throw error;
  const ids = (mems ?? []).map((m) => (m as { user_id: string }).user_id);
  if (ids.length === 0) return [];
  const { data: profs, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", ids);
  if (pErr) throw pErr;
  return (profs ?? []) as WorkspaceMember[];
}

export function useWorkspaceMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace-members", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWorkspaceMembers(workspaceId as string),
  });
}
