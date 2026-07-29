import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
// Composio connections are workspace-scoped: the Composio "user" is the
// workspace id, so every member (and every agent) shares the same tools.
import {
  composioKeyOrNull,
  composioKeyFor,
  composioUserId,
  humanizeTool,
  examplePrompt,
  COMPOSIO_SIGNUP_URL,
} from "./composio-util";

export const searchToolkits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { workspaceId: string; search?: string }) => {
    if (!i || typeof i.workspaceId !== "string") throw new Error("Invalid input");
    return i;
  })
  .handler(async ({ data, context }) => {
    const key = await composioKeyOrNull(context.supabase as never, data.workspaceId);
    if (!key) return { toolkits: [], needsKey: true as const };
    const { listToolkits } = await import("./composio.server");
    return { toolkits: await listToolkits(key, data.search), needsKey: false as const };
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
    const key = await composioKeyOrNull(supabase as never, data.workspaceId);
    if (!key) {
      // No workspace key yet — don't throw (that blanks the app); tell the UI.
      return {
        redirectUrl: COMPOSIO_SIGNUP_URL,
        status: "NO_KEY" as const,
        message:
          "No Composio API key for this workspace. An admin can add one in Settings → Integrations.",
      };
    }
    const { createAuthConfig, initiateConnection, getConnection } = await import(
      "./composio.server"
    );

    // Already authorised? Don't send the user through OAuth again.
    const { data: existing } = await supabase
      .from("workspace_integrations" as never)
      .select("connected_account_id")
      .eq("workspace_id", data.workspaceId)
      .eq("toolkit", data.toolkit)
      .maybeSingle();
    const existingId = (existing as { connected_account_id?: string } | null)
      ?.connected_account_id;
    if (existingId) {
      try {
        const { status } = await getConnection(key, existingId);
        if (status === "ACTIVE") {
          await supabase
            .from("workspace_integrations" as never)
            .update({ status, updated_at: new Date().toISOString() } as never)
            .eq("workspace_id", data.workspaceId)
            .eq("toolkit", data.toolkit);
          return { redirectUrl: null, status: "ACTIVE" as const, message: null };
        }
      } catch {
        /* stale connection — fall through and re-authorise */
      }
    }

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

    return { redirectUrl: conn.redirectUrl, status: conn.status, message: null };
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
    const key = await composioKeyFor(supabase as never, data.workspaceId);
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
        const key = await composioKeyFor(supabase as never, data.workspaceId);
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

/**
 * Tools the workspace can actually use right now (active Composio connections),
 * grouped by toolkit and with a ready-to-send example prompt for each tool.
 * Powers the "!" tool palette in the message composer.
 */
export const listWorkspaceTools = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { workspaceId: string }) => {
    if (!i || typeof i.workspaceId !== "string") throw new Error("Invalid input");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("workspace_integrations" as never)
      .select("toolkit, status, enabled")
      .eq("workspace_id", data.workspaceId)
      .eq("enabled", true);
    const active = ((rows ?? []) as unknown as { toolkit: string; status: string }[]).filter(
      (r) => r.status === "ACTIVE",
    );
    if (active.length === 0) return { toolkits: [] as ToolPaletteGroup[] };

    let key: string;
    try {
      key = await composioKeyFor(supabase as never, data.workspaceId);
    } catch {
      return { toolkits: [] as ToolPaletteGroup[] };
    }

    const { listToolsAsOpenAI } = await import("./composio.server");
    const groups: ToolPaletteGroup[] = [];
    for (const integ of active.slice(0, 8)) {
      try {
        const tools = await listToolsAsOpenAI(key, integ.toolkit, 10);
        groups.push({
          toolkit: integ.toolkit,
          tools: tools.map((t) => ({
            slug: t.function.name,
            label: humanizeTool(t.function.name, integ.toolkit),
            description: (t.function.description ?? "").slice(0, 160),
            example: examplePrompt(t.function.name, integ.toolkit),
          })),
        });
      } catch {
        // Listing failed, but the toolkit IS connected — keep it in the list so
        // the UI doesn't ask the user to authorise it again.
        groups.push({ toolkit: integ.toolkit, tools: [] });
      }

    }
    return { toolkits: groups };
  });

export type ToolPaletteGroup = {
  toolkit: string;
  tools: { slug: string; label: string; description: string; example: string }[];
};
