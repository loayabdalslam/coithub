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
    const model = (cfg?.model as string | undefined) || "google/gemini-3-flash-preview";
    const provider = providerForModel(model);
    const systemPrompt = ((cfg as { custom_system?: string | null } | null)?.custom_system) || petCfg.system;

    // Fetch the workspace API key for the selected provider via SECURITY DEFINER function
    const { data: keyData } = await supabase.rpc("get_workspace_api_key" as never, {
      _workspace_id: workspaceId,
      _provider: provider,
    } as never);
    const workspaceKey = (keyData as string | null) ?? null;

    messages[0].content = `${systemPrompt}\n\nYou are ${petCfg.name}, replying inside #${channel.name}${
      channel.topic ? ` (${channel.topic})` : ""
    }. Stay fully in character. Address people by name. Do NOT prefix your reply with your own name — the UI shows it. Format the reply in Markdown (headings, lists, tables, fenced code) so it renders cleanly. Keep replies focused and useful.

TASK CAPTURE: When the conversation implies a concrete, actionable task, decision to execute, or todo, capture it by appending a fenced code block with language "task" containing ONLY JSON, in addition to your normal reply. Shape: {"title": "short imperative title", "description": "1-2 sentence detail", "priority": "Low|Medium|High", "assignee": "<agent-slug or null>", "due_date": "YYYY-MM-DD or null"}. Emit one block per distinct task. Valid agent slugs: ${PET_LIST.join(", ")}. Only capture genuinely actionable items — never fabricate tasks for small talk. If there is nothing actionable, do not emit a task block.`;

    const rawReply = await callProvider(provider, model, messages, workspaceKey);
    if (!rawReply) throw new Error(`${petCfg.name} returned an empty reply.`);

    const { cleaned, tasks: captured } = extractCapturedTasks(rawReply);
    const reply = cleaned || rawReply;

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
