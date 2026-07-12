import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PET_PROMPTS, PET_LIST, type PetSlug } from "./pets";
import { providerForModel, type ProviderId } from "./providers";

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

type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

async function callProvider(
  provider: ProviderId,
  model: string,
  messages: ChatMsg[],
  workspaceKey: string | null,
): Promise<string> {
  // Strip provider prefix — some providers expect the raw model id.
  const rawModel = model.includes("/") ? model.split("/").slice(1).join("/") : model;

  const throwHttp = async (label: string, resp: Response) => {
    const text = await resp.text().catch(() => "");
    if (resp.status === 429) throw new Error(`${label}: rate limited — try again in a moment.`);
    if (resp.status === 401 || resp.status === 403)
      throw new Error(`${label}: invalid or missing API key.`);
    if (resp.status === 402) throw new Error(`${label}: credits exhausted.`);
    throw new Error(`${label} error ${resp.status}: ${text.slice(0, 300)}`);
  };

  if (provider === "google" || provider === "openai") {
    // Lovable AI Gateway (no user key)
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY on server.");
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages }),
    });
    if (!resp.ok) await throwHttp("Lovable AI", resp);
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (!workspaceKey) {
    throw new Error(
      `No ${provider} API key configured for this workspace. An admin can add one in Settings → API Keys.`,
    );
  }

  if (provider === "openrouter") {
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workspaceKey}`,
        "HTTP-Referer": "https://coithub.app",
        "X-Title": "Coithub",
      },
      body: JSON.stringify({ model: rawModel, messages }),
    });
    if (!resp.ok) await throwHttp("OpenRouter", resp);
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (provider === "groq") {
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workspaceKey}` },
      body: JSON.stringify({ model: rawModel, messages }),
    });
    if (!resp.ok) await throwHttp("Groq", resp);
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (provider === "chatgpt") {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${workspaceKey}` },
      body: JSON.stringify({ model: rawModel, messages }),
    });
    if (!resp.ok) await throwHttp("OpenAI", resp);
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  if (provider === "gemini") {
    // Google AI Studio direct — flatten to Gemini "contents" format.
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      rawModel,
    )}:generateContent?key=${encodeURIComponent(workspaceKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
      }),
    });
    if (!resp.ok) await throwHttp("Gemini", resp);
    const json = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return (
      json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? ""
    );
  }

  throw new Error(`Unknown provider: ${provider}`);
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

    // Fetch workspace API key for BYO providers via SECURITY DEFINER function
    let workspaceKey: string | null = null;
    if (provider !== "google" && provider !== "openai") {
      const { data: keyData } = await supabase.rpc("get_workspace_api_key" as never, {
        _workspace_id: workspaceId,
        _provider: provider,
      } as never);
      workspaceKey = (keyData as string | null) ?? null;
    }

    messages[0].content = `${systemPrompt}\n\nYou are ${petCfg.name}, replying inside #${channel.name}${
      channel.topic ? ` (${channel.topic})` : ""
    }. Stay fully in character. Address people by name. Do NOT prefix your reply with your own name — the UI shows it. Format the reply in Markdown (headings, lists, tables, fenced code) so it renders cleanly. Keep replies focused and useful.`;

    const reply = await callProvider(provider, model, messages, workspaceKey);
    if (!reply) throw new Error(`${petCfg.name} returned an empty reply.`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("messages")
      .insert({ channel_id: channelId, author_id: null, pet_id: pet, body: reply, parent_id: parentId ?? null })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    return { id: inserted.id, pet, body: reply };
  });
