import { createClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

// Every MCP tool acts as the signed-in user: we forward the verified bearer
// token so Postgres RLS applies exactly as it does in the app UI.
export function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function unauthenticated() {
  return {
    content: [{ type: "text" as const, text: "Not authenticated. Reconnect this app to sign in." }],
    isError: true,
  };
}

export function fail(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function ok(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: { result: data } as Record<string, unknown>,
  };
}

// Resolve a workspace the caller is actually a member of. When no id is given
// and they belong to exactly one workspace, use it.
export async function resolveWorkspace(
  ctx: ToolContext,
  workspaceId?: string,
): Promise<{ id: string } | { error: string }> {
  const db = supabaseForUser(ctx);
  const { data, error } = await db
    .from("memberships")
    .select("workspace_id")
    .eq("user_id", ctx.getUserId()!);
  if (error) return { error: error.message };
  const ids = (data ?? []).map((m) => m.workspace_id as string);
  if (ids.length === 0) return { error: "You are not a member of any workspace yet." };
  if (workspaceId) {
    return ids.includes(workspaceId)
      ? { id: workspaceId }
      : { error: "You are not a member of that workspace." };
  }
  if (ids.length > 1) {
    return { error: `Specify workspace_id. Yours: ${ids.join(", ")}` };
  }
  return { id: ids[0] };
}
