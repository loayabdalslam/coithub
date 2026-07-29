import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, fail, unauthenticated, supabaseForUser } from "../supabase";

type Ws = { id: string; name: string; slug: string };

function pickWorkspace(value: unknown): Ws | null {
  const v = value as Ws | Ws[] | null;
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export default defineTool({
  name: "list_workspaces",
  title: "List workspaces",
  description: "List the Coithub workspaces the signed-in user belongs to, with their channels.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input: Record<string, never>, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const db = supabaseForUser(ctx);
    const { data: memberships, error } = await db
      .from("memberships")
      .select("role, workspaces(id, name, slug)")
      .eq("user_id", ctx.getUserId()!);
    if (error) return fail(error.message);
    const ids = (memberships ?? [])
      .map((m) => pickWorkspace(m.workspaces)?.id)
      .filter(Boolean) as string[];
    const { data: channels } = ids.length
      ? await db.from("channels").select("id, name, topic, workspace_id").in("workspace_id", ids)
      : { data: [] };
    return ok(
      (memberships ?? []).map((m) => {
        const w = pickWorkspace(m.workspaces);
        return {
          id: w?.id,
          name: w?.name,
          slug: w?.slug,
          role: m.role,
          channels: (channels ?? [])
            .filter((c) => c.workspace_id === w?.id)
            .map((c) => ({ id: c.id, name: c.name, topic: c.topic })),
        };
      }),
    );
  },
});

export const listChannelMessages = defineTool({
  name: "list_channel_messages",
  title: "Read channel messages",
  description:
    "Read the most recent messages in a Coithub channel, including replies from AI agents.",
  inputSchema: {
    channel_id: z.string().describe("The channel UUID (from list_workspaces)."),
    limit: z.number().int().describe("How many recent messages to return (1-100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ channel_id, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const db = supabaseForUser(ctx);
    const { data, error } = await db
      .from("messages")
      .select("id, body, pet_id, author_id, parent_id, created_at")
      .eq("channel_id", channel_id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit || 20, 1), 100));
    if (error) return fail(error.message);
    return ok((data ?? []).reverse());
  },
});
