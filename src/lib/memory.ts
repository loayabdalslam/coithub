// Unified agent memory — a shared, workspace-scoped knowledge base that every
// agent reads before replying and writes to as it learns about the users,
// the workspace, and the business.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MEMORY_KINDS = [
  "user",
  "workspace",
  "business",
  "preference",
  "process",
  "fact",
  "insight",
] as const;

export type MemoryKind = (typeof MEMORY_KINDS)[number];

export type Memory = {
  id: string;
  workspace_id: string;
  kind: MemoryKind;
  subject: string;
  content: string;
  importance: number;
  source_channel_id: string | null;
  source_message_id: string | null;
  created_by_agent: string | null;
  created_at: string;
  updated_at: string;
};

const COLS =
  "id, workspace_id, kind, subject, content, importance, source_channel_id, source_message_id, created_by_agent, created_at, updated_at";

export async function fetchMemories(workspaceId: string): Promise<Memory[]> {
  const { data, error } = await supabase
    .from("workspace_memories" as never)
    .select(COLS)
    .eq("workspace_id", workspaceId)
    .order("importance", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as Memory[];
}

export function useMemories(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["workspace_memories", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchMemories(workspaceId!),
  });
}

export async function createMemory(input: {
  workspaceId: string;
  kind: MemoryKind;
  subject: string;
  content: string;
  importance?: number;
}): Promise<void> {
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase.from("workspace_memories" as never).insert({
    workspace_id: input.workspaceId,
    kind: input.kind,
    subject: input.subject,
    content: input.content,
    importance: input.importance ?? 3,
    created_by: user.user?.id ?? null,
  } as never);
  if (error) throw error;
}

export async function updateMemory(
  id: string,
  patch: Partial<Pick<Memory, "kind" | "subject" | "content" | "importance">>,
): Promise<void> {
  const { error } = await supabase
    .from("workspace_memories" as never)
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMemory(id: string): Promise<void> {
  const { error } = await supabase.from("workspace_memories" as never).delete().eq("id", id);
  if (error) throw error;
}
