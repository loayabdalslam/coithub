import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, fail, unauthenticated, supabaseForUser, resolveWorkspace } from "../supabase";

export const listMemories = defineTool({
  name: "list_memories",
  title: "Read agent memory",
  description:
    "Read the shared memory the workspace AI agents use — facts about the people, the business, preferences and insights.",
  inputSchema: {
    workspace_id: z.string().nullable().describe("Workspace UUID. Omit if you have only one."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ workspace_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const ws = await resolveWorkspace(ctx, workspace_id ?? undefined);
    if ("error" in ws) return fail(ws.error);
    const { data, error } = await supabaseForUser(ctx)
      .from("workspace_memories")
      .select("id, kind, subject, content, importance, created_by_agent, created_at")
      .eq("workspace_id", ws.id)
      .order("importance", { ascending: false })
      .limit(200);
    if (error) return fail(error.message);
    return ok(data ?? []);
  },
});

export const addMemory = defineTool({
  name: "add_memory",
  title: "Teach agent memory",
  description:
    "Store a durable fact in the workspace's shared agent memory so every agent uses it in future replies. Never store secrets or credentials.",
  inputSchema: {
    workspace_id: z.string().nullable().describe("Workspace UUID. Omit if you have only one."),
    kind: z
      .enum(["user", "workspace", "business", "preference", "process", "fact", "insight"])
      .describe("What sort of knowledge this is."),
    subject: z.string().nullable().describe("Who or what it is about."),
    content: z.string().min(1).describe("One crisp sentence."),
    importance: z.number().int().describe("Importance from 1 (minor) to 5 (critical)."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const ws = await resolveWorkspace(ctx, input.workspace_id ?? undefined);
    if ("error" in ws) return fail(ws.error);
    const importance = Math.min(Math.max(Math.round(input.importance || 3), 1), 5);
    const { data, error } = await supabaseForUser(ctx)
      .from("workspace_memories")
      .insert({
        workspace_id: ws.id,
        kind: input.kind,
        subject: input.subject ?? "",
        content: input.content,
        importance,
        created_by: ctx.getUserId(),
      })
      .select("id, kind, subject, content, importance")
      .single();
    if (error) return fail(error.message);
    return ok(data);
  },
});

export default listMemories;
