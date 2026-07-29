import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PET_PROMPTS, PET_LIST, type PetSlug } from "./pets";
import { providerForModel } from "./providers";
import { callProvider, extractCapturedTasks, type ChatMsg } from "./provider-call";

type InvokeInput = {
  channelId: string;
  pet: PetSlug;
  triggerMessageId: string;
  parentId?: string | null;
};

function validate(input: unknown): InvokeInput {
  const i = input as InvokeInput;
  if (!i || typeof i.channelId !== "string" || typeof i.triggerMessageId !== "string") {
    throw new Error("Invalid input");
  }
  if (!PET_LIST.includes(i.pet)) throw new Error("Unknown pet");
  return { ...i, parentId: i.parentId ?? null };
}


export const invokePet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const { channelId, pet, parentId } = data;
    const { supabase } = context;

    const { data: channel, error: chErr } = await supabase
      .from("channels")
      .select("id, name, topic, workspace_id")
      .eq("id", channelId)
      .single();
    if (chErr || !channel) throw new Error("Channel not accessible");

    // For thread replies, fetch the parent + siblings; otherwise the top-level channel history.
    const historyQuery = supabase
      .from("messages")
      .select("id, body, pet_id, author_id, created_at, parent_id")
      .eq("channel_id", channelId)
      .order("created_at", { ascending: false })
      .limit(20);
    const { data: recent, error: rErr } = parentId
      ? await historyQuery.or(`id.eq.${parentId},parent_id.eq.${parentId}`)
      : await historyQuery.is("parent_id", null);
    if (rErr) throw new Error(rErr.message);

    const history = (recent ?? []).reverse();

    const humanIds = Array.from(
      new Set(history.filter((m) => m.author_id && !m.pet_id).map((m) => m.author_id as string)),
    );
    let names: Record<string, string> = {};
    if (humanIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", humanIds);
      names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.display_name ?? "user"]));
    }

    const petCfg = PET_PROMPTS[pet];
    const messages: ChatMsg[] = [
      {
        role: "system",
        content: `PLACEHOLDER_SYSTEM`,
      },
    ];

    for (const m of history) {
      if (m.pet_id) {
        const p = PET_PROMPTS[m.pet_id as PetSlug];
        messages.push({ role: "assistant", content: `${p?.name ?? m.pet_id}: ${m.body}` });
      } else {
        const who = names[m.author_id as string] ?? "user";
        messages.push({ role: "user", content: `${who}: ${m.body}` });
      }
    }

    const workspaceId = (channel as { workspace_id?: string }).workspace_id ?? "";

    const { data: cfg } = await supabase
      .from("pet_configs")
      .select("model, enabled, provider, custom_system")
      .eq("workspace_id", workspaceId)
      .eq("pet_slug", pet)
      .maybeSingle();
    if (cfg && cfg.enabled === false) {
      throw new Error(`${petCfg.name} is disabled in this workspace.`);
    }
    const model = (cfg?.model as string | undefined) || DEFAULT_MODEL;
    const provider = providerForModel(model);
    const systemPrompt = ((cfg as { custom_system?: string | null } | null)?.custom_system) || petCfg.system;

    // Fetch the workspace API key for the selected provider via SECURITY DEFINER function
    const { data: keyData } = await supabase.rpc("get_workspace_api_key" as never, {
      _workspace_id: workspaceId,
      _provider: provider,
    } as never);
    const workspaceKey = (keyData as string | null) ?? null;

    // ---- Unified memory: everything the agents have learned so far ----
    const { data: memRows } = await supabase
      .from("workspace_memories" as never)
      .select("kind, subject, content, importance")
      .eq("workspace_id", workspaceId)
      .order("importance", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60);
    const memories = (memRows ?? []) as unknown as {
      kind: string;
      subject: string;
      content: string;
      importance: number;
    }[];
    const memoryBlock = memories.length
      ? memories
          .map((m) => `- [${m.kind}${m.subject ? `/${m.subject}` : ""}] ${m.content}`)
          .join("\n")
      : "(nothing learned yet)";

    // ---- Composio tools the workspace has connected ----
    let tools: ToolSpec[] = [];
    let composioKey: string | null = null;
    const toolAccounts: Record<string, string | null> = {};
    const toolkitByTool: Record<string, string> = {};
    if (supportsToolCalling(provider)) {
      const { data: integrations } = await supabase
        .from("workspace_integrations" as never)
        .select("toolkit, connected_account_id, status, enabled")
        .eq("workspace_id", workspaceId)
        .eq("enabled", true);
      const active = ((integrations ?? []) as unknown as {
        toolkit: string;
        connected_account_id: string | null;
        status: string;
      }[]).filter((i) => i.status === "ACTIVE");

      if (active.length > 0) {
        try {
          const { data: ck } = await supabase.rpc("get_workspace_api_key" as never, {
            _workspace_id: workspaceId,
            _provider: "composio",
          } as never);
          composioKey = (ck as string | null) ?? null;
          if (composioKey) {
            const { listToolsAsOpenAI } = await import("./composio.server");
            for (const integ of active.slice(0, 4)) {
              const t = await listToolsAsOpenAI(composioKey, integ.toolkit, 10);
              for (const tool of t) {
                toolkitByTool[tool.function.name] = integ.toolkit;
                toolAccounts[tool.function.name] = integ.connected_account_id;
              }
              tools = tools.concat(t);
            }
          }
        } catch {
          tools = [];
        }
      }
    }

    messages[0].content = `${systemPrompt}\n\nYou are ${petCfg.name}, replying inside #${channel.name}${
      channel.topic ? ` (${channel.topic})` : ""
    }. Stay fully in character. Address people by name. Do NOT prefix your reply with your own name — the UI shows it. Format the reply in Markdown (headings, lists, tables, fenced code) so it renders cleanly. Keep replies focused and useful.

SHARED MEMORY — what the team of agents already knows about this workspace, its people and its business. Use it to personalise every reply, avoid re-asking known facts, and make sharper recommendations:
${memoryBlock}

MEMORY CAPTURE: When you learn something durable and reusable — about a person, the workspace, the business, a preference, a process, or a strategic insight — append a fenced code block with language "memory" containing ONLY JSON: {"kind": "user|workspace|business|preference|process|fact|insight", "subject": "who/what it's about", "content": "one crisp sentence", "importance": 1-5}. One block per fact. Never store secrets, passwords or API keys. Skip it when nothing new was learned.

TASK CAPTURE: When the conversation implies a concrete, actionable task, decision to execute, or todo, capture it by appending a fenced code block with language "task" containing ONLY JSON, in addition to your normal reply. Shape: {"title": "short imperative title", "description": "1-2 sentence detail", "priority": "Low|Medium|High", "assignee": "<agent-slug or null>", "due_date": "YYYY-MM-DD or null"}. Emit one block per distinct task. Valid agent slugs: ${PET_LIST.join(", ")}. Only capture genuinely actionable items — never fabricate tasks for small talk. If there is nothing actionable, do not emit a task block.${
      tools.length
        ? `\n\nTOOLS: You have live Composio tools connected to this workspace (${Array.from(
            new Set(Object.values(toolkitByTool)),
          ).join(", ")}). Use them to actually read data and take action instead of guessing, then summarise what you did. Never take a destructive or irreversible action without the user asking for it.`
        : ""
    }`;

    const { text: rawReply, toolCalls } = await callProviderWithTools(
      provider,
      model,
      messages,
      workspaceKey,
      tools,
      async (name, args) => {
        if (!composioKey) throw new Error("Composio is not configured for this workspace.");
        const { executeTool } = await import("./composio.server");
        const { composioUserId } = await import("./composio-util");
        return executeTool(composioKey, name, composioUserId(workspaceId), args, toolAccounts[name]);
      },
    );
    if (!rawReply) throw new Error(`${petCfg.name} returned an empty reply.`);

    const { cleaned: noTasks, tasks: captured } = extractCapturedTasks(rawReply);
    const { cleaned, memories: capturedMemories } = extractCapturedMemories(noTasks);
    const reply = cleaned || noTasks || rawReply;



    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("messages")
      .insert({ channel_id: channelId, author_id: null, pet_id: pet, body: reply, parent_id: parentId ?? null })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Persist any auto-captured tasks, tagged with their chat origin.
    if (captured.length > 0) {
      const rows = captured.map((t) => ({
        workspace_id: workspaceId,
        channel_id: channelId,
        source_message_id: inserted.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: "Backlog",
        assigned_to_agent:
          t.assignee && PET_LIST.includes(t.assignee as PetSlug) ? t.assignee : pet,
        due_date: t.due_date,
        created_by: null,
      }));
      await supabaseAdmin.from("tasks" as never).insert(rows as never);
    }

    return { id: inserted.id, pet, body: reply, capturedTasks: captured.length };
  });
