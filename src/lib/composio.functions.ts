import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// Composio connections are workspace-scoped: the Composio "user" is the
// workspace id, so every member (and every agent) shares the same tools.
import { composioKeyFor as keyFor, composioUserId } from "./composio-util";

export const searchToolkits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { workspaceId: string; search?: string }) => {
    if (!i || typeof i.workspaceId !== "string") throw new Error("Invalid input");
    return i;
  })
  .handler(async ({ data, context }) => {
    const key = await keyFor(context.supabase as never, data.workspaceId);
    const { listToolkits } = await import("./composio.server");
    return { toolkits: await listToolkits(key, data.search) };
  });

export const connectToolkit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { workspaceId: string; toolkit: string }) => {
    if (!i || typeof i.workspaceId !== "string" || typeof i.toolkit !== "string") {
      throw new Error("Invalid input");
    }
    return i;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const key = await keyFor(supabase as never, data.workspaceId);
    const { createAuthConfig, initiateConnection } = await import("./composio.server");

    const authConfigId = await createAuthConfig(key, data.toolkit);
    const conn = await initiateConnection(key, authConfigId, composioUserId(data.workspaceId));

    const { error } = await supabase.from("workspace_integrations" as never).upsert(
      {
        workspace_id: data.workspaceId,
        toolkit: data.toolkit,
        auth_config_id: authConfigId,
        connected_account_id: conn.id,
        status: conn.status,
        enabled: true,
        connected_by: userId,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "workspace_id,toolkit" },
    );
    if (error) throw new Error(error.message);

    return { redirectUrl: conn.redirectUrl, status: conn.status };
  });

export const refreshIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { workspaceId: string; toolkit: string }) => {
    if (!i || typeof i.workspaceId !== "string" || typeof i.toolkit !== "string") {
      throw new Error("Invalid input");
    }
    return i;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const key = await keyFor(supabase as never, data.workspaceId);
    const { data: row } = await supabase
      .from("workspace_integrations" as never)
      .select("connected_account_id")
      .eq("workspace_id", data.workspaceId)
      .eq("toolkit", data.toolkit)
      .maybeSingle();
    const accountId = (row as { connected_account_id?: string } | null)?.connected_account_id;
    if (!accountId) return { status: "MISSING" };

    const { getConnection } = await import("./composio.server");
    const { status } = await getConnection(key, accountId);
    await supabase
      .from("workspace_integrations" as never)
      .update({ status, updated_at: new Date().toISOString() } as never)
      .eq("workspace_id", data.workspaceId)
      .eq("toolkit", data.toolkit);
    return { status };
  });

export const disconnectToolkit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { workspaceId: string; toolkit: string }) => {
    if (!i || typeof i.workspaceId !== "string" || typeof i.toolkit !== "string") {
      throw new Error("Invalid input");
    }
    return i;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row } = await supabase
      .from("workspace_integrations" as never)
      .select("connected_account_id")
      .eq("workspace_id", data.workspaceId)
      .eq("toolkit", data.toolkit)
      .maybeSingle();
    const accountId = (row as { connected_account_id?: string } | null)?.connected_account_id;

    if (accountId) {
      try {
        const key = await keyFor(supabase as never, data.workspaceId);
        const { deleteConnection } = await import("./composio.server");
        await deleteConnection(key, accountId);
      } catch {
        /* connection may already be gone upstream */
      }
    }

    const { error } = await supabase
      .from("workspace_integrations" as never)
      .delete()
      .eq("workspace_id", data.workspaceId)
      .eq("toolkit", data.toolkit);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
