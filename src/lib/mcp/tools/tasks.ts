import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { ok, fail, unauthenticated, supabaseForUser, resolveWorkspace } from "../supabase";

const TASK_COLUMNS =
  "id, workspace_id, channel_id, title, description, status, priority, assigned_to, assigned_to_agent, due_date, created_at, updated_at";

export const listTasks = defineTool({
  name: "list_tasks",
  title: "List tasks",
  description:
    "List tasks on the workspace board, optionally filtered by status (Backlog, In progress, Blocked, Done).",
  inputSchema: {
    workspace_id: z.string().nullable().describe("Workspace UUID. Omit if you have only one."),
    status: z
      .enum(["Backlog", "In progress", "Blocked", "Done"])
      .nullable()
      .describe("Optional status filter."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ workspace_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const ws = await resolveWorkspace(ctx, workspace_id ?? undefined);
    if ("error" in ws) return fail(ws.error);
    let q = supabaseForUser(ctx)
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) return fail(error.message);
    return ok(data ?? []);
  },
});

export const createTask = defineTool({
  name: "create_task",
  title: "Create task",
  description: "Create a task on the workspace board.",
  inputSchema: {
    workspace_id: z.string().nullable().describe("Workspace UUID. Omit if you have only one."),
    title: z.string().min(1).describe("Short imperative task title."),
    description: z.string().nullable().describe("One or two sentences of detail."),
    priority: z.enum(["Low", "Medium", "High"]).nullable().describe("Task priority."),
    due_date: z.string().nullable().describe("Due date as YYYY-MM-DD."),
    channel_id: z.string().nullable().describe("Channel to attach the task to."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const ws = await resolveWorkspace(ctx, input.workspace_id ?? undefined);
    if ("error" in ws) return fail(ws.error);
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .insert({
        workspace_id: ws.id,
        title: input.title,
        description: input.description ?? "",
        status: "Backlog",
        priority: input.priority ?? "Medium",
        due_date: input.due_date ?? null,
        channel_id: input.channel_id ?? null,
        created_by: ctx.getUserId(),
      })
      .select(TASK_COLUMNS)
      .single();
    if (error) return fail(error.message);
    return ok(data);
  },
});

export const updateTaskStatus = defineTool({
  name: "update_task_status",
  title: "Update task status",
  description: "Move a task to a different column on the board.",
  inputSchema: {
    task_id: z.string().describe("Task UUID."),
    status: z.enum(["Backlog", "In progress", "Blocked", "Done"]).describe("New status."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ task_id, status }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const { data, error } = await supabaseForUser(ctx)
      .from("tasks")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", task_id)
      .select(TASK_COLUMNS)
      .single();
    if (error) return fail(error.message);
    return ok(data);
  },
});

export default listTasks;
