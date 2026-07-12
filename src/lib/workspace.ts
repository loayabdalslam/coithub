import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  onboarded_at: string | null;
  auto_respond?: boolean;
};
export type Channel = { id: string; name: string; topic: string | null; workspace_id: string };
export type WorkspaceInvite = {
  id: string;
  workspace_id: string;
  token: string;
  role: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
  created_at: string;
};

const SELECTED_KEY = "selected_workspace_id";

export function getSelectedWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SELECTED_KEY);
}

export function setSelectedWorkspaceId(id: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SELECTED_KEY, id);
}

export function clearSelectedWorkspaceId(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SELECTED_KEY);
}

// List every workspace the current user is a member of.
export async function listWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, onboarded_at, auto_respond")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Workspace[];
}

// Create a brand-new workspace for the current user and select it.
export async function createWorkspace(name?: string): Promise<Workspace> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Not signed in");

  const displayName =
    name?.trim() ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "My";
  const baseSlug =
    displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "workspace";
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  const wsName = name?.trim() ? name.trim() : `${displayName}'s Workspace`;

  const { data: created, error: createErr } = await supabase.rpc(
    "create_workspace_for_current_user",
    { _name: wsName, _slug: slug },
  );
  if (createErr) throw createErr;
  const row = Array.isArray(created) ? created[0] : created;
  if (!row) throw new Error("Failed to create workspace");
  const workspace = {
    ...(row as { id: string; name: string; slug: string }),
    onboarded_at: null,
  } as Workspace;
  setSelectedWorkspaceId(workspace.id);
  return workspace;
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  const { error } = await supabase.from("workspaces").update({ name }).eq("id", id);
  if (error) throw error;
}

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: listWorkspaces,
    staleTime: 30_000,
  });
}

// Returns the currently selected workspace, or null if none is selected /
// the selection no longer belongs to the user.
export function useWorkspace() {
  return useQuery({
    queryKey: ["workspace"],
    queryFn: async (): Promise<Workspace | null> => {
      const id = getSelectedWorkspaceId();
      if (!id) return null;
      const { data, error } = await supabase
        .from("workspaces")
        .select("id, name, slug, onboarded_at, auto_respond")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as Workspace | null) ?? null;
    },
    staleTime: 60_000,
  });
}


export function useChannels(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["channels", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name, topic, workspace_id")
        .eq("workspace_id", workspaceId!)
        .order("name");
      if (error) throw error;
      return data as Channel[];
    },
  });
}

// -------- Channels --------
export async function createChannel(
  workspaceId: string,
  name: string,
  topic: string | null,
): Promise<Channel> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const clean =
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "") || "channel";
  const { data, error } = await supabase
    .from("channels")
    .insert({
      workspace_id: workspaceId,
      name: clean,
      topic: topic?.trim() || null,
      created_by: uid,
    })
    .select("id, name, topic, workspace_id")
    .single();
  if (error) throw error;
  return data as Channel;
}

// -------- Invites --------
function randomToken(): string {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

export async function createInvite(workspaceId: string): Promise<WorkspaceInvite> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("Not signed in");
  const token = randomToken();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(); // 14 days
  const { data, error } = await supabase
    .from("workspace_invites")
    .insert({
      workspace_id: workspaceId,
      token,
      created_by: uid,
      role: "member",
      expires_at: expires,
      max_uses: 25,
    })
    .select("id, workspace_id, token, role, expires_at, max_uses, uses, created_at")
    .single();
  if (error) throw error;
  return data as WorkspaceInvite;
}

export async function listInvites(workspaceId: string): Promise<WorkspaceInvite[]> {
  const { data, error } = await supabase
    .from("workspace_invites")
    .select("id, workspace_id, token, role, expires_at, max_uses, uses, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WorkspaceInvite[];
}

export function inviteUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${token}`;
}

export async function previewInvite(token: string) {
  const { data, error } = await supabase.rpc("get_invite_preview", { _token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as
    | { workspace_id: string | null; workspace_name: string | null; valid: boolean; reason: string }
    | null;
}

export async function acceptInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc("accept_workspace_invite", { _token: token });
  if (error) throw error;
  return data as string;
}
