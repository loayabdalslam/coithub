import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type WidgetKind = "dashboard" | "file" | "docs" | "workflow";
export type WidgetStatus = "pending" | "running" | "ready" | "error";

export type Widget = {
  id: string;
  workspace_id: string;
  created_by: string;
  agent_slug: string;
  kind: WidgetKind;
  title: string;
  prompt: string;
  content: Record<string, unknown> & { markdown?: string };
  status: WidgetStatus;
  error: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchWidgets(workspaceId: string): Promise<Widget[]> {
  const { data, error } = await supabase
    .from("widgets" as never)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Widget[];
}

export function useWidgets(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["widgets", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => fetchWidgets(workspaceId!),
  });
}

export async function deleteWidget(id: string) {
  const { error } = await supabase.from("widgets" as never).delete().eq("id", id);
  if (error) throw error;
}

export const WIDGET_KINDS: { kind: WidgetKind; label: string; icon: string; hint: string }[] = [
  { kind: "dashboard", label: "Dashboard", icon: "▤", hint: "Metrics & KPIs" },
  { kind: "file", label: "File", icon: "▣", hint: "CSV / list output" },
  { kind: "docs", label: "Docs", icon: "▥", hint: "Long-form brief" },
  { kind: "workflow", label: "Workflow", icon: "→", hint: "Step-by-step plan" },
];
