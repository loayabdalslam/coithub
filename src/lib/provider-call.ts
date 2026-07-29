import type { ProviderId } from "./providers";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const throwHttp = async (label: string, resp: Response) => {
  const text = await resp.text().catch(() => "");
  if (resp.status === 429) throw new Error(`${label}: rate limited — try again in a moment.`);
  if (resp.status === 401 || resp.status === 403)
    throw new Error(`${label}: invalid or missing API key.`);
  if (resp.status === 402) throw new Error(`${label}: credits exhausted.`);
  throw new Error(`${label} error ${resp.status}: ${text.slice(0, 300)}`);
};

// Calls the AI provider selected in the frontend using the workspace's own API key.
// The Lovable AI Gateway is not used.
export async function callProvider(
  provider: ProviderId,
  model: string,
  messages: ChatMsg[],
  workspaceKey: string | null,
): Promise<string> {
  // Strip provider prefix — providers expect the raw model id.
  const rawModel = model.includes("/") ? model.split("/").slice(1).join("/") : model;

  if (!workspaceKey) {
    throw new Error(
      `No ${provider} API key configured for this workspace. An admin can add one in Settings → API Keys.`,
    );
  }

  // OpenAI-compatible providers (OpenAI, OpenRouter, Groq).
  const openaiCompatible: Partial<Record<ProviderId, { url: string; label: string; extraHeaders?: Record<string, string> }>> = {
    openai: { url: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
    chatgpt: { url: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
    groq: { url: "https://api.groq.com/openai/v1/chat/completions", label: "Groq" },
    openrouter: {
      url: "https://openrouter.ai/api/v1/chat/completions",
      label: "OpenRouter",
      extraHeaders: { "HTTP-Referer": "https://coithub.app", "X-Title": "Coithub" },
    },
  };

  const oa = openaiCompatible[provider];
  if (oa) {
    const resp = await fetch(oa.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workspaceKey}`,
        ...(oa.extraHeaders ?? {}),
      },
      body: JSON.stringify({ model: rawModel, messages }),
    });
    if (!resp.ok) await throwHttp(oa.label, resp);
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  // Google providers (Gemini direct via Google AI Studio key).
  if (provider === "google" || provider === "gemini") {
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
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}

export type CapturedTask = {
  title: string;
  description: string;
  priority: "Low" | "Medium" | "High";
  assignee: string | null; // agent slug (validated by caller) or null
  due_date: string | null; // YYYY-MM-DD or null
};

// Agents may emit ```task { ...json... }``` blocks to auto-capture actionable
// tasks. This pulls them out and returns the reply with the blocks removed.
export function extractCapturedTasks(text: string): { cleaned: string; tasks: CapturedTask[] } {
  const tasks: CapturedTask[] = [];
  const re = /```task\s*([\s\S]*?)```/g;
  const cleaned = text
    .replace(re, (_m, body: string) => {
      try {
        const j = JSON.parse(body.trim()) as Record<string, unknown>;
        const title = typeof j.title === "string" ? j.title.trim() : "";
        if (title) {
          const pri = j.priority;
          const dd = typeof j.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(j.due_date)
            ? j.due_date
            : null;
          tasks.push({
            title: title.slice(0, 300),
            description: typeof j.description === "string" ? j.description : "",
            priority: pri === "Low" || pri === "High" ? pri : "Medium",
            assignee: typeof j.assignee === "string" && j.assignee ? j.assignee : null,
            due_date: dd,
          });
        }
      } catch {
        /* ignore malformed blocks */
      }
      return "";
    })
    .trim();
  return { cleaned, tasks };
}

// ---------------------------------------------------------------------------
// Tool calling (OpenAI-compatible providers: OpenAI, Groq, OpenRouter)
// ---------------------------------------------------------------------------

export type ToolSpec = {
  type: "function";
  function: { name: string; description?: string; parameters: Record<string, unknown> };
};

type RawMsg = Record<string, unknown>;

export function supportsToolCalling(provider: ProviderId): boolean {
  return provider === "openai" || provider === "chatgpt" || provider === "groq" || provider === "openrouter";
}

const OA_ENDPOINTS: Partial<Record<ProviderId, { url: string; label: string; extraHeaders?: Record<string, string> }>> = {
  openai: { url: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
  chatgpt: { url: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
  groq: { url: "https://api.groq.com/openai/v1/chat/completions", label: "Groq" },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    label: "OpenRouter",
    extraHeaders: { "HTTP-Referer": "https://coithub.app", "X-Title": "Coithub" },
  },
};

/**
 * Runs a tool-calling loop against an OpenAI-compatible provider. Falls back to
 * a plain completion when the provider or tool list can't support tools.
 */
export async function callProviderWithTools(
  provider: ProviderId,
  model: string,
  messages: ChatMsg[],
  workspaceKey: string | null,
  tools: ToolSpec[],
  execute: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  maxSteps = 6,
): Promise<{ text: string; toolCalls: { name: string; ok: boolean }[] }> {
  if (tools.length === 0 || !supportsToolCalling(provider)) {
    const text = await callProvider(provider, model, messages, workspaceKey);
    return { text, toolCalls: [] };
  }
  if (!workspaceKey) {
    throw new Error(
      `No ${provider} API key configured for this workspace. An admin can add one in Settings → API Keys.`,
    );
  }

  const oa = OA_ENDPOINTS[provider]!;
  const rawModel = model.includes("/") ? model.split("/").slice(1).join("/") : model;
  const convo: RawMsg[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const used: { name: string; ok: boolean }[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const resp = await fetch(oa.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workspaceKey}`,
        ...(oa.extraHeaders ?? {}),
      },
      body: JSON.stringify({ model: rawModel, messages: convo, tools, tool_choice: "auto" }),
    });
    if (!resp.ok) await throwHttp(oa.label, resp);
    const json = (await resp.json()) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: { id: string; function: { name: string; arguments: string } }[];
        };
      }[];
    };
    const msg = json.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];
    if (calls.length === 0) {
      return { text: (msg?.content ?? "").trim(), toolCalls: used };
    }

    convo.push({ role: "assistant", content: msg?.content ?? "", tool_calls: calls });
    for (const c of calls) {
      let result: unknown;
      let ok = true;
      try {
        const args = c.function.arguments ? JSON.parse(c.function.arguments) : {};
        result = await execute(c.function.name, args as Record<string, unknown>);
      } catch (e) {
        ok = false;
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      used.push({ name: c.function.name, ok });
      convo.push({
        role: "tool",
        tool_call_id: c.id,
        content: JSON.stringify(result ?? null).slice(0, 8000),
      });
    }
  }

  return { text: "I ran out of tool steps before finishing. Here's what I gathered so far.", toolCalls: used };
}

// ---------------------------------------------------------------------------
// Unified memory capture — agents emit ```memory { ...json... } ``` blocks
// ---------------------------------------------------------------------------

export type CapturedMemory = {
  kind: string;
  subject: string;
  content: string;
  importance: number;
};

export function extractCapturedMemories(text: string): { cleaned: string; memories: CapturedMemory[] } {
  const memories: CapturedMemory[] = [];
  const re = /```memory\s*([\s\S]*?)```/g;
  const cleaned = text
    .replace(re, (_m, body: string) => {
      try {
        const j = JSON.parse(body.trim()) as Record<string, unknown>;
        const content = typeof j.content === "string" ? j.content.trim() : "";
        if (content) {
          const imp = Number(j.importance);
          memories.push({
            kind: typeof j.kind === "string" ? j.kind : "fact",
            subject: typeof j.subject === "string" ? j.subject.slice(0, 200) : "",
            content: content.slice(0, 2000),
            importance: Number.isFinite(imp) ? Math.min(5, Math.max(1, Math.round(imp))) : 3,
          });
        }
      } catch {
        /* ignore malformed blocks */
      }
      return "";
    })
    .trim();
  return { cleaned, memories };
}
