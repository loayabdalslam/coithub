// Small helpers shared by Composio server functions. Contains no server-only
// imports so it is safe to import from *.functions.ts module scope.

export function composioUserId(workspaceId: string): string {
  return `ws_${workspaceId}`;
}

type RpcClient = { rpc: (fn: never, args: never) => Promise<{ data: unknown }> };

export async function composioKeyFor(supabase: RpcClient, workspaceId: string): Promise<string> {
  const { data } = await supabase.rpc("get_workspace_api_key" as never, {
    _workspace_id: workspaceId,
    _provider: "composio",
  } as never);
  const key = (data as string | null) ?? null;
  if (!key) {
    throw new Error(
      "No Composio API key for this workspace. An admin can add one in Settings → Integrations.",
    );
  }
  return key;
}

export function humanizeTool(slug: string, toolkit: string): string {
  const parts = slug.split("_");
  if (parts[0]?.toLowerCase() === toolkit.replace(/_/g, "").toLowerCase()) parts.shift();
  const words = parts.join(" ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function examplePrompt(slug: string, toolkit: string): string {
  const action = humanizeTool(slug, toolkit).toLowerCase();
  const app = toolkit.replace(/_/g, " ");
  return `@co ${action} in ${app} — `;
}
